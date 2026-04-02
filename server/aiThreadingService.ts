import { invokeLLM } from "./llm";
import * as inboxService from "./unifiedInboxService";
import { nanoid } from "nanoid";

export interface ThreadAnalysis {
  shouldCreateNewThread: boolean;
  existingThreadId?: string;
  subject: string;
  topics: string[];
  sentiment: "positive" | "neutral" | "negative";
  category: string;
  suggestedCaseId?: string;
  confidence: number;
}

/**
 * Analyze a message and determine threading strategy using AI
 */
export async function analyzeMessageForThreading(
  userId: string,
  messageContent: {
    sender: string;
    recipient: string;
    subject?: string;
    body: string;
    channel: string;
  }
): Promise<ThreadAnalysis> {
  // Get recent threads for the user
  const recentThreads = await inboxService.getThreadsByUser(userId, {}, 20, 0);

  // Build context for LLM
  const threadsContext = recentThreads
    .map(
      (t) =>
        `Thread ID: ${t.id}\nTitle: ${t.title || "No Title"}\nTopics: ${t.aiTopics || "N/A"}\nParticipants: ${t.participants || "{}"}`
    )
    .join("\n\n");

  const prompt = `You are an AI assistant that analyzes messages and determines conversation threading.

RECENT THREADS:
${threadsContext || "No recent threads"}

NEW MESSAGE:
From: ${messageContent.sender}
To: ${messageContent.recipient}
Subject: ${messageContent.subject || "N/A"}
Body: ${messageContent.body}
Channel: ${messageContent.channel}

Analyze this message and determine:
1. Should it be added to an existing thread or create a new one?
2. If existing, which thread ID?
3. What is the main subject/topic?
4. What are the key topics discussed?
5. What is the sentiment?
6. What category does it belong to (legal_inquiry, case_update, evidence_submission, general_communication, urgent_matter)?
7. Confidence level (0-100)

Return your analysis in JSON format.`;

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are an expert at analyzing legal communications and organizing them into conversation threads.",
        },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "thread_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              shouldCreateNewThread: {
                type: "boolean",
                description: "Whether to create a new thread or use existing",
              },
              existingThreadId: {
                type: ["string", "null"],
                description: "ID of existing thread if applicable",
              },
              subject: {
                type: "string",
                description: "Main subject/topic of the message",
              },
              topics: {
                type: "array",
                items: { type: "string" },
                description: "Key topics discussed in the message",
              },
              sentiment: {
                type: "string",
                enum: ["positive", "neutral", "negative"],
                description: "Overall sentiment of the message",
              },
              category: {
                type: "string",
                enum: [
                  "legal_inquiry",
                  "case_update",
                  "evidence_submission",
                  "general_communication",
                  "urgent_matter",
                ],
                description: "Category of the message",
              },
              suggestedCaseId: {
                type: ["string", "null"],
                description: "Suggested case ID if message relates to a specific case",
              },
              confidence: {
                type: "number",
                description: "Confidence level 0-100",
              },
            },
            required: [
              "shouldCreateNewThread",
              "subject",
              "topics",
              "sentiment",
              "category",
              "confidence",
            ],
            additionalProperties: false,
          },
        },
      },
    });

    const rawContent = response.choices[0].message.content;
    const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent || "{}");
    const analysis = JSON.parse(content || "{}");
    return analysis as ThreadAnalysis;
  } catch (error) {
    console.error("Error analyzing message for threading:", error);
    // Fallback: create new thread
    return {
      shouldCreateNewThread: true,
      subject: messageContent.subject || "Conversation",
      topics: [],
      sentiment: "neutral",
      category: "general_communication",
      confidence: 50,
    };
  }
}

/**
 * Process a new message and assign it to a thread
 */
