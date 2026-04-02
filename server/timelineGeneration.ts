// @ts-nocheck

import { invokeLLM } from "./llm";

export interface TimelineEvent {
  date: string; // ISO date string
  title: string;
  description: string;
  source: string; // Which document this came from
  importance: "critical" | "high" | "medium" | "low";
  category: "employment" | "termination" | "communication" | "legal" | "financial" | "other";
}

export interface Timeline {
  events: TimelineEvent[];
  summary: string;
  key_dates: string[];
  duration_days: number;
}

/**
 * Generates a chronological timeline from multiple documents
 */
export async function generateTimeline(
  documents: Array<{ id: string; title: string; content: string; uploadedAt: string }>
): Promise<Timeline> {
  // Combine all document contents with metadata
  const documentsText = documents
    .map((doc, idx) => `
=== Document ${idx + 1}: ${doc.title} (ID: ${doc.id}) ===
${doc.content.substring(0, 5000)}
`)
    .join("\n\n");

  const prompt = `Analyze these Dutch legal documents and create a chronological timeline of events.

${documentsText}

Extract all significant events with dates and create a timeline in JSON format:
{
  "events": [
    {
      "date": "YYYY-MM-DD",
      "title": "Brief event title",
      "description": "Detailed description of what happened",
      "source": "Document title where this was found",
      "importance": "critical" | "high" | "medium" | "low",
      "category": "employment" | "termination" | "communication" | "legal" | "financial" | "other"
    }
  ],
  "summary": "Overall summary of the case timeline",
  "key_dates": ["YYYY-MM-DD", "YYYY-MM-DD"],
  "duration_days": number
}

Focus on:
- Employment start/end dates
- Termination notices and meetings
- Important communications
- Legal deadlines
- Financial transactions
- Disputes or conflicts

Sort events chronologically (oldest first).`;

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "You are an expert at analyzing Dutch legal documents and creating chronological timelines. Respond only with valid JSON.",
      },
      { role: "user", content: prompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "timeline",
        strict: true,
        schema: {
          type: "object",
          properties: {
            events: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  date: { type: "string" },
                  title: { type: "string" },
                  description: { type: "string" },
                  source: { type: "string" },
                  importance: {
                    type: "string",
                    enum: ["critical", "high", "medium", "low"],
                  },
                  category: {
                    type: "string",
                    enum: [
                      "employment",
                      "termination",
                      "communication",
                      "legal",
                      "financial",
                      "other",
                    ],
                  },
                },
                required: ["date", "title", "description", "source", "importance", "category"],
                additionalProperties: false,
              },
            },
            summary: { type: "string" },
            key_dates: {
              type: "array",
              items: { type: "string" },
            },
            duration_days: { type: "number" },
          },
          required: ["events", "summary", "key_dates", "duration_days"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error("No timeline generated");
  }

  const timeline = JSON.parse(content) as Timeline;

  // Sort events by date
  timeline.events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return timeline;
}

/**
 * Identifies gaps or missing information in the timeline
 */
export async function identifyTimelineGaps(timeline: Timeline): Promise<string[]> {
  const prompt = `Analyze this case timeline and identify any gaps or missing information that would be important for a legal case:

Timeline Summary: ${timeline.summary}
Duration: ${timeline.duration_days} days
Number of events: ${timeline.events.length}

Events:
${timeline.events.map((e) => `- ${e.date}: ${e.title} (${e.importance})`).join("\n")}

Identify:
1. Missing documentation (e.g., no termination letter, no employment contract)
2. Suspicious time gaps (e.g., long periods with no events)
3. Missing evidence for claims
4. Incomplete information

Return as a JSON array of strings describing each gap:
["Gap 1 description", "Gap 2 description", ...]`;

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: "You are an expert at identifying gaps in legal case timelines. Respond only with valid JSON.",
      },
      { role: "user", content: prompt },
    ],
  });

  const content = response.choices[0].message.content;
  if (!content) {
    return [];
  }

  try {
    return JSON.parse(content) as string[];
  } catch {
    // If not valid JSON, return empty array
    return [];
  }
}

