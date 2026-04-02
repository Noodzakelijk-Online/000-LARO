// @ts-nocheck

import { adaptiveLLM, extractStructuredData } from "./adaptiveLLMOrchestrator";
import type { Lawyer } from "./schema";

/**
 * Lawyer Data Enrichment Service (Nov 2025)
 * 
 * Automatically enriches incomplete lawyer data by:
 * 1. Searching Google for lawyer/firm information
 * 2. Scraping relevant websites (firm sites, LinkedIn, legal directories)
 * 3. Extracting structured data using adaptive LLM
 * 4. Validating and merging with existing data
 * 
 * Features:
 * - Intelligent search query generation
 * - Multi-source data aggregation
 * - Confidence scoring
 * - Deduplication and conflict resolution
 * - Rate limiting to avoid blocking
 */

export interface EnrichmentResult {
  lawyerId: string;
  enrichedFields: Partial<Lawyer>;
  sources: Array<{
    url: string;
    type: "website" | "linkedin" | "directory" | "news";
    confidence: number;
  }>;
  confidence: number;
  cost: number;
  timeMs: number;
}

export interface LawyerSearchResult {
  name: string;
  firmName?: string;
  website?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  legalAreas?: string[];
  experienceYears?: string;
  languages?: string[];
  profileUrl?: string;
  linkedinUrl?: string;
}

/**
 * Generate intelligent search queries for a lawyer
 */
function generateSearchQueries(lawyer: Partial<Lawyer>): string[] {
  const queries: string[] = [];

  // Primary query: name + city
  if (lawyer.name && lawyer.city) {
    queries.push(`${lawyer.name} advocaat ${lawyer.city}`);
  }

  // Secondary query: name + firm
  if (lawyer.name && lawyer.firmName) {
    queries.push(`${lawyer.name} ${lawyer.firmName}`);
  }

  // Tertiary query: just name + "advocaat"
  if (lawyer.name) {
    queries.push(`${lawyer.name} advocaat Nederland`);
  }

  // NOvA profile query
  if (lawyer.novaId) {
    queries.push(`advocatenorde.nl ${lawyer.novaId}`);
  }

  return queries.filter(Boolean);
}

/**
 * Search Google for lawyer information
 * Uses Manus search API with 'info' type
 */
async function searchLawyerInfo(
  lawyer: Partial<Lawyer>
): Promise<Array<{ url: string; title: string; snippet: string }>> {
  const queries = generateSearchQueries(lawyer);

  if (queries.length === 0) {
    console.warn(`[Enrichment] No search queries generated for lawyer ${lawyer.id}`);
    return [];
  }

  console.log(`[Enrichment] Searching for: ${queries[0]}`);

  // Note: This is a placeholder - you would use the actual Manus search API
  // For now, we'll return mock results
  // TODO: Integrate with actual search API when available

  return [
    {
      url: `https://example.com/${lawyer.name?.replace(/\s+/g, "-").toLowerCase()}`,
      title: `${lawyer.name} - Advocaat ${lawyer.city}`,
      snippet: `Contact information and profile for ${lawyer.name}, lawyer specializing in...`,
    },
  ];
}

/**
 * Scrape and extract lawyer information from a webpage
 */
async function extractFromWebpage(
  url: string,
  lawyerName: string
): Promise<LawyerSearchResult | null> {
  try {
    console.log(`[Enrichment] Scraping ${url}...`);

    // Fetch webpage content
    // Note: In production, you would use a proper web scraping service
    // For now, we'll use a simple fetch
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      console.warn(`[Enrichment] Failed to fetch ${url}: ${response.status}`);
      return null;
    }

    const html = await response.text();

    // Extract text content (remove HTML tags)
    const textContent = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Limit to first 5000 characters to save costs
    const limitedContent = textContent.substring(0, 5000);

    // Use adaptive LLM to extract structured data
    const extractionResult = await extractStructuredData<LawyerSearchResult>(
      `Extract lawyer information for "${lawyerName}" from this webpage content:\n\n${limitedContent}`,
      {
        type: "object",
        properties: {
          name: { type: "string" },
          firmName: { type: "string" },
          website: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          address: { type: "string" },
          city: { type: "string" },
          legalAreas: { type: "array", items: { type: "string" } },
          experienceYears: { type: "string" },
          languages: { type: "array", items: { type: "string" } },
          profileUrl: { type: "string" },
          linkedinUrl: { type: "string" },
        },
        required: [],
        additionalProperties: false,
      },
      {
        type: "data_extraction",
        qualityRequirement: "high",
        maxCostCents: 2, // Max 2 cents per extraction
      }
    );

    return extractionResult.result;
  } catch (error) {
    console.error(`[Enrichment] Error extracting from ${url}:`, error);
    return null;
  }
}

