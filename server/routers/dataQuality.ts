/**
 * Data Quality Report Router
 * Provides tRPC endpoints for data quality metrics and validation statistics
 */

import { router, adminProcedure } from "../_core/trpc";
import {
  generateDataQualityReport,
  getCaseValidationIssues,
  getDataQualityMetrics,
} from "../dataQualityReport";

export const dataQualityRouter = router({
  /**
   * Get comprehensive data quality report
   * Admin only - shows all validation statistics
   */
  getReport: adminProcedure.query(async () => {
    const report = await generateDataQualityReport();
    return report;
  }),

  /**
   * Get data quality metrics summary
   * Admin only - shows high-level metrics
   */
  getMetrics: adminProcedure.query(async () => {
    const metrics = await getDataQualityMetrics();
    return metrics;
  }),

  /**
   * Get validation issues for a specific case
   * Admin only - shows issues for one case
   */
  getCaseIssues: adminProcedure
    .input((input: unknown) => {
      const caseId = input as string;
      if (!caseId || typeof caseId !== "string") {
        throw new Error("Case ID is required");
      }
      return caseId;
    })
    .query(async ({ input: caseId }) => {
      const issues = await getCaseValidationIssues(caseId);
      return issues;
    }),

  /**
   * Get summary of data quality issues
   * Admin only - shows issue counts by severity
   */
  getIssueSummary: adminProcedure.query(async () => {
    const report = await generateDataQualityReport();
    const critical = report.validationIssues.filter((i) => i.severity === "critical").length;
    const warnings = report.validationIssues.filter((i) => i.severity === "warning").length;
    const infos = report.validationIssues.filter((i) => i.severity === "info").length;

    return {
      total: report.validationIssues.length,
      critical,
      warnings,
      infos,
      criticalCases: report.validationIssues
        .filter((i) => i.severity === "critical")
        .map((i) => ({ caseId: i.caseId, issue: i.issue })),
    };
  }),
});
