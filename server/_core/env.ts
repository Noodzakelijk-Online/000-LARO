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

  // Forge (custom LLM endpoint)
  forgeApiUrl: process.env.FORGE_API_URL || '',
  forgeApiKey: process.env.FORGE_API_KEY || '',

  get ownerId() { return this.OWNER_ID; },
  get isDev()   { return this.NODE_ENV === 'development'; },
  get isProd()  { return this.NODE_ENV === 'production'; },
};
