const fs = require('fs');

const files = [
  'src/renderer/pages/AuthPage.tsx',
  'src/renderer/pages/HomePage.tsx',
  'src/renderer/pages/ScanPage.tsx',
  'src/renderer/pages/SettingsPage.tsx',
];

files.forEach(f => {
  if (!fs.existsSync(f)) { console.log('skipped (not found):', f); return; }
  let c = fs.readFileSync(f, 'utf8');
  c = c.replace(/from ['"]lib\/electronApiShim['"]/g, 'from "@/lib/electronApiShim"');
  c = c.replace(/from ['"]\.\/?lib\/electronApiShim['"]/g, 'from "@/lib/electronApiShim"');
  fs.writeFileSync(f, c);
  console.log('patched:', f);
});

console.log('Done');
