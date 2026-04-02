import { CaseCSVRow } from './bulkCaseImport';

/**
 * Case Aggregation Service
 * Intelligently detect and consolidate duplicate cases from CSV imports
 */

export interface AggregatedCase {
  rows: number[]; // Original CSV row numbers that were merged
  caseTitle: string;
  description: string;
  category: string;
  urgency: string;
  evidenceUrls: string[];
  tags: string[];
  mergeReason: string;
}

export interface AggregationResult {
  originalCount: number;
  consolidatedCount: number;
  aggregatedCases: AggregatedCase[];
  duplicatesRemoved: number;
}

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy matching of client names and descriptions
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,    // deletion
          dp[i][j - 1] + 1,    // insertion
          dp[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculate text similarity percentage (0-100)
 * Uses Jaccard similarity for word-level comparison
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(Boolean));
  const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(Boolean));

  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  if (union.size === 0) return 0;
  
  return (intersection.size / union.size) * 100;
}

/**
 * Normalize urgency levels for comparison
 */
function normalizeUrgency(urgency: string): string {
  const normalized = urgency.toLowerCase().trim();
  if (normalized === 'high' || normalized === 'urgent') return 'High';
  if (normalized === 'medium' || normalized === 'normal') return 'Medium';
  if (normalized === 'low') return 'Low';
  return urgency;
}

/**
 * Check if two cases are exact duplicates
 */
function isExactDuplicate(case1: CaseCSVRow, case2: CaseCSVRow): boolean {
  const title1 = case1.caseTitle.trim().toLowerCase();
  const title2 = case2.caseTitle.trim().toLowerCase();
  const category1 = case1.category.trim().toLowerCase();
  const category2 = case2.category.trim().toLowerCase();
  const urgency1 = normalizeUrgency(case1.urgency);
  const urgency2 = normalizeUrgency(case2.urgency);

  // Exact match: same title, category, urgency, and very similar description
  if (title1 === title2 && category1 === category2 && urgency1 === urgency2) {
    const descSimilarity = calculateTextSimilarity(case1.description, case2.description);
    return descSimilarity >= 90;
  }

  return false;
}

/**
 * Check if two cases are fuzzy duplicates
 */
function isFuzzyDuplicate(case1: CaseCSVRow, case2: CaseCSVRow): boolean {
  const title1 = case1.caseTitle.trim();
  const title2 = case2.caseTitle.trim();
  const category1 = case1.category.trim().toLowerCase();
  const category2 = case2.category.trim().toLowerCase();

  // Fuzzy match: similar title, same category, similar description
  if (category1 === category2) {
    // Check title similarity using Levenshtein distance
    const titleDistance = levenshteinDistance(title1.toLowerCase(), title2.toLowerCase());
    const maxTitleDistance = Math.max(3, Math.floor(title1.length * 0.15)); // Allow 15% difference
    const titleSimilar = titleDistance <= maxTitleDistance;

    // Check description similarity
    const descSimilarity = calculateTextSimilarity(case1.description, case2.description);
    const descSimilar = descSimilarity >= 60; // Lowered from 70 to 60

    return titleSimilar && descSimilar;
  }

  return false;
}

/**
 * Merge multiple cases into one aggregated case
 */
function mergeCases(cases: Array<{ row: number; data: CaseCSVRow }>, reason: string): AggregatedCase {
  // Use the first case as the base
  const base = cases[0].data;

  // Collect all evidence URLs and tags
  const allEvidenceUrls = new Set<string>();
  const allTags = new Set<string>();

  // Merge descriptions
  const descriptions: string[] = [];

  for (const { data } of cases) {
    // Add description if unique
    if (data.description && !descriptions.includes(data.description.trim())) {
      descriptions.push(data.description.trim());
    }

    // Add evidence URLs
    if (data.evidenceUrls) {
      data.evidenceUrls.split(',').forEach(url => {
        const trimmed = url.trim();
        if (trimmed) allEvidenceUrls.add(trimmed);
      });
    }

    // Add tags
    if (data.tags) {
      data.tags.split(',').forEach(tag => {
        const trimmed = tag.trim();
        if (trimmed) allTags.add(trimmed);
      });
    }
  }

  // Determine highest urgency
  const urgencies = cases.map(c => normalizeUrgency(c.data.urgency));
  let highestUrgency = 'Low';
  if (urgencies.includes('High')) highestUrgency = 'High';
  else if (urgencies.includes('Medium')) highestUrgency = 'Medium';

  return {
    rows: cases.map(c => c.row),
    caseTitle: base.caseTitle.trim(),
    description: descriptions.join('\n\n---\n\n'), // Separate merged descriptions
    category: base.category.trim(),
    urgency: highestUrgency,
    evidenceUrls: Array.from(allEvidenceUrls),
    tags: Array.from(allTags),
    mergeReason: reason,
  };
}

