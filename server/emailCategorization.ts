// @ts-nocheck

import { invokeLLM } from './llm';
import type { FetchedEmail } from './emailService';
import { trackUsage } from './usageTracking';

/**
 * Email Categorization Service
 * AI-powered analysis of emails for legal relevance
 */

export interface EmailAnalysis {
  relevanceScore: number; // 0-100
  category: 'correspondence' | 'contract' | 'invoice' | 'notice' | 'legal_document' | 'other';
  extractedParties: string[]; // Names and companies mentioned
  extractedDates: string[]; // Important dates (deadlines, meetings, etc.)
  extractedKeywords: string[]; // Legal keywords (termination, dispute, claim, etc.)
  summary: string; // AI-generated summary
  reasoning: string; // Why this email is relevant/not relevant
}

/**
 * Legal keywords that indicate high relevance
 */
const LEGAL_KEYWORDS = [
  // Dutch legal terms
  'ontslag', 'opzegging', 'beëindiging', 'geschil', 'vordering', 'claim', 'aansprakelijkheid',
  'schadevergoeding', 'contract', 'overeenkomst', 'rechtszaak', 'advocaat', 'rechtbank',
  'dagvaarding', 'sommatie', 'ingebrekestelling', 'dwangsom', 'boete', 'sanctie',
  
  // English legal terms
  'termination', 'dismissal', 'dispute', 'claim', 'liability', 'damages', 'compensation',
  'contract', 'agreement', 'lawsuit', 'lawyer', 'attorney', 'court', 'summons',
  'notice', 'default', 'penalty', 'fine', 'sanction',
  
  // Employment-specific
  'arbeidsovereenkomst', 'arbeidscontract', 'proeftijd', 'opzegtermijn', 'transitievergoeding',
  'employment contract', 'probation', 'notice period', 'severance',
  
  // Dispute-specific
  'geschillencommissie', 'mediator', 'arbitrage', 'klacht', 'bezwaar',
  'dispute resolution', 'mediation', 'arbitration', 'complaint', 'objection',
];

/**
 * Analyze email for legal relevance using AI
 */
