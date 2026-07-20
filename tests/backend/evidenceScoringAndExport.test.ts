import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { buildCase, buildUser } from "../factories";
import { bootTestApp, sqliteAvailable, type TestApp } from "../helpers/app";

const suite = sqliteAvailable ? describe : describe.skip;

suite("evidence scoring and case export", () => {
  let app: TestApp;
  const owner = { id: "USR_SCORE_OWNER", name: "Owner", role: "user", email: "score-owner@example.com" };
  const other = { id: "USR_SCORE_OTHER", name: "Other", role: "user", email: "score-other@example.com" };

  beforeAll(async () => {
    app = await bootTestApp();
    await app.db.insert(app.schema.users).values([
      buildUser({ id: owner.id, email: owner.email }),
      buildUser({ id: other.id, email: other.email }),
    ]);
    await app.db.insert(app.schema.cases).values([
      buildCase({
        id: "CASE_SCORE_OWNER",
        userId: owner.id,
        caseType: "Bestuursrecht",
        caseSummary: "Bezwaar tegen besluit van de gemeente over een uitkering",
        legalAreas: JSON.stringify(["Bestuursrecht"]),
      }),
      buildCase({ id: "CASE_SCORE_OTHER", userId: other.id }),
    ]);
  });

  afterAll(() => app?.cleanup());

  it("scores evidence against persisted case context and source-linked analysis", async () => {
    const caller = app.makeCaller(owner);
    const relevant = await caller.evidenceFiles.upload({
      caseId: "CASE_SCORE_OWNER",
      title: 'Besluit gemeente, "uitkering"',
      type: "document",
      fileName: "besluit.txt",
      mimeType: "text/plain",
      source: "manual",
      base64: Buffer.from([
        "Besluit van de gemeente Utrecht.",
        "De uitkering wordt beeindigd.",
        "U kunt binnen zes weken bezwaar maken.",
      ].join("\n")).toString("base64"),
    });
    const unrelated = await caller.evidenceFiles.upload({
      caseId: "CASE_SCORE_OWNER",
      title: "Vakantiefoto",
      type: "other",
      fileName: "vakantie.txt",
      mimeType: "text/plain",
      source: "manual",
      base64: Buffer.from("Zon zee strand en hotel.").toString("base64"),
    });
    await caller.documentAnalysis.analyzeEvidence({
      evidenceId: relevant.id,
      deepAnalysis: false,
      force: false,
    });

    const scored = await caller.relevanceScoring.batchScore({
      caseContext: { caseId: "CASE_SCORE_OWNER" },
      batchSize: 1,
    });
    expect(scored.totalScored).toBe(2);
    const relevantScore = scored.results.find((result: any) => result.itemId === relevant.id);
    const unrelatedScore = scored.results.find((result: any) => result.itemId === unrelated.id);
    expect(relevantScore.analysisAvailable).toBe(true);
    expect(relevantScore.keywords).toEqual(expect.arrayContaining(["besluit", "gemeente", "uitkering", "bezwaar"]));
    expect(relevantScore.relevanceScore).toBeGreaterThan(unrelatedScore.relevanceScore);

    const statistics = await caller.relevanceScoring.getStatistics({ caseId: "CASE_SCORE_OWNER" });
    expect(statistics.statistics.totalEvidence).toBe(2);
    expect(statistics.statistics.totalScored).toBe(2);
    expect(statistics.statistics.analyzedEvidence).toBe(1);
    expect(statistics.statistics.topKeywords.some((entry: any) => entry.keyword === "gemeente")).toBe(true);

    const [stored] = await app.db
      .select()
      .from(app.schema.evidence)
      .where(eq(app.schema.evidence.id, relevant.id));
    const metadata = JSON.parse(stored.metadata);
    expect(metadata.scoringMethod).toBe("case-context-v1");
    expect(metadata.relevanceScore).toBe(relevantScore.relevanceScore);
    const scoreAudit = await caller.audit.list({
      entityType: "case",
      entityId: "CASE_SCORE_OWNER",
      action: "evidence.scored",
    });
    expect(scoreAudit).toHaveLength(1);

    await expect(app.makeCaller(other).relevanceScoring.getStatistics({
      caseId: "CASE_SCORE_OWNER",
    })).rejects.toThrow();
  });

  it("exports only the selected owner's case and includes available source files", async () => {
    const caller = app.makeCaller(owner);
    const csvDownload = await caller.evidenceExport.exportCSV({ caseId: "CASE_SCORE_OWNER" });
    const csv = Buffer.from(csvDownload.base64, "base64").toString("utf8");
    expect(csvDownload.filename).toBe("case-CASE_SCORE_OWNER-evidence.csv");
    expect(csv).toContain('"Besluit gemeente, ""uitkering"""');
    expect(csv).toContain("contentHash");
    expect(csv).not.toContain("CASE_SCORE_OTHER");

    const zipDownload = await caller.evidenceExport.exportZIP({ caseId: "CASE_SCORE_OWNER" });
    const zip = Buffer.from(zipDownload.base64, "base64");
    const zipDirectory = zip.toString("latin1");
    expect(zip.subarray(0, 2).toString("ascii")).toBe("PK");
    expect(zipDirectory).toContain("manifest.json");
    expect(zipDirectory).toContain("evidence.csv");
    expect(zipDirectory).toContain("analysis/");
    expect(zipDirectory).toContain("files/");
    expect(zipDownload.bytes).toBe(zip.length);
    const exportAudit = await caller.audit.list({
      entityType: "case",
      entityId: "CASE_SCORE_OWNER",
      action: "evidence.exported",
    });
    expect(exportAudit).toHaveLength(2);

    await expect(app.makeCaller(other).evidenceExport.exportZIP({
      caseId: "CASE_SCORE_OWNER",
    })).rejects.toThrow();
  });
});
