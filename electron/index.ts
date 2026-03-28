import { app, BrowserWindow, ipcMain, dialog, shell, Menu } from 'electron';
import path from 'path';
import os from 'os';
import { execSync, spawn, spawnSync } from 'child_process';
import { nanoid } from 'nanoid';
import { IPC_CHANNELS, Platform, ScanConfig, AgentConfig } from '../shared/types';
import { initDatabase, closeDatabase, createScan, getScanFiles } from './database';
import { FileScanner } from './scanner';
import { FileUploader } from './uploader';
import { initAutoUpdater } from './autoUpdater';

const LARO_URL   = 'http://localhost:3000';
const HEALTH_URL = 'http://localhost:3000/api/health';
const isDev      = process.env.NODE_ENV === 'development';
const isWindows  = process.platform === 'win32';

let mainWindow:      BrowserWindow | null = null;
let scanPanel:       BrowserWindow | null = null;
let currentScanner:  FileScanner   | null = null;
let currentUploader: FileUploader  | null = null;

let agentConfig: AgentConfig = {
  caseId: null, apiUrl: LARO_URL, token: null, deviceId: null,
  deviceName: os.hostname(), userId: null,
};

function getPlatform(): Platform {
  if (process.platform === 'win32') return 'windows';
  if (process.platform === 'darwin') return 'macos';
  return 'linux';
}

// ─── Docker path resolution ───────────────────────────────────────────────────
// On Windows, Docker Desktop may not be in the PATH that Electron sees.
// We try multiple known locations.

function findDockerPath(): string {
  if (!isWindows) return 'docker';

  const candidates = [
    'docker', // may already be in PATH
    'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe',
    `${process.env.ProgramFiles}\\Docker\\Docker\\resources\\bin\\docker.exe`,
    `${process.env.LOCALAPPDATA}\\Programs\\Docker\\Docker\\resources\\bin\\docker.exe`,
    `${os.homedir()}\\AppData\\Local\\Programs\\Docker\\Docker\\resources\\bin\\docker.exe`,
  ];

  for (const candidate of candidates) {
    try {
      const result = spawnSync(candidate, ['--version'], { timeout: 3000, stdio: 'pipe' });
      if (result.status === 0) {
        console.log('[Docker] Found docker at:', candidate);
        return candidate;
      }
    } catch {}
  }

  return 'docker'; // fallback
}

let _dockerPath: string | null = null;
function getDockerPath(): string {
  if (!_dockerPath) _dockerPath = findDockerPath();
  return _dockerPath;
}

function getComposePath(): string {
  if (app.isPackaged) return path.join(process.resourcesPath, 'docker-compose.yml');
  return path.join(app.getAppPath(), 'docker-compose.yml');
}

function isDockerRunning(): boolean {
  const docker = getDockerPath();
  const attempts = [
    // Try docker info
    () => { const r = spawnSync(docker, ['info'], { timeout: 8000, stdio: 'pipe' }); return r.status === 0; },
    // Try docker ps (lighter check)
    () => { const r = spawnSync(docker, ['ps'], { timeout: 5000, stdio: 'pipe' }); return r.status === 0; },
    // On Windows also try via PowerShell
    ...(isWindows ? [
      () => { const r = spawnSync('powershell', ['-Command', 'docker info'], { timeout: 8000, stdio: 'pipe' }); return r.status === 0; },
      () => { const r = spawnSync('cmd', ['/c', 'docker info'], { timeout: 8000, stdio: 'pipe' }); return r.status === 0; },
    ] : []),
  ];

  for (const attempt of attempts) {
    try { if (attempt()) return true; } catch {}
  }
  return false;
}

