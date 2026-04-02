import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import { getDb } from '../db';
import { users, usageTracking, billingPeriods } from '../schema';
import { eq, and, gte, sql, desc } from 'drizzle-orm';

/**
 * Admin Analytics Router
 * Aggregate metrics and insights for platform owners
 */

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Admin access required',
    });
  }
  return next({ ctx });
});

export const adminAnalyticsRouter = router({
  /**
   * Get platform overview metrics
   */
  overview: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    // Total users by tier
    const usersByTier = await db
      .select({
        tier: users.subscriptionTier,
        count: sql<number>`COUNT(*)`,
      })
      .from(users)
      .groupBy(users.subscriptionTier);

    // Total users by status
    const usersByStatus = await db
      .select({
        status: users.subscriptionStatus,
        count: sql<number>`COUNT(*)`,
      })
      .from(users)
      .groupBy(users.subscriptionStatus);

    // Total revenue (sum of all billing periods)
    const revenueResult = await db
      .select({
        total: sql<number>`SUM(CAST(${billingPeriods.totalCost} AS SIGNED))`,
      })
      .from(billingPeriods);

    const totalRevenue = Number(revenueResult[0]?.total || 0) / 100; // Convert cents to dollars

    // Active users (logged in within last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const activeUsersResult = await db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(users)
      .where(gte(users.lastSignedIn, thirtyDaysAgo));

    const activeUsers = Number(activeUsersResult[0]?.count || 0);

    // Total users
    const totalUsersResult = await db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(users);

    const totalUsers = Number(totalUsersResult[0]?.count || 0);

    return {
      totalUsers,
      activeUsers,
      totalRevenue,
      usersByTier: usersByTier.map(row => ({
        tier: row.tier || 'free',
        count: Number(row.count),
      })),
      usersByStatus: usersByStatus.map(row => ({
        status: row.status || 'free',
        count: Number(row.count),
      })),
    };
  }),

  /**
   * Get usage metrics by resource type
   */
  usageMetrics: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    // Get current month usage by resource type
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const usageByResource = await db
      .select({
        resourceType: usageTracking.resourceType,
        totalQuantity: sql<number>`SUM(CAST(${usageTracking.quantity} AS SIGNED))`,
        totalCost: sql<number>`SUM(CAST(${usageTracking.billedCost} AS DECIMAL(10,2)))`,
        uniqueUsers: sql<number>`COUNT(DISTINCT ${usageTracking.userId})`,
      })
      .from(usageTracking)
      .where(gte(usageTracking.timestamp, periodStart))
      .groupBy(usageTracking.resourceType);

    return usageByResource.map(row => ({
      resourceType: row.resourceType,
      totalQuantity: Number(row.totalQuantity),
      totalCost: Number(row.totalCost) / 100, // Convert cents to dollars
      uniqueUsers: Number(row.uniqueUsers),
    }));
  }),

  /**
   * Get conversion funnel (free → pro)
   */
  conversionFunnel: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    // Total free tier users
    const freeUsersResult = await db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(users)
      .where(eq(users.subscriptionTier, 'free'));

    const freeUsers = Number(freeUsersResult[0]?.count || 0);

    // Total pro tier users
    const proUsersResult = await db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(users)
      .where(eq(users.subscriptionTier, 'pro'));

    const proUsers = Number(proUsersResult[0]?.count || 0);

    // Calculate conversion rate
    const totalUsers = freeUsers + proUsers;
    const conversionRate = totalUsers > 0 ? (proUsers / totalUsers) * 100 : 0;

    return {
      freeUsers,
      proUsers,
      totalUsers,
      conversionRate,
    };
  }),

  /**
   * Get top users by usage
   */
  topUsers: adminProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(10),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error('Database not available');
      }

      // Get current month
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Get top users by total cost
      const topUsers = await db
        .select({
          userId: usageTracking.userId,
          totalCost: sql<number>`SUM(CAST(${usageTracking.billedCost} AS DECIMAL(10,2)))`,
          totalOperations: sql<number>`COUNT(*)`,
        })
        .from(usageTracking)
        .where(gte(usageTracking.timestamp, periodStart))
        .groupBy(usageTracking.userId)
        .orderBy(desc(sql`SUM(CAST(${usageTracking.billedCost} AS DECIMAL(10,2)))`))
        .limit(input.limit);

      // Enrich with user details
      const enriched = await Promise.all(
        topUsers.map(async (row) => {
          const userResult = await db.select().from(users).where(eq(users.id, row.userId as string)).limit(1);
          const user = userResult[0];
          
          return {
            userId: row.userId,
            userName: user?.name || 'Unknown',
            userEmail: user?.email || '',
            tier: user?.subscriptionTier || 'free',
            totalCost: Number(row.totalCost) / 100, // Convert cents to dollars
            totalOperations: Number(row.totalOperations),
          };
        })
      );

      return enriched;
    }),

  /**
   * Get revenue over time (last 12 months)
   */
  revenueOverTime: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    // Get last 12 months of billing periods
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const revenueByMonth = await db
      .select({
        month: billingPeriods.periodStart,
        totalRevenue: sql<number>`SUM(CAST(${billingPeriods.totalCost} AS DECIMAL(10,2)))`,
        userCount: sql<number>`COUNT(DISTINCT ${billingPeriods.userId})`,
      })
      .from(billingPeriods)
      .where(gte(billingPeriods.periodStart, twelveMonthsAgo))
      .groupBy(billingPeriods.periodStart)
      .orderBy(billingPeriods.periodStart);

    return revenueByMonth.map(row => ({
      month: row.month,
      totalRevenue: Number(row.totalRevenue) / 100, // Convert cents to dollars
      userCount: Number(row.userCount),
    }));
  }),

  /**
   * Get most used features
   */
  featureUsage: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    // Get current month
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get usage by resource type (feature)
    const featureUsage = await db
      .select({
        feature: usageTracking.resourceType,
        usageCount: sql<number>`COUNT(*)`,
        uniqueUsers: sql<number>`COUNT(DISTINCT ${usageTracking.userId})`,
      })
      .from(usageTracking)
      .where(gte(usageTracking.timestamp, periodStart))
      .groupBy(usageTracking.resourceType)
      .orderBy(desc(sql`COUNT(*)`));

    return featureUsage.map(row => ({
      feature: row.feature,
      usageCount: Number(row.usageCount),
      uniqueUsers: Number(row.uniqueUsers),
    }));
  }),
});
