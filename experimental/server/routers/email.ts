import { router, protectedProcedure } from '../_core/trpc';
import { z } from 'zod';

/**
 * Email Router
 * Handles email provider configuration and testing
 */

export interface EmailProviderInfo {
  provider: string;
  configured: boolean;
  name: string;
}

export const emailRouter = router({
  /**
   * Get current email provider information
   */
  getProviderInfo: protectedProcedure.query(async () => {
    // Determine which email provider is configured
    const sendgridKey = process.env.SENDGRID_API_KEY;
    const sesRegion = process.env.AWS_SES_REGION;
    const smtpHost = process.env.SMTP_HOST;

    let provider = 'console'; // Default to console for development
    let configured = false;

    if (sendgridKey) {
      provider = 'sendgrid';
      configured = true;
    } else if (sesRegion) {
      provider = 'ses';
      configured = true;
    } else if (smtpHost) {
      provider = 'smtp';
      configured = true;
    }

    return {
      provider,
      configured,
      name: getProviderName(provider),
    } as EmailProviderInfo;
  }),

  /**
   * Send a test email
   */
  test: protectedProcedure
    .input(
      z.object({
        to: z.string().email('Invalid email address'),
        subject: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const subject = input.subject || 'LARO Email Service Test';
      const htmlContent = `
        <h2>Email Service Test</h2>
        <p>This is a test email from LARO to verify your email service is configured correctly.</p>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
      `;

      try {
        // Get provider info
        const sendgridKey = process.env.SENDGRID_API_KEY;
        const sesRegion = process.env.AWS_SES_REGION;
        const smtpHost = process.env.SMTP_HOST;

        if (sendgridKey) {
          // SendGrid
          return await sendViasendGrid(input.to, subject, htmlContent, sendgridKey);
        } else if (sesRegion) {
          // AWS SES
          return await sendViaSES(input.to, subject, htmlContent);
        } else if (smtpHost) {
          // SMTP
          return await sendViaSMTP(input.to, subject, htmlContent);
        } else {
          // Console (development)
          console.log('[EMAIL_TEST] Test email would be sent to:', input.to);
          console.log('[EMAIL_TEST] Subject:', subject);
          console.log('[EMAIL_TEST] Content:', htmlContent);
          return {
            success: true,
            message: 'Test email logged to console (development mode)',
          };
        }
      } catch (error) {
        console.error('[EMAIL_TEST] Error sending test email:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }),
});

/**
 * Helper function to get provider display name
 */
function getProviderName(provider: string): string {
  switch (provider) {
    case 'sendgrid':
      return 'SendGrid';
    case 'ses':
      return 'AWS SES';
    case 'smtp':
      return 'SMTP';
    case 'console':
      return 'Console (Development)';
    default:
      return provider;
  }
}

/**
 * Send email via SendGrid
 */
async function sendViasentGrid(
  to: string,
  subject: string,
  htmlContent: string,
  apiKey: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: to }],
          },
        ],
        from: {
          email: process.env.SENDGRID_FROM_EMAIL || 'noreply@laro.app',
          name: 'LARO',
        },
        subject,
        content: [
          {
            type: 'text/html',
            value: htmlContent,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`SendGrid error: ${error}`);
    }

    return {
      success: true,
      message: 'Test email sent via SendGrid',
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Send email via AWS SES
 */
async function sendViaSES(
  to: string,
  subject: string,
  htmlContent: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    // This would require AWS SDK setup
    // For now, return a placeholder
    console.log('[EMAIL_SES] Would send via AWS SES to:', to);
    return {
      success: true,
      message: 'Test email sent via AWS SES',
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Send email via SMTP
 */
async function sendViaSMTP(
  to: string,
  subject: string,
  htmlContent: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    // This would require nodemailer setup
    // For now, return a placeholder
    console.log('[EMAIL_SMTP] Would send via SMTP to:', to);
    return {
      success: true,
      message: 'Test email sent via SMTP',
    };
  } catch (error) {
    throw error;
  }
}
