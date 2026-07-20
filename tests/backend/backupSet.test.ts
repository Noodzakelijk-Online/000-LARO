import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  backupSetManifestPath,
  backupSetSecretsPath,
  createBackupSet,
  restoreBackupSet,
  validateBackupSet,
} from '../../server/backupSet';
import { buildUser } from '../factories';
import { bootTestApp, sqliteAvailable, type TestApp } from '../helpers/app';

const suite = sqliteAvailable ? describe : describe.skip;

function desktopSecrets(jwt = '1', cookie = '2') {
  return {
    jwtSecret: jwt.repeat(64),
    cookieSecret: cookie.repeat(64),
  };
}

suite('recovery-ready backup sets', () => {
  let app: TestApp;
  let secretsPath: string;

  beforeAll(async () => {
    app = await bootTestApp();
    secretsPath = path.join(app.tmpDir, 'laro-secrets.json');
    fs.writeFileSync(secretsPath, JSON.stringify(desktopSecrets(), null, 2), { mode: 0o600 });
    await app.db.insert(app.schema.users).values(buildUser({
      id: 'BACKUP_SET_MARKER',
      email: 'backup-set-marker@example.invalid',
    }));
  });

  afterAll(async () => {
    const { closeDatabaseForMaintenance } = await import('../../server/db');
    closeDatabaseForMaintenance();
    app?.cleanup();
  });

  it('publishes a database, manifest, and matching desktop-secret sidecar', async () => {
    const destination = path.join(app.tmpDir, 'complete.sqlite');

    const result = await createBackupSet(destination, { desktopSecretsPath: secretsPath });
    const validation = validateBackupSet(destination);

    expect(result.databasePath).toBe(destination);
    expect(result.manifestPath).toBe(backupSetManifestPath(destination));
    expect(result.secretsPath).toBe(backupSetSecretsPath(destination));
    expect(validation.valid).toBe(true);
    expect(validation.manifest?.encryption.mode).toBe('bundled-desktop-secret');
    expect(validation.tables).toContain('evidence');
    expect(fs.readdirSync(app.tmpDir).filter((name) => name.endsWith('.tmp'))).toEqual([]);
  });

  it('refuses to overwrite any member of an existing backup set', async () => {
    const destination = path.join(app.tmpDir, 'no-overwrite.sqlite');
    await createBackupSet(destination, { desktopSecretsPath: secretsPath });

    await expect(createBackupSet(destination, { desktopSecretsPath: secretsPath }))
      .rejects.toThrow('Refusing to overwrite');

    const externalDestination = path.join(app.tmpDir, 'stale-sidecar.sqlite');
    fs.writeFileSync(backupSetSecretsPath(externalDestination), 'stale');
    await expect(createBackupSet(externalDestination, { externalJwtSecret: 'external-secret' }))
      .rejects.toThrow('Refusing to overwrite');
  });

  it('detects database and secret-sidecar tampering before restore', async () => {
    const databaseTamper = path.join(app.tmpDir, 'database-tamper.sqlite');
    await createBackupSet(databaseTamper, { desktopSecretsPath: secretsPath });
    fs.appendFileSync(databaseTamper, 'tamper');
    expect(validateBackupSet(databaseTamper)).toMatchObject({
      valid: false,
      reason: expect.stringContaining('database hash or size'),
    });

    const secretTamper = path.join(app.tmpDir, 'secret-tamper.sqlite');
    await createBackupSet(secretTamper, { desktopSecretsPath: secretsPath });
    fs.appendFileSync(backupSetSecretsPath(secretTamper), 'tamper');
    expect(validateBackupSet(secretTamper)).toMatchObject({
      valid: false,
      reason: expect.stringContaining('desktop-secret hash'),
    });
  });

  it('binds environment-managed backups to the intended JWT secret', async () => {
    const destination = path.join(app.tmpDir, 'external-secret.sqlite');
    const correctSecret = 'external-production-jwt-secret-with-high-entropy';
    await createBackupSet(destination, { externalJwtSecret: correctSecret });

    expect(fs.existsSync(backupSetSecretsPath(destination))).toBe(false);
    expect(validateBackupSet(destination, { externalJwtSecret: correctSecret }).valid).toBe(true);
    expect(validateBackupSet(destination, { externalJwtSecret: 'different-secret' })).toMatchObject({
      valid: false,
      reason: expect.stringContaining('incompatible'),
    });
    expect(() => restoreBackupSet(destination, {
      externalJwtSecret: correctSecret,
      desktopSecretsPath: secretsPath,
    })).toThrow('desktop profile with incompatible keys');
  });

  it('rejects an active environment key that would override bundled desktop secrets', async () => {
    const destination = path.join(app.tmpDir, 'desktop-env-conflict.sqlite');
    await createBackupSet(destination, { desktopSecretsPath: secretsPath });
    const secretsBefore = fs.readFileSync(secretsPath, 'utf8');

    expect(() => restoreBackupSet(destination, {
      desktopSecretsPath: secretsPath,
      externalJwtSecret: 'active-environment-secret-that-does-not-match',
    })).toThrow('active JWT_SECRET overrides its bundled key');
    expect(fs.readFileSync(secretsPath, 'utf8')).toBe(secretsBefore);
  });

  it('restores the database and its matching desktop secrets while preserving both previous files', async () => {
    const destination = path.join(app.tmpDir, 'restore.sqlite');
    const originalSecrets = fs.readFileSync(secretsPath, 'utf8');
    await createBackupSet(destination, { desktopSecretsPath: secretsPath });
    (app.db as any).$client.prepare('DELETE FROM users WHERE id = ?').run('BACKUP_SET_MARKER');
    fs.writeFileSync(secretsPath, JSON.stringify(desktopSecrets('3', '4'), null, 2), { mode: 0o600 });

    const result = restoreBackupSet(destination, { desktopSecretsPath: secretsPath });
    const reopened = await (await import('../../server/db')).getDb();
    const marker = (reopened as any).$client
      .prepare('SELECT id FROM users WHERE id = ?')
      .get('BACKUP_SET_MARKER');

    expect(marker).toEqual({ id: 'BACKUP_SET_MARKER' });
    expect(fs.readFileSync(secretsPath, 'utf8')).toBe(originalSecrets);
    expect(result.backupOfPreviousDatabase && fs.existsSync(result.backupOfPreviousDatabase)).toBe(true);
    expect(result.backupOfPreviousSecrets && fs.existsSync(result.backupOfPreviousSecrets)).toBe(true);
  });
});
