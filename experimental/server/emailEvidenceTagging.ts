import { invokeLLM } from "./llm";

/**
 * Email Evidence Auto-Tagging Service
 * 
 * Automatically categorizes and tags emails based on their content
 * using AI to identify evidence types, extract key entities, and assess relevance.
 */

export interface EmailClassification {
  category: 'contract' | 'termination' | 'correspondence' | 'invoice' | 'notice' | 'complaint' | 'other';
  tags: string[];
  entities: {
    names: string[];
    dates: string[];
    amounts: string[];
    companies: string[];
  };
  relevance: 'high' | 'medium' | 'low';
  confidence: number; // 0-100
  summary: string;
}

/**
 * Classify an email using AI
 */
export async function classifyEmail(
  subject: string,
  body: string,
  caseType?: string
): Promise<EmailClassification> {
  const prompt = `You are an AI assistant helping classify legal evidence from emails.

**Email Subject:** ${subject}

**Email Body:**
${body.substring(0, 2000)} ${body.length > 2000 ? '...(truncated)' : ''}

${caseType ? `**Case Type:** ${caseType}` : ''}

Please analyze this email and provide:
1. **Category**: What type of document is this? (contract, termination, correspondence, invoice, notice, complaint, other)
2. **Tags**: Relevant keywords (max 5)
3. **Entities**: Extract names, dates, monetary amounts, company names
4. **Relevance**: How relevant is this to a legal case? (high/medium/low)
5. **Confidence**: How confident are you in this classification? (0-100)
6. **Summary**: One-sentence summary of the email

Respond in JSON format:
{
  "category": "contract",
  "tags": ["employment", "salary", "benefits"],
  "entities": {
    "names": ["John Doe"],
    "dates": ["2024-01-15"],
    "amounts": ["€50,000"],
    "companies": ["ACME Corp"]
  },
  "relevance": "high",
  "confidence": 95,
  "summary": "Employment contract offer from ACME Corp to John Doe"
}`;

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are a legal evidence classification assistant. Always respond with valid JSON only, no additional text.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "email_classification",
          strict: true,
          schema: {
            type: "object",
            properties: {
              category: {
                type: "string",
                enum: ["contract", "termination", "correspondence", "invoice", "notice", "complaint", "other"],
              },
              tags: {
                type: "array",
                items: { type: "string" },
              },
              entities: {
                type: "object",
                properties: {
                  names: { type: "array", items: { type: "string" } },
                  dates: { type: "array", items: { type: "string" } },
                  amounts: { type: "array", items: { type: "string" } },
                  companies: { type: "array", items: { type: "string" } },
                },
                required: ["names", "dates", "amounts", "companies"],
                additionalProperties: false,
              },
              relevance: {
                type: "string",
                enum: ["high", "medium", "low"],
              },
              confidence: {
                type: "number",
                minimum: 0,
                maximum: 100,
              },
              summary: {
                type: "string",
              },
            },
            required: ["category", "tags", "entities", "relevance", "confidence", "summary"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from LLM");
    }

    const classification: EmailClassification = JSON.parse(content);
    return classification;
  } catch (error) {
    console.error("[EmailTagging] Classification error:", error);
    
    // Fallback: basic keyword matching
    return fallbackClassification(subject, body);
  }
}

/**
 * Fallback classification using keyword matching
 */
function fallbackClassification(subject: string, body: string): EmailClassification {
  const text = `${subject} ${body}`.toLowerCase();
  
  let category: EmailClassification['category'] = 'other';
  const tags: string[] = [];
  
  // Category detection
  if (text.includes('contract') || text.includes('overeenkomst')) {
    category = 'contract';
    tags.push('contract');
  } else if (text.includes('termination') || text.includes('ontslag') || text.includes('beëindiging')) {
    category = 'termination';
    tags.push('termination');
  } else if (text.includes('invoice') || text.includes('factuur')) {
    category = 'invoice';
    tags.push('invoice');
  } else if (text.includes('notice') || text.includes('kennisgeving')) {
    category = 'notice';
    tags.push('notice');
  } else if (text.includes('complaint') || text.includes('klacht')) {
    category = 'complaint';
    tags.push('complaint');
  } else {
    category = 'correspondence';
    tags.push('correspondence');
  }
  
  // Relevance detection
  let relevance: EmailClassification['relevance'] = 'low';
  if (category !== 'correspondence' && category !== 'other') {
    relevance = 'high';
  } else if (text.includes('legal') || text.includes('juridisch') || text.includes('lawyer') || text.includes('advocaat')) {
    relevance = 'medium';
  }
  
  return {
    category,
    tags,
    entities: {
      names: [],
      dates: [],
      amounts: [],
      companies: [],
    },
    relevance,
    confidence: 50, // Low confidence for fallback
    summary: subject || 'Email correspondence',
  };
}

/**
 * Batch classify multiple emails
 */
export async function batchClassifyEmails(
  emails: Array<{ id: string; subject: string; body: string; caseType?: string }>
): Promise<Map<string, EmailClassification>> {
  const results = new Map<string, EmailClassification>();
  
  // Process in batches of 5 to avoid rate limits
  const batchSize = 5;
  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    
    const promises = batch.map(async (email) => {
      const classification = await classifyEmail(email.subject, email.body, email.caseType);
      results.set(email.id, classification);
    });
    
    await Promise.all(promises);
    
    // Small delay between batches
    if (i + batchSize < emails.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}
