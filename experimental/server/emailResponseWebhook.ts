/**
 * Email Response Webhook Handler
 * 
 * Receives incoming email responses from lawyers and automatically parses them
 * using LLM to determine intent (Accept/Decline/Questions/Interested)
 */

import { Router } from "express";
import { getDb } from "./db";
import { outreachStatus, lawyers, cases } from "./schema";
import { eq, and } from "drizzle-orm";
import { recordLawyerResponse } from "./outreach-automation";
import { invokeLLM } from "./llm";
import { answerLawyerQuestions, extractQuestionsFromEmail } from "./aiQuestionAnswering";

const router = Router();

/**
 * Parse lawyer response intent using LLM
 */
async function parseLawyerResponseIntent(emailBody: string): Promise<{
  intent: 'ACCEPT' | 'DECLINE' | 'INTERESTED' | 'QUESTIONS' | 'UNCLEAR';
  confidence: number;
  reasoning: string;
  extractedInfo?: {
    availability?: string;
    questions?: string[];
    concerns?: string[];
  };
}> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `You are an AI assistant that analyzes lawyer email responses to case outreach.
Your task is to determine the lawyer's intent from their email response.

Possible intents:
- ACCEPT: Lawyer explicitly accepts the case, wants to take it on
- INTERESTED: Lawyer is interested but needs more information or has questions
- QUESTIONS: Lawyer has questions before deciding
- DECLINE: Lawyer explicitly declines or says they cannot take the case
- UNCLEAR: Cannot determine intent from the email

Respond with JSON in this exact format:
{
  "intent": "ACCEPT" | "DECLINE" | "INTERESTED" | "QUESTIONS" | "UNCLEAR",
  "confidence": 0-100,
  "reasoning": "Brief explanation of why you chose this intent",
  "extractedInfo": {
    "availability": "When lawyer is available (if mentioned)",
    "questions": ["List of questions lawyer asked"],
    "concerns": ["Any concerns or conditions mentioned"]
  }
}`,
        },
        {
          role: 'user',
          content: `Analyze this lawyer's email response:\n\n${emailBody}`,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'lawyer_response_analysis',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              intent: {
                type: 'string',
                enum: ['ACCEPT', 'DECLINE', 'INTERESTED', 'QUESTIONS', 'UNCLEAR'],
              },
              confidence: {
                type: 'number',
                description: 'Confidence score 0-100',
              },
              reasoning: {
                type: 'string',
                description: 'Brief explanation',
              },
              extractedInfo: {
                type: 'object',
                properties: {
                  availability: { type: 'string' },
                  questions: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                  concerns: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                },
                required: [],
                additionalProperties: false,
              },
            },
            required: ['intent', 'confidence', 'reasoning'],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No response from LLM');
    }

    const parsed = JSON.parse(content);
    return parsed;
  } catch (error) {
    console.error('[Email Webhook] Error parsing intent with LLM:', error);
    
    // Fallback to simple keyword matching
    const lowerBody = emailBody.toLowerCase();
    
    if (lowerBody.includes('accept') || lowerBody.includes('yes') || lowerBody.includes('interested')) {
      return {
        intent: 'INTERESTED',
        confidence: 50,
        reasoning: 'Fallback keyword matching detected interest',
      };
    } else if (lowerBody.includes('decline') || lowerBody.includes('no') || lowerBody.includes('cannot')) {
      return {
        intent: 'DECLINE',
        confidence: 50,
        reasoning: 'Fallback keyword matching detected decline',
      };
    } else {
      return {
        intent: 'UNCLEAR',
        confidence: 30,
        reasoning: 'Could not parse intent',
      };
    }
  }
}

/**
 * Extract case ID from reply-to address
 * Format: cases+{caseId}@laro.nl
 */
function extractCaseIdFromReplyTo(replyTo: string): string | null {
  const match = replyTo.match(/cases\+([^@]+)@/);
  return match ? match[1] : null;
}

/**
 * Webhook endpoint for incoming email responses
 * 
 * Expects generic JSON format:
 * {
 *   "from": "lawyer@example.com",
 *   "to": "cases+{caseId}@laro.nl",
 *   "subject": "Re: Case inquiry",
 *   "body": "Email body text",
 *   "html": "<p>Email HTML</p>" (optional)
 * }
 */
