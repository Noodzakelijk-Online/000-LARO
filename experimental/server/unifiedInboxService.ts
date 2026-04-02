import { eq, and, desc, or, sql, like } from "drizzle-orm";
import { getDb } from "./db";
import {
  unifiedMessages,
  conversationThreads,
  channelIntegrations,
  InsertUnifiedMessage,
  InsertConversationThread,
  InsertChannelIntegration,
} from "./schema";
import { nanoid } from "nanoid";

// ===== Unified Messages =====

export async function createMessage(data: Omit<InsertUnifiedMessage, "id" | "createdAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const id = nanoid();
  const message = {
    id,
    ...data,
  };

  await db.insert(unifiedMessages).values(message);
  
  // Update thread if exists
  if (data.threadId) {
    await updateThreadLastMessage(data.threadId);
  }
  
  return { id, ...data };
}

export async function getMessageById(id: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select()
    .from(unifiedMessages)
    .where(eq(unifiedMessages.id, id))
    .limit(1);

  return result[0];
}

export async function getMessagesByThread(threadId: string, limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .select()
    .from(unifiedMessages)
    .where(eq(unifiedMessages.threadId, threadId))
    .orderBy(desc(unifiedMessages.sentAt))
    .limit(limit)
    .offset(offset);
}

export async function getMessagesByUser(
  userId: string,
  filters?: {
    channel?: string;
    caseId?: string;
    status?: string;
    unreadOnly?: boolean;
  },
  limit = 50,
  offset = 0
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  let query = db.select().from(unifiedMessages).where(eq(unifiedMessages.userId, userId));

  if (filters?.channel) {
    query = query.where(eq(unifiedMessages.channel, filters.channel as any));
  }
  if (filters?.caseId) {
    query = query.where(eq(unifiedMessages.caseId, filters.caseId));
  }
  if (filters?.status) {
    query = query.where(eq(unifiedMessages.status, filters.status as any));
  }
  if (filters?.unreadOnly) {
    query = query.where(sql`${unifiedMessages.readAt} IS NULL`);
  }

  return await query.orderBy(desc(unifiedMessages.sentAt)).limit(limit).offset(offset);
}

export async function markMessageAsRead(id: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(unifiedMessages)
    .set({ readAt: new Date(), status: "read" })
    .where(eq(unifiedMessages.id, id));

  return true;
}

export async function searchMessages(
  userId: string,
  query: string,
  limit = 50,
  offset = 0
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .select()
    .from(unifiedMessages)
    .where(
      and(
        eq(unifiedMessages.userId, userId),
        or(
          like(unifiedMessages.subject, `%${query}%`),
          like(unifiedMessages.body, `%${query}%`),
          like(unifiedMessages.sender, `%${query}%`)
        )
      )
    )
    .orderBy(desc(unifiedMessages.sentAt))
    .limit(limit)
    .offset(offset);
}

// ===== Conversation Threads =====

export async function createThread(data: Omit<InsertConversationThread, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const id = nanoid();
  const thread = {
    id,
    ...data,
  };

  await db.insert(conversationThreads).values(thread);
  return { id, ...data };
}

export async function getThreadById(id: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select()
    .from(conversationThreads)
    .where(eq(conversationThreads.id, id))
    .limit(1);

  return result[0];
}

export async function getThreadsByUser(
  userId: string,
  filters?: {
    caseId?: string;
    status?: string;
  },
  limit = 50,
  offset = 0
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  let query = db.select().from(conversationThreads).where(eq(conversationThreads.userId, userId));

  if (filters?.caseId) {
    query = query.where(eq(conversationThreads.caseId, filters.caseId));
  }
  if (filters?.status) {
    query = query.where(eq(conversationThreads.status, filters.status as any));
  }

  return await query.orderBy(desc(conversationThreads.lastMessageAt)).limit(limit).offset(offset);
}

export async function updateThreadLastMessage(threadId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get message count and last message time
  const messages = await db
    .select()
    .from(unifiedMessages)
    .where(eq(unifiedMessages.threadId, threadId))
    .orderBy(desc(unifiedMessages.sentAt))
    .limit(1);

  if (messages.length === 0) return;

  const messageCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(unifiedMessages)
    .where(eq(unifiedMessages.threadId, threadId));

  const unreadCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(unifiedMessages)
    .where(and(eq(unifiedMessages.threadId, threadId), sql`${unifiedMessages.readAt} IS NULL`));

  await db
    .update(conversationThreads)
    .set({
      lastMessageAt: messages[0].sentAt,
      messageCount: Number(messageCount[0].count),
      unreadCount: Number(unreadCount[0].count),
      updatedAt: new Date(),
    })
    .where(eq(conversationThreads.id, threadId));
}

export async function archiveThread(threadId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(conversationThreads)
    .set({ status: "archived", updatedAt: new Date() })
    .where(eq(conversationThreads.id, threadId));

  return true;
}

// ===== Channel Integrations =====

export async function createChannelIntegration(
  data: Omit<InsertChannelIntegration, "id" | "createdAt" | "updatedAt">
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const id = nanoid();
  const integration = {
    id,
    ...data,
  };

  await db.insert(channelIntegrations).values(integration);
  return { id, ...data };
}

export async function getChannelIntegrationsByUser(userId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .select()
    .from(channelIntegrations)
    .where(eq(channelIntegrations.userId, userId));
}

export async function updateChannelIntegrationStatus(
  id: string,
  status: "active" | "inactive" | "error",
  errorMessage?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(channelIntegrations)
    .set({
      status,
      errorMessage: errorMessage || null,
      updatedAt: new Date(),
    })
    .where(eq(channelIntegrations.id, id));

  return true;
}

export async function updateChannelIntegrationSync(id: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const now = new Date();
  const integration = await db
    .select()
    .from(channelIntegrations)
    .where(eq(channelIntegrations.id, id))
    .limit(1);

  if (integration.length === 0) return false;

  const nextSync = new Date(now.getTime() + integration[0].syncFrequency * 1000);

  await db
    .update(channelIntegrations)
    .set({
      lastSyncAt: now,
      nextSyncAt: nextSync,
      updatedAt: now,
    })
    .where(eq(channelIntegrations.id, id));

  return true;
}

export async function deleteChannelIntegration(id: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(channelIntegrations).where(eq(channelIntegrations.id, id));
  return true;
}
