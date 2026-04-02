/**
 * Data Quality Report Service
 * Generates comprehensive validation statistics for the database
 */

import { getDb } from "./db";
import { cases } from "./schema";
import { eq } from "drizzle-orm";

export interface DataQualityStats {
  totalCases: number;
  validCases: number;
  invalidCases: number;
  validPercentage: number;
  invalidPercentage: number;
  casesByStatus: Record<string, number>;
  casesByUrgency: Record<string, number>;
  legalAreasStats: {
    casesWithLegalAreas: number;
    casesWithoutLegalAreas: number;
    uniqueLegalAreas: string[];
  };
  validationIssues: ValidationIssue[];
  summary: string;
  generatedAt: Date;
}

export interface ValidationIssue {
  caseId: string;
  issue: string;
  severity: "critical" | "warning" | "info";
  details: Record<string, unknown>;
}

/**
 * Generate comprehensive data quality report
 */
export async function generateDataQualityReport(): Promise<DataQualityStats> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database connection not available");
  }

  const allCases = await db.select().from(cases);
  const validationIssues: ValidationIssue[] = [];

  let validCases = 0;
  let invalidCases = 0;
  const casesByStatus: Record<string, number> = {};
  const casesByUrgency: Record<string, number> = {};
  const uniqueLegalAreas = new Set<string>();
  let casesWithLegalAreas = 0;
  let casesWithoutLegalAreas = 0;

  // Analyze each case
  for (const caseItem of allCases) {
    // Check status
    if (caseItem.status) {
      casesByStatus[caseItem.status] = (casesByStatus[caseItem.status] || 0) + 1;
    }

    // Check urgency
    if (caseItem.urgency) {
      casesByUrgency[caseItem.urgency] = (casesByUrgency[caseItem.urgency] || 0) + 1;
    }

    // Validate legalAreas
    if (!caseItem.legalAreas) {
      casesWithoutLegalAreas++;
      validationIssues.push({
        caseId: caseItem.id,
        issue: "Missing legalAreas field",
        severity: "warning",
        details: {
          caseTitle: caseItem.clientName,
          status: caseItem.status,
        },
      });
      invalidCases++;
      continue;
    }

    try {
      const parsedAreas = JSON.parse(caseItem.legalAreas);
      if (Array.isArray(parsedAreas)) {
        casesWithLegalAreas++;
        validCases++;
        // Track unique legal areas
        parsedAreas.forEach((area) => {
          if (typeof area === "string") {
            uniqueLegalAreas.add(area);
          }
        });
      } else {
        throw new Error("legalAreas is not an array");
      }
    } catch (error) {
      invalidCases++;
      validationIssues.push({
        caseId: caseItem.id,
        issue: "Invalid JSON in legalAreas field",
        severity: "critical",
        details: {
          caseTitle: caseItem.clientName,
          legalAreasValue: caseItem.legalAreas.substring(0, 100),
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  const totalCases = allCases.length;
  const validPercentage = totalCases > 0 ? (validCases / totalCases) * 100 : 0;
  const invalidPercentage = totalCases > 0 ? (invalidCases / totalCases) * 100 : 0;

  // Generate summary
  const summary = generateSummary({
    totalCases,
    validCases,
    invalidCases,
    validPercentage,
    casesWithLegalAreas,
    casesWithoutLegalAreas,
    uniqueLegalAreasCount: uniqueLegalAreas.size,
  });

  return {
    totalCases,
    validCases,
    invalidCases,
    validPercentage: Math.round(validPercentage * 100) / 100,
    invalidPercentage: Math.round(invalidPercentage * 100) / 100,
    casesByStatus,
    casesByUrgency,
    legalAreasStats: {
      casesWithLegalAreas,
      casesWithoutLegalAreas,
      uniqueLegalAreas: Array.from(uniqueLegalAreas).sort(),
    },
    validationIssues: validationIssues.sort((a, b) => {
      // Sort by severity: critical > warning > info
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    }),
    summary,
    generatedAt: new Date(),
  };
}

/**
 * Get validation issues for a specific case
 */
export async function getCaseValidationIssues(caseId: string): Promise<ValidationIssue[]> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database connection not available");
  }

  const caseItem = await db.select().from(cases).where(eq(cases.id, caseId)).limit(1);
  if (caseItem.length === 0) {
    throw new Error(`Case ${caseId} not found`);
  }

  const issues: ValidationIssue[] = [];
  const c = caseItem[0];

  // Check legalAreas
  if (!c.legalAreas) {
    issues.push({
      caseId,
      issue: "Missing legalAreas field",
      severity: "warning",
      details: { message: "Case has no legal areas defined" },
    });
  } else {
    try {
      JSON.parse(c.legalAreas);
    } catch (error) {
      issues.push({
        caseId,
        issue: "Invalid JSON in legalAreas",
        severity: "critical",
        details: {
          value: c.legalAreas.substring(0, 100),
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  // Check required fields
  if (!c.clientName) {
    issues.push({
      caseId,
      issue: "Missing client name",
      severity: "warning",
      details: { field: "clientName" },
    });
  }

  if (!c.caseSummary) {
    issues.push({
      caseId,
      issue: "Missing case summary",
      severity: "info",
      details: { field: "caseSummary" },
    });
  }

  return issues;
}

/**
 * Get data quality metrics by category
 */
export async function getDataQualityMetrics(): Promise<Record<string, unknown>> {
  const report = await generateDataQualityReport();

  return {
    overallQuality: {
      score: report.validPercentage,
      status: report.validPercentage >= 95 ? "Excellent" : report.validPercentage >= 80 ? "Good" : "Needs Attention",
      validCases: report.validCases,
      invalidCases: report.invalidCases,
      totalCases: report.totalCases,
    },
    legalAreasQuality: {
      casesWithAreas: report.legalAreasStats.casesWithLegalAreas,
      casesWithoutAreas: report.legalAreasStats.casesWithoutLegalAreas,
      coverage: report.totalCases > 0 ? (report.legalAreasStats.casesWithLegalAreas / report.totalCases) * 100 : 0,
      uniqueAreas: report.legalAreasStats.uniqueLegalAreas.length,
    },
    caseDistribution: {
      byStatus: report.casesByStatus,
      byUrgency: report.casesByUrgency,
    },
    criticalIssues: report.validationIssues.filter((i) => i.severity === "critical").length,
    warnings: report.validationIssues.filter((i) => i.severity === "warning").length,
    infos: report.validationIssues.filter((i) => i.severity === "info").length,
  };
}

/**
 * Generate human-readable summary
 */
function generateSummary(stats: {
  totalCases: number;
  validCases: number;
  invalidCases: number;
  validPercentage: number;
  casesWithLegalAreas: number;
  casesWithoutLegalAreas: number;
  uniqueLegalAreasCount: number;
}): string {
  const lines = [
    `Data Quality Report Summary`,
    `========================`,
    ``,
    `Total Cases: ${stats.totalCases}`,
    `Valid Cases: ${stats.validCases} (${Math.round(stats.validPercentage)}%)`,
    `Invalid Cases: ${stats.invalidCases}`,
    ``,
    `Legal Areas Coverage:`,
    `  - Cases with legal areas: ${stats.casesWithLegalAreas}`,
    `  - Cases without legal areas: ${stats.casesWithoutLegalAreas}`,
    `  - Unique legal areas: ${stats.uniqueLegalAreasCount}`,
    ``,
    `Quality Status: ${stats.validPercentage >= 95 ? "✅ Excellent" : stats.validPercentage >= 80 ? "⚠️ Good" : "❌ Needs Attention"}`,
  ];

  return lines.join("\n");
}
