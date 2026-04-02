import { invokeLLM } from "./llm";
import { getDb } from "./db";
import { evidence } from "./schema";
import { eq } from "drizzle-orm";

interface ScoringResult {
  itemId: string;
  relevanceScore: number; // 0-100
  reasoning: string;
  keywords: string[];
  caseRelevance: "high" | "medium" | "low";
}

interface CaseContext {
  caseId: string;
  description: string;
  legalArea: string;
  keyIssues: string[];
}

/**
 * Score a single evidence item for relevance using LLM
 */
export async function scoreEvidenceRelevance(
  itemId: string,
  itemTitle: string,
  itemDescription: string | undefined,
  caseContext: CaseContext
): Promise<ScoringResult> {
  try {
    const prompt = `You are a legal evidence relevance analyzer. Analyze the following evidence item and determine its relevance to the case.

CASE INFORMATION:
- Case ID: ${caseContext.caseId}
- Description: ${caseContext.description}
- Legal Area: ${caseContext.legalArea}
- Key Issues: ${caseContext.keyIssues.join(", ")}

EVIDENCE ITEM:
- Title: ${itemTitle}
- Description: ${itemDescription || "No description provided"}

Please analyze this evidence and provide:
1. A relevance score from 0-100 (100 = highly relevant, 0 = not relevant)
2. A brief reasoning (1-2 sentences)
3. Key keywords that make this evidence relevant or irrelevant
4. Overall relevance category (high/medium/low)

Respond in JSON format:
{
  "relevanceScore": <number 0-100>,
  "reasoning": "<brief explanation>",
  "keywords": ["keyword1", "keyword2", ...],
  "caseRelevance": "high" | "medium" | "low"
}`;

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are a legal evidence relevance analyzer. Provide responses in valid JSON format only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    // Extract JSON from response
    const content = response.choices[0]?.message?.content || "{}";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    return {
      itemId,
      relevanceScore: Math.min(100, Math.max(0, result.relevanceScore || 0)),
      reasoning: result.reasoning || "Unable to determine relevance",
      keywords: result.keywords || [],
      caseRelevance: result.caseRelevance || "low",
    };
  } catch (error) {
    console.error("[Relevance Scoring] Error scoring evidence:", error);
    // Return neutral score on error
    return {
      itemId,
      relevanceScore: 50,
      reasoning: "Unable to score due to system error",
      keywords: [],
      caseRelevance: "medium",
    };
  }
}

/**
 * Score all evidence for a case
 */
export async function scoreAllEvidenceForCase(
  caseId: string,
  caseContext: CaseContext,
  options?: { limit?: number }
): Promise<ScoringResult[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const limit = options?.limit || 100;

    // Fetch evidence items
    const items = await db
      .select()
      .from(evidence)
      .where(eq(evidence.caseId, caseId))
      .limit(limit);

    // Score each item
    const scoringResults = await Promise.all(
      items.map((item) =>
        scoreEvidenceRelevance(
          item.id,
          item.title,
          item.description || undefined,
          caseContext
        )
      )
    );

    // Update database with scores
    for (const result of scoringResults) {
      const item = items.find((i) => i.id === result.itemId);
      if (item) {
        const metadata = item.metadata ? JSON.parse(item.metadata) : {};
        metadata.relevanceScore = result.relevanceScore;
        metadata.scoringReasoning = result.reasoning;
        metadata.scoringKeywords = result.keywords;
        metadata.caseRelevance = result.caseRelevance;

        await db
          .update(evidence)
          .set({
            relevant: result.relevanceScore >= 60, // Mark as relevant if score >= 60
            metadata: JSON.stringify(metadata),
          })
          .where(eq(evidence.id, result.itemId));
      }
    }

    return scoringResults;
  } catch (error) {
    console.error("[Relevance Scoring] Error scoring all evidence:", error);
    throw error;
  }
}

/**
 * Batch score evidence with progress tracking
 */
