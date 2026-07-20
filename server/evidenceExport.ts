import archiver from "archiver";
import { and, eq } from "drizzle-orm";
import { getDb } from "./db";
import { cases, documentAnalyses, evidence } from "./schema";
import { sanitizeFilename, storageRead } from "./storage";

const SENSITIVE_METADATA_FIELDS = new Set([
  "accesstoken",
  "apikey",
  "authorization",
  "clientsecret",
  "cookie",
  "refreshtoken",
  "secret",
  "storagekey",
  "token",
]);

function normalizeFieldName(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function redactMetadata(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactMetadata);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !SENSITIVE_METADATA_FIELDS.has(normalizeFieldName(key)))
        .map(([key, item]) => [key, redactMetadata(item)])
    );
  }
  return value;
}

function parseMetadata(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function csvCell(value: unknown): string {
  const rendered = value == null ? "" : String(value);
  return /[",\r\n]/.test(rendered) ? `"${rendered.replace(/"/g, '""')}"` : rendered;
}

async function loadCaseExportRows(userId: string, caseId: string) {
  const db = await getDb();
  const [caseRow] = await db
    .select()
    .from(cases)
    .where(and(eq(cases.id, caseId), eq(cases.userId, userId)))
    .limit(1);
  if (!caseRow) throw new Error("Case not found");
  const [items, analyses] = await Promise.all([
    db.select().from(evidence).where(and(eq(evidence.caseId, caseId), eq(evidence.userId, userId))),
    db.select().from(documentAnalyses).where(and(
      eq(documentAnalyses.caseId, caseId),
      eq(documentAnalyses.userId, userId)
    )),
  ]);
  return { caseRow, items, analyses };
}

function renderCaseCsv(items: Array<typeof evidence.$inferSelect>): Buffer {
  const headers = [
    "id",
    "title",
    "type",
    "source",
    "fileName",
    "mimeType",
    "relevant",
    "relevanceScore",
    "createdAt",
    "contentHash",
  ];
  const rows = items.map((item) => {
    const metadata = parseMetadata(item.metadata);
    return [
      item.id,
      item.title,
      item.type,
      item.source,
      item.fileName,
      item.mimeType,
      item.relevant === false ? "No" : "Yes",
      metadata.relevanceScore,
      item.createdAt?.toISOString(),
      metadata.contentHash,
    ].map(csvCell).join(",");
  });
  return Buffer.from(`\uFEFF${[headers.join(","), ...rows].join("\r\n")}\r\n`, "utf8");
}

export async function buildCaseCsv(userId: string, caseId: string): Promise<Buffer> {
  const { items } = await loadCaseExportRows(userId, caseId);
  return renderCaseCsv(items);
}

export async function buildCaseZip(userId: string, caseId: string): Promise<Buffer> {
  const { caseRow, items, analyses } = await loadCaseExportRows(userId, caseId);
  const analysisByEvidence = new Map(analyses.map((analysis) => [analysis.evidenceId, analysis]));
  const sourceFiles: Array<{ name: string; bytes: Buffer }> = [];

  for (const item of items) {
    const metadata = parseMetadata(item.metadata);
    if (typeof metadata.storageKey !== "string" || !metadata.storageKey) continue;
    try {
      const bytes = await storageRead(metadata.storageKey);
      const sourceName = sanitizeFilename(item.fileName || item.title || `${item.id}.bin`);
      sourceFiles.push({ name: `files/${item.id}-${sourceName}`, bytes });
    } catch {
      // Keep the metadata export usable when a legacy source object is unavailable.
    }
  }

  const manifest = {
    format: "laro-case-evidence/v2",
    generatedAt: new Date().toISOString(),
    case: {
      id: caseRow.id,
      clientName: caseRow.clientName,
      caseType: caseRow.caseType,
      caseSummary: caseRow.caseSummary,
      legalAreas: caseRow.legalAreas,
      status: caseRow.status,
    },
    evidenceCount: items.length,
    analyzedEvidenceCount: analyses.length,
    sourceFileCount: sourceFiles.length,
    evidence: items.map((item) => {
      const metadata = parseMetadata(item.metadata);
      return {
        id: item.id,
        title: item.title,
        type: item.type,
        source: item.source,
        fileName: item.fileName,
        mimeType: item.mimeType,
        relevant: item.relevant,
        relevanceScore: metadata.relevanceScore ?? null,
        contentHash: metadata.contentHash ?? null,
        analyzed: analysisByEvidence.has(item.id),
      };
    }),
  };
  const csv = renderCaseCsv(items);

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("data", (chunk) => chunks.push(chunk as Buffer));
    archive.on("error", reject);
    archive.on("end", () => resolve(Buffer.concat(chunks)));

    archive.append(JSON.stringify(manifest, null, 2), { name: "manifest.json" });
    archive.append(csv, { name: "evidence.csv" });
    archive.append(
      "LARO case evidence export.\n\nmanifest.json lists provenance and analysis coverage.\nevidence.csv is a spreadsheet-ready index.\nfiles/ contains available source documents.\nanalysis/ contains source-linked document analyses.\n",
      { name: "README.txt" }
    );
    for (const item of items) {
      archive.append(JSON.stringify({ ...item, metadata: redactMetadata(parseMetadata(item.metadata)) }, null, 2), {
        name: `evidence/${item.id}.json`,
      });
      const analysis = analysisByEvidence.get(item.id);
      if (analysis) {
        archive.append(analysis.result, { name: `analysis/${item.id}.json` });
      }
    }
    for (const sourceFile of sourceFiles) archive.append(sourceFile.bytes, { name: sourceFile.name });
    archive.finalize();
  });
}
