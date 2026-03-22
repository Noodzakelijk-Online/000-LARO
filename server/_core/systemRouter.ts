import { router, publicProcedure } from './trpc';
import { ENV } from './env';

export const systemRouter = router({
  health: publicProcedure.query(() => ({
    status: 'ok',
    version: process.env.npm_package_version || '1.0.0',
    env: ENV.NODE_ENV,
    timestamp: new Date().toISOString(),
  })),
});
