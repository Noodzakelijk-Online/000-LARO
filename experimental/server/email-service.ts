/**
 * Email Service
 * 
 * Handles sending emails through SMTP.
 */

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send email using SMTP
 * 
 * Configuration via environment variables:
 * - EMAIL_PROVIDER: 'smtp' | 'console' (default: 'console')
 * - EMAIL_FROM: Default sender email address
 * - SMTP_HOST: SMTP server hostname
 * - SMTP_PORT: SMTP server port (default: 587)
 * - SMTP_USER: SMTP username
 * - SMTP_PASS: SMTP password
 * - SMTP_SECURE: Use TLS (true for port 465, false for 587)
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  const provider = process.env.EMAIL_PROVIDER || 'console';
  const defaultFrom = process.env.EMAIL_FROM || 'noreply@laro.nl';
  
  const emailOptions = {
    ...options,
    from: options.from || defaultFrom,
    text: options.text || stripHtml(options.html),
  };
  
  try {
    switch (provider) {
      case 'smtp':
        return await sendViaSMTP(emailOptions);
      case 'console':
      default:
        return await logToConsole(emailOptions);
    }
  } catch (error) {
    console.error('[Email Service] Error sending email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * SMTP implementation (using nodemailer)
 */
async function sendViaSMTP(options: EmailOptions): Promise<EmailResult> {
  try {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587');
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const secure = process.env.SMTP_SECURE === 'true'; // true for 465, false for other ports
    
    if (!host || !user || !pass) {
      throw new Error('SMTP configuration incomplete. Please set SMTP_HOST, SMTP_USER, and SMTP_PASS.');
    }
    
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.default.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });
    
    const info = await transporter.sendMail({
      from: options.from!,
      to: options.to,
      subject: options.subject,
      text: options.text!,
      html: options.html,
      replyTo: options.replyTo,
    });
    
    console.log('[Email Service] SMTP email sent successfully:', info.messageId);
    
    return { 
      success: true, 
      messageId: info.messageId 
    };
  } catch (error) {
    console.error('[Email Service] SMTP error:', error);
    throw error;
  }
}

/**
 * Console logger (for development/testing)
 */
async function logToConsole(options: EmailOptions): Promise<EmailResult> {
  console.log('\n========== EMAIL (Console Mode) ==========');
  console.log('From:', options.from);
  console.log('To:', options.to);
  console.log('Subject:', options.subject);
  if (options.replyTo) {
    console.log('Reply-To:', options.replyTo);
  }
  console.log('\n--- TEXT ---');
  console.log(options.text);
  console.log('\n--- HTML ---');
  console.log(options.html);
  console.log('==========================================\n');
  
  return {
    success: true,
    messageId: `console-${Date.now()}`,
  };
}

/**
 * Strip HTML tags for plain text version
 */
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>.*?<\/style>/gi, '')
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
}

/**
 * Validate email address format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Send bulk emails (with rate limiting)
 */
export async function sendBulkEmails(
  emails: EmailOptions[],
  options?: {
    rateLimit?: number; // emails per second
    onProgress?: (sent: number, total: number) => void;
  }
): Promise<EmailResult[]> {
  const rateLimit = options?.rateLimit || 10; // 10 emails/second default
  const delayMs = 1000 / rateLimit;
  
  const results: EmailResult[] = [];
  
  for (let i = 0; i < emails.length; i++) {
    const result = await sendEmail(emails[i]);
    results.push(result);
    
    if (options?.onProgress) {
      options.onProgress(i + 1, emails.length);
    }
    
    // Rate limiting delay (except for last email)
    if (i < emails.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  return results;
}
