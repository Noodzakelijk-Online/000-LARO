import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildUser } from "../factories";
import { bootTestApp, sqliteAvailable, type TestApp } from "../helpers/app";
import { assessDataReadiness } from "../../server/dataReadiness";

const suite = sqliteAvailable ? describe : describe.skip;

suite("production data readiness", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await bootTestApp();
  });

  afterAll(() => app?.cleanup());

  it("passes an initialized clean database", async () => {
    const report = await assessDataReadiness();
    expect(report).toMatchObject({
      ok: true,
      sqliteIntegrity: "ok",
      foreignKeyViolations: 0,
      demoLikeRecords: { users: 0, cases: 0 },
      reconciliation: { totalOrphans: 0, duplicateEmails: [] },
    });
    expect(report.invariants.every((item) => item.ok)).toBe(true);
  });

  it("fails when a known non-production account marker remains", async () => {
    await app.db.insert(app.schema.users).values(buildUser({
      id: "demo-user-123",
      email: "owner@example.invalid",
    }));
    const report = await assessDataReadiness();
    expect(report.ok).toBe(false);
    expect(report.demoLikeRecords.users).toBe(1);
  });
});
