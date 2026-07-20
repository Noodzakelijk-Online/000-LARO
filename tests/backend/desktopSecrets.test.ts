import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { ensureDesktopSecrets } from '../../src-main/desktopSecrets';

const temporaryRoots: string[] = [];

function createRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'laro-desktop-secrets-'));
  temporaryRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('desktop secret durability', () => {
  it('creates strong secrets atomically on first run', () => {
    const root = createRoot();
    const environment: NodeJS.ProcessEnv = {};

    const result = ensureDesktopSecrets(root, environment);
    const secretsPath = path.join(root, 'laro-secrets.json');
    const stored = JSON.parse(fs.readFileSync(secretsPath, 'utf8'));

    expect(result).toEqual({ source: 'created-file', secretsPath });
    expect(environment.JWT_SECRET).toMatch(/^[a-f0-9]{64}$/);
    expect(environment.COOKIE_SECRET).toMatch(/^[a-f0-9]{64}$/);
    expect(stored).toEqual({
      jwtSecret: environment.JWT_SECRET,
      cookieSecret: environment.COOKIE_SECRET,
    });
    expect(fs.readdirSync(root).filter((name) => name.endsWith('.tmp'))).toEqual([]);
  });

  it('reuses the same secrets after restart', () => {
    const root = createRoot();
    const firstEnvironment: NodeJS.ProcessEnv = {};
    ensureDesktopSecrets(root, firstEnvironment);
    const secondEnvironment: NodeJS.ProcessEnv = {};

    const result = ensureDesktopSecrets(root, secondEnvironment);

    expect(result.source).toBe('existing-file');
    expect(secondEnvironment.JWT_SECRET).toBe(firstEnvironment.JWT_SECRET);
    expect(secondEnvironment.COOKIE_SECRET).toBe(firstEnvironment.COOKIE_SECRET);
  });

  it('preserves and rejects a corrupt existing file', () => {
    const root = createRoot();
    const secretsPath = path.join(root, 'laro-secrets.json');
    fs.writeFileSync(secretsPath, '{not-json', 'utf8');

    expect(() => ensureDesktopSecrets(root, {})).toThrow('Could not read the existing desktop secrets file');
    expect(fs.readFileSync(secretsPath, 'utf8')).toBe('{not-json');
  });

  it('preserves and rejects weak existing keys', () => {
    const root = createRoot();
    const secretsPath = path.join(root, 'laro-secrets.json');
    const weak = JSON.stringify({ jwtSecret: 'weak', cookieSecret: 'also-weak' });
    fs.writeFileSync(secretsPath, weak, 'utf8');

    expect(() => ensureDesktopSecrets(root, {})).toThrow('existing desktop secrets file');
    expect(fs.readFileSync(secretsPath, 'utf8')).toBe(weak);
  });

  it('allows complete operator-provided secrets without touching the local file', () => {
    const root = createRoot();
    const secretsPath = path.join(root, 'laro-secrets.json');
    fs.writeFileSync(secretsPath, '{corrupt-but-bypassed', 'utf8');
    const environment = {
      JWT_SECRET: 'operator-jwt-secret-with-sufficient-entropy',
      COOKIE_SECRET: 'operator-cookie-secret-with-sufficient-entropy',
    };

    expect(ensureDesktopSecrets(root, environment)).toEqual({ source: 'environment' });
    expect(fs.readFileSync(secretsPath, 'utf8')).toBe('{corrupt-but-bypassed');
  });

  it('fails instead of replacing an unreadable existing path', () => {
    const root = createRoot();
    const secretsPath = path.join(root, 'laro-secrets.json');
    fs.mkdirSync(secretsPath);

    expect(() => ensureDesktopSecrets(root, {})).toThrow('Could not read the existing desktop secrets file');
    expect(fs.statSync(secretsPath).isDirectory()).toBe(true);
  });
});
