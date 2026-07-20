import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const GENERATED_SECRET_PATTERN = /^[a-f0-9]{64}$/;

interface DesktopSecretStore {
  jwtSecret: string;
  cookieSecret: string;
}

export interface DesktopSecretResult {
  source: 'environment' | 'existing-file' | 'created-file';
  secretsPath?: string;
}

function isValidStore(value: unknown): value is DesktopSecretStore {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.jwtSecret === 'string' &&
    GENERATED_SECRET_PATTERN.test(candidate.jwtSecret) &&
    typeof candidate.cookieSecret === 'string' &&
    GENERATED_SECRET_PATTERN.test(candidate.cookieSecret)
  );
}

function readExistingStore(secretsPath: string): DesktopSecretStore {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(secretsPath, 'utf8'));
  } catch (error) {
    throw new Error(
      `Could not read the existing desktop secrets file at ${secretsPath}. ` +
        'Restore it from backup or provide JWT_SECRET and COOKIE_SECRET explicitly.',
      { cause: error },
    );
  }
  if (!isValidStore(parsed)) {
    throw new Error(
      `The existing desktop secrets file at ${secretsPath} is invalid. ` +
        'It was not replaced because doing so would invalidate sessions and encrypted provider tokens.',
    );
  }
  return parsed;
}

function createStoreAtomically(secretsPath: string): DesktopSecretStore {
  const store: DesktopSecretStore = {
    jwtSecret: crypto.randomBytes(32).toString('hex'),
    cookieSecret: crypto.randomBytes(32).toString('hex'),
  };
  const temporaryPath = `${secretsPath}.${process.pid}.${crypto.randomBytes(8).toString('hex')}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, JSON.stringify(store, null, 2), {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });
    fs.renameSync(temporaryPath, secretsPath);
  } catch (error) {
    try {
      fs.unlinkSync(temporaryPath);
    } catch {
      // Nothing to clean when the temporary file was never created.
    }
    throw new Error(
      `Could not persist desktop secrets at ${secretsPath}. ` +
        'LARO will not continue with temporary encryption keys.',
      { cause: error },
    );
  }
  return store;
}

export function ensureDesktopSecrets(
  userDataPath: string,
  targetEnvironment: NodeJS.ProcessEnv = process.env,
): DesktopSecretResult {
  if (targetEnvironment.JWT_SECRET && targetEnvironment.COOKIE_SECRET) {
    return { source: 'environment' };
  }

  const secretsPath = path.join(userDataPath, 'laro-secrets.json');
  const existed = fs.existsSync(secretsPath);
  const store = existed ? readExistingStore(secretsPath) : createStoreAtomically(secretsPath);

  if (!targetEnvironment.JWT_SECRET) targetEnvironment.JWT_SECRET = store.jwtSecret;
  if (!targetEnvironment.COOKIE_SECRET) targetEnvironment.COOKIE_SECRET = store.cookieSecret;
  return { source: existed ? 'existing-file' : 'created-file', secretsPath };
}
