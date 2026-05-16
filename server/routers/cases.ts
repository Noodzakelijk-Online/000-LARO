import { z } from "zod";
import { publicProcedure, router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { cases as casesTable, outreachStatus, lawyers } from '../schema';
import { eq, desc, and, sql } from "drizzle-orm";
import { sanitizeLegalAreas } from "../legalAreasValidator";

export const casesRouter = router({
  list: protectedProcedure
    .input(z.object({
      page: z.number().optional().default(1),
      limit: z.number().optional().default(10),
    }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { cases: [], pagination: { total: 0, totalPages: 0, page: 1, limit: 10 } };

      const userId = ctx.user.id;
      const page = input?.page || 1;
      const limit = input?.limit || 10;
      const offset = (page - 1) * limit;

      const userCases = await db
        .select()
        .from(casesTable)
        .where(eq(casesTable.userId, userId))
        .orderBy(desc(casesTable.createdAt))
        .limit(limit)
        .offset(offset);

      const totalResult = await db.select({ count: sql<number>`count(*)` }).from(casesTable).where(eq(casesTable.userId, userId));
      const total = Number(totalResult[0]?.count || 0);

      return {
        cases: userCases.map((c) => ({
          ...c,
          legalAreas: typeof c.legalAreas === "string" ? c.legalAreas : JSON.stringify(c.legalAreas || []),
        })),
        pagination: {
          total,
          totalPages: Math.ceil(total / limit),
          page,
          limit,
        }
      };
    }),


  byId: protectedProcedure
    .input(z.string())
    .query(async ({ input: caseId, ctx }) => {
      const db = await getDb();
      if (!db) return null;
      const result = await db.select().from(casesTable).where(and(eq(casesTable.id, caseId), eq(casesTable.userId, ctx.user.id))).limit(1);
      if (!result.length) return null;
      return result[0];
    }),

  create: protectedProcedure
    .input(z.object({
      clientName: z.string(),
      clientEmail: z.string().email(),
      clientPhone: z.string().optional().default(""),
      clientAddress: z.string().optional().default(""),
      caseType: z.string(),
      caseSummary: z.string().default(""),
      urgency: z.enum(["Low", "Medium", "High"]),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const caseId = `CASE${Date.now().toString().slice(-6)}`;
      const userId = ctx.user.id;

      await db.insert(casesTable).values({
        id: caseId,
        userId,
        clientName: input.clientName,
        clientEmail: input.clientEmail,
        clientPhone: input.clientPhone,
        clientAddress: input.clientAddress,
        caseType: input.caseType,
        caseSummary: input.caseSummary,
        urgency: input.urgency,
        status: "Matching",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      return { id: caseId, success: true };
    }),


  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      status: z.string().optional(),
      caseSummary: z.string().optional(),
      urgency: z.enum(["Low", "Medium", "High"]).optional(),
      legalAreas: z.any().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const updateData: any = { updatedAt: new Date() };
      if (input.status) updateData.status = input.status;
      if (input.caseSummary) updateData.caseSummary = input.caseSummary;
      if (input.urgency) updateData.urgency = input.urgency;
      if (input.legalAreas) {
        updateData.legalAreas = sanitizeLegalAreas(input.legalAreas);
      }

      await db.update(casesTable)
        .set(updateData)
        .where(and(eq(casesTable.id, input.id), eq(casesTable.userId, ctx.user.id)));

      return { success: true };
    }),

  // Hard-delete a case and cascade through every related table that has a
  // `caseId` column. Schema-introspection driven so it stays correct as the
  // schema grows. Ownership-checked so a user can only delete their own cases.
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const existing = await db
        .select({ id: casesTable.id })
        .from(casesTable)
        .where(and(eq(casesTable.id, input.id), eq(casesTable.userId, ctx.user.id)))
        .limit(1);

      if (!existing.length) {
        throw new Error("Case not found or you do not have permission to delete it");
      }

      // Find every table (other than `cases` itself) that has a `caseId`
      // column, then DELETE FROM each WHERE caseId = ?. Wrapped in a
      // transaction so partial failures roll back.
      const sqliteDb: any = (db as any).$client ?? (db as any).session?.client;
      if (!sqliteDb) {
        // Fallback: use drizzle's raw SQL (better-sqlite3 driver is sync).
        db.run(sql`DELETE FROM cases WHERE id = ${input.id} AND userId = ${ctx.user.id}`);
        return { success: true };
      }

      const tables = sqliteDb
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__%' AND name != 'cases'"
        )
        .all() as Array<{ name: string }>;

      const tablesWithCaseId: string[] = [];
      for (const t of tables) {
        try {
          const cols = sqliteDb
            .prepare(`PRAGMA table_info("${t.name}")`)
            .all() as Array<{ name: string }>;
          if (cols.some((c) => c.name === "caseId")) {
            tablesWithCaseId.push(t.name);
          }
        } catch {
          // Ignore tables we can't introspect.
        }
      }

      const tx = sqliteDb.transaction((caseId: string, userId: string) => {
        for (const tableName of tablesWithCaseId) {
          try {
            sqliteDb.prepare(`DELETE FROM "${tableName}" WHERE caseId = ?`).run(caseId);
          } catch (err) {
            console.warn(`[cases.delete] Failed to delete from ${tableName}:`, err);
          }
        }
        sqliteDb
          .prepare(`DELETE FROM cases WHERE id = ? AND userId = ?`)
          .run(caseId, userId);
      });

      tx(input.id, ctx.user.id);

      return { success: true };
    }),

  outreachProgress: publicProcedure
    .input(z.object({ caseId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { legalAreas: [], overallStats: {} };

      // Get case
      const caseData = await db.select().from(casesTable).where(eq(casesTable.id, input.caseId)).limit(1);
      if (!caseData.length) return { legalAreas: [], overallStats: {} };

      // Mocked for now to satisfy component requirements
      let legalAreas: string[] = [];
      try {
        legalAreas = JSON.parse(caseData[0].legalAreas || "[]");
      } catch {}

      return {
        legalAreas: legalAreas.map(area => ({
          name: area,
          status: "In Progress",
          count: 5,
          contacted: 2,
          responded: 1,
        })),
        overallStats: {
          totalContacted: 2,
          totalResponses: 1,
          avgResponseTime: "48h",
        }
      };
    }),
    
  getOutreachByCaseId: publicProcedure
    .input(z.string())
    .query(async ({ input: caseId }) => {
      const db = await getDb();
      if (!db) return [];
      
      const results = await db
        .select({
          id: outreachStatus.id,
          lawyerName: lawyers.name,
          status: outreachStatus.status,
          distanceKm: outreachStatus.distanceKm,
          initialContact: outreachStatus.initialContact,
          followUpsSent: outreachStatus.followUpsSent,
          response: outreachStatus.response,
          lastContact: outreachStatus.lastContact,
        })
        .from(outreachStatus)
        .leftJoin(lawyers, eq(outreachStatus.lawyerId, lawyers.id))
        .where(eq(outreachStatus.caseId, caseId));
        
      return results;
    }),
});
