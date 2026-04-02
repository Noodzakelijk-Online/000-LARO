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

const PORT   = parseInt(process.env.PORT || '3000', 10);
const isDev  = process.env.NODE_ENV === 'development';

// ─── Express setup ────────────────────────────────────────────────────────────

const app        = express();
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
  const rendererPath = path.join(process.cwd(), 'dist', 'renderer');
  if (fs.existsSync(rendererPath)) {
    app.use(express.static(rendererPath));
    app.get('*', (req, res) => {
      if (!req.path.startsWith('/trpc') && !req.path.startsWith('/api')) {
        res.sendFile(path.join(rendererPath, 'index.html'));
      }
    });
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