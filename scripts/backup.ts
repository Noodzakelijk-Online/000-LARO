import path from 'path';
import { backupDatabase, restoreDatabase, validateBackup } from '../server/backup';

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function main() {
  const [commandOrDest, file] = process.argv.slice(2);

  if (commandOrDest === '--restore') {
    if (!file) throw new Error('Usage: npm run db:restore -- <backup.sqlite>');
    const result = restoreDatabase(file);
    console.log(`[Restore] Restored ${path.resolve(file)}.`);
    console.log(`[Restore] Previous database: ${result.backupOfPrevious || 'none'}`);
    return;
  }

  if (commandOrDest === '--validate') {
    if (!file) throw new Error('Usage: npm run db:validate -- <backup.sqlite>');
    const result = validateBackup(file);
    if (!result.valid) throw new Error(`Invalid backup: ${result.reason}`);
    console.log(`[Validate] Valid SQLite backup with ${result.tables?.length || 0} tables.`);
    return;
  }

  const dbPath = path.resolve(process.env.DATABASE_URL || 'laro.sqlite');
  const destination = commandOrDest || path.join(
    path.dirname(dbPath),
    'db-backups',
    `${path.basename(dbPath)}.${timestamp()}.bak`,
  );
  const result = await backupDatabase(destination);
  console.log(`[Backup] Wrote ${result.bytes} bytes to ${result.path}`);
}

main().catch((error) => {
  console.error('[Database maintenance] Failed:', error);
  process.exitCode = 1;
});
