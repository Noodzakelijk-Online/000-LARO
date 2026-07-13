import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { sendSystemEmail } from "../systemEmail";
function resolveProvider() {
  const from = process.env.EMAIL_FROM || process.env.SMTP_FROM || "noreply@laro.local";
  const missingVars: string[] = [];

  if (process.env.SENDGRID_API_KEY) {
    return {
      provider: "sendgrid" as const,
      name: "SendGrid",
      configured: true,
      from,
      missingVars: [] as string[],
    };
  }
  if (process.env.SMTP_HOST) {
    return {
      provider: "smtp" as const,
      name: "SMTP",
      configured: true,
      from,
      missingVars: [] as string[],
    };
  }

  if (process.env.EMAIL_PROVIDER === "sendgrid") missingVars.push("SENDGRID_API_KEY");
  if (process.env.EMAIL_PROVIDER === "smtp") missingVars.push("SMTP_HOST");

  return {
    provider: "console" as const,
    name: "Console (Development)",
    configured: false,
    from: from || "Not configured",
    missingVars,
  };
}

export const emailRouter = router({
  getProviderInfo: protectedProcedure.query(() => resolveProvider()),

  test: protectedProcedure
    .input(
      z.object({
        to: z.string().email("Invalid email address"),
        subject: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const subject = input.subject ?? "LARO test email";
      const result = await sendSystemEmail({
        to: input.to,
        subject,
        text: "This is a transactional email configuration test from LARO.",
      });
      return {
        success: result.delivered,
        provider: result.provider,
        message: result.delivered
          ? `Test email sent through ${result.provider}.`
          : "No transactional email provider is configured; no email was sent.",
      };
    }),
});
