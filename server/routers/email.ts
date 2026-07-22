import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { sendSystemEmail } from "../systemEmail";
import { resolveOutboundEmailConfiguration } from "../emailConfig";
function resolveProvider() {
  const configuration = resolveOutboundEmailConfiguration();
  const from = configuration.from || "noreply@laro.local";
  if (configuration.provider === "sendgrid") {
    return {
      provider: "sendgrid" as const,
      name: "SendGrid",
      configured: configuration.configured,
      from,
      missingVars: configuration.missingVars,
    };
  }
  if (configuration.provider === "smtp") {
    return {
      provider: "smtp" as const,
      name: "SMTP",
      configured: configuration.configured,
      from,
      missingVars: configuration.missingVars,
    };
  }

  return {
    provider: "console" as const,
    name: "Console (Development)",
    configured: false,
    from: from || "Not configured",
    missingVars: configuration.missingVars,
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
