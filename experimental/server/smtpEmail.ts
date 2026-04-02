import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

/**
 * SMTP Email Service
 * Send emails via Gmail or Outlook SMTP
 */

interface EmailConfig {
  provider: 'gmail' | 'outlook';
  user: string;
  password: string;
}

interface EmailPayload {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

// Cached transporters
const transporters = new Map<string, Transporter>();

/**
 * Get SMTP configuration for provider
 */
function getSMTPConfig(provider: 'gmail' | 'outlook', user: string, password: string) {
  if (provider === 'gmail') {
    return {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // use STARTTLS
      auth: {
        user,
        pass: password,
      },
    };
  } else {
    // Outlook/Office365
    return {
      host: 'smtp.office365.com',
      port: 587,
      secure: false, // use STARTTLS
      auth: {
        user,
        pass: password,
      },
    };
  }
}

/**
 * Get or create email transporter
 */
function getTransporter(config: EmailConfig): Transporter {
  const key = `${config.provider}:${config.user}`;
  
  if (!transporters.has(key)) {
    const smtpConfig = getSMTPConfig(config.provider, config.user, config.password);
    const transporter = nodemailer.createTransporter(smtpConfig);
    transporters.set(key, transporter);
  }
  
  return transporters.get(key)!;
}

/**
 * Send email via SMTP
 */
export async function sendEmail(
  config: EmailConfig,
  payload: EmailPayload
): Promise<boolean> {
  try {
    const transporter = getTransporter(config);
    
    const info = await transporter.sendMail({
      from: `"LARO Platform" <${config.user}>`,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html || payload.text,
    });
    
    console.log(`[SMTP] Email sent: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('[SMTP] Failed to send email:', error);
    return false;
  }
}

/**
 * Verify SMTP connection
 */
export async function verifyEmailConfig(config: EmailConfig): Promise<boolean> {
  try {
    const transporter = getTransporter(config);
    await transporter.verify();
    console.log(`[SMTP] ${config.provider} connection verified for ${config.user}`);
    return true;
  } catch (error) {
    console.error(`[SMTP] Failed to verify ${config.provider} connection:`, error);
    return false;
  }
}

/**
 * Get email config from environment
 */
export function getEmailConfigFromEnv(): EmailConfig | null {
  const provider = process.env.EMAIL_PROVIDER as 'gmail' | 'outlook' | undefined;
  const user = process.env.EMAIL_USER;
  const password = process.env.EMAIL_PASSWORD;
  
  if (!provider || !user || !password) {
    console.warn('[SMTP] Email configuration not found in environment');
    return null;
  }
  
  return { provider, user, password };
}