function startDockerServices(): void {
  const docker = getDockerPath();
  const composePath = getComposePath();
  console.log('[Docker] Starting with:', docker, 'compose:', composePath);

  // Use docker compose (v2) — try both forms
  const args = ['compose', '-f', composePath, 'up', '--build', '-d'];
  const p = spawn(docker, args, {
    stdio: 'pipe',
    // On Windows, run in shell to pick up PATH
    shell: isWindows,
  });
  p.stdout?.on('data', (d: Buffer) => console.log('[Docker]', d.toString().trim()));
  p.stderr?.on('data', (d: Buffer) => console.log('[Docker]', d.toString().trim()));
  p.on('error', (err) => console.error('[Docker] spawn error:', err));
  p.on('exit', (code) => console.log('[Docker] startup exit:', code));
}

function stopDockerServices(): void {
  try {
    const docker = getDockerPath();
    spawnSync(docker, ['compose', '-f', getComposePath(), 'down'], {
      stdio: 'ignore', timeout: 15000, shell: isWindows,
    });
  } catch {}
}

async function waitForServer(max = 40, ms = 3000): Promise<boolean> {
  for (let i = 0; i < max; i++) {
    try {
      const r = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(2000) });
      if (r.ok) { console.log('[Server] Ready!'); return true; }
    } catch {}
    console.log(`[Server] Waiting... (${i + 1}/${max})`);
    mainWindow?.webContents.executeJavaScript(
      `document.getElementById('laro-status')&&(document.getElementById('laro-status').textContent='Starting services... (${i+1}/${max})')`
    ).catch(() => {});
    await new Promise(r => setTimeout(r, ms));
  }
  return false;
}

const LOADING_HTML = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0f172a;color:white;font-family:system-ui;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:16px}.icon{width:72px;height:72px;background:#2563eb;border-radius:18px;display:flex;align-items:center;justify-content:center;font-size:36px}h1{font-size:26px;font-weight:700}#laro-status{font-size:14px;color:#94a3b8;text-align:center;max-width:300px}.bar{width:220px;height:3px;background:#1e293b;border-radius:2px;overflow:hidden;margin-top:8px}.fill{height:100%;background:#2563eb;width:50%;animation:p 1.4s ease-in-out infinite}@keyframes p{0%,100%{opacity:.4}50%{opacity:1}}</style>
</head><body><div class="icon">⚖️</div><h1>LARO Desktop</h1><p id="laro-status">Starting services...</p><div class="bar"><div class="fill"></div></div></body></html>`;

async function createMainWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1024, minHeight: 700,
    title: 'LARO Desktop', backgroundColor: '#0f172a',
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  mainWindow.on('closed', () => { mainWindow = null; scanPanel?.close(); });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(LARO_URL)) return { action: 'allow' };
    shell.openExternal(url); return { action: 'deny' };
  });

  if (isDev) {
    await mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    return;
  }

  await mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(LOADING_HTML)}`);

  const setStatus = (msg: string) => {
    console.log('[Status]', msg);
    mainWindow?.webContents.executeJavaScript(
      `document.getElementById('laro-status')&&(document.getElementById('laro-status').textContent=${JSON.stringify(msg)})`
    ).catch(() => {});
  };

  // Step 1: Check if server is already running (Docker already up)
  setStatus('Checking if LARO is already running...');
  if (await waitForServer(3, 1000)) {
    await mainWindow.loadURL(LARO_URL);
    initAutoUpdater(mainWindow);
    return;
  }

  // Step 2: Check Docker is accessible
  setStatus('Locating Docker...');
  const dockerOk = isDockerRunning();
  console.log('[Docker] isRunning:', dockerOk);

  if (!dockerOk) {
    // On Windows, give more helpful guidance
    const detail = isWindows
      ? 'Docker Desktop is installed but LARO cannot reach it.\n\nPlease try:\n1. Make sure Docker Desktop is fully started (check the system tray icon)\n2. Restart Docker Desktop\n3. Restart LARO Desktop'
      : 'LARO requires Docker Desktop to run. Please start Docker Desktop and reopen LARO.';

    const { response } = await dialog.showMessageBox(mainWindow!, {
      type: 'warning',
      title: 'Docker Not Responding',
      message: 'Cannot connect to Docker Desktop',
      detail,
      buttons: isWindows
        ? ['Try Anyway', 'Open Docker Website', 'Quit']
        : ['Open Docker Website', 'Quit'],
    });

    if (isWindows && response === 0) {
      // User wants to try anyway — continue with startup
    } else if ((!isWindows && response === 0) || (isWindows && response === 1)) {
      shell.openExternal('https://www.docker.com/products/docker-desktop/');
      app.quit(); return;
    } else {
      app.quit(); return;
    }
  }

  // Step 3: Start Docker services
  setStatus('Starting LARO database and server...');
  startDockerServices();

  // Step 4: Wait for server
  setStatus('Waiting for services... (first run takes ~1 minute)');
  const ready = await waitForServer(40, 3000);

  if (!ready) {
    const { response } = await dialog.showMessageBox(mainWindow!, {
      type: 'error',
      title: 'Startup Timeout',
      message: 'LARO services did not start in time',
      detail: 'Docker may still be starting up. Try opening LARO again in a minute.',
      buttons: ['Try Again', 'Quit'],
    });
    if (response === 0) { await createMainWindow(); return; }
    app.quit(); return;
  }

  await mainWindow.loadURL(LARO_URL);
  initAutoUpdater(mainWindow);
}

