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
import { registerOAuthRoutes } from './oauth';
import { initializeWebSocket } from './websocket';
import { compressionMiddleware } from './compression';
import { initializeCronJobs } from './cron-scheduler';
import { performHealthCheck } from './routers/health';

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

app.get('/api/health', async (_req, res) => {
  try {
    const status = await performHealthCheck();
    res.status(200).json(status);
  } catch {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  }
});

// ─── OAuth routes ─────────────────────────────────────────────────────────────

registerOAuthRoutes(app);

// Google OAuth callback
app.get('/api/oauth/google/callback', async (req, res) => {
  const { handleGoogleOAuthCallback } = await import('./googleOAuthCallback');
  await handleGoogleOAuthCallback(req, res);
});

// Slack OAuth callback
app.get('/api/oauth/slack/callback', async (req, res) => {
  const { handleSlackOAuthCallback } = await import('./slackOAuthCallback');
  await handleSlackOAuthCallback(req, res);
});

// Microsoft/Outlook OAuth callback
app.get('/api/oauth/outlook/callback', async (req, res) => {
  const { handleOutlookOAuthCallback } = await import('./emailOAuthCallbacks');
  await handleOutlookOAuthCallback(req, res);
});

// ─── Stripe webhook (raw body; optional — no-op locally without Stripe) ─────

app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    try {
      const { isStripeConfigured } = await import('./stripeSubscription');
      if (!isStripeConfigured()) {
        res.status(204).end();
        return;
      }
      const { handleStripeWebhook } = await import('./stripeWebhooks');
      await handleStripeWebhook(req, res);
    } catch (err) {
      console.error('[Stripe webhook]', err);
      res.status(500).json({ error: 'Webhook failed' });
    }
  }
);

// ─── Email response webhook ───────────────────────────────────────────────────

app.post('/api/email/webhook', async (req, res) => {
  try {
    const { handleEmailWebhook } = await import('./emailResponseWebhook');
    await handleEmailWebhook(req, res);
  } catch (err) {
    console.error('[Email webhook]', err);
    res.status(500).json({ error: 'Webhook failed' });
  }
});

// ─── tRPC ─────────────────────────────────────────────────────────────────────

app.use('/api/trpc', createExpressMiddleware({
  router: appRouter,
  createContext,
  onError: ({ path, error }) => {
    if (error.code !== 'UNAUTHORIZED') {
      console.error(`[tRPC /${path}]`, error.message);
    }
  },
}));

// ─── Serve built frontend in production ──────────────────────────────────────

const DIST = path.join(__dirname, '../../dist/renderer');

const API_ONLY_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>LARO API</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 42rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; color: #0f172a; }
    code { background: #f1f5f9; padding: 0.15rem 0.4rem; border-radius: 4px; }
    a { color: #2563eb; }
  </style>
</head>
<body>
  <h1>LARO server is running</h1>
  <p>This process is serving the <strong>API only</strong>. The web UI bundle (<code>dist/renderer</code>) is not in this image, so there is no app at <code>/</code>.</p>
  <ul>
    <li><strong>Local dev (full UI):</strong> run <code>npm run dev:renderer</code> (Vite, usually port <strong>5173</strong>) and keep the API on port 3000, or use <code>npm run dev:server</code> for API-only.</li>
    <li><strong>Docker with UI:</strong> build the renderer on your machine (<code>npm run build:renderer</code>), then extend the image to copy <code>dist/renderer</code> into <code>/app/dist/renderer</code> before starting the server.</li>
  </ul>
  <p><a href="/api/health">Open /api/health</a></p>
</body>
</html>`;

if (!isDev && fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      next();
      return;
    }
    res.sendFile(path.join(DIST, 'index.html'));
  });
} else if (!isDev) {
  app.get('*', (req, res, next) => {
    if (req.method !== "GET") {
      next();
      return;
    }
    if (
      req.path.startsWith("/api/") ||
      req.path.startsWith("/socket.io") ||
      req.path.startsWith("/.well-known/")
    ) {
      next();
      return;
    }
    res.type("html").send(API_ONLY_HTML);
  });
}

// ─── WebSocket ────────────────────────────────────────────────────────────────

initializeWebSocket(httpServer);

// ─── Start server ─────────────────────────────────────────────────────────────

httpServer.listen(PORT, () => {
  console.log(`\n🚀 LARO running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
  console.log(`   Mode:   ${process.env.NODE_ENV || 'production'}\n`);

  // Start scheduled jobs
  try {
    initializeCronJobs();
    console.log('[Cron] Scheduled jobs started');
  } catch (err) {
    console.warn('[Cron] Jobs failed to start:', err);
  }
});

process.on('SIGTERM', () => httpServer.close(() => process.exit(0)));
process.on('SIGINT',  () => httpServer.close(() => process.exit(0)));

export { app, httpServer };