import { router, publicProcedure } from './trpc';
import { ENV } from './env';

export const systemRouter = router({
  health: publicProcedure.query(() => ({
    status: 'ok',
    version: process.env.npm_package_version || '1.0.0',
    env: ENV.NODE_ENV,
    timestamp: new Date().toISOString(),
  })),

  // Phase 037 — app info the UI uses to show an unmistakable environment/demo
  // banner. `demoMode` is forced false in production so demo behaviour can never
  // be confused with real production.
  appInfo: publicProcedure.query(() => ({
    version: process.env.npm_package_version || '1.0.0',
    env: ENV.NODE_ENV,
    isProduction: ENV.isProd,
    demoMode: ENV.isDemo,
    // A ready-to-render label for a banner; empty in normal production.
    banner: ENV.isDemo
      ? 'DEMO MODE — sample environment, not for real cases'
      : ENV.isProd
        ? ''
        : `DEVELOPMENT (${ENV.NODE_ENV}) — not for production use`,
  })),
});
