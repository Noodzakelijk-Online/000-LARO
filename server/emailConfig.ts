export type OutboundEmailProvider = "sendgrid" | "smtp" | "unconfigured";

export type OutboundEmailConfiguration = {
  provider: OutboundEmailProvider;
  configured: boolean;
  from: string;
  missingVars: string[];
};

function present(value: string | undefined): boolean {
  return Boolean(value && value.trim());
}

export function resolveOutboundEmailConfiguration(
  environment: NodeJS.ProcessEnv = process.env
): OutboundEmailConfiguration {
  const sendGridFrom = (environment.EMAIL_FROM || "").trim();
  const smtpFrom = (environment.SMTP_FROM || "").trim();
  const sendGridRequested = present(environment.SENDGRID_API_KEY);
  if (sendGridRequested && present(sendGridFrom)) {
    return {
      provider: "sendgrid",
      configured: true,
      from: sendGridFrom,
      missingVars: [],
    };
  }

  const smtpRequested = present(environment.SMTP_HOST) || environment.EMAIL_PROVIDER === "smtp";
  if (smtpRequested) {
    const required = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"] as const;
    const missingVars = required.filter((name) => !present(environment[name]));
    if (missingVars.length === 0) {
      return {
        provider: "smtp",
        configured: true,
        from: smtpFrom,
        missingVars: [],
      };
    }
    if (!sendGridRequested) {
      return {
        provider: "smtp",
        configured: false,
        from: smtpFrom,
        missingVars,
      };
    }
  }

  if (sendGridRequested) {
    return {
      provider: "sendgrid",
      configured: false,
      from: sendGridFrom,
      missingVars: ["EMAIL_FROM"],
    };
  }

  if (smtpRequested) {
    const required = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"] as const;
    return {
      provider: "smtp",
      configured: false,
      from: smtpFrom,
      missingVars: required.filter((name) => !present(environment[name])),
    };
  }

  return {
    provider: "unconfigured",
    configured: false,
    from: "",
    missingVars: [],
  };
}
