/**
 * Evidence compilation — stubs so legal research routes typecheck.
 * Replace with LLM-backed report generation when restoring the full module.
 */

export type ReportType =
  | "evidence_compilation"
  | "case_law_research"
  | "timeline_analysis"
  | "entity_extraction"
  | "comprehensive";

export async function compileEvidence(opts: {
  caseId: string;
  userId: string;
  reportType: ReportType;
  evidenceFileIds?: string[];
}): Promise<{ reportId: string; status: string }> {
  void opts;
  return { reportId: "stub-report", status: "pending" };
}

export async function getReport(reportId: string): Promise<{ id: string; summary: string } | null> {
  void reportId;
  return { id: reportId, summary: "Stub report — implement persistence + LLM output." };
}

export async function getReportsForCase(caseId: string): Promise<Array<{ id: string; caseId: string }>> {
  void caseId;
  return [];
}

export async function getEntitiesForCase(caseId: string): Promise<unknown[]> {
  void caseId;
  return [];
}
