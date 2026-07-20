import crypto from "crypto";
import fs from "fs";
import path from "path";
import { backupDatabase, restoreDatabase, validateBackup } from "./backup";

const FORMAT = "laro-backup-set";
const VERSION = 1;
const SECRET_PATTERN = /^[a-f0-9]{64}$/;
const COMPATIBILITY_CONTEXT = "LARO backup token-encryption compatibility v1";

interface DesktopSecretStore {
  jwtSecret: string;
  cookieSecret: string;
}

interface DatabaseManifestEntry {
  file: string;
  bytes: number;
  sha256: string;
}

type EncryptionManifestEntry =
  | {
      mode: "bundled-desktop-secret";
      compatibilityTag: string;
      file: string;
      sha256: string;
    }
  | {
      mode: "external-environment";
      compatibilityTag: string;
    };

export interface BackupSetManifest {
  format: typeof FORMAT;
  version: typeof VERSION;
  createdAt: string;
  database: DatabaseManifestEntry;
  encryption: EncryptionManifestEntry;
}

export interface CreateBackupSetOptions {
  desktopSecretsPath?: string;
  externalJwtSecret?: string;
}

export interface ValidateBackupSetOptions {
  externalJwtSecret?: string;
}

export interface BackupSetValidation {
  valid: boolean;
  reason?: string;
  manifest?: BackupSetManifest;
  tables?: string[];
}

export interface RestoreBackupSetOptions extends ValidateBackupSetOptions {
  desktopSecretsPath?: string;
}

export interface RestoreBackupSetResult {
  restored: true;
  backupOfPreviousDatabase: string | null;
  backupOfPreviousSecrets: string | null;
}

export function backupSetManifestPath(databaseBackupPath: string): string {
  return `${path.resolve(databaseBackupPath)}.manifest.json`;
}

export function backupSetSecretsPath(databaseBackupPath: string): string {
  return `${path.resolve(databaseBackupPath)}.secrets.json`;
}

