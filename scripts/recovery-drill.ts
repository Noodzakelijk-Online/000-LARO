import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const workDir = mkdtempSync(join(tmpdir(), 'laro-recovery-drill-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = join(workDir, 'live.sqlite');

async function main() {
  const [{ getDb, closeDatabaseForMaintenance }, backup, schema] = await Promise.all([
    import('../server/db'),
    import('../server/backupSet'),
    import('../server/schema'),
  ]);
  const db = await getDb();
  const marker = `RECOVERY-${Date.now()}`;
  const secretsPath = join(workDir, 'laro-secrets.json');
  const originalSecrets = {
    jwtSecret: 'a'.repeat(64),
    cookieSecret: 'b'.repeat(64),
  };
  writeFileSync(secretsPath, JSON.stringify(originalSecrets, null, 2), { mode: 0o600 });
  await db.insert(schema.users).values({
    id: marker,
    email: `${marker.toLowerCase()}@example.invalid`,
    name: 'Recovery drill',
    role: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const backupPath = join(workDir, 'verified-backup.sqlite');
  await backup.createBackupSet(backupPath, { desktopSecretsPath: secretsPath });
  (db as any).$client.prepare('DELETE FROM users WHERE id = ?').run(marker);
  writeFileSync(secretsPath, JSON.stringify({
    jwtSecret: 'c'.repeat(64),
    cookieSecret: 'd'.repeat(64),
  }, null, 2), { mode: 0o600 });

  const restored = backup.restoreBackupSet(backupPath, { desktopSecretsPath: secretsPath });
  const reopened = await getDb();
  const row = (reopened as any).$client.prepare('SELECT id FROM users WHERE id = ?').get(marker);
  if (!row) throw new Error('Round-trip restore did not recover the marker row');
  if (!restored.backupOfPreviousDatabase) throw new Error('Restore did not preserve the previous database');
  if (!restored.backupOfPreviousSecrets || !existsSync(restored.backupOfPreviousSecrets)) {
    throw new Error('Restore did not preserve the previous desktop secrets');
  }
  if (readFileSync(secretsPath, 'utf8') !== JSON.stringify(originalSecrets, null, 2)) {
    throw new Error('Round-trip restore did not recover the matching desktop secrets');
  }

  console.log(
    '[Recovery drill] Backup set validated; database and desktop secrets restored; previous state preserved.',
  );
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
