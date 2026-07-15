import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const workDir = mkdtempSync(join(tmpdir(), 'laro-recovery-drill-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = join(workDir, 'live.sqlite');

async function main() {
  const [{ getDb, closeDatabaseForMaintenance }, backup, schema] = await Promise.all([
    import('../server/db'),
    import('../server/backup'),
    import('../server/schema'),
  ]);
  const db = await getDb();
  const marker = `RECOVERY-${Date.now()}`;
  await db.insert(schema.users).values({
    id: marker,
    email: `${marker.toLowerCase()}@example.invalid`,
    name: 'Recovery drill',
    role: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const backupPath = join(workDir, 'verified-backup.sqlite');
  await backup.backupDatabase(backupPath);
  (db as any).$client.prepare('DELETE FROM users WHERE id = ?').run(marker);

  const restored = backup.restoreDatabase(backupPath);
  const reopened = await getDb();
  const row = (reopened as any).$client.prepare('SELECT id FROM users WHERE id = ?').get(marker);
  if (!row) throw new Error('Round-trip restore did not recover the marker row');
  if (!restored.backupOfPrevious) throw new Error('Restore did not preserve the previous database');

  console.log('[Recovery drill] Backup validated, restore completed, previous DB preserved, and data recovered.');
  closeDatabaseForMaintenance();
}

main()
  .catch((error) => {
    console.error('[Recovery drill] Failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    try { rmSync(workDir, { recursive: true, force: true }); } catch { /* native handle release can lag on Windows */ }
  });
