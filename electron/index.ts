/**
 * Electron main process
 * Entry point for the LARO Evidence Collection Agent
 */

import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import os from 'os';
import { nanoid } from 'nanoid';
import { IPC_CHANNELS, Platform, ScanConfig, AgentConfig } from '../shared/types';
import { initDatabase, closeDatabase, createScan, getScan, getScanFiles } from './database';
import { FileScanner } from './scanner';
import { FileUploader } from './uploader';
import { initAutoUpdater } from './autoUpdater';

// Keep a global reference of the window object
let mainWindow: BrowserWindow | null = null;
let currentScanner: FileScanner | null = null;
let currentUploader: FileUploader | null = null;

// Agent configuration
let agentConfig: AgentConfig = {
  apiUrl: 'https://3000-igg5m4mdwe2agq93mhzko-26878163.manusvm.computer',
  token: null,
  deviceId: null,
  deviceName: os.hostname(),
  userId: null,
  caseId: null,
};

/**
 * Get platform
 */
function getPlatform(): Platform {
  const platform = process.platform;
  if (platform === 'win32') return 'windows';
  if (platform === 'darwin') return 'macos';
  return 'linux';
}

/**
 * Create the main window
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    title: 'LARO Evidence Collection Agent',
  });

  // Load the app
  console.log("[DEBUG] NODE_ENV =", process.env.NODE_ENV);
  if (process.env.NODE_ENV === 'development') {
    // Full LARO dashboard from this repo (run `npm run dev:renderer` + API on :3000).
    // Deployed reference UI: https://lawyerdashboard.manus.space
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // __dirname = dist/main/electron → renderer bundle is dist/renderer
    mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Initialize auto-updater (production only)
  if (process.env.NODE_ENV !== 'development') {
    initAutoUpdater(mainWindow);
  }
}

/**
 * App ready
 */
