/**
 * GDPR Compliance Router
 * 
 * Provides endpoints for GDPR-compliant data management.
 */

import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import {
  exportUserData,
  deleteUserData,
  anonymizeUserData,
  getUserConsent,
  updateUserConsent,
} from "../gdprCompliance";

export const gdprRouter = router({
  /**
   * Export all user data (GDPR Article 15 - Right of Access)
   * POST /api/trpc/gdpr.exportData
   */
  exportData: protectedProcedure.mutation(async ({ ctx }) => {
    const result = await exportUserData(ctx.user.id);
    
    if (!result.success) {
      throw new Error(result.error || "Failed to export data");
    }

    return result.data;
  }),

  /**
   * Delete all user data (GDPR Article 17 - Right to Erasure)
   * POST /api/trpc/gdpr.deleteData
   */
  deleteData: protectedProcedure
    .input(z.object({
      reason: z.string().optional(),
      confirmEmail: z.string().email(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify email matches user's email
      if (input.confirmEmail !== ((ctx.user as any).email)) {
        throw new Error("Email confirmation does not match");
      }

      const result = await deleteUserData(ctx.user.id, input.reason);
      
      if (!result.success) {
        throw new Error(result.error || "Failed to delete data");
      }

      return { success: true, message: "Your data has been deleted" };
    }),

  /**
   * Anonymize user data (alternative to deletion)
   * POST /api/trpc/gdpr.anonymizeData
   */
  anonymizeData: protectedProcedure.mutation(async ({ ctx }) => {
    const result = await anonymizeUserData(ctx.user.id);
    
    if (!result.success) {
      throw new Error(result.error || "Failed to anonymize data");
    }

    return { success: true, message: "Your data has been anonymized" };
  }),

  /**
   * Get user consent status
   * GET /api/trpc/gdpr.getConsent
   */
  getConsent: protectedProcedure.query(async ({ ctx }) => {
    const result = await getUserConsent(ctx.user.id);
    
    if (!result.success) {
      throw new Error(result.error || "Failed to get consent");
    }

    return result.consent;
  }),

  /**
   * Update user consent
   * POST /api/trpc/gdpr.updateConsent
   */
  updateConsent: protectedProcedure
    .input(z.object({
      dataProcessing: z.boolean().optional(),
      emailCommunication: z.boolean().optional(),
      dataSharing: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await updateUserConsent(ctx.user.id, input);
      
      if (!result.success) {
        throw new Error(result.error || "Failed to update consent");
      }

      return { success: true, message: "Consent preferences updated" };
    }),
});

