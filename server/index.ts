/**
 * LARO Server — Express + tRPC entry point
 */

import express from 'express';
import { createServer } from 'http';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import path from 'path';
import fs from 'fs';
import cookieParser from 'cookie-parser';

import { appRouter } from './routers';
import { createContext } from './context';
import { compressionMiddleware } from './compression';

// ─── Environment ──────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || '3000', 10);
const isDev = process.env.NODE_ENV === 'development';

// ─── Express setup ────────────────────────────────────────────────────────────

const app = express();
const httpServer = createServer(app);

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use((req, res, next) => {
  const origin = req.headers.origin || '';
  const allowed = [
    'http://localhost:3000',
    'http://localhost:5173',
    'app://.',
  ];
  if (allowed.includes(origin) || isDev) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,Cookie');
  }
  if (req.method === 'OPTIONS') { res.sendStatus(200); return; }
  next();
});

app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(compressionMiddleware);

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ─── tRPC middleware ──────────────────────────────────────────────────────────

app.use(
  '/api/trpc',
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

// ─── Static files (Production) ────────────────────────────────────────────────

if (!isDev) {
  // In a packaged Electron app, we need to find the renderer files relative to this file
  // dist/main/server/index.js -> dist/renderer
  const possiblePaths = [
    path.join(__dirname, '..', 'renderer'), // dist/server -> dist/renderer
    path.join(__dirname, '..', '..', 'renderer'), // just in case it's in dist/main/server
    path.join((process as any).resourcesPath || __dirname, 'app', 'dist', 'renderer'),
    path.join(process.cwd(), 'dist', 'renderer'),
    path.join(process.cwd(), 'resources', 'app', 'dist', 'renderer'),
  ];

  let rendererPath = '';
  for (const p of possiblePaths) {
    if (fs.existsSync(p) && fs.existsSync(path.join(p, 'index.html'))) {
      rendererPath = p;
      break;
    }
  }

  if (rendererPath) {
    console.log(`[Server] Serving static files from: ${rendererPath}`);
    app.use(express.static(rendererPath));
    app.get('*', (req, res) => {
      if (!req.path.startsWith('/trpc') && !req.path.startsWith('/api')) {
        res.sendFile(path.join(rendererPath, 'index.html'));
      }
    });
  } else {
    console.error(`[Server] Critical: Could not find renderer path in: ${possiblePaths.join(', ')}`);
  }
}

// ─── Lifecycle ──────────────────────────────────────────────────────────────

export async function startServer(port: number = PORT) {
  return new Promise<void>((resolve) => {
    httpServer.listen(port, () => {
      console.log(`[Server] Integrated backend listening on port ${port}`);
      resolve();
    });
  });
}

// Start if run directly (though Electron usually calls startServer)
if (require.main === module) {
  startServer().catch(console.error);
}