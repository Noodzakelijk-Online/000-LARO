import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { listGoogleDriveFiles, getGoogleDriveFilesForCase } from "./googleDriveService";
import { getDb } from "./db";
import { emailAccounts } from "./schema";
import { and, eq } from "drizzle-orm";

export const googleDriveRouter = router({
  listFiles: protectedProcedure
    .input(
      z.object({
        accountId: z.string(),
        folderId: z.string().optional(),
        pageToken: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [account] = await db
        .select()
        .from(emailAccounts)
        .where(and(eq(emailAccounts.id, input.accountId), eq(emailAccounts.userId, ctx.user.id)))
        .limit(1);

      if (!account?.accessToken) throw new Error("Email account not found");

      return listGoogleDriveFiles(account.accessToken, input.folderId, input.pageToken);
    }),

  getForCase: protectedProcedure
    .input(z.object({ caseId: z.string() }))
    .query(async ({ input }) => getGoogleDriveFilesForCase(input.caseId)),
});