/**
 * Merge extracted data with existing lawyer data
 * Resolves conflicts and calculates confidence
 */
function mergeEnrichedData(
  existing: Partial<Lawyer>,
  extracted: LawyerSearchResult[],
  sources: Array<{ url: string; confidence: number }>
): {
  enrichedFields: Partial<Lawyer>;
  confidence: number;
} {
  const enrichedFields: Partial<Lawyer> = {};
  let totalConfidence = 0;
  let fieldCount = 0;

  // Helper to set field if not already present
  const setIfMissing = (
    field: keyof Lawyer,
    value: any,
    confidence: number
  ) => {
    if (!existing[field] || existing[field] === "") {
      if (value && value !== "") {
        enrichedFields[field] = value;
        totalConfidence += confidence;
        fieldCount++;
      }
    }
  };

  // Aggregate data from all sources
  for (let i = 0; i < extracted.length; i++) {
    const data = extracted[i];
    const sourceConfidence = sources[i]?.confidence || 0.5;

    // Contact information
    setIfMissing("email", data.email, sourceConfidence);
    setIfMissing("phone", data.phone, sourceConfidence);
    setIfMissing("website", data.website, sourceConfidence);

    // Location
    setIfMissing("address", data.address, sourceConfidence);
    if (data.city && !existing.city) {
      setIfMissing("city", data.city, sourceConfidence);
    }

    // Firm information
    setIfMissing("firmName", data.firmName, sourceConfidence);

    // Professional details
    setIfMissing("experienceYears", data.experienceYears, sourceConfidence);

    // Arrays (merge if multiple sources)
    if (data.legalAreas && data.legalAreas.length > 0) {
      const existingAreas = existing.legalAreas
        ? JSON.parse(existing.legalAreas as string)
        : [];
      if (existingAreas.length === 0) {
        enrichedFields.legalAreas = JSON.stringify(data.legalAreas);
        totalConfidence += sourceConfidence;
        fieldCount++;
      }
    }

    if (data.languages && data.languages.length > 0) {
      const existingLanguages = existing.languages
        ? JSON.parse(existing.languages as string)
        : [];
      if (existingLanguages.length === 0) {
        enrichedFields.languages = JSON.stringify(data.languages);
        totalConfidence += sourceConfidence;
        fieldCount++;
      }
    }

    // Profile URLs
    setIfMissing("profileUrl", data.profileUrl, sourceConfidence);
  }

  // Calculate overall confidence
  const confidence = fieldCount > 0 ? totalConfidence / fieldCount : 0;

  return {
    enrichedFields,
    confidence,
  };
}

/**
 * Enrich a single lawyer's data
 */
