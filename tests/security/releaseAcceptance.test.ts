import { spawnSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const packageVersion = '1.3.0';
const temporaryDirectories: string[] = [];
const providerRequirements = {
  google: ['credentials', 'oauthConsent', 'gmailRead', 'driveRead', 'evidencePersisted', 'sourceLinkOpened', 'disconnectRevoked'],
  outboundEmail: ['credentials', 'approvedSend', 'singleDelivery', 'auditRecorded', 'duplicateBlocked'],
};

function approval() {
  return {
    status: 'approved',
    approvedBy: 'Release owner',
    approvedAt: new Date().toISOString(),
    evidence: ['review:brand-approval'],
  };
}

function record(liveProviders: Record<string, unknown>) {
  return {
    schemaVersion: 1,
    version: packageVersion,
    gates: { publicBrand: approval(), liveProviders },
  };
}

function validate(candidate: Record<string, unknown>) {
  const directory = mkdtempSync(join(tmpdir(), 'laro-provider-acceptance-'));
  temporaryDirectories.push(directory);
  const file = join(directory, 'acceptance.json');
  writeFileSync(file, JSON.stringify(candidate));
  return spawnSync(process.execPath, [
    join(ROOT, 'scripts/release-acceptance.mjs'),
    '--require-approved',
    '--tag', `v${packageVersion}`,
    '--file', file,
  ], { cwd: ROOT, encoding: 'utf8' });
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('release acceptance provider evidence', () => {
  it('rejects generic provider approval without provider-specific results', () => {
    const result = validate(record({ ...approval(), providerScope: ['google'] }));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('liveProviders approval requires a providerChecks object');
  });

  it('rejects unsupported scopes, future timestamps, and incomplete checks', () => {
    const result = validate(record({
      ...approval(),
      providerScope: ['google', 'unknownProvider'],
      providerChecks: {
        google: {
          status: 'passed',
          testedAt: '2999-01-01T00:00:00.000Z',
          evidence: ['run:google-live-test'],
          checks: ['credentials', 'oauthConsent'],
        },
        unknownProvider: {
          status: 'passed',
          testedAt: new Date().toISOString(),
          evidence: ['run:unknown'],
          checks: ['credentials'],
        },
      },
    }));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('unsupported providers: unknownProvider');
    expect(result.stderr).toContain('must be a valid non-future timestamp');
    expect(result.stderr).toContain('is missing checks: gmailRead');
  });

  it('accepts complete evidence for every provider in the declared scope', () => {
    const providerScope = ['google', 'outboundEmail'] as const;
    const providerChecks = Object.fromEntries(providerScope.map((provider) => [provider, {
      status: 'passed',
      testedAt: new Date().toISOString(),
      evidence: [`run:${provider}-acceptance`],
      checks: providerRequirements[provider],
    }]));
    const result = validate(record({ ...approval(), providerScope: [...providerScope], providerChecks }));
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('All recorded external acceptance gates are approved.');
  });
});
