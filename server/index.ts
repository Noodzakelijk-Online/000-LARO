/**
 * LARO Server — Express + tRPC entry point
 */

import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import path from 'path';
import fs from 'fs';
import cookieParser from 'cookie-parser';

import { appRouter } from './routers';
import { createContext } from './context';
import { compressionMiddleware } from './compression';
import { initCronScheduler } from './cronScheduler';
import oauth2CallbacksRouter from './oauth2Callbacks';
import { beginOAuthFlow } from './oauth2';

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

// ─── OAuth2 routes ────────────────────────────────────────────────────────────

// OAuth2 initiation endpoint (redirects to Google/Outlook)
app.get('/api/oauth/:provider/connect', (req, res) => {
  try {
    const { provider } = req.params;
    const userId = req.query.userId as string;
    
    if (!userId) {
      return res.status(400).json({ error: 'Missing userId parameter' });
    }
    
    if (provider !== 'gmail' && provider !== 'outlook') {
      return res.status(400).json({ error: 'Invalid provider. Use gmail or outlook' });
    }
    
    console.log(`[OAuth2] Initiating ${provider} connection for user ${userId}`);
    
    // Generate authorization URL and redirect
    const authUrl = beginOAuthFlow(provider as 'gmail' | 'outlook', userId);
    res.redirect(authUrl);
  } catch (error) {
    console.error('[OAuth2] Connect error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to initiate OAuth flow' 
    });
  }
});

// Mount OAuth2 callback routes
app.use(oauth2CallbacksRouter);

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

      // Initialize background cron jobs
      initCronScheduler();

      resolve();
    });
  });
}

// Start if run directly (though Electron usually calls startServer)
if (require.main === module) {
  startServer().catch(console.error);
}