export async function analyzeEmail(email: FetchedEmail, caseContext?: string): Promise<EmailAnalysis> {
  // Quick keyword check for initial relevance
  const hasLegalKeywords = LEGAL_KEYWORDS.some(keyword =>
    email.subject.toLowerCase().includes(keyword) ||
    email.body.toLowerCase().includes(keyword)
  );

  // Build prompt for LLM
  const prompt = `You are a legal assistant analyzing emails for a Dutch legal case. Analyze this email and provide a structured assessment.

${caseContext ? `**Case Context:** ${caseContext}\n\n` : ''}**Email Details:**
- Subject: ${email.subject}
- From: ${email.fromName} <${email.from}>
- To: ${email.to.join(', ')}
- Date: ${email.date.toISOString()}
- Body Preview: ${email.snippet || email.body.substring(0, 500)}

**Analysis Required:**
1. **Relevance Score (0-100):** How relevant is this email to a legal dispute?
   - 90-100: Critical legal document (contract, termination letter, legal notice)
   - 70-89: Important correspondence (dispute-related, formal complaints)
   - 50-69: Potentially relevant (mentions legal issues, parties involved)
   - 30-49: Tangentially related (business correspondence, general communication)
   - 0-29: Not relevant (spam, marketing, unrelated topics)

2. **Category:** Classify the email type:
   - correspondence: Regular business/personal communication
   - contract: Contracts, agreements, terms
   - invoice: Invoices, payment requests, financial documents
   - notice: Legal notices, warnings, formal notifications
   - legal_document: Court documents, lawyer letters, legal filings
   - other: Doesn't fit above categories

3. **Extracted Parties:** List all people, companies, or organizations mentioned (names only, no emails)

4. **Extracted Dates:** List important dates mentioned (deadlines, meetings, events) in YYYY-MM-DD format

5. **Extracted Keywords:** List legal keywords found (termination, dispute, claim, etc.)

6. **Summary:** One-sentence summary of the email's content

7. **Reasoning:** Brief explanation of why this email is or isn't relevant to a legal case

Respond in JSON format:
{
  "relevanceScore": 85,
  "category": "notice",
  "extractedParties": ["Company X", "John Doe"],
  "extractedDates": ["2025-01-15", "2025-02-01"],
  "extractedKeywords": ["termination", "notice period"],
  "summary": "Formal termination notice from employer",
  "reasoning": "This is a critical legal document that formally terminates employment"
}`;

  try {
    // Track AI email analysis usage
    const startTime = Date.now();
    
    const response = await invokeLLM({
      messages: [
        { role: 'system', content: 'You are a legal assistant specializing in Dutch employment and contract law. Analyze emails for legal relevance.' },
        { role: 'user', content: prompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'email_analysis',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              relevanceScore: { type: 'number', description: 'Relevance score 0-100' },
              category: { 
                type: 'string', 
                enum: ['correspondence', 'contract', 'invoice', 'notice', 'legal_document', 'other'],
                description: 'Email category'
              },
              extractedParties: { 
                type: 'array', 
                items: { type: 'string' },
                description: 'Names of people and organizations'
              },
              extractedDates: { 
                type: 'array', 
                items: { type: 'string' },
                description: 'Important dates in YYYY-MM-DD format'
              },
              extractedKeywords: { 
                type: 'array', 
                items: { type: 'string' },
                description: 'Legal keywords found'
              },
              summary: { type: 'string', description: 'One-sentence summary' },
              reasoning: { type: 'string', description: 'Why relevant or not' },
            },
            required: ['relevanceScore', 'category', 'extractedParties', 'extractedDates', 'extractedKeywords', 'summary', 'reasoning'],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from LLM');
    }

    const analysis: EmailAnalysis = JSON.parse(content);
    
    // Track usage after successful analysis
    const tokensUsed = response.usage?.total_tokens || 0;
    await trackUsage({
      userId: 'system', // Will be replaced by actual userId in router
      resourceType: 'ai_email_analysis',
      quantity: 1,
      metadata: {
        emailId: email.messageId,
        tokensUsed,
        processingTime: Date.now() - startTime,
        relevanceScore: analysis.relevanceScore,
      },
    }).catch(err => {
      console.error('[EMAIL_CATEGORIZATION] Failed to track usage:', err);
    });

    // Boost score if legal keywords found
    if (hasLegalKeywords && analysis.relevanceScore < 50) {
      analysis.relevanceScore = Math.min(analysis.relevanceScore + 20, 100);
    }

    console.log(`[EMAIL_CATEGORIZATION] Analyzed email "${email.subject}" - Score: ${analysis.relevanceScore}, Category: ${analysis.category}`);

    return analysis;

  } catch (error) {
    console.error('[EMAIL_CATEGORIZATION] Error analyzing email:', error);

    // Fallback to keyword-based analysis
    return {
      relevanceScore: hasLegalKeywords ? 60 : 20,
      category: hasLegalKeywords ? 'correspondence' : 'other',
      extractedParties: extractPartiesFromText(email.body),
      extractedDates: extractDatesFromText(email.body),
      extractedKeywords: LEGAL_KEYWORDS.filter(keyword =>
        email.subject.toLowerCase().includes(keyword) ||
        email.body.toLowerCase().includes(keyword)
      ),
      summary: email.snippet || email.subject,
      reasoning: hasLegalKeywords ? 'Contains legal keywords' : 'No legal keywords found',
    };
  }
}

/**
 * Batch analyze multiple emails
 */
export async function analyzeEmailBatch(
  emails: FetchedEmail[],
  caseContext?: string,
  onProgress?: (processed: number, total: number) => void
): Promise<Map<string, EmailAnalysis>> {
  const results = new Map<string, EmailAnalysis>();

  for (let i = 0; i < emails.length; i++) {
    const email = emails[i];
    
    try {
      const analysis = await analyzeEmail(email, caseContext);
      results.set(email.messageId, analysis);
      
      if (onProgress) {
        onProgress(i + 1, emails.length);
      }
    } catch (error) {
      console.error(`[EMAIL_CATEGORIZATION] Error analyzing email ${email.messageId}:`, error);
    }

    // Rate limiting: wait 100ms between requests
    if (i < emails.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return results;
}

/**
 * Extract party names from text (fallback method)
 */
function extractPartiesFromText(text: string): string[] {
  const parties: string[] = [];
  
  // Simple regex for capitalized names (2-3 words)
  const nameRegex = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b/g;
  const matches = text.match(nameRegex);
  
  if (matches) {
    // Deduplicate and filter common words
    const commonWords = ['Dear', 'Sincerely', 'Best', 'Regards', 'From', 'To', 'Subject'];
    parties.push(...new Set(matches.filter(name => !commonWords.includes(name))));
  }

  return parties.slice(0, 10); // Limit to 10 parties
}

/**
 * Extract dates from text (fallback method)
 */
function extractDatesFromText(text: string): string[] {
  const dates: string[] = [];
  
  // Regex for various date formats
  const dateRegex = /\b(\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2})\b/g;
  const matches = text.match(dateRegex);
  
  if (matches) {
    for (const match of matches) {
      try {
        const date = new Date(match);
        if (!isNaN(date.getTime())) {
          dates.push(date.toISOString().split('T')[0]);
        }
      } catch {
        // Invalid date, skip
      }
    }
  }

  return [...new Set(dates)].slice(0, 10); // Deduplicate and limit to 10 dates
}

/**
 * Filter emails by relevance threshold
 */
export function filterRelevantEmails(
  emails: FetchedEmail[],
  analyses: Map<string, EmailAnalysis>,
  minRelevanceScore: number = 50
): FetchedEmail[] {
  return emails.filter(email => {
    const analysis = analyses.get(email.messageId);
    return analysis && analysis.relevanceScore >= minRelevanceScore;
  });
}

/**
 * Group emails by category
 */
export function groupEmailsByCategory(
  emails: FetchedEmail[],
  analyses: Map<string, EmailAnalysis>
): Map<string, FetchedEmail[]> {
  const groups = new Map<string, FetchedEmail[]>();

  for (const email of emails) {
    const analysis = analyses.get(email.messageId);
    if (!analysis) continue;

    const category = analysis.category;
    if (!groups.has(category)) {
      groups.set(category, []);
    }
    groups.get(category)!.push(email);
  }

  return groups;
}

