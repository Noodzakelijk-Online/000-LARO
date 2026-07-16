import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { assertCaseOwnership } from "../_core/authz";
import { createAuditLog } from "../audit";
import { enforceRateLimit, RATE_LIMITS } from "../rateLimit";
import {
  createManualOutreachTarget,
  discoverOutreachTargetsForCase,
  getCaseTargetMatches,
  getOutreachDirectorySummary,
  listOutreachTargets,
  matchApprovedTargetsForCase,
  reviewOutreachTarget,
  updateCaseTargetMatchStatus,
} from "../outreachDirectory";

const targetTypeSchema = z.enum(["media", "organization"]);
const reviewStatusSchema = z.enum(["pending", "approved", "rejected"]);
const matchStatusSchema = z.enum(["suggested", "shortlisted", "contacted", "dismissed"]);

export const outreachDirectoryRouter = router({
  summary: protectedProcedure.query(({ ctx }) => getOutreachDirectorySummary(ctx.user.id)),

  list: protectedProcedure
    .input(z.object({
      targetType: targetTypeSchema,
      status: reviewStatusSchema.optional(),
      limit: z.number().int().min(1).max(200).optional().default(100),
    }))
    .query(({ input, ctx }) => listOutreachTargets({ userId: ctx.user.id, ...input })),

  discoverForCase: protectedProcedure
    .input(z.object({
      caseId: z.string().min(1),
      targetType: targetTypeSchema,
      maxQueries: z.number().int().min(1).max(6).optional().default(4),
      maxResults: z.number().int().min(1).max(60).optional().default(30),
    }))
    .mutation(async ({ input, ctx }) => {
      await assertCaseOwnership(input.caseId, ctx.user.id);
      enforceRateLimit(ctx, "outreachDiscovery", {
        ...RATE_LIMITS.lawyerSearch,
        maxRequests: 10,
        message: "Too many public discovery requests. Please wait a moment.",
      });
      const report = await discoverOutreachTargetsForCase({ userId: ctx.user.id, ...input });
      await createAuditLog({
        userId: ctx.user.id,
        action: "outreach.directory_discovered",
        entityType: "case",
        entityId: input.caseId,
        details: {
          targetType: input.targetType,
          status: report.status,
          newCandidates: report.newCandidates,
          rawCaseTextShared: report.rawCaseTextShared,
        },
      });
      return report;
    }),

  createManual: protectedProcedure
    .input(z.object({
      targetType: targetTypeSchema,
      name: z.string().trim().min(2).max(255),
      url: z.string().trim().url().max(2_048),
      contactUrl: z.string().trim().url().max(2_048).optional(),
      description: z.string().trim().max(2_000).optional(),
      subtype: z.string().trim().max(120).optional(),
      legalAreas: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const id = await createManualOutreachTarget({ userId: ctx.user.id, ...input });
      await createAuditLog({
        userId: ctx.user.id,
        action: "outreach.directory_imported",
        entityType: "outreach_target",
        entityId: id,
        details: { targetType: input.targetType, source: "manual" },
      });
      return { id };
    }),

  review: protectedProcedure
    .input(z.object({
      id: z.string().min(1),
      status: reviewStatusSchema,
      reviewNotes: z.string().trim().max(1_000).optional(),
      caseId: z.string().min(1).optional(),
      targetType: targetTypeSchema,
    }))
    .mutation(async ({ input, ctx }) => {
      if (input.caseId) await assertCaseOwnership(input.caseId, ctx.user.id);
      const reviewed = await reviewOutreachTarget({
        userId: ctx.user.id,
        id: input.id,
        targetType: input.targetType,
        status: input.status,
        reviewNotes: input.reviewNotes,
      });
      const matches = input.status === "approved" && input.caseId
        ? await matchApprovedTargetsForCase({
          userId: ctx.user.id,
          caseId: input.caseId,
          targetType: reviewed.targetType,
        })
        : null;
      await createAuditLog({
        userId: ctx.user.id,
        action: "outreach.directory_reviewed",
        entityType: "outreach_target",
        entityId: input.id,
        details: { status: input.status, targetType: reviewed.targetType, caseId: input.caseId || null },
      });
      return { success: true as const, matches };
    }),

  matchCase: protectedProcedure
    .input(z.object({
      caseId: z.string().min(1),
      targetType: targetTypeSchema,
      limit: z.number().int().min(1).max(100).optional().default(30),
    }))
    .mutation(async ({ input, ctx }) => {
      await assertCaseOwnership(input.caseId, ctx.user.id);
      const matches = await matchApprovedTargetsForCase({ userId: ctx.user.id, ...input });
      await createAuditLog({
        userId: ctx.user.id,
        action: "outreach.targets_matched",
        entityType: "case",
        entityId: input.caseId,
        details: { targetType: input.targetType, count: matches.length },
      });
      return matches;
    }),

  matches: protectedProcedure
    .input(z.object({ caseId: z.string().min(1), targetType: targetTypeSchema }))
    .query(async ({ input, ctx }) => {
      await assertCaseOwnership(input.caseId, ctx.user.id);
      return getCaseTargetMatches({ userId: ctx.user.id, ...input });
    }),

  updateMatchStatus: protectedProcedure
    .input(z.object({ id: z.string().min(1), status: matchStatusSchema }))
    .mutation(async ({ input, ctx }) => {
      const result = await updateCaseTargetMatchStatus({ userId: ctx.user.id, ...input });
      await createAuditLog({
        userId: ctx.user.id,
        action: "outreach.target_match_status_changed",
        entityType: "outreach_target_match",
        entityId: input.id,
        details: { status: input.status },
      });
      return result;
    }),
});
