import { app, BrowserWindow, ipcMain, dialog, shell, Menu } from 'electron';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { nanoid } from 'nanoid';
import { IPC_CHANNELS, Platform, ScanConfig, AgentConfig } from '../shared/types';
import { initDatabase as initAgentDb, closeDatabase as closeAgentDb, createScan, getScanFiles } from './database';
import { FileScanner } from './scanner';
import { FileUploader } from './uploader';
import { initAutoUpdater } from './autoUpdater';
import { startServer } from '../server/index';

const PORT = 3000;
const LARO_URL = `http://localhost:${PORT}`;
const isDev = process.env.NODE_ENV === 'development';

// ─── Error Handling ─────────────────────────────────────────────────────────

process.on('uncaughtException', (err) => {
  console.error('[Electron] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Electron] Unhandled Rejection:', reason);
});

let mainWindow: BrowserWindow | null = null;
let scanPanel: BrowserWindow | null = null;
let currentScanner: FileScanner | null = null;
let currentUploader: FileUploader | null = null;

let agentConfig: AgentConfig = {
  caseId: null,
  apiUrl: LARO_URL,
  token: null,
  deviceId: null,
  deviceName: os.hostname(),
  userId: null,
};

function getPlatform(): Platform {
  if (process.platform === 'win32') return 'windows';
  if (process.platform === 'darwin') return 'macos';
  return 'linux';
}