function sha256(filePath: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function compatibilityTag(jwtSecret: string): string {
  return crypto.createHmac("sha256", jwtSecret).update(COMPATIBILITY_CONTEXT).digest("hex");
}

function parseDesktopSecretStore(filePath: string): DesktopSecretStore {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Could not read desktop secrets at ${filePath}.`, { cause: error });
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error(`Desktop secrets at ${filePath} are invalid.`);
  }
  const candidate = parsed as Record<string, unknown>;
  if (
    typeof candidate.jwtSecret !== "string" ||
    !SECRET_PATTERN.test(candidate.jwtSecret) ||
    typeof candidate.cookieSecret !== "string" ||
    !SECRET_PATTERN.test(candidate.cookieSecret)
  ) {
    throw new Error(`Desktop secrets at ${filePath} are invalid.`);
  }
  return {
    jwtSecret: candidate.jwtSecret,
    cookieSecret: candidate.cookieSecret,
  };
}

function isHexDigest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function parseManifest(manifestPath: string): BackupSetManifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (error) {
    throw new Error(`Could not read backup-set manifest at ${manifestPath}.`, { cause: error });
  }
  if (!parsed || typeof parsed !== "object") throw new Error("Backup-set manifest is invalid.");
  const candidate = parsed as Record<string, unknown>;
  const database = candidate.database as Record<string, unknown> | undefined;
  const encryption = candidate.encryption as Record<string, unknown> | undefined;
  const baseValid =
    candidate.format === FORMAT &&
    candidate.version === VERSION &&
    typeof candidate.createdAt === "string" &&
    !Number.isNaN(Date.parse(candidate.createdAt)) &&
    database &&
    typeof database.file === "string" &&
    Number.isSafeInteger(database.bytes) &&
    Number(database.bytes) > 0 &&
    isHexDigest(database.sha256) &&
    encryption &&
    isHexDigest(encryption.compatibilityTag);
  if (!baseValid) throw new Error("Backup-set manifest is invalid.");

  if (encryption.mode === "bundled-desktop-secret") {
    if (typeof encryption.file !== "string" || !isHexDigest(encryption.sha256)) {
      throw new Error("Bundled desktop-secret metadata is invalid.");
    }
  } else if (encryption.mode !== "external-environment") {
    throw new Error("Backup-set encryption mode is unsupported.");
  }
  return parsed as BackupSetManifest;
}

function discoverDesktopSecrets(databasePath: string): string | null {
  const candidate = path.join(path.dirname(path.resolve(databasePath)), "laro-secrets.json");
  return fs.existsSync(candidate) ? candidate : null;
}

function resolveSecretSource(
  databasePath: string,
  options: CreateBackupSetOptions,
): { mode: "desktop"; path: string; store: DesktopSecretStore } | { mode: "external"; jwtSecret: string } {
  const desktopSecretsPath = options.desktopSecretsPath || (
    options.externalJwtSecret ? null : discoverDesktopSecrets(databasePath)
  );
  if (desktopSecretsPath) {
    const resolved = path.resolve(desktopSecretsPath);
    return { mode: "desktop", path: resolved, store: parseDesktopSecretStore(resolved) };
  }
  const externalJwtSecret = options.externalJwtSecret || process.env.JWT_SECRET;
  if (!externalJwtSecret) {
    throw new Error(
      "Cannot create a recovery-ready backup set without laro-secrets.json or JWT_SECRET.",
    );
  }
  return { mode: "external", jwtSecret: externalJwtSecret };
}

function currentDatabasePath(): string {
  return path.resolve(process.env.DATABASE_URL || "laro.sqlite");
}

function removeIfPresent(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // Preserve the original failure; partial paths are named in its message.
  }
}

export async function createBackupSet(
  destinationPath: string,
  options: CreateBackupSetOptions = {},
): Promise<{ databasePath: string; manifestPath: string; secretsPath: string | null; bytes: number }> {
  const destination = path.resolve(destinationPath);
  const manifestPath = backupSetManifestPath(destination);
  const secretsPath = backupSetSecretsPath(destination);
  const secretSource = resolveSecretSource(currentDatabasePath(), options);
  const finalPaths = [destination, manifestPath, secretsPath];
  const existing = finalPaths.find((filePath) => fs.existsSync(filePath));
  if (existing) throw new Error(`Refusing to overwrite an existing backup-set file: ${existing}`);

  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const nonce = `${process.pid}-${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
  const temporaryDatabase = `${destination}.${nonce}.tmp`;
  const temporaryManifest = `${manifestPath}.${nonce}.tmp`;
  const temporarySecrets = `${secretsPath}.${nonce}.tmp`;
  const published: string[] = [];

  try {
    const backup = await backupDatabase(temporaryDatabase);
    const databaseEntry: DatabaseManifestEntry = {
      file: path.basename(destination),
      bytes: backup.bytes,
      sha256: sha256(temporaryDatabase),
    };
    let encryption: EncryptionManifestEntry;

    if (secretSource.mode === "desktop") {
      fs.copyFileSync(secretSource.path, temporarySecrets, fs.constants.COPYFILE_EXCL);
      fs.chmodSync(temporarySecrets, 0o600);
      parseDesktopSecretStore(temporarySecrets);
      encryption = {
        mode: "bundled-desktop-secret",
        compatibilityTag: compatibilityTag(secretSource.store.jwtSecret),
        file: path.basename(secretsPath),
        sha256: sha256(temporarySecrets),
      };
    } else {
      encryption = {
        mode: "external-environment",
        compatibilityTag: compatibilityTag(secretSource.jwtSecret),
      };
    }

    const manifest: BackupSetManifest = {
      format: FORMAT,
      version: VERSION,
      createdAt: new Date().toISOString(),
      database: databaseEntry,
      encryption,
    };
    fs.writeFileSync(temporaryManifest, JSON.stringify(manifest, null, 2), {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });

    if (secretSource.mode === "desktop") {
      fs.renameSync(temporarySecrets, secretsPath);
      published.push(secretsPath);
    }
    fs.renameSync(temporaryDatabase, destination);
    published.push(destination);
    fs.renameSync(temporaryManifest, manifestPath);
    published.push(manifestPath);

    return {
      databasePath: destination,
      manifestPath,
      secretsPath: secretSource.mode === "desktop" ? secretsPath : null,
      bytes: backup.bytes,
    };
  } catch (error) {
    for (const filePath of [temporaryDatabase, temporaryManifest, temporarySecrets, ...published]) {
      removeIfPresent(filePath);
    }
    throw error;
  }
}

export function validateBackupSet(
  databaseBackupPath: string,
  options: ValidateBackupSetOptions = {},
): BackupSetValidation {
  const databasePath = path.resolve(databaseBackupPath);
  try {
    const manifest = parseManifest(backupSetManifestPath(databasePath));
    if (manifest.database.file !== path.basename(databasePath)) {
      return { valid: false, reason: "Backup-set database filename does not match its manifest." };
    }
    if (!fs.existsSync(databasePath)) return { valid: false, reason: "Backup database does not exist." };
    const databaseStat = fs.statSync(databasePath);
    if (databaseStat.size !== manifest.database.bytes || sha256(databasePath) !== manifest.database.sha256) {
      return { valid: false, reason: "Backup database hash or size does not match its manifest." };
    }
    const databaseValidation = validateBackup(databasePath);
    if (!databaseValidation.valid) {
      return { valid: false, reason: databaseValidation.reason };
    }

    if (manifest.encryption.mode === "bundled-desktop-secret") {
      const expectedSecretsPath = backupSetSecretsPath(databasePath);
      if (manifest.encryption.file !== path.basename(expectedSecretsPath)) {
        return { valid: false, reason: "Backup-set secret filename does not match its manifest." };
      }
      if (!fs.existsSync(expectedSecretsPath)) {
        return { valid: false, reason: "Bundled desktop secrets are missing." };
      }
      if (sha256(expectedSecretsPath) !== manifest.encryption.sha256) {
        return { valid: false, reason: "Bundled desktop-secret hash does not match its manifest." };
      }
      const store = parseDesktopSecretStore(expectedSecretsPath);
      if (compatibilityTag(store.jwtSecret) !== manifest.encryption.compatibilityTag) {
        return { valid: false, reason: "Bundled desktop secrets are incompatible with the manifest." };
      }
    } else {
      const externalJwtSecret = options.externalJwtSecret || process.env.JWT_SECRET;
      if (!externalJwtSecret) {
        return { valid: false, reason: "JWT_SECRET is required to validate this external-secret backup set." };
      }
      if (compatibilityTag(externalJwtSecret) !== manifest.encryption.compatibilityTag) {
        return { valid: false, reason: "JWT_SECRET is incompatible with this backup set." };
      }
    }

    return { valid: true, manifest, tables: databaseValidation.tables };
  } catch (error) {
    return { valid: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

function installBundledSecrets(
  bundledSecretsPath: string,
  targetSecretsPath: string,
): { previous: string | null; rollback: () => void } {
  const source = path.resolve(bundledSecretsPath);
  const target = path.resolve(targetSecretsPath);
  if (source === target) return { previous: null, rollback: () => undefined };

  const nonce = `${process.pid}-${Date.now()}`;
  const staged = `${target}.restore-${nonce}.tmp`;
  const previous = `${target}.bak-${Date.now()}`;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, staged, fs.constants.COPYFILE_EXCL);
  fs.chmodSync(staged, 0o600);
  parseDesktopSecretStore(staged);

  const hadTarget = fs.existsSync(target);
  try {
    if (hadTarget) fs.renameSync(target, previous);
    fs.renameSync(staged, target);
  } catch (error) {
    removeIfPresent(staged);
    try {
      if (!fs.existsSync(target) && fs.existsSync(previous)) fs.renameSync(previous, target);
    } catch {
      // Leave recovery paths in place and report the original install failure.
    }
    throw error;
  }

  return {
    previous: hadTarget ? previous : null,
    rollback: () => {
      removeIfPresent(target);
      if (hadTarget && fs.existsSync(previous)) fs.renameSync(previous, target);
    },
  };
}

export function restoreBackupSet(
  databaseBackupPath: string,
  options: RestoreBackupSetOptions = {},
): RestoreBackupSetResult {
  const databasePath = path.resolve(databaseBackupPath);
  const validation = validateBackupSet(databasePath, options);
  if (!validation.valid || !validation.manifest) {
    throw new Error(`Refusing to restore backup set: ${validation.reason || "validation failed"}`);
  }

  const targetSecretsPath = options.desktopSecretsPath || path.join(
    path.dirname(currentDatabasePath()),
    "laro-secrets.json",
  );
  const activeEnvironmentSecret = options.externalJwtSecret || process.env.JWT_SECRET;
  if (
    validation.manifest.encryption.mode === "bundled-desktop-secret" &&
    activeEnvironmentSecret &&
    compatibilityTag(activeEnvironmentSecret) !== validation.manifest.encryption.compatibilityTag
  ) {
    throw new Error(
      "Refusing to restore desktop backup set while the active JWT_SECRET overrides its bundled key.",
    );
  }
  if (
    validation.manifest.encryption.mode === "external-environment" &&
    fs.existsSync(targetSecretsPath)
  ) {
    const targetStore = parseDesktopSecretStore(targetSecretsPath);
    if (compatibilityTag(targetStore.jwtSecret) !== validation.manifest.encryption.compatibilityTag) {
      throw new Error(
        "Refusing to restore external-secret backup set into a desktop profile with incompatible keys.",
      );
    }
  }

  let secretInstall: { previous: string | null; rollback: () => void } | null = null;
  if (validation.manifest.encryption.mode === "bundled-desktop-secret") {
    secretInstall = installBundledSecrets(backupSetSecretsPath(databasePath), targetSecretsPath);
  }

  try {
    const restored = restoreDatabase(databasePath);
    return {
      restored: true,
      backupOfPreviousDatabase: restored.backupOfPrevious,
      backupOfPreviousSecrets: secretInstall?.previous || null,
    };
  } catch (error) {
    secretInstall?.rollback();
    throw error;
  }
}
