import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";

export const outlookEnhancedRouter = router({
  getStatus: protectedProcedure
    .query(async ({ ctx }) => {
      return {
        connected: false,
        email: null,
        lastSync: null,
        itemCount: 0,
      };
    }),

  getOAuthUrl: protectedProcedure
    .query(async ({ ctx }) => {
      const redirectUri = `${process.env.OAUTH_REDIRECT_BASE_URL || "http://localhost:3000"}/api/oauth/outlook/callback`;
      const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID;
      
      if (!clientId) {
        throw new Error("Microsoft OAuth client ID not configured");
      }

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "Mail.Read Files.Read offline_access",
      });

      return {
        url: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`,
      };
    }),

  disconnect: protectedProcedure
    .mutation(async ({ ctx }) => {
      return { success: true };
    }),

  listEmails: protectedProcedure
    .input(z.object({
      caseId: z.string().optional(),
      limit: z.number().default(50),
      offset: z.number().default(0),
    }))
    .query(async ({ ctx, input }) => {
      return {
        emails: [],
        total: 0,
      };
    }),

  getEmail: protectedProcedure
    .input(z.object({
      emailId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      return {
        id: input.emailId,
        subject: "",
        from: "",
        to: "",
        body: "",
        receivedAt: new Date(),
      };
    }),

  getAttachments: protectedProcedure
    .input(z.object({
      emailId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      return {
        attachments: [],
      };
    }),

  downloadAttachment: protectedProcedure
    .input(z.object({
      emailId: z.string(),
      attachmentId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      return {
        url: "",
      };
    }),

  getUserProfile: protectedProcedure
    .query(async ({ ctx }) => {
      return {
        id: "",
        displayName: "",
        mail: "",
      };
    }),

  connect: protectedProcedure
    .input(z.object({
      caseId: z.string(),
      code: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      return { success: true };
    }),

  syncForCase: protectedProcedure
    .input(z.object({
      caseId: z.string(),
      filter: z.object({
        from: z.string().optional(),
        subject: z.string().optional(),
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return {
        synced: 0,
        errors: [],
      };
    }),
});