function createScanPanel(): void {
  if (scanPanel) { scanPanel.focus(); return; }
  scanPanel = new BrowserWindow({
    width: 520, height: 700, minWidth: 480, title: 'LARO Evidence Scanner',
    backgroundColor: '#0f172a', parent: mainWindow ?? undefined,
    webPreferences: { nodeIntegration: false, contextIsolation: true, preload: path.join(__dirname, 'preload.js') },
  });
  isDev ? scanPanel.loadURL('http://localhost:5173') :
    scanPanel.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
  scanPanel.on('closed', () => { scanPanel = null; });
}

function buildMenu(): void {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'LARO', submenu: [
      { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => mainWindow?.loadURL(LARO_URL) },
      { type: 'separator' },
      { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
    ]},
    { label: 'Evidence', submenu: [
      { label: 'Scan Local Files', accelerator: 'CmdOrCtrl+Shift+S', click: createScanPanel },
    ]},
    { label: 'View', submenu: [
      { role: 'toggleDevTools' }, { type: 'separator' },
      { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
      { type: 'separator' }, { role: 'togglefullscreen' },
    ]},
  ]));
}

app.whenReady().then(async () => {
  initDatabase(); buildMenu(); setupIPC(); await createMainWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createMainWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => {
  currentScanner?.stop(); currentUploader?.stop(); closeDatabase();
  if (!isDev) stopDockerServices();
});

function setupIPC(): void {
  ipcMain.handle(IPC_CHANNELS.CONFIG_GET, () => ({ ...agentConfig }));
  ipcMain.handle(IPC_CHANNELS.CONFIG_SET, (_, c: Partial<AgentConfig>) => { agentConfig = { ...agentConfig, ...c }; return { ...agentConfig }; });
  ipcMain.handle(IPC_CHANNELS.SYSTEM_INFO, () => ({ platform: getPlatform(), arch: process.arch, hostname: os.hostname(), username: os.userInfo().username, homeDir: os.homedir(), totalMemory: os.totalmem(), freeMemory: os.freemem(), cpus: os.cpus().length, version: app.getVersion() }));
  ipcMain.handle(IPC_CHANNELS.APP_VERSION, () => app.getVersion());
  ipcMain.handle(IPC_CHANNELS.OPEN_EXTERNAL, (_, url: string) => shell.openExternal(url));
  ipcMain.handle('scan:open-panel', () => createScanPanel());
  ipcMain.handle(IPC_CHANNELS.FOLDER_SELECT, async () => {
    const parent = scanPanel ?? mainWindow;
    if (!parent) return null;
    const result = await dialog.showOpenDialog(parent, { properties: ['openDirectory', 'multiSelections'], title: 'Select folders to scan' });
    return result.canceled ? null : result.filePaths;
  });
  ipcMain.handle(IPC_CHANNELS.UPDATE_CHECK, () => ({ currentVersion: app.getVersion(), updateAvailable: false }));
  ipcMain.handle(IPC_CHANNELS.SCAN_START, async (_, config: ScanConfig) => {
    if (currentScanner) throw new Error('Scan already in progress');
    const scanId = nanoid();
    createScan(scanId, config.caseId, config.caseName, config.autoUpload, config.excludedFolders);
    currentScanner = new FileScanner({ scanId, config, platform: getPlatform() });
    currentScanner.on('progress', (p) => scanPanel?.webContents.send(IPC_CHANNELS.SCAN_PROGRESS, p));
    currentScanner.on('completed', async (result) => {
      scanPanel?.webContents.send(IPC_CHANNELS.SCAN_PROGRESS, { scanId, status: config.autoUpload ? 'uploading' : 'review', ...result });
      mainWindow?.webContents.executeJavaScript(`window.dispatchEvent(new CustomEvent('laro:evidence-updated',{detail:{scanId:'${scanId}'}}))`).catch(() => {});
      if (config.autoUpload && agentConfig.token) await startUpload(scanId).catch(console.error);
      currentScanner = null;
    });
    currentScanner.on('cancelled', () => { scanPanel?.webContents.send(IPC_CHANNELS.SCAN_PROGRESS, { scanId, status: 'cancelled' }); currentScanner = null; });
    currentScanner.on('error', (e: Error) => { scanPanel?.webContents.send(IPC_CHANNELS.SCAN_PROGRESS, { scanId, status: 'failed', errorMessage: e.message }); currentScanner = null; });
    currentScanner.start().catch(console.error);
    return { scanId };
  });
  ipcMain.handle(IPC_CHANNELS.SCAN_STOP,      () => { currentScanner?.stop();   return { success: true }; });
  ipcMain.handle(IPC_CHANNELS.SCAN_PAUSE,     () => { currentScanner?.pause();  return { success: true }; });
  ipcMain.handle(IPC_CHANNELS.SCAN_RESUME,    () => { currentScanner?.resume(); return { success: true }; });
  ipcMain.handle(IPC_CHANNELS.SCAN_FILES_GET, (_, id: string) => ({ files: getScanFiles(id) }));
  ipcMain.handle(IPC_CHANNELS.UPLOAD_START,   (_, id: string) => startUpload(id));
  ipcMain.handle(IPC_CHANNELS.UPLOAD_PAUSE,   () => { currentUploader?.pause();  return { success: true }; });
  ipcMain.handle(IPC_CHANNELS.UPLOAD_RESUME,  () => { currentUploader?.resume(); return { success: true }; });
}

async function startUpload(scanId: string): Promise<{ success: boolean }> {
  if (currentUploader) throw new Error('Upload in progress');
  if (!agentConfig.token) throw new Error('Not authenticated');
  currentUploader = new FileUploader({ scanId, apiUrl: agentConfig.apiUrl, token: agentConfig.token, concurrency: 3, maxRetries: 3 });
  currentUploader.on('progress', (p) => scanPanel?.webContents.send(IPC_CHANNELS.UPLOAD_PROGRESS, { scanId, ...p }));
  currentUploader.on('completed', (r) => { scanPanel?.webContents.send(IPC_CHANNELS.UPLOAD_PROGRESS, { scanId, done: true, ...r }); mainWindow?.webContents.executeJavaScript(`window.dispatchEvent(new CustomEvent('laro:evidence-updated',{detail:{scanId:'${scanId}'}}))`).catch(() => {}); currentUploader = null; });
  currentUploader.on('cancelled', () => { currentUploader = null; });
  currentUploader.on('error',     () => { currentUploader = null; });
  currentUploader.start().catch(console.error);
  return { success: true };
}