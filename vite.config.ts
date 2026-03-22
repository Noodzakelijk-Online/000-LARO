import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/renderer'),
      'radix-ui': path.resolve(__dirname, './src/renderer/lib/radix-ui.ts'),
    },
  },

  // Must be './' so Electron can load the built index.html as a local file
  base: './',

  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
  },

  server: {
    // Must match the port in package.json dev script:
    // "wait-on http://localhost:5173 && npm run dev:main"
    port: 5173,
    strictPort: true,
  },
});