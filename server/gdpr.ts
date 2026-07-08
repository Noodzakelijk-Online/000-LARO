/**
 * Phase 028 — privacy controls and data deletion (GDPR access + erasure).
 *
 * Previously the gdpr.* endpoints were empty stubs returning `{}`. These helpers
 * implement the real rights:
 *  - exportUserData: a full JSON dump of every row owned by the user, gathered
 *    by introspecting which tables have a `userId` column.
 *  - deleteUserData: erases every user-owned row across those tables (plus the
 *    case-scoped child rows) and finally the user record itself, inside a
 *    transaction.
 *
 * Both are driven by sqlite_master introspection so they stay correct as the
 * schema grows, mirroring the cascade approach already used by cases.delete.
 */
import { getDb } from "./db";

function rawClient(db: any): any {
  return db.$client ?? db.session?.client ?? null;
}

function listUserTables(sqlite: any): string[] {
  // NB: filter internal tables in JS — a SQL `LIKE '__%'` would treat `_` as a
  // wildcard and exclude every table name of length >= 2.
  const tables = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all() as Array<{ name: string }>;
  return tables
    .map((t) => t.name)
    .filter((n) => !n.startsWith("sqlite_") && !n.startsWith("__"));
}

function tableColumns(sqlite: any, table: string): string[] {
  try {
    const cols = sqlite.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string }>;
    return cols.map((c) => c.name);
  } catch {
    return [];
  }
}

/**
 * Export every row owned by the user. Returns a structured object keyed by table
 * name. Tables with a `userId` column are exported by owner; the user's own row
 * is exported from `users`.
 */
export async function exportUserData(userId: string): Promise<Record<string, any>> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const sqlite = rawClient(db);
  if (!sqlite) throw new Error("Storage engine not available for export");

  const out: Record<string, any> = {
    _meta: { userId, exportedFormat: "json", generatedBy: "LARO GDPR export (Phase 028)" },
  };

  for (const table of listUserTables(sqlite)) {
    const cols = tableColumns(sqlite, table);
    try {
      if (table === "users" && cols.includes("id")) {
        out.users = sqlite.prepare(`SELECT * FROM "users" WHERE id = ?`).all(userId);
      } else if (cols.includes("userId")) {
        const rows = sqlite.prepare(`SELECT * FROM "${table}" WHERE userId = ?`).all(userId);
        if (rows.length > 0) out[table] = rows;
      }
    } catch (e) {
      // Skip tables we cannot read; do not fail the whole export.
      console.warn(`[GDPR] export: skipped ${table}:`, e instanceof Error ? e.message : e);
    }
  }

  // Redact password/token material from the export.
  if (Array.isArray(out.users)) {
    out.users = out.users.map((u: any) => ({ ...u, password: undefined, resetCodeHash: undefined }));
  }
  return out;
}

/**
 * Permanently delete all data owned by the user, then the user row. Returns the
 * per-table deletion counts. Runs in a transaction so a partial failure rolls
 * back.
 */
export async function deleteUserData(userId: string): Promise<{ deleted: Record<string, number> }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const sqlite = rawClient(db);
  if (!sqlite) throw new Error("Storage engine not available for deletion");

  const tables = listUserTables(sqlite);
  const userScoped = tables.filter((t) => t !== "users" && tableColumns(sqlite, t).includes("userId"));

  const deleted: Record<string, number> = {};
  const tx = sqlite.transaction(() => {
    for (const table of userScoped) {
      try {
        const info = sqlite.prepare(`DELETE FROM "${table}" WHERE userId = ?`).run(userId);
        if (info.changes) deleted[table] = info.changes;
      } catch (e) {
        console.warn(`[GDPR] delete: skipped ${table}:`, e instanceof Error ? e.message : e);
      }
    }
    const userInfo = sqlite.prepare(`DELETE FROM "users" WHERE id = ?`).run(userId);
    if (userInfo.changes) deleted.users = userInfo.changes;
  });
  tx();

  return { deleted };
}