export async function processMessageThreading(
  userId: string,
  messageData: {
    caseId?: string;
    channel: "email" | "sms" | "whatsapp" | "in_app";
    externalId?: string;
    sender: string;
    recipient: string;
    subject?: string;
    body: string;
    direction: "inbound" | "outbound";
    status?: "sent" | "delivered" | "read" | "failed";
    priority?: "low" | "normal" | "high" | "urgent";
    metadata?: string;
    attachmentCount?: number;
    sentAt?: Date;
    receivedAt?: Date;
  }
) {
  // Analyze message for threading
  const analysis = await analyzeMessageForThreading(userId, {
    sender: messageData.sender,
    recipient: messageData.recipient,
    subject: messageData.subject,
    body: messageData.body,
    channel: messageData.channel,
  });

  let threadId: string;

  if (analysis.shouldCreateNewThread || !analysis.existingThreadId) {
    // Create new thread
    const participants = [messageData.sender, messageData.recipient];
    const thread = await inboxService.createThread({
      userId,
      caseId: messageData.caseId || (analysis.suggestedCaseId as string | null),
      title: analysis.subject,
      participants: JSON.stringify(participants),
      channels: JSON.stringify([messageData.channel]),
      status: "active",
      priority: messageData.priority || "normal",
      firstMessageAt: messageData.sentAt || new Date(),
      lastMessageAt: messageData.sentAt || new Date(),
      aiSummary: null,
      aiTopics: JSON.stringify(analysis.topics),
    });
    threadId = thread.id;
  } else {
    // Use existing thread
    threadId = analysis.existingThreadId;
  }

  // Create message with AI-enhanced metadata
  const message = await inboxService.createMessage({
    userId,
    caseId: messageData.caseId || analysis.suggestedCaseId,
    threadId,
    channel: messageData.channel,
    externalId: messageData.externalId,
    sender: messageData.sender,
    recipient: messageData.recipient,
    subject: messageData.subject,
    body: messageData.body,
    direction: messageData.direction,
    status: messageData.status || "sent",
    priority: messageData.priority || "normal",
    aiSubject: analysis.subject,
    aiSentiment: analysis.sentiment,
    aiCategory: analysis.category,
    metadata: messageData.metadata,
    attachmentCount: messageData.attachmentCount || 0,
    sentAt: messageData.sentAt,
    receivedAt: messageData.receivedAt,
  });

  return {
    message,
    threadId,
    analysis,
  };
}

/**
 * Generate AI summary for a conversation thread
 */
export async function generateThreadSummary(threadId: string): Promise<string> {
  // Get all messages in the thread
  const messages = await inboxService.getMessagesByThread(threadId, 100, 0);

  if (messages.length === 0) {
    return "No messages in thread";
  }

  // Build conversation context
  const conversationText = messages
    .map(
      (m) =>
        `[${m.sentAt?.toISOString() || "Unknown"}] ${m.sender || "Unknown"} to ${m.recipient || "Unknown"}:\n${m.body || ""}`
    )
    .join("\n\n");

  const prompt = `Summarize the following conversation thread in 2-3 sentences. Focus on the main topic, key points, and current status.

CONVERSATION:
${conversationText}

Provide a concise summary:`;

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are an expert at summarizing legal conversations concisely.",
        },
        { role: "user", content: prompt },
      ],
    });

    const rawContent = response.choices[0].message.content;
    return typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent || "");
  } catch (error) {
    console.error("Error generating thread summary:", error);
    return "Summary generation failed";
  }
}

/**
 * Extract topics from a conversation thread
 */
export async function extractThreadTopics(threadId: string): Promise<string[]> {
  const messages = await inboxService.getMessagesByThread(threadId, 50, 0);

  if (messages.length === 0) {
    return [];
  }

  const conversationText = messages.map((m) => m.body).join("\n\n");

  const prompt = `Extract the main topics discussed in this conversation. Return a JSON array of topic strings (max 5 topics).

CONVERSATION:
${conversationText}`;

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are an expert at identifying key topics in legal conversations.",
        },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "topics",
          strict: true,
          schema: {
            type: "object",
            properties: {
              topics: {
                type: "array",
                items: { type: "string" },
                description: "List of main topics",
              },
            },
            required: ["topics"],
            additionalProperties: false,
          },
        },
      },
    });

    const rawContent = response.choices[0].message.content;
    const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent || "{}");
    const result = JSON.parse(content || "{}");
    return result.topics || [];
  } catch (error) {
    console.error("Error extracting thread topics:", error);
    return [];
  }
}
