import { eq, and, desc } from "drizzle-orm";
import { notifications } from "./schema";
import { getDb } from "./db";
import { getIO } from "./websocket";

export type NotificationType =
  | "lawyer_response"
  | "case_status_change"
  | "evidence_uploaded"
  | "new_match"
  | "deadline_reminder"
  | "system_announcement";

/**
 * Create a new notification and emit it via WebSocket
 * Schema columns: id, userId, title, body, read, createdAt
 */
export async function createNotification(data: {
  userId: string;
  type?: string;
  title: string;
  message?: string;
  body?: string;
}) {
  const db = await getDb();
  if (!db) {
    console.warn("[Notification] Cannot create: database not available");
    return null;
  }

  const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  // Map message → body to match schema
  const body = data.body ?? data.message ?? "";

  await db.insert(notifications).values({
    id:     notificationId,
    userId: data.userId,
    title:  data.title,
    body,
    read:   false,
  });

  const [created] = await db
    .select()
    .from(notifications)
    .where(eq(notifications.id, notificationId))
    .limit(1);

  // Emit via WebSocket
  if (created) {
    const io = getIO();
    if (io) io.to(data.userId).emit("notification", created);
  }

  return created ?? null;
}

/**
 * Get notifications for a user
 */
export async function getUserNotifications(userId: string, limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Get unread notification count
 * Uses schema column `read` (boolean) not `isRead`
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const results = await db
    .select()
    .from(notifications)
    .where(and(
      eq(notifications.userId, userId),
      eq(notifications.read, false)
    ));

  return results.length;
}

/**
 * Mark a single notification as read
 */
export async function markAsRead(notificationId: string, userId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  await db
    .update(notifications)
    .set({ read: true })
    .where(and(
      eq(notifications.id, notificationId),
      eq(notifications.userId, userId)
    ));

  return true;
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  await db
    .update(notifications)
    .set({ read: true })
    .where(and(
      eq(notifications.userId, userId),
      eq(notifications.read, false)
    ));

  return true;
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: string, userId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  await db
    .delete(notifications)
    .where(and(
      eq(notifications.id, notificationId),
      eq(notifications.userId, userId)
    ));

  return true;
}

/**
 * Send notification to a user (alias for createNotification)
 */
export async function sendNotification(
  userId: string,
  title: string,
  body: string,
  type?: string
) {
  return createNotification({ userId, title, body, type });
}