async function createMainWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'LARO Desktop',
    backgroundColor: '#0f172a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    scanPanel?.close();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }: { url: string }) => {
    if (url.startsWith(LARO_URL)) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  console.log(`[Electron] NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`[Electron] isDev: ${isDev}`);

  if (isDev) {
    const devUrl = 'http://localhost:5173';
    console.log(`[Electron] Attempting to load Vite Dev Server: ${devUrl}`);
    try {
      await mainWindow.loadURL(devUrl);
      console.log('[Electron] Vite Dev Server loaded successfully');
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    } catch (err) {
      console.error('[Electron] Failed to load Vite Dev Server. Is it running? Error:', err);
      // Fallback to production URL if Vite fails in dev
      await mainWindow.loadURL(LARO_URL);
    }
  } else {
    console.log(`[Electron] Loading Production URL: ${LARO_URL}`);
    try {
      await mainWindow.loadURL(LARO_URL);
    } catch (err) {
      console.error('[Electron] Failed to load Production URL. Did you run npm run build? Error:', err);
    }
    if (process.env.DEBUG) mainWindow.webContents.openDevTools();
  }
}

function createScanPanel(): void {
  if (scanPanel) {
    scanPanel.focus();
    return;
  }
  scanPanel = new BrowserWindow({
    width: 520,
    height: 700,
    minWidth: 480,
    title: 'LARO Evidence Scanner',
    backgroundColor: '#0f172a',
    parent: mainWindow ?? undefined,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (isDev) {
    scanPanel.loadURL('http://localhost:5173/?mode=scanner');
  } else {
    scanPanel.loadURL(`${LARO_URL}/?mode=scanner`);
  }
  scanPanel.on('closed', () => {
    scanPanel = null;
  });
}

function buildMenu(): void {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: 'LARO',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => mainWindow?.loadURL(LARO_URL) },
        { type: 'separator' },
        { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
      ],
    },
    {
      label: 'Evidence',
      submenu: [
        { label: 'Scan Local Files', accelerator: 'CmdOrCtrl+Shift+S', click: createScanPanel },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
  ]));
}

app.whenReady().then(async () => {
  // Initialize App Data Directory for SQLite
  const userDataPath = app.getPath('userData');
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }

  // Set database path for the server (better-sqlite3)
  const serverDbPath = path.join(userDataPath, 'laro-server.sqlite');
  process.env.DATABASE_URL = serverDbPath;
  console.log('[Electron] Server DB Path:', serverDbPath);

  // Initialize Agent DB (scanning state)
  initAgentDb();

  // Start the integrated backend server
  try {
    await startServer(PORT);
    console.log('[Electron] Integrated server started on port', PORT);
  } catch (err) {
    console.error('[Electron] Failed to start integrated server:', err);
    dialog.showErrorBox('Server Error', 'Failed to start the integrated backend server.');
    app.quit();
    return;
  }

  buildMenu();
  setupIPC();
  await createMainWindow();

  console.log('[Electron] Application ready and window created');

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  currentScanner?.stop();
  currentUploader?.stop();
  closeAgentDb();
});

function setupIPC(): void {
  ipcMain.handle(IPC_CHANNELS.CONFIG_GET, () => ({ ...agentConfig }));
  ipcMain.handle(IPC_CHANNELS.CONFIG_SET, (_: any, c: Partial<AgentConfig>) => {
    agentConfig = { ...agentConfig, ...c };
    return { ...agentConfig };
  });
  ipcMain.handle(IPC_CHANNELS.SYSTEM_INFO, () => ({
    platform: getPlatform(),
    arch: process.arch,
    hostname: os.hostname(),
    username: os.userInfo().username,
    homeDir: os.homedir(),
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    cpus: os.cpus().length,
    version: app.getVersion(),
  }));
  ipcMain.handle(IPC_CHANNELS.APP_VERSION, () => app.getVersion());
  ipcMain.handle(IPC_CHANNELS.OPEN_EXTERNAL, (_: any, url: string) => shell.openExternal(url));
  ipcMain.handle(IPC_CHANNELS.SCAN_OPEN_PANEL, () => createScanPanel());
  ipcMain.handle(IPC_CHANNELS.FOLDER_SELECT, async () => {
    const parent = scanPanel ?? mainWindow;
    if (!parent) return null;
    const result = await dialog.showOpenDialog(parent, {
      properties: ['openDirectory', 'multiSelections'],
      title: 'Select folders to scan',
    });
    return result.canceled ? null : result.filePaths;
  });
  ipcMain.handle(IPC_CHANNELS.UPDATE_CHECK, () => ({ currentVersion: app.getVersion(), updateAvailable: false }));
  
  ipcMain.handle(IPC_CHANNELS.SCAN_START, async (_: any, config: ScanConfig) => {
    if (currentScanner) throw new Error('Scan already in progress');
    const scanId = nanoid();
    createScan(scanId, config.caseId, config.caseName, config.autoUpload, config.excludedFolders);
    currentScanner = new FileScanner({ scanId, config, platform: getPlatform() });
    currentScanner.on('progress', (p) => scanPanel?.webContents.send(IPC_CHANNELS.SCAN_PROGRESS, p));
    currentScanner.on('completed', async (result) => {
      scanPanel?.webContents.send(IPC_CHANNELS.SCAN_PROGRESS, {
        scanId,
        status: config.autoUpload ? 'uploading' : 'review',
        ...result,
      });
      mainWindow?.webContents.executeJavaScript(
        `window.dispatchEvent(new CustomEvent('laro:evidence-updated',{detail:{scanId:'${scanId}'}}))`
      ).catch(() => {});
      if (config.autoUpload && agentConfig.token) await startUpload(scanId).catch(console.error);
      currentScanner = null;
    });
    currentScanner.on('cancelled', () => {
      scanPanel?.webContents.send(IPC_CHANNELS.SCAN_PROGRESS, { scanId, status: 'cancelled' });
      currentScanner = null;
    });
    currentScanner.on('error', (e: Error) => {
      scanPanel?.webContents.send(IPC_CHANNELS.SCAN_PROGRESS, { scanId, status: 'failed', errorMessage: e.message });
      currentScanner = null;
    });
    currentScanner.start().catch(console.error);
    return { scanId };
  });

  ipcMain.handle(IPC_CHANNELS.SCAN_STOP, () => { currentScanner?.stop(); return { success: true }; });
  ipcMain.handle(IPC_CHANNELS.SCAN_PAUSE, () => { currentScanner?.pause(); return { success: true }; });
  ipcMain.handle(IPC_CHANNELS.SCAN_RESUME, () => { currentScanner?.resume(); return { success: true }; });
  ipcMain.handle(IPC_CHANNELS.SCAN_FILES_GET, (_: any, id: string) => ({ files: getScanFiles(id) }));
  ipcMain.handle(IPC_CHANNELS.UPLOAD_START, (_: any, id: string) => startUpload(id));
  ipcMain.handle(IPC_CHANNELS.UPLOAD_PAUSE, () => { currentUploader?.pause(); return { success: true }; });
  ipcMain.handle(IPC_CHANNELS.UPLOAD_RESUME, () => { currentUploader?.resume(); return { success: true }; });
}

async function startUpload(scanId: string): Promise<{ success: boolean }> {
  if (currentUploader) throw new Error('Upload in progress');
  if (!agentConfig.token) throw new Error('Not authenticated');
  currentUploader = new FileUploader({
    scanId,
    apiUrl: agentConfig.apiUrl,
    token: agentConfig.token,
    concurrency: 3,
    maxRetries: 3,
  });
  currentUploader.on('progress', (p) => scanPanel?.webContents.send(IPC_CHANNELS.UPLOAD_PROGRESS, { scanId, ...p }));
  currentUploader.on('completed', (r) => {
    scanPanel?.webContents.send(IPC_CHANNELS.UPLOAD_PROGRESS, { scanId, done: true, ...r });
    mainWindow?.webContents.executeJavaScript(
      `window.dispatchEvent(new CustomEvent('laro:evidence-updated',{detail:{scanId:'${scanId}'}}))`
    ).catch(() => {});
    currentUploader = null;
  });
  currentUploader.on('cancelled', () => { currentUploader = null; });
  currentUploader.on('error', () => { currentUploader = null; });
  currentUploader.start().catch(console.error);
  return { success: true };
}
