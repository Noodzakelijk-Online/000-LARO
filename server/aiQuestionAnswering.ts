/**
 * AI Question Answering Service
 * 
 * Automatically responds to lawyer questions using LLM with case context
 */

import { invokeLLM } from "./llm";
import { getDb } from "./db";
import { cases, lawyers, outreachStatus } from "./schema";
import { eq } from "drizzle-orm";
import { sendEmail } from "./email-service";

export interface QuestionAnsweringResult {
  success: boolean;
  answer?: string;
  confidence: number;
  needsManualReview: boolean;
  reasoning: string;
}

/**
 * Answer lawyer's questions using AI with case context
 */
export async function answerLawyerQuestions(
  caseId: string,
  lawyerId: string,
  questions: string[]
): Promise<QuestionAnsweringResult> {
  try {
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    // Get case details
    const caseData = await db.select().from(cases).where(eq(cases.id, caseId)).limit(1);
    if (!caseData.length) {
      throw new Error("Case not found");
    }
    const caseInfo = caseData[0];

    // Get lawyer details
    const lawyerData = await db.select().from(lawyers).where(eq(lawyers.id, lawyerId)).limit(1);
    if (!lawyerData.length) {
      throw new Error("Lawyer not found");
    }
    const lawyerInfo = lawyerData[0];

    // Build context for LLM
    const context = buildCaseContext(caseInfo);
    
    // Generate answer using LLM
    const result = await generateAnswer(questions, context, lawyerInfo.name || "Geachte heer/mevrouw");
    
    // If high confidence, send email automatically
    if (result.confidence >= 80 && !result.needsManualReview) {
      await sendAnswerEmail(caseId, lawyerInfo.email || "", lawyerInfo.name || "Advocaat", result.answer!);
    }
    
    return result;
  } catch (error) {
    console.error("[AI Q&A] Error answering questions:", error);
    return {
      success: false,
      confidence: 0,
      needsManualReview: true,
      reasoning: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Build comprehensive case context for LLM
 */
function buildCaseContext(caseInfo: any): string {
  return `
CASE INFORMATION:
- Case Type: ${caseInfo.caseType}
- Client Name: ${caseInfo.clientName}
- Client Email: ${caseInfo.clientEmail || "Not provided"}
- Client Phone: ${caseInfo.clientPhone || "Not provided"}
- Urgency: ${caseInfo.urgency}
- Status: ${caseInfo.status}

CASE DETAILS:
${caseInfo.caseDetails || "No additional details provided"}

EVIDENCE:
${caseInfo.evidence || "No evidence details provided"}

LOCATION:
- City: ${caseInfo.city || "Not specified"}
- Province: ${caseInfo.province || "Not specified"}

TIMELINE:
- Case Created: ${caseInfo.createdAt ? new Date(caseInfo.createdAt).toLocaleDateString('nl-NL') : "Unknown"}
- Expected Start: ${caseInfo.expectedStartDate ? new Date(caseInfo.expectedStartDate).toLocaleDateString('nl-NL') : "As soon as possible"}

BUDGET:
- Budget Range: ${caseInfo.budgetRange || "To be discussed"}
- Payment Method: ${caseInfo.paymentMethod || "To be discussed"}
`.trim();
}

/**
 * Generate answer using LLM
 */
async function generateAnswer(
  questions: string[],
  caseContext: string,
  lawyerName: string
): Promise<QuestionAnsweringResult> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are an AI assistant for LARO (Lawyer Automation Rotterdam), helping to answer lawyer questions about potential cases.

Your role:
- Answer questions professionally and accurately based on the case information provided
- Be transparent about what information is available and what isn't
- Maintain a professional, helpful tone
- Use Dutch language for responses (lawyers in Netherlands)
- If a question requires information not in the case context, clearly state that it needs to be discussed with the client
- Flag questions that need manual review (e.g., legal advice, pricing negotiations, complex scheduling)

Respond with JSON in this exact format:
{
  "answer": "Your detailed answer in Dutch",
  "confidence": 0-100,
  "needsManualReview": true/false,
  "reasoning": "Why you chose this confidence level and review status"
}`,
        },
        {
          role: "user",
          content: `Lawyer Name: ${lawyerName}

CASE CONTEXT:
${caseContext}

LAWYER'S QUESTIONS:
${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Please answer these questions based on the case information available.`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "lawyer_question_answer",
          strict: true,
          schema: {
            type: "object",
            properties: {
              answer: {
                type: "string",
                description: "Detailed answer in Dutch",
              },
              confidence: {
                type: "number",
                description: "Confidence score 0-100",
              },
              needsManualReview: {
                type: "boolean",
                description: "Whether this needs manual review",
              },
              reasoning: {
                type: "string",
                description: "Explanation of confidence and review decision",
              },
            },
            required: ["answer", "confidence", "needsManualReview", "reasoning"],
            additionalProperties: false,
          },
        },
      },
    });

    const rawContent = response.choices[0].message.content;
    const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent || "{}");
    if (!content || content === "{}") {
      throw new Error("No response from LLM");
    }

    const parsed = JSON.parse(content);
    
    console.log("[AI Q&A] Generated answer:", {
      confidence: parsed.confidence,
      needsManualReview: parsed.needsManualReview,
      reasoning: parsed.reasoning,
    });

    return {
      success: true,
      ...parsed,
    };
  } catch (error) {
    console.error("[AI Q&A] Error generating answer:", error);
    return {
      success: false,
      confidence: 0,
      needsManualReview: true,
      reasoning: error instanceof Error ? error.message : "LLM error",
    };
  }
}

/**
 * Send answer email to lawyer
 */
async function sendAnswerEmail(
  caseId: string,
  lawyerEmail: string,
  lawyerName: string,
  answer: string
): Promise<void> {
  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .answer { background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; }
    .footer { text-align: center; color: #666; margin-top: 30px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Antwoord op uw vragen</h1>
      <p>Automatisch gegenereerd door LARO AI</p>
    </div>
    <div class="content">
      <p>Beste ${lawyerName},</p>
      
      <p>Bedankt voor uw interesse in deze zaak. Hieronder vindt u antwoorden op uw vragen:</p>
      
      <div class="answer">
        ${answer.split('\n').map(line => `<p>${line}</p>`).join('')}
      </div>
      
      <p>Als u aanvullende vragen heeft of meer informatie nodig heeft, kunt u direct reageren op deze email. Wij zorgen ervoor dat uw vragen bij de juiste persoon terechtkomen.</p>
      
      <p>Met vriendelijke groet,<br>
      <strong>LARO Team</strong><br>
      Lawyer Automation Rotterdam</p>
      
      <div class="footer">
        <p>Deze email is automatisch gegenereerd door AI en gecontroleerd op nauwkeurigheid.<br>
        Voor dringende zaken kunt u contact opnemen via info@laro.nl</p>
      </div>
    </div>
  </div>
</body>
</html>
`.trim();

  await sendEmail({
    to: lawyerEmail,
    subject: "Re: Antwoord op uw vragen over de zaak",
    html: emailHtml,
    replyTo: `cases+${caseId}@laro.nl`,
  });

  console.log(`[AI Q&A] Sent answer email to ${lawyerEmail}`);
}

/**
 * Extract questions from lawyer's email response
 */
export async function extractQuestionsFromEmail(emailBody: string): Promise<string[]> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are an AI assistant that extracts questions from lawyer email responses.

Your task:
- Identify all questions the lawyer is asking
- Extract them as a list of clear, standalone questions
- Ignore greetings, signatures, and non-question content
- Preserve the original language (Dutch or English)

Respond with JSON in this exact format:
{
  "questions": ["Question 1", "Question 2", ...]
}`,
        },
        {
          role: "user",
          content: `Extract all questions from this lawyer's email:\n\n${emailBody}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "question_extraction",
          strict: true,
          schema: {
            type: "object",
            properties: {
              questions: {
                type: "array",
                items: { type: "string" },
                description: "List of extracted questions",
              },
            },
            required: ["questions"],
            additionalProperties: false,
          },
        },
      },
    });

    const rawContent = response.choices[0].message.content;
    const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent || "{}");
    if (!content || content === "{}") {
      return [];
    }

    const parsed = JSON.parse(content);
    return parsed.questions || [];
  } catch (error) {
    console.error("[AI Q&A] Error extracting questions:", error);
    return [];
  }
}
