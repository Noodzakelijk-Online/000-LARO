import { describe, expect, it } from "vitest";
import { resolveOutboundEmailConfiguration } from "../../server/emailConfig";

describe("outbound email configuration", () => {
  it("requires a verified sender alongside a SendGrid key", () => {
    const incomplete = resolveOutboundEmailConfiguration({
      SENDGRID_API_KEY: "test-key",
    });
    expect(incomplete).toMatchObject({
      provider: "sendgrid",
      configured: false,
      missingVars: ["EMAIL_FROM"],
    });

    const complete = resolveOutboundEmailConfiguration({
      SENDGRID_API_KEY: "test-key",
      EMAIL_FROM: "sender@example.com",
    });
    expect(complete).toMatchObject({
      provider: "sendgrid",
      configured: true,
      from: "sender@example.com",
      missingVars: [],
    });
  });

  it("does not report a partial SMTP setup as operational", () => {
    const result = resolveOutboundEmailConfiguration({
      EMAIL_PROVIDER: "smtp",
      SMTP_HOST: "smtp.gmail.com",
      SMTP_USER: "sender@example.com",
    });
    expect(result).toMatchObject({
      provider: "smtp",
      configured: false,
      missingVars: ["SMTP_PASS", "SMTP_FROM"],
    });
  });

  it("accepts a complete authenticated SMTP setup", () => {
    const result = resolveOutboundEmailConfiguration({
      EMAIL_PROVIDER: "smtp",
      SMTP_HOST: "smtp.gmail.com",
      SMTP_PORT: "587",
      SMTP_USER: "sender@example.com",
      SMTP_PASS: "app-password",
      SMTP_FROM: "sender@example.com",
    });
    expect(result).toMatchObject({
      provider: "smtp",
      configured: true,
      from: "sender@example.com",
      missingVars: [],
    });
  });

  it("uses complete SMTP when an incomplete SendGrid setup is also present", () => {
    const result = resolveOutboundEmailConfiguration({
      SENDGRID_API_KEY: "stale-key-without-a-sender",
      EMAIL_PROVIDER: "smtp",
      SMTP_HOST: "smtp.gmail.com",
      SMTP_USER: "sender@example.com",
      SMTP_PASS: "app-password",
      SMTP_FROM: "sender@example.com",
    });
    expect(result).toMatchObject({
      provider: "smtp",
      configured: true,
      missingVars: [],
    });
  });

  it("reports an absent provider without inventing a fallback", () => {
    expect(resolveOutboundEmailConfiguration({})).toEqual({
      provider: "unconfigured",
      configured: false,
      from: "",
      missingVars: [],
    });
  });
});
