const fs = require('fs');

// Fix App.tsx — add shim import if missing
let app = fs.readFileSync('src/renderer/App.tsx', 'utf8');
if (!app.includes('electronApiShim')) {
  app = 'import { getElectronAPI } from "@/lib/electronApiShim";\n' + app;
  fs.writeFileSync('src/renderer/App.tsx', app);
  console.log('patched: App.tsx — added shim import');
} else {
  console.log('skipped: App.tsx already has shim import');
}

// Fix preload.ts — remove the ../shared/types import, inline the channel names
let preload = fs.readFileSync('electron/preload.ts', 'utf8');
if (preload.includes('../shared/types')) {
  // Replace the import with inline IPC_CHANNELS constant
  preload = preload.replace(
    /import\s*\{[^}]*\}\s*from\s*['"]\.\.\/shared\/types['"];?\n?/g,
    `const IPC_CHANNELS = {
  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',
  SYSTEM_INFO: 'system:info',
  APP_VERSION: 'app:version',
  FOLDER_SELECT: 'folder:select',
  SCAN_START: 'scan:start',
  SCAN_STOP: 'scan:stop',
  SCAN_PAUSE: 'scan:pause',
  SCAN_RESUME: 'scan:resume',
  SCAN_PROGRESS: 'scan:progress',
  SCAN_FILES_GET: 'scan:files:get',
  UPLOAD_START: 'upload:start',
  UPLOAD_PAUSE: 'upload:pause',
  UPLOAD_RESUME: 'upload:resume',
  UPLOAD_PROGRESS: 'upload:progress',
  UPDATE_CHECK: 'update:check',
  OPEN_EXTERNAL: 'open:external',
};\n`
  );
  fs.writeFileSync('electron/preload.ts', preload);
  console.log('patched: electron/preload.ts — inlined IPC_CHANNELS');
} else {
  console.log('skipped: preload.ts already fixed');
}

console.log('All done — run: npm run dev');