export async function batchScoreEvidence(
  caseId: string,
  caseContext: CaseContext,
  options?: {
    batchSize?: number;
    onProgress?: (progress: { completed: number; total: number }) => void;
  }
): Promise<ScoringResult[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const batchSize = options?.batchSize || 10;

    // Fetch all evidence items
    const items = await db.select().from(evidence).where(eq(evidence.caseId, caseId));

    const totalItems = items.length;
    const results: ScoringResult[] = [];

    // Process in batches
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map((item) =>
          scoreEvidenceRelevance(
            item.id,
            item.title,
            item.description || undefined,
            caseContext
          )
        )
      );

      results.push(...batchResults);

      // Update database for this batch
      for (const result of batchResults) {
        const item = batch.find((b) => b.id === result.itemId);
        if (item) {
          const metadata = item.metadata ? JSON.parse(item.metadata) : {};
          metadata.relevanceScore = result.relevanceScore;
          metadata.scoringReasoning = result.reasoning;
          metadata.scoringKeywords = result.keywords;
          metadata.caseRelevance = result.caseRelevance;

          await db
            .update(evidence)
            .set({
              relevant: result.relevanceScore >= 60,
              metadata: JSON.stringify(metadata),
            })
            .where(eq(evidence.id, result.itemId));
        }
      }

      // Report progress
      if (options?.onProgress) {
        options.onProgress({
          completed: Math.min(i + batchSize, totalItems),
          total: totalItems,
        });
      }
    }

    return results;
  } catch (error) {
    console.error("[Relevance Scoring] Error batch scoring evidence:", error);
    throw error;
  }
}

/**
 * Get relevance statistics for a case
 */
export async function getRelevanceStatistics(caseId: string) {
  const db = await getDb();
  if (!db) {
    return {
      totalScored: 0,
      highRelevance: 0,
      mediumRelevance: 0,
      lowRelevance: 0,
      averageScore: 0,
      topKeywords: [],
    };
  }

  try {
    const items = await db.select().from(evidence).where(eq(evidence.caseId, caseId));

    let totalScored = 0;
    let highRelevance = 0;
    let mediumRelevance = 0;
    let lowRelevance = 0;
    let totalScore = 0;
    const keywordFrequency: Record<string, number> = {};

    items.forEach((item) => {
      const metadata = item.metadata ? JSON.parse(item.metadata) : {};
      const score = metadata.relevanceScore;

      if (score !== undefined) {
        totalScored++;
        totalScore += score;

        if (score >= 70) {
          highRelevance++;
        } else if (score >= 40) {
          mediumRelevance++;
        } else {
          lowRelevance++;
        }

        // Track keywords
        const keywords = metadata.scoringKeywords || [];
        keywords.forEach((keyword: string) => {
          keywordFrequency[keyword] = (keywordFrequency[keyword] || 0) + 1;
        });
      }
    });

    // Get top keywords
    const topKeywords = Object.entries(keywordFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([keyword, frequency]) => ({ keyword, frequency }));

    return {
      totalScored,
      highRelevance,
      mediumRelevance,
      lowRelevance,
      averageScore: totalScored > 0 ? Math.round(totalScore / totalScored) : 0,
      topKeywords,
    };
  } catch (error) {
    console.error("[Relevance Scoring] Error getting statistics:", error);
    throw error;
  }
}

/**
 * Rescore evidence item (update existing score)
 */
export async function rescoreEvidenceItem(
  itemId: string,
  caseContext: CaseContext
): Promise<ScoringResult> {
  const db = await getDb();
  if (!db) {
    return {
      itemId,
      relevanceScore: 0,
      reasoning: "Database not available",
      keywords: [],
      caseRelevance: "low",
    };
  }

  try {
    // Fetch the item
    const item = await db.select().from(evidence).where(eq(evidence.id, itemId)).limit(1);

    if (!item.length) {
      throw new Error("Evidence item not found");
    }

    const evidenceItem = item[0];

    // Score the item
    const result = await scoreEvidenceRelevance(
      itemId,
      evidenceItem.title,
      evidenceItem.description || undefined,
      caseContext
    );

    // Update database
    const metadata = evidenceItem.metadata ? JSON.parse(evidenceItem.metadata) : {};
    metadata.relevanceScore = result.relevanceScore;
    metadata.scoringReasoning = result.reasoning;
    metadata.scoringKeywords = result.keywords;
    metadata.caseRelevance = result.caseRelevance;
    metadata.lastScoredAt = new Date().toISOString();

    await db
      .update(evidence)
      .set({
        relevant: result.relevanceScore >= 60,
        metadata: JSON.stringify(metadata),
      })
      .where(eq(evidence.id, itemId));

    return result;
  } catch (error) {
    console.error("[Relevance Scoring] Error rescoring item:", error);
    throw error;
  }
}
