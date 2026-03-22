import { initTRPC, TRPCError } from "@trpc/server";
import superjson from 'superjson';
import type { TrpcContext } from '../context';

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router          = t.router;
export const publicProcedure = t.procedure;
export const middleware       = t.middleware;
export const mergeRouters     = t.mergeRouters;

// Protected procedure — requires authenticated user
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  return next({ ctx });
});
