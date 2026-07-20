import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { bootTestApp, sqliteAvailable, type TestApp } from "../helpers/app";
import { buildCase, buildEvidence, buildUser } from "../factories";

const suite = sqliteAvailable ? describe : describe.skip;

suite("legacy relationship integrity guards", () => {
  let app: TestApp;
  const userId = "RI_USER";

  beforeAll(async () => {
    app = await bootTestApp();
    await app.db.insert(app.schema.users).values(buildUser({ id: userId, email: "ri@example.com" }));
  });

  afterAll(() => app?.cleanup());

  it("installs every required database trigger", async () => {
    const { relationshipIntegrityReport } = await import("../../server/relationshipIntegrity");
    const sqlite = (app.db as any).$client ?? (app.db as any).session?.client;
    const report = relationshipIntegrityReport(sqlite);

    expect(report.ok).toBe(true);
    expect(report.expected).toBeGreaterThan(100);
    expect(report.installed).toBe(report.expected);
    expect(report.missing).toEqual([]);
  });

  it("rejects orphaned inserts and relationship updates in legacy tables", async () => {
    await expect(app.db.insert(app.schema.evidence).values(buildEvidence({
      id: "RI_ORPHAN",
      caseId: "MISSING_CASE",
      userId,
    }))).rejects.toThrow(/relationship violation: evidence\.caseId/);

    const validCase = buildCase({ id: "RI_UPDATE_CASE", userId });
    await app.db.insert(app.schema.cases).values(validCase);
    await expect(app.db.update(app.schema.cases)
      .set({ userId: "MISSING_USER" })
      .where(eq(app.schema.cases.id, validCase.id)))
      .rejects.toThrow(/relationship violation: cases\.userId/);

    await expect(app.db.insert(app.schema.emailMessages).values({
      id: "RI_EMAIL_ORPHAN",
      accountId: "MISSING_ACCOUNT",
      subject: "orphan",
    } as any)).rejects.toThrow(/relationship violation: email_messages\.accountId/);
  });

  it("keeps audit actor identifiers independent from account ownership", async () => {
    await expect(app.db.insert(app.schema.auditLogs).values({
      id: "RI_AUDIT",
      userId: "REMOVED_ACTOR",
      action: "historical.test",
      createdAt: new Date(),
    } as any)).resolves.toBeDefined();
  });

  it("preserves legacy orphans at startup and exposes them for explicit repair", async () => {
    const sqlite = (app.db as any).$client ?? (app.db as any).session?.client;
    const { ensureRelationshipIntegrityTriggers } = await import("../../server/relationshipIntegrity");
    const { reconcileReport, repairOrphans } = await import("../../server/reconcile");

    sqlite.exec('DROP TRIGGER "laro_ri_email_messages_accountId_insert"');
    sqlite.prepare(
      "INSERT INTO email_messages (id, accountId, subject) VALUES (?, ?, ?)",
    ).run("RI_LEGACY_EMAIL", "REMOVED_ACCOUNT", "legacy orphan");

    expect(() => ensureRelationshipIntegrityTriggers(sqlite)).not.toThrow();
    const before = await reconcileReport();
    expect(before.orphanedByRelationship["email_messages.accountId->email_accounts.id"]).toBe(1);

    const repaired = await repairOrphans();
    expect(repaired.deleted["email_messages.accountId"]).toBe(1);
    const after = await reconcileReport();
    expect(after.orphanedByRelationship["email_messages.accountId->email_accounts.id"] ?? 0).toBe(0);
  });

  it("cascades a direct parent delete through legacy child tables", async () => {
    const caseId = "RI_DELETE_CASE";
    await app.db.insert(app.schema.cases).values(buildCase({ id: caseId, userId }));
    await app.db.insert(app.schema.evidence).values(buildEvidence({ id: "RI_EVIDENCE", caseId, userId }));

    const sqlite = (app.db as any).$client ?? (app.db as any).session?.client;
    sqlite.prepare("DELETE FROM cases WHERE id = ?").run(caseId);

    const remaining = sqlite.prepare("SELECT count(*) AS count FROM evidence WHERE id = ?").get("RI_EVIDENCE") as {
      count: number;
    };
    expect(remaining.count).toBe(0);
  });
});
