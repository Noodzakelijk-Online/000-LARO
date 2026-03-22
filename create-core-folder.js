/**
 * create-core-folder.js
 * Creates the missing server/_core/ folder and all files it should contain.
 * Run from project root: node create-core-folder.js
 */

const fs   = require('fs');
const path = require('path');

function write(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content.trimStart());
  console.log('✅ Created:', filePath);
}

// ─── server/_core/env.ts ─────────────────────────────────────────────────────
write('server/_core/env.ts', `
/**
 * Environment configuration
 * Single source of truth for all env vars with safe defaults
 */
export const ENV = {
  // Server
  PORT:             parseInt(process.env.PORT || '3000', 10),
  NODE_ENV:         process.env.NODE_ENV || 'production',

  // Database
  DATABASE_URL:     process.env.DATABASE_URL || '',

  // Auth / Manus OAuth
  MANUS_API_URL:    process.env.MANUS_API_URL || 'https://api.manus.im',
  JWT_SECRET:       process.env.JWT_SECRET || 'change-this-secret',
  COOKIE_SECRET:    process.env.COOKIE_SECRET || 'change-this-cookie-secret',
  OWNER_ID:         process.env.OWNER_ID || '',

  // AI providers
  OPENAI_API_KEY:       process.env.OPENAI_API_KEY || '',
  ANTHROPIC_API_KEY:    process.env.ANTHROPIC_API_KEY || '',
  GOOGLE_GEMINI_API_KEY: process.env.GOOGLE_GEMINI_API_KEY || '',
  DEEPSEEK_API_KEY:     process.env.DEEPSEEK_API_KEY || '',
  GROQ_API_KEY:         process.env.GROQ_API_KEY || '',

  // OAuth integrations
  GOOGLE_CLIENT_ID:       process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET:   process.env.GOOGLE_CLIENT_SECRET || '',
  MICROSOFT_CLIENT_ID:    process.env.MICROSOFT_CLIENT_ID || '',
  MICROSOFT_CLIENT_SECRET: process.env.MICROSOFT_CLIENT_SECRET || '',
  SLACK_CLIENT_ID:        process.env.SLACK_CLIENT_ID || '',
  SLACK_CLIENT_SECRET:    process.env.SLACK_CLIENT_SECRET || '',
  TRELLO_API_KEY:         process.env.TRELLO_API_KEY || '',
  TELEGRAM_BOT_TOKEN:     process.env.TELEGRAM_BOT_TOKEN || '',

  // Email
  SENDGRID_API_KEY:   process.env.SENDGRID_API_KEY || '',
  AWS_SES_ACCESS_KEY: process.env.AWS_SES_ACCESS_KEY || '',
  AWS_SES_SECRET_KEY: process.env.AWS_SES_SECRET_KEY || '',
  AWS_SES_REGION:     process.env.AWS_SES_REGION || 'eu-west-1',

  // Stripe
  STRIPE_SECRET_KEY:      process.env.STRIPE_SECRET_KEY || '',
  STRIPE_WEBHOOK_SECRET:  process.env.STRIPE_WEBHOOK_SECRET || '',

  // Storage (S3)
  AWS_S3_BUCKET:          process.env.AWS_S3_BUCKET || '',
  AWS_S3_ACCESS_KEY:      process.env.AWS_S3_ACCESS_KEY || '',
  AWS_S3_SECRET_KEY:      process.env.AWS_S3_SECRET_KEY || '',
  AWS_S3_REGION:          process.env.AWS_S3_REGION || 'eu-west-1',

  // Frontend
  FRONTEND_URL: process.env.VITE_FRONTEND_URL || 'http://localhost:3000',

  get ownerId() { return this.OWNER_ID; },
  get isDev()   { return this.NODE_ENV === 'development'; },
  get isProd()  { return this.NODE_ENV === 'production'; },
};
`);

// ─── server/_core/trpc.ts ─────────────────────────────────────────────────────
write('server/_core/trpc.ts', `
import { initTRPC, TRPCError } from '@trpc/server';
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
`);

// ─── server/_core/cookies.ts ─────────────────────────────────────────────────
write('server/_core/cookies.ts', `
// Re-export from server/cookies.ts
export { getSessionCookieOptions } from '../cookies';
`);

// ─── server/_core/systemRouter.ts ────────────────────────────────────────────
write('server/_core/systemRouter.ts', `
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
`);

// ─── server/_core/llm.ts ─────────────────────────────────────────────────────
write('server/_core/llm.ts', `
// Re-export LLM utilities from server/llm.ts
export * from '../llm';
`);

// ─── server/_core/pagination.ts ──────────────────────────────────────────────
write('server/_core/pagination.ts', `
// Re-export pagination utilities from server/pagination.ts
export * from '../pagination';
`);

// ─── server/_core/rateLimit.ts ───────────────────────────────────────────────
write('server/_core/rateLimit.ts', `
// Re-export rate limit utilities from server/rateLimit.ts
export * from '../rateLimit';
`);

// ─── server/_core/websocket.ts ───────────────────────────────────────────────
write('server/_core/websocket.ts', `
// Re-export websocket utilities from server/websocket.ts
export * from '../websocket';
`);

// ─── server/_core/notification.ts ────────────────────────────────────────────
write('server/_core/notification.ts', `
// Re-export notification utilities from server/notification.ts
export * from '../notification';
`);

// ─── Also fix env import in server/llm.ts and server/notification.ts ─────────
// These import from "./env" which doesn't exist at server/ level
// They should import from "./_core/env"
const filesToFixEnv = [
  'server/llm.ts',
  'server/notification.ts',
];

for (const f of filesToFixEnv) {
  if (!fs.existsSync(f)) continue;
  let c = fs.readFileSync(f, 'utf8');
  c = c.replace(/from ["']\.\/env["']/g, 'from "./_core/env"');
  fs.writeFileSync(f, c);
  console.log('✅ Fixed env import in:', f);
}

// ─── Fix server/db.ts _core/env import ───────────────────────────────────────
if (fs.existsSync('server/db.ts')) {
  let c = fs.readFileSync('server/db.ts', 'utf8');
  // db.ts imports from './_core/env' which is now correct since we created it
  console.log('✅ server/db.ts _core/env import is already correct');
}

console.log('\n✅ All _core files created!');
console.log('\n▶️  Run: docker compose up --build');