export async function enrichLawyerData(
  lawyer: Partial<Lawyer>
): Promise<EnrichmentResult> {
  const startTime = Date.now();
  let totalCost = 0;

  console.log(`[Enrichment] Starting enrichment for lawyer ${lawyer.id} (${lawyer.name})`);

  // Step 1: Search for lawyer information
  const searchResults = await searchLawyerInfo(lawyer);

  if (searchResults.length === 0) {
    console.warn(`[Enrichment] No search results for lawyer ${lawyer.id}`);
    return {
      lawyerId: lawyer.id!,
      enrichedFields: {},
      sources: [],
      confidence: 0,
      cost: 0,
      timeMs: Date.now() - startTime,
    };
  }

  // Step 2: Extract data from top search results
  const extractedData: LawyerSearchResult[] = [];
  const sources: Array<{
    url: string;
    type: "website" | "linkedin" | "directory" | "news";
    confidence: number;
  }> = [];

  // Process top 3 results
  for (const result of searchResults.slice(0, 3)) {
    const data = await extractFromWebpage(result.url, lawyer.name || "");

    if (data) {
      extractedData.push(data);

      // Determine source type and confidence
      let type: "website" | "linkedin" | "directory" | "news" = "website";
      let confidence = 0.7;

      if (result.url.includes("linkedin.com")) {
        type = "linkedin";
        confidence = 0.9;
      } else if (
        result.url.includes("advocatenorde.nl") ||
        result.url.includes("rechtspraak.nl")
      ) {
        type = "directory";
        confidence = 0.95;
      }

      sources.push({
        url: result.url,
        type,
        confidence,
      });

      // Add small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Step 3: Merge and validate data
  const { enrichedFields, confidence } = mergeEnrichedData(
    lawyer,
    extractedData,
    sources
  );

  const timeMs = Date.now() - startTime;

  console.log(
    `[Enrichment] Completed for lawyer ${lawyer.id}: ${Object.keys(enrichedFields).length} fields enriched, confidence: ${(confidence * 100).toFixed(1)}%`
  );

  return {
    lawyerId: lawyer.id!,
    enrichedFields,
    sources,
    confidence,
    cost: totalCost,
    timeMs,
  };
}

/**
 * Batch enrich multiple lawyers
 */
export async function enrichLawyersBatch(
  lawyers: Partial<Lawyer>[],
  maxConcurrency: number = 3
): Promise<EnrichmentResult[]> {
  const results: EnrichmentResult[] = [];

  console.log(`[Enrichment] Starting batch enrichment for ${lawyers.length} lawyers`);

  // Process in batches to avoid overwhelming the system
  for (let i = 0; i < lawyers.length; i += maxConcurrency) {
    const batch = lawyers.slice(i, i + maxConcurrency);

    const batchResults = await Promise.all(
      batch.map((lawyer) => enrichLawyerData(lawyer))
    );

    results.push(...batchResults);

    console.log(
      `[Enrichment] Batch ${Math.floor(i / maxConcurrency) + 1}/${Math.ceil(lawyers.length / maxConcurrency)} complete`
    );

    // Add delay between batches
    if (i + maxConcurrency < lawyers.length) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  // Calculate statistics
  const totalEnriched = results.reduce(
    (sum, r) => sum + Object.keys(r.enrichedFields).length,
    0
  );
  const avgConfidence =
    results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
  const totalCost = results.reduce((sum, r) => sum + r.cost, 0);

  console.log(`[Enrichment] Batch complete:
    - Lawyers processed: ${results.length}
    - Total fields enriched: ${totalEnriched}
    - Average confidence: ${(avgConfidence * 100).toFixed(1)}%
    - Total cost: $${totalCost.toFixed(4)}
  `);

  return results;
}

/**
 * Get enrichment priority for a lawyer
 * Higher score = higher priority for enrichment
 */
export function getEnrichmentPriority(lawyer: Partial<Lawyer>): number {
  let priority = 0;

  // Critical fields (contact information)
  if (!lawyer.email || lawyer.email === "") priority += 10;
  if (!lawyer.phone || lawyer.phone === "") priority += 10;
  if (!lawyer.website || lawyer.website === "") priority += 8;

  // Important fields (professional information)
  if (!lawyer.legalAreas || lawyer.legalAreas === "") priority += 7;
  if (!lawyer.experienceYears || lawyer.experienceYears === "") priority += 5;
  if (!lawyer.firmName || lawyer.firmName === "") priority += 5;

  // Nice-to-have fields
  if (!lawyer.languages || lawyer.languages === "") priority += 3;
  if (!lawyer.address || lawyer.address === "") priority += 2;

  return priority;
}

/**
 * Get lawyers that need enrichment, sorted by priority
 */
export async function getLawyersNeedingEnrichment(
  limit: number = 100
): Promise<Partial<Lawyer>[]> {
  const { getDb } = await import("./db");
  const { lawyers } = await import('./schema');
  const { or, eq, isNull } = await import("drizzle-orm");

  const db = await getDb();
  if (!db) return [];

  // Get lawyers with missing critical fields
  const incompleteLawyers = await db
    .select()
    .from(lawyers)
    .where(
      or(
        isNull(lawyers.email),
        eq(lawyers.email, ""),
        isNull(lawyers.phone),
        eq(lawyers.phone, ""),
        isNull(lawyers.website),
        eq(lawyers.website, ""),
        isNull(lawyers.legalAreas),
        eq(lawyers.legalAreas, "")
      )
    )
    .limit(limit * 2); // Get more than needed for sorting

  // Sort by priority
  const sorted = incompleteLawyers
    .map((lawyer) => ({
      lawyer,
      priority: getEnrichmentPriority(lawyer),
    }))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, limit)
    .map((item) => item.lawyer);

  return sorted;
}
