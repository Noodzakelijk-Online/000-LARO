import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { bootTestApp, sqliteAvailable, type TestApp } from "../helpers/app";
import { buildUser } from "../factories";

const suite = sqliteAvailable ? describe : describe.skip;

suite("keyword pull progress", () => {
  let app: TestApp;
  let previousScanRoots: string | undefined;
  const user = { id: "PULL_PROGRESS_USER", name: "Progress", role: "user", email: "progress@example.com" };
  let caseId: string;

  beforeAll(async () => {
    app = await bootTestApp();
    previousScanRoots = process.env.LOCAL_SCAN_ROOTS;
    process.env.LOCAL_SCAN_ROOTS = app.tmpDir;
    await app.db.insert(app.schema.users).values(buildUser({ id: user.id, email: user.email }));
    const created = await app.makeCaller(user).cases.create({
      clientName: "Progress Client",
      clientEmail: "client@example.com",
      caseType: "Contract",
      caseSummary: "contract dispute",
      urgency: "Medium",
    });
    caseId = created.id;
  });

  afterAll(() => {
    if (previousScanRoots === undefined) delete process.env.LOCAL_SCAN_ROOTS;
    else process.env.LOCAL_SCAN_ROOTS = previousScanRoots;
    app?.cleanup();
  });

  it("reports discovered and processed words while importing local evidence", async () => {
    const fileName = "contract-notice.txt";
    writeFileSync(
      join(app.tmpDir, fileName),
      "On 14 July 2026 the seller stated that payment must arrive within seven days.",
      "utf8",
    );
    const updates: Array<{
      phase: string;
      processedWordsDelta?: number;
      totalWordsDelta?: number;
      processedItemsDelta?: number;
      totalItemsDelta?: number;
    }> = [];
    const { pullEvidenceByKeywords } = await import("../../server/autoCollectionService");

    const result = await pullEvidenceByKeywords({
      caseId,
      userId: user.id,
      keywords: ["contract"],
      matchMode: "any",
      includeGmail: false,
      includeDrive: false,
      includeLocal: true,
      localFolderPaths: [app.tmpDir],
      onProgress: (update) => updates.push(update),
    });

    expect(result.localFiles).toBe(1);
    expect(updates.some((update) => update.phase === "discovering")).toBe(true);
    expect(updates.reduce((sum, update) => sum + (update.totalWordsDelta || 0), 0)).toBe(14);
    expect(updates.reduce((sum, update) => sum + (update.processedWordsDelta || 0), 0)).toBe(14);
    expect(updates.reduce((sum, update) => sum + (update.totalItemsDelta || 0), 0)).toBe(1);
    expect(updates.reduce((sum, update) => sum + (update.processedItemsDelta || 0), 0)).toBe(1);
  });

  it("rejects local folders outside the configured standalone-server roots", async () => {
    const outside = mkdtempSync(join(tmpdir(), "laro-disallowed-scan-"));
    try {
      writeFileSync(join(outside, "contract-secret.txt"), "This file is outside the allowed root.", "utf8");
      const { pullEvidenceByKeywords } = await import("../../server/autoCollectionService");
      const result = await pullEvidenceByKeywords({
        caseId,
        userId: user.id,
        keywords: ["contract"],
        includeGmail: false,
        includeDrive: false,
        includeLocal: true,
        localFolderPaths: [outside],
      });
      expect(result.localFiles).toBe(0);
      expect(result.errors.join(" ")).toContain("outside LOCAL_SCAN_ROOTS");
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it("marks a persisted orphaned job interrupted so the case can retry", async () => {
    const now = new Date();
    const jobId = "46bf4444-0b0d-4fb8-aee4-4da91d82742b";
    await app.db.insert(app.schema.keywordPullJobs).values({
      id: jobId,
      caseId,
      userId: user.id,
      status: "running",
      phase: "local",
      message: "Reading local evidence",
      processedWords: 4,
      totalWords: 12,
      processedItems: 1,
      totalItems: 3,
      createdAt: now,
      startedAt: now,
      updatedAt: now,
    });

    const firstRead = await app.makeCaller(user).autoCollection.activePullJob({ caseId });
    expect(firstRead).toMatchObject({
      id: jobId,
      status: "failed",
      message: "Pull interrupted before completion",
    });
    expect(firstRead?.error).toContain("retry safely");
    await expect(app.makeCaller(user).autoCollection.activePullJob({ caseId })).resolves.toBeNull();
  });
});
