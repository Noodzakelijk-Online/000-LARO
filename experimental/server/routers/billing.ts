import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getUserUsage, checkUsageLimit, RESOURCE_BASE_COSTS } from "../usageTracking";
import {
  createProCheckoutSession,
  createCustomerPortalSession,
  getStripe,
  isStripeConfigured,
} from "../stripeSubscription";

export const billingRouter = router({
  getUsage: protectedProcedure
    .input(
      z
        .object({
          periodStart: z.string().optional(),
          periodEnd: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const periodStart = input?.periodStart ? new Date(input.periodStart) : undefined;
      const periodEnd = input?.periodEnd ? new Date(input.periodEnd) : undefined;

      const usage = await getUserUsage(ctx.user.id, periodStart, periodEnd);

      return {
        total: usage.total,
        byResourceType: usage.byResourceType,
        records: usage.records.map((r) => ({
          id: r.id,
          resourceType: r.resourceType,
          quantity: parseInt(String(r.quantity), 10),
          baseCost: parseFloat(String(r.baseCost || "0")),
          billedCost: parseFloat(String(r.billedCost || "0")),
          metadata: r.metadata ? JSON.parse(String(r.metadata)) : null,
          timestamp: r.timestamp,
        })),
      };
    }),

  getUsageLimits: protectedProcedure.query(async ({ ctx }) => {
    const limits: Record<string, unknown> = {};
    for (const resourceType of Object.keys(RESOURCE_BASE_COSTS)) {
      limits[resourceType] = await checkUsageLimit(ctx.user.id, resourceType as never);
    }
    return limits;
  }),

  checkLimit: protectedProcedure
    .input(
      z.object({
        resourceType: z.enum([
          "ai_email_analysis",
          "ai_document_analysis",
          "ai_legal_inference",
          "email_sync",
          "lawyer_outreach",
          "document_generation",
          "case_analysis",
          "other",
        ]),
      })
    )
    .query(async ({ ctx, input }) => checkUsageLimit(ctx.user.id, input.resourceType)),

  getInvoices: protectedProcedure.query(async ({ ctx }) => {
    if (!isStripeConfigured() || !ctx.user.stripeCustomerId) return [];
    const invoices = await getStripe().invoices.list({
      customer: ctx.user.stripeCustomerId,
      limit: 12,
    });
    return invoices.data;
  }),

  getUpcomingInvoice: protectedProcedure.query(async ({ ctx }) => {
    if (!isStripeConfigured() || !ctx.user.stripeCustomerId) return null;
    try {
      return await getStripe().invoices.retrieveUpcoming({
        customer: ctx.user.stripeCustomerId,
      });
    } catch {
      return null;
    }
  }),

  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    if (!isStripeConfigured() || !ctx.user.stripeCustomerId) return null;
    const subs = await getStripe().subscriptions.list({
      customer: ctx.user.stripeCustomerId,
      status: "all",
      limit: 3,
    });
    return subs.data[0] ?? null;
  }),

  createCheckoutSession: protectedProcedure
    .input(
      z.object({
        successUrl: z.string().url().optional(),
        cancelUrl: z.string().url().optional(),
      }).optional()
    )
    .mutation(async ({ ctx, input }) => {
      if (!isStripeConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Billing is not enabled (set STRIPE_SECRET_KEY to use Stripe).",
        });
      }
      const base = process.env.FRONTEND_URL || "http://localhost:5173";
      return createProCheckoutSession({
        userId: ctx.user.id,
        email: ctx.user.email || "",
        name: ctx.user.name || undefined,
        successUrl: input?.successUrl || `${base}/billing?success=1`,
        cancelUrl: input?.cancelUrl || `${base}/billing?canceled=1`,
      });
    }),

  createPortalSession: protectedProcedure
    .input(z.object({ returnUrl: z.string().url().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      if (!isStripeConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Billing is not enabled (set STRIPE_SECRET_KEY to use Stripe).",
        });
      }
      const base = process.env.FRONTEND_URL || "http://localhost:5173";
      return createCustomerPortalSession({
        userId: ctx.user.id,
        returnUrl: input?.returnUrl || `${base}/billing`,
      });
    }),
});
