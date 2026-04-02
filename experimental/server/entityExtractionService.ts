import { invokeLLM } from "./llm";
import { invokeMultiProviderLLM } from "./multiProviderLLM";
import { getDb } from "./db";
import { extractedEntities, InsertExtractedEntity } from "./schema";
import { nanoid } from "nanoid";

export type EntityType =
  | "person"
  | "organization"
  | "location"
  | "date"
  | "amount"
  | "legal_citation"
  | "contract_term"
  | "other";

export interface ExtractedEntity {
  entityType: EntityType;
  entityValue: string;
  context: string;
  confidence: number;
  pageNumber?: number;
}

export interface DocumentClassification {
  documentType: string;
  confidence: number;
  suggestedCategory: string;
  keyTerms: string[];
}

/**
 * Extract entities from text using AI with multi-provider support
 * @param text - Text to extract entities from
 * @param caseId - Case ID for context
 * @returns Array of extracted entities
 */
export async function extractEntitiesFromText(
  text: string,
  caseId: string
): Promise<ExtractedEntity[]> {
  try {
    // Use multi-provider LLM with speed-optimized strategy
    // Entity extraction benefits from fast inference (Groq's Llama 3.3 is excellent here)
    const llmResponse = await invokeMultiProviderLLM({
      messages: [
        {
          role: "system",
          content:
            "You are a legal document analyzer. Extract key entities from the provided text. Return a JSON array of entities.",
        },
        {
          role: "user",
          content: `Extract all important entities from this legal document text. For each entity, provide:
- entityType: person, organization, location, date, amount, legal_citation, contract_term, or other
- entityValue: the actual value/name
- context: surrounding text (max 200 chars)
- confidence: 0-100

Text:
${text.slice(0, 8000)}`, // Limit to 8000 chars to avoid token limits
        },
      ],
      responseFormat: {
        type: "json_schema",
        json_schema: {
          name: "entity_extraction",
          strict: true,
          schema: {
            type: "object",
            properties: {
              entities: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    entityType: {
                      type: "string",
                      enum: [
                        "person",
                        "organization",
                        "location",
                        "date",
                        "amount",
                        "legal_citation",
                        "contract_term",
                        "other",
                      ],
                    },
                    entityValue: { type: "string" },
                    context: { type: "string" },
                    confidence: { type: "integer", minimum: 0, maximum: 100 },
                  },
                  required: ["entityType", "entityValue", "context", "confidence"],
                  additionalProperties: false,
                },
              },
            },
            required: ["entities"],
            additionalProperties: false,
          },
        },
      },
      strategy: "speed-optimized", // Groq → Gemini → OpenAI → Together → Claude
    });

    console.log(
      `[Entity Extraction] Used ${llmResponse.provider} (${llmResponse.model}): ` +
      `${llmResponse.tokensUsed.total} tokens, $${llmResponse.cost.toFixed(4)}, ${llmResponse.responseTimeMs}ms`
    );

    const content = llmResponse.content;
    if (!content) {
      throw new Error("No response from LLM");
    }

    const result = JSON.parse(content);
    return result.entities || [];
  } catch (error) {
    console.error("[Entity Extraction] Error:", error);
    return []; // Return empty array on error
  }
}

/**
 * Classify document type using AI with multi-provider support
 * @param text - Document text
 * @param fileName - Original file name
 * @returns Document classification
 */
export async function classifyDocument(
  text: string,
  fileName: string
): Promise<DocumentClassification> {
  try {
    // Use cost-optimized strategy for classification (simpler task)
    const llmResponse = await invokeMultiProviderLLM({
      messages: [
        {
          role: "system",
          content:
            "You are a document classifier. Analyze the document and determine its type.",
        },
        {
          role: "user",
          content: `Classify this document. Provide:
- documentType: contract, email, invoice, court_filing, correspondence, receipt, legal_memo, or other
- confidence: 0-100
- suggestedCategory: brief category description
- keyTerms: array of 3-5 key terms that indicate document type

File name: ${fileName}

Text (first 3000 chars):
${text.slice(0, 3000)}`,
        },
      ],
      responseFormat: {
        type: "json_schema",
        json_schema: {
          name: "document_classification",
          strict: true,
          schema: {
            type: "object",
            properties: {
              documentType: { type: "string" },
              confidence: { type: "integer", minimum: 0, maximum: 100 },
              suggestedCategory: { type: "string" },
              keyTerms: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: ["documentType", "confidence", "suggestedCategory", "keyTerms"],
            additionalProperties: false,
          },
        },
      },
      strategy: "cost-optimized", // Gemini → Groq → Together → OpenAI → Claude
    });

    console.log(
      `[Document Classification] Used ${llmResponse.provider}: ` +
      `${llmResponse.tokensUsed.total} tokens, $${llmResponse.cost.toFixed(4)}`
    );

    const content = llmResponse.content;
    if (!content) {
      throw new Error("No response from LLM");
    }

    return JSON.parse(content);
  } catch (error) {
    console.error("[Document Classification] Error:", error);
    return {
      documentType: "other",
      confidence: 0,
      suggestedCategory: "unknown",
      keyTerms: [],
    };
  }
}

/**
 * Store extracted entities in database
 * @param entities - Entities to store
 * @param caseId - Case ID
 * @param evidenceFileId - Evidence file ID
 * @param reportId - Report ID (optional)
 */
export async function storeExtractedEntities(
  entities: ExtractedEntity[],
  caseId: string,
  evidenceFileId: string,
  reportId?: string
): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const records: InsertExtractedEntity[] = entities.map((entity) => ({
    id: nanoid(),
    caseId,
    evidenceFileId,
    reportId: reportId || null,
    entityType: entity.entityType,
    entityValue: entity.entityValue,
    context: entity.context,
    confidence: entity.confidence,
    pageNumber: entity.pageNumber || null,
    extractedAt: new Date(),
  }));

  if (records.length > 0) {
    await db.insert(extractedEntities).values(records);
  }
}