router.post('/api/email-response', async (req, res) => {
  try {
    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }

    // Parse email data from request body (generic format)
    const emailData: {
      from: string;
      to: string;
      subject: string;
      body: string;
      html?: string;
    } = {
      from: req.body.from || req.body.sender,
      to: req.body.to || req.body.recipient,
      subject: req.body.subject,
      body: req.body.body || req.body.text || req.body.content,
      html: req.body.html,
    };

    if (!emailData.from || !emailData.to || !emailData.body) {
      return res.status(400).json({ error: 'Missing required email fields' });
    }

    console.log('[Email Webhook] Received email response from:', emailData.from);

    // Extract case ID from reply-to address
    const caseId = extractCaseIdFromReplyTo(emailData.to);
    if (!caseId) {
      console.log('[Email Webhook] Could not extract case ID from:', emailData.to);
      return res.status(400).json({ error: 'Invalid reply-to format' });
    }

    // Find lawyer by email
    const lawyerData = await db.select()
      .from(lawyers)
      .where(eq(lawyers.email, emailData.from))
      .limit(1);

    if (!lawyerData.length) {
      console.log('[Email Webhook] Lawyer not found with email:', emailData.from);
      return res.status(404).json({ error: 'Lawyer not found' });
    }

    const lawyer = lawyerData[0];

    // Check if outreach record exists
    const outreachData = await db.select()
      .from(outreachStatus)
      .where(and(
        eq(outreachStatus.caseId, caseId),
        eq(outreachStatus.lawyerId, lawyer.id)
      ))
      .limit(1);

    if (!outreachData.length) {
      console.log('[Email Webhook] Outreach record not found for case:', caseId, 'lawyer:', lawyer.id);
      return res.status(404).json({ error: 'Outreach record not found' });
    }

    // Parse intent using LLM
    const analysis = await parseLawyerResponseIntent(emailData.body);
    
    console.log('[Email Webhook] Intent analysis:', {
      intent: analysis.intent,
      confidence: analysis.confidence,
      reasoning: analysis.reasoning,
    });

    // Handle based on intent
    switch (analysis.intent) {
      case 'ACCEPT':
        // Lawyer explicitly accepts the case
        await recordLawyerResponse(caseId, lawyer.id, true, emailData.body);
        
        // Notify owner
        console.log(`[Email Webhook] 🎉 Lawyer ${lawyer.name} ACCEPTED case ${caseId}!`);
        
        // TODO: Send confirmation email to lawyer
        // TODO: Notify client
        // TODO: Schedule intro call
        break;

      case 'INTERESTED':
        // Lawyer is interested but needs more info
        await recordLawyerResponse(caseId, lawyer.id, true, emailData.body);
        
        console.log(`[Email Webhook] ✓ Lawyer ${lawyer.name} is INTERESTED in case ${caseId}`);
        
        // TODO: Forward questions to client or answer automatically with LLM
        break;

      case 'QUESTIONS':
        // Lawyer has questions - answer automatically with AI
        console.log(`[Email Webhook] ❓ Lawyer ${lawyer.name} has QUESTIONS about case ${caseId}`);
        
        // Extract questions from email
        const questions = await extractQuestionsFromEmail(emailData.body);
        
        if (questions.length > 0) {
          console.log(`[Email Webhook] Extracted ${questions.length} questions:`, questions);
          
          // Generate AI answer
          const aiResult = await answerLawyerQuestions(caseId, lawyer.id, questions);
          
          if (aiResult.success && !aiResult.needsManualReview && aiResult.confidence >= 80) {
            // AI answered with high confidence - update status
            await db.update(outreachStatus)
              .set({
                status: 'Questions Answered',
                response: emailData.body,
              })
              .where(and(
                eq(outreachStatus.caseId, caseId),
                eq(outreachStatus.lawyerId, lawyer.id)
              ));
            
            console.log(`[Email Webhook] ✅ AI answered questions automatically (confidence: ${aiResult.confidence}%)`);
          } else {
            // Needs manual review
            await db.update(outreachStatus)
              .set({
                status: 'Manual Review',
                response: emailData.body,
              })
              .where(and(
                eq(outreachStatus.caseId, caseId),
                eq(outreachStatus.lawyerId, lawyer.id)
              ));
            
            console.log(`[Email Webhook] ⚠️ Questions need manual review (confidence: ${aiResult.confidence}%, reason: ${aiResult.reasoning})`);
          }
        } else {
          // No questions extracted - mark for review
          await db.update(outreachStatus)
            .set({
              status: 'Manual Review',
              response: emailData.body,
            })
            .where(and(
              eq(outreachStatus.caseId, caseId),
              eq(outreachStatus.lawyerId, lawyer.id)
            ));
        }
        break;

      case 'DECLINE':
        // Lawyer declines the case
        await recordLawyerResponse(caseId, lawyer.id, false, emailData.body);
        
        console.log(`[Email Webhook] ✗ Lawyer ${lawyer.name} DECLINED case ${caseId}`);
        
        // System will automatically move to next lawyer via cron job
        break;

      case 'UNCLEAR':
        // Cannot determine intent - mark for manual review
        await db.update(outreachStatus)
          .set({
            status: 'Manual Review',
            response: emailData.body,
          })
          .where(and(
            eq(outreachStatus.caseId, caseId),
            eq(outreachStatus.lawyerId, lawyer.id)
          ));
        
        console.log(`[Email Webhook] ⚠️ UNCLEAR response from lawyer ${lawyer.name} for case ${caseId}`);
        
        // TODO: Notify owner for manual review
        break;
    }

    return res.status(200).json({
      success: true,
      caseId,
      lawyerId: lawyer.id,
      intent: analysis.intent,
      confidence: analysis.confidence,
    });

  } catch (error) {
    console.error('[Email Webhook] Error processing email response:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Health check endpoint
 */
router.get('/api/email-response/health', (req, res) => {
  res.json({ status: 'ok', service: 'email-response-webhook' });
});

export default router;
