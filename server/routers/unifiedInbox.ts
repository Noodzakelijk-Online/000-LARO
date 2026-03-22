import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as inboxService from "../unifiedInboxService";
import * as aiThreading from "../aiThreadingService";

export const unifiedInboxRouter = router({
  // ===== Messages =====
  
  createMessage: protectedProcedure
    .input(
      z.object({
        caseId: z.string().optional(),
        threadId: z.string().optional(),
        channel: z.enum(["email", "sms", "whatsapp", "in_app"]),
        externalId: z.string().optional(),
        sender: z.string(),
        recipient: z.string(),
        subject: z.string().optional(),
        body: z.string(),
        direction: z.enum(["inbound", "outbound"]),
        status: z.enum(["sent", "delivered", "read", "failed"]).default("sent"),
        priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
        metadata: z.string().optional(),
        attachmentCount: z.number().default(0),
        sentAt: z.date().optional(),
        receivedAt: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await inboxService.createMessage({
        ...input,
        userId: ctx.user.id,
      });
    }),

  getMessages: protectedProcedure
    .input(
      z.object({
        channel: z.string().optional(),
        caseId: z.string().optional(),
        status: z.string().optional(),
        unreadOnly: z.boolean().optional(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const { limit, offset, ...filters } = input;
      return await inboxService.getMessagesByUser(ctx.user.id, filters, limit, offset);
    }),

  getMessageById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return await inboxService.getMessageById(input.id);
    }),

  markAsRead: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      return await inboxService.markMessageAsRead(input.id);
    }),

  searchMessages: protectedProcedure
    .input(
      z.object({
        query: z.string(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      return await inboxService.searchMessages(ctx.user.id, input.query, input.limit, input.offset);
    }),

  // ===== Threads =====

  createThread: protectedProcedure
    .input(
      z.object({
        caseId: z.string().optional(),
        subject: z.string(),
        participants: z.string(), // JSON array
        channels: z.string(), // JSON array
        status: z.enum(["active", "archived", "closed"]).default("active"),
        priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
        firstMessageAt: z.date().optional(),
        lastMessageAt: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await inboxService.createThread({
        ...input,
        userId: ctx.user.id,
      });
    }),

  getThreads: protectedProcedure
    .input(
      z.object({
        caseId: z.string().optional(),
        status: z.string().optional(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const { limit, offset, ...filters } = input;
      return await inboxService.getThreadsByUser(ctx.user.id, filters, limit, offset);
    }),

  getThreadById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return await inboxService.getThreadById(input.id);
    }),

  getThreadMessages: protectedProcedure
    .input(
      z.object({
        threadId: z.string(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      })
    )
    .query(async ({ input }) => {
      return await inboxService.getMessagesByThread(input.threadId, input.limit, input.offset);
    }),

  archiveThread: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      return await inboxService.archiveThread(input.id);
    }),

  // ===== Channel Integrations =====

  createIntegration: protectedProcedure
    .input(
      z.object({
        channel: z.enum(["email", "sms", "whatsapp"]),
        provider: z.string().optional(),
        credentials: z.string(), // JSON with encrypted credentials
        status: z.enum(["active", "inactive", "error"]).default("active"),
        syncFrequency: z.number().default(300),
        metadata: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await inboxService.createChannelIntegration({
        ...input,
        userId: ctx.user.id,
      });
    }),

  getIntegrations: protectedProcedure.query(async ({ ctx }) => {
    return await inboxService.getChannelIntegrationsByUser(ctx.user.id);
  }),

  updateIntegrationStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["active", "inactive", "error"]),
        errorMessage: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return await inboxService.updateChannelIntegrationStatus(
        input.id,
        input.status,
        input.errorMessage
      );
    }),

  deleteIntegration: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      return await inboxService.deleteChannelIntegration(input.id);
    }),

  // ===== AI Threading =====

  createMessageWithThreading: protectedProcedure
    .input(
      z.object({
        caseId: z.string().optional(),
        channel: z.enum(["email", "sms", "whatsapp", "in_app"]),
        externalId: z.string().optional(),
        sender: z.string(),
        recipient: z.string(),
        subject: z.string().optional(),
        body: z.string(),
        direction: z.enum(["inbound", "outbound"]),
        status: z.enum(["sent", "delivered", "read", "failed"]).default("sent"),
        priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
        metadata: z.string().optional(),
        attachmentCount: z.number().default(0),
        sentAt: z.date().optional(),
        receivedAt: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await aiThreading.processMessageThreading(ctx.user.id, input);
    }),

  generateThreadSummary: protectedProcedure
    .input(z.object({ threadId: z.string() }))
    .mutation(async ({ input }) => {
      return await aiThreading.generateThreadSummary(input.threadId);
    }),

  extractThreadTopics: protectedProcedure
    .input(z.object({ threadId: z.string() }))
    .mutation(async ({ input }) => {
      return await aiThreading.extractThreadTopics(input.threadId);
    }),
});
