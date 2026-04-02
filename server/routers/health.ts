import { publicProcedure, router } from '../_core/trpc';
import { z } from 'zod';

export const healthRouter = router({
  check: publicProcedure
    .query(() => {
      return {
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        nodeVersion: process.version,
        platform: process.platform,
      };
    }),
});