/**
 * Aggregate cases from CSV rows
 * Detects duplicates and consolidates them
 */
export function aggregateCases(rows: CaseCSVRow[]): AggregationResult {
  const aggregatedCases: AggregatedCase[] = [];
  const processedIndices = new Set<number>();

  for (let i = 0; i < rows.length; i++) {
    if (processedIndices.has(i)) continue;

    const currentCase = rows[i];
    const group: Array<{ row: number; data: CaseCSVRow }> = [
      { row: i + 2, data: currentCase } // +2 because CSV row 1 is header, array is 0-indexed
    ];

    // Look for duplicates
    for (let j = i + 1; j < rows.length; j++) {
      if (processedIndices.has(j)) continue;

      const compareCase = rows[j];

      // Check for exact duplicates
      if (isExactDuplicate(currentCase, compareCase)) {
        group.push({ row: j + 2, data: compareCase });
        processedIndices.add(j);
        continue;
      }

      // Check for fuzzy duplicates
      if (isFuzzyDuplicate(currentCase, compareCase)) {
        group.push({ row: j + 2, data: compareCase });
        processedIndices.add(j);
        continue;
      }
    }

    // Create aggregated case
    if (group.length > 1) {
      // Multiple cases merged
      const reason = `Merged ${group.length} duplicate cases (rows: ${group.map(g => g.row).join(', ')})`;
      aggregatedCases.push(mergeCases(group, reason));
    } else {
      // Single case, no duplicates
      const singleCase = group[0];
      aggregatedCases.push({
        rows: [singleCase.row],
        caseTitle: singleCase.data.caseTitle.trim(),
        description: singleCase.data.description.trim(),
        category: singleCase.data.category.trim(),
        urgency: normalizeUrgency(singleCase.data.urgency),
        evidenceUrls: singleCase.data.evidenceUrls
          ? singleCase.data.evidenceUrls.split(',').map(url => url.trim()).filter(Boolean)
          : [],
        tags: singleCase.data.tags
          ? singleCase.data.tags.split(',').map(tag => tag.trim()).filter(Boolean)
          : [],
        mergeReason: 'No duplicates found',
      });
    }

    processedIndices.add(i);
  }

  return {
    originalCount: rows.length,
    consolidatedCount: aggregatedCases.length,
    aggregatedCases,
    duplicatesRemoved: rows.length - aggregatedCases.length,
  };
}

/**
 * Generate aggregation summary report
 */
export function generateAggregationReport(result: AggregationResult): string {
  const lines: string[] = [];

  lines.push('=== Case Aggregation Report ===');
  lines.push('');
  lines.push(`Original cases: ${result.originalCount}`);
  lines.push(`Consolidated cases: ${result.consolidatedCount}`);
  lines.push(`Duplicates removed: ${result.duplicatesRemoved}`);
  lines.push(`Reduction: ${((result.duplicatesRemoved / result.originalCount) * 100).toFixed(1)}%`);
  lines.push('');

  if (result.duplicatesRemoved > 0) {
    lines.push('=== Merged Cases ===');
    lines.push('');

    const mergedCases = result.aggregatedCases.filter(c => c.rows.length > 1);
    for (const merged of mergedCases) {
      lines.push(`Case: ${merged.caseTitle}`);
      lines.push(`  Rows merged: ${merged.rows.join(', ')}`);
      lines.push(`  Reason: ${merged.mergeReason}`);
      lines.push(`  Final urgency: ${merged.urgency}`);
      lines.push(`  Tags: ${merged.tags.join(', ') || 'None'}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}
