import { readFileSync } from "fs";
import { join } from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { analyzeDocumentBytes, extractDocumentText } from "../../server/documentIntelligence";
import { buildCase, buildUser } from "../factories";
import { bootTestApp, sqliteAvailable, type TestApp } from "../helpers/app";

const suite = sqliteAvailable ? describe : describe.skip;
const OCR_FIXTURE = readFileSync(join(__dirname, "..", "fixtures", "ocr-dutch-decision.png"));

describe("document intelligence units", () => {
  it("extracts clean HTML text without executable content", async () => {
    const extracted = await extractDocumentText(
      Buffer.from("<p>Decision dated 2026-07-14.</p><script>steal()</script><p>Amount EUR 250.</p>"),
      "text/html"
    );
    expect(extracted.method).toBe("html");
    expect(extracted.text).toContain("Decision dated 2026-07-14.");
    expect(extracted.text).toContain("Amount EUR 250.");
    expect(extracted.text).not.toContain("steal()");
  });

  it("produces deterministic findings whose citations resolve to source spans", async () => {
    const analysis = await analyzeDocumentBytes({
      bytes: Buffer.from([
        "Van: Gemeente Utrecht",
        "Aan: Jan de Vries",
        "Besluit van 14 juli 2026.",
        "De gemeente stelt dat EUR 1.250,00 verschuldigd is.",
        "U moet binnen 6 weken bezwaar maken.",
      ].join("\n")),
      mimeType: "text/plain",
      deepAnalysis: false,
    });
    const citationIds = new Set(analysis.citations.map((citation) => citation.id));
    expect(analysis.documentType).toBe("administrative decision");
    expect(analysis.dates.length).toBeGreaterThan(0);
    expect(analysis.amounts.length).toBeGreaterThan(0);
    expect(analysis.claims.length).toBeGreaterThan(0);
    expect(analysis.obligations.length).toBeGreaterThan(0);
    expect(analysis.analyzedWords).toBeGreaterThan(0);
    expect(analysis.timelineEvents.length).toBeGreaterThan(0);
    expect(analysis.timelineEvents[0].date).toBe("2026-07-14");
    for (const finding of [
      ...analysis.parties,
      ...analysis.dates,
      ...analysis.amounts,
      ...analysis.claims,
      ...analysis.obligations,
      ...analysis.legalIssues,
      ...analysis.riskFlags,
      ...analysis.timelineEvents,
    ]) {
      expect(finding.citations.length).toBeGreaterThan(0);
      expect(finding.citations.every((id) => citationIds.has(id))).toBe(true);
    }
  });

  it("extracts Dutch image text locally and keeps OCR findings source-linked", async () => {
    const analysis = await analyzeDocumentBytes({
      bytes: OCR_FIXTURE,
      mimeType: "image/png",
      deepAnalysis: false,
    });

    expect(analysis.extractionMethod).toBe("ocr_text");
    expect(analysis.extractionConfidence).toBeGreaterThan(80);
    expect(analysis.summary).toContain("Besluit 14 juli 2026 EUR 1250");
    expect(analysis.dates[0]?.normalized).toBe("2026-07-14");
    expect(analysis.amounts.length).toBeGreaterThan(0);
    expect(analysis.timelineEvents[0]?.citations.length).toBeGreaterThan(0);
  }, 60_000);
});

suite("persisted document analysis and source-linked timeline", () => {
  let app: TestApp;
  const owner = { id: "USR_DOC_OWNER", name: "Owner", role: "user", email: "owner-doc@example.com" };
  const other = { id: "USR_DOC_OTHER", name: "Other", role: "user", email: "other-doc@example.com" };

  beforeAll(async () => {
    app = await bootTestApp();
    await app.db.insert(app.schema.users).values([
      buildUser({ id: owner.id, email: owner.email }),
      buildUser({ id: other.id, email: other.email }),
    ]);
    await app.db.insert(app.schema.cases).values(buildCase({
      id: "CASE_DOC_ANALYSIS",
      userId: owner.id,
      caseType: "Administrative Law",
    }));
  });

  afterAll(() => app?.cleanup());

  it("stores source bytes, persists one versioned analysis, caches it, and generates linked events", async () => {
    const sourceText = [
      "Van: Gemeente Utrecht",
      "Aan: Jan de Vries",
      "Besluit van 14 juli 2026.",
      "De gemeente stelt dat EUR 1.250,00 verschuldigd is.",
      "U moet binnen 6 weken bezwaar maken.",
    ].join("\n");
    const caller = app.makeCaller(owner);
    const uploaded = await caller.evidenceFiles.upload({
      caseId: "CASE_DOC_ANALYSIS",
      title: "Besluit gemeente.txt",
      type: "document",
      fileName: "besluit-gemeente.txt",
      mimeType: "text/plain",
      source: "manual",
      base64: Buffer.from(sourceText).toString("base64"),
    });

    const first = await caller.documentAnalysis.analyzeEvidence({
      evidenceId: uploaded.id,
      deepAnalysis: false,
      force: false,
    });
    expect(first.cached).toBe(false);
    expect(first.result.providerStatus).toBe("not_requested");
    expect(first.result.summary).toContain("Gemeente Utrecht");

    const persisted = await app.db
      .select()
      .from(app.schema.documentAnalyses)
      .where(eq(app.schema.documentAnalyses.evidenceId, uploaded.id));
    expect(persisted).toHaveLength(1);
    expect(persisted[0].contentHash).toBe(uploaded.sha256);

    const second = await caller.documentAnalysis.analyzeEvidence({
      evidenceId: uploaded.id,
      deepAnalysis: false,
      force: false,
    });
    expect(second.cached).toBe(true);
    expect(second.id).toBe(first.id);

    const timeline = await caller.documentAnalysis.generateCaseTimeline({ caseId: "CASE_DOC_ANALYSIS" });
    expect(timeline.events.length).toBeGreaterThan(0);
    expect(timeline.events[0].source.evidenceId).toBe(uploaded.id);
    expect(timeline.events[0].date).toBe("2026-07-14");
    expect(timeline.events[0].source.title).toBe("Besluit gemeente.txt");
    expect(timeline.events[0].source.citation?.quote).toContain("14 juli 2026");
    expect(timeline.reconstruction.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: uploaded.id, title: "Besluit gemeente.txt", analysisStatus: "complete" }),
    ]));
    expect(timeline.reconstruction.nodes[0].summary).toContain("Gemeente Utrecht");
    const caseAnalyses = await caller.documentAnalysis.byCase({ caseId: "CASE_DOC_ANALYSIS" });
    expect(caseAnalyses).toEqual([
      expect.objectContaining({ evidenceId: uploaded.id, documentType: first.result.documentType }),
    ]);

    await expect(app.makeCaller(other).documentAnalysis.analyzeEvidence({
      evidenceId: uploaded.id,
      deepAnalysis: false,
      force: false,
    })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(app.makeCaller(other).documentAnalysis.byCase({ caseId: "CASE_DOC_ANALYSIS" }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });

    const [uploadedRow] = await app.db.select().from(app.schema.evidence).where(eq(app.schema.evidence.id, uploaded.id));
    const storageKey = JSON.parse(uploadedRow.metadata).storageKey;
    const { storageRead } = await import("../../server/storage");
    await expect(storageRead(storageKey)).resolves.toEqual(Buffer.from(sourceText));
    expect((await caller.evidenceFiles.delete({ id: uploaded.id })).success).toBe(true);
    await expect(storageRead(storageKey)).rejects.toThrow("not found");
    expect(await caller.documentAnalysis.byEvidence({ evidenceId: uploaded.id })).toBeNull();
  });
});
