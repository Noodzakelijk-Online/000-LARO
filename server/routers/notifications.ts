import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import * as notificationService from "../notificationService";

export const notificationsRouter = router({
  list: publicProcedure
    .input(z.object({
      limit:  z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ ctx, input }) => {
      if (!ctx.user) return [];
      return notificationService.getUserNotifications(
        ctx.user.id,
        input?.limit  ?? 50,
        input?.offset ?? 0
      );
    }),

  unreadCount: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return 0;
    return notificationService.getUnreadCount(ctx.user.id);
  }),

  markAsRead: publicProcedure
    .input(z.object({ notificationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) return { success: false };
      const success = await notificationService.markAsRead(
        input.notificationId,
        ctx.user.id
      );
      return { success };
    }),

  markAllAsRead: publicProcedure.mutation(async ({ ctx }) => {
    if (!ctx.user) return { success: false };
    const success = await notificationService.markAllAsRead(ctx.user.id);
    return { success };
  }),

  delete: publicProcedure
    .input(z.object({ notificationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) return { success: false };
      const success = await notificationService.deleteNotification(
        input.notificationId,
        ctx.user.id
      );
      return { success };
    }),

  sendTest: publicProcedure
    .input(z.object({
      type:    z.string(),
      title:   z.string(),
      message: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) return null;
      return notificationService.createNotification({
        userId:  ctx.user.id,
        type:    input.type,
        title:   input.title,
        message: input.message,
      });
    }),
});