app.whenReady().then(() => {
  initDatabase();
  createWindow();
  setupIPC();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

/**
 * Quit when all windows are closed
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/**
 * Before quit
 */
app.on('before-quit', () => {
  // Stop any active scanning/uploading
  if (currentScanner) {
    currentScanner.stop();
  }
  if (currentUploader) {
    currentUploader.stop();
  }
  
  closeDatabase();
});

/**
 * Setup IPC handlers
 */
function setupIPC(): void {
  // Configuration
  ipcMain.handle(IPC_CHANNELS.CONFIG_GET, () => {
    return agentConfig;
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_SET, (_, config: Partial<AgentConfig>) => {
    agentConfig = { ...agentConfig, ...config };
    return agentConfig;
  });

  // System info
  ipcMain.handle(IPC_CHANNELS.SYSTEM_INFO, () => {
    return {
      platform: getPlatform(),
      hostname: os.hostname(),
      username: os.userInfo().username,
      homeDir: os.homedir(),
    };
  });

  // App version
  ipcMain.handle(IPC_CHANNELS.APP_VERSION, () => {
    return app.getVersion();
  });

  // Folder selection
  ipcMain.handle(IPC_CHANNELS.FOLDER_SELECT, async () => {
    if (!mainWindow) return null;

    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });

    if (result.canceled) {
      return null;
    }

    return result.filePaths[0];
  });

  // Start scan
  ipcMain.handle(IPC_CHANNELS.SCAN_START, async (_, config: ScanConfig) => {
    if (currentScanner) {
      throw new Error('A scan is already in progress');
    }

    const scanId = nanoid();
    const platform = getPlatform();

    // Create scan in database
    createScan(scanId, config.caseId, config.caseName, config.autoUpload, config.excludedFolders);

    // Create scanner
    currentScanner = new FileScanner({
      scanId,
      config,
      platform,
    });

    // Setup event listeners
    currentScanner.on('progress', (progress) => {
      mainWindow?.webContents.send(IPC_CHANNELS.SCAN_PROGRESS, progress);
    });

    currentScanner.on('completed', async (result) => {
      mainWindow?.webContents.send(IPC_CHANNELS.SCAN_PROGRESS, {
        scanId,
        status: config.autoUpload ? 'uploading' : 'review',
        ...result,
      });

      // If auto-upload is enabled, start uploading
      if (config.autoUpload && agentConfig.token) {
        try {
          await startUpload(scanId);
        } catch (error: any) {
          console.error('[Main] Failed to start auto-upload:', error);
        }
      }

      currentScanner = null;
    });

    currentScanner.on('cancelled', () => {
      mainWindow?.webContents.send(IPC_CHANNELS.SCAN_PROGRESS, {
        scanId,
        status: 'cancelled',
      });
      currentScanner = null;
    });

    currentScanner.on('error', (error) => {
      mainWindow?.webContents.send(IPC_CHANNELS.SCAN_PROGRESS, {
        scanId,
        status: 'failed',
        errorMessage: error.message,
      });
      currentScanner = null;
    });

    // Start scanning
    currentScanner.start().catch((error) => {
      console.error('[Main] Scanner error:', error);
    });

    return { scanId };
  });

  // Stop scan
  ipcMain.handle(IPC_CHANNELS.SCAN_STOP, () => {
    if (currentScanner) {
      currentScanner.stop();
    }
    return { success: true };
  });

  // Pause scan
  ipcMain.handle(IPC_CHANNELS.SCAN_PAUSE, () => {
    if (currentScanner) {
      currentScanner.pause();
    }
    return { success: true };
  });

  // Resume scan
  ipcMain.handle(IPC_CHANNELS.SCAN_RESUME, () => {
    if (currentScanner) {
      currentScanner.resume();
    }
    return { success: true };
  });

  // Get scan files
  ipcMain.handle(IPC_CHANNELS.SCAN_FILES_GET, (_, scanId: string) => {
    const files = getScanFiles(scanId);
    return { files };
  });

  // Start upload
  ipcMain.handle(IPC_CHANNELS.UPLOAD_START, async (_, scanId: string) => {
    return startUpload(scanId);
  });

  // Pause upload
  ipcMain.handle(IPC_CHANNELS.UPLOAD_PAUSE, () => {
    if (currentUploader) {
      currentUploader.pause();
    }
    return { success: true };
  });

  // Resume upload
  ipcMain.handle(IPC_CHANNELS.UPLOAD_RESUME, () => {
    if (currentUploader) {
      currentUploader.resume();
    }
    return { success: true };
  });
}

/**
 * Start uploading files
 */
async function startUpload(scanId: string): Promise<{ success: boolean }> {
  if (currentUploader) {
    throw new Error('An upload is already in progress');
  }

  if (!agentConfig.token) {
    throw new Error('Not authenticated');
  }

  // Create uploader
  currentUploader = new FileUploader({
    scanId,
    apiUrl: agentConfig.apiUrl,
    token: agentConfig.token,
    concurrency: 3,
    maxRetries: 3,
  });

  // Setup event listeners
  currentUploader.on('progress', (progress) => {
    mainWindow?.webContents.send(IPC_CHANNELS.SCAN_PROGRESS, {
      scanId,
      status: 'uploading',
      ...progress,
    });
  });

  currentUploader.on('completed', (result) => {
    mainWindow?.webContents.send(IPC_CHANNELS.SCAN_PROGRESS, {
      scanId,
      status: 'completed',
      ...result,
    });
    currentUploader = null;
  });

  currentUploader.on('cancelled', () => {
    mainWindow?.webContents.send(IPC_CHANNELS.SCAN_PROGRESS, {
      scanId,
      status: 'cancelled',
    });
    currentUploader = null;
  });

  currentUploader.on('error', (error) => {
    mainWindow?.webContents.send(IPC_CHANNELS.SCAN_PROGRESS, {
      scanId,
      status: 'failed',
      errorMessage: error.message,
    });
    currentUploader = null;
  });

  // Start uploading
  currentUploader.start().catch((error) => {
    console.error('[Main] Uploader error:', error);
  });

  return { success: true };
}
