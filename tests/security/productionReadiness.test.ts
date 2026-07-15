import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');
const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('production readiness regressions', () => {
  it('fails closed when provider-backed AI is not configured', async () => {
    delete process.env.FORGE_API_KEY;
    vi.resetModules();
    const { invokeLLM } = await import('../../server/llm');
    await expect(invokeLLM({ messages: [{ role: 'user', content: 'Analyze this.' }] }))
      .rejects.toThrow('FORGE_API_KEY is not configured');
  });

  it('uses encrypted PKCE state for Google OAuth', async () => {
    process.env.GOOGLE_CLIENT_ID = 'client-id';
    process.env.COOKIE_SECRET = 'test-cookie-secret-that-is-long-and-random-1234';
    vi.resetModules();
    const { beginOAuthFlow, consumeOAuthState } = await import('../../server/oauth2');
    const authUrl = new URL(beginOAuthFlow('gmail', 'USER_TEST'));
    expect(authUrl.searchParams.get('code_challenge_method')).toBe('S256');
    const state = authUrl.searchParams.get('state');
    expect(state).toBeTruthy();
    expect(consumeOAuthState(state!, 'gmail').userId).toBe('USER_TEST');
  });

  it('keeps sensitive mutations behind protected or admin procedures', () => {
    const messages = readFileSync(join(ROOT, 'server/routers/messages.ts'), 'utf8');
    const lawyers = readFileSync(join(ROOT, 'server/routers/lawyers.ts'), 'utf8');
    const email = readFileSync(join(ROOT, 'server/routers/email.ts'), 'utf8');
    expect(messages).not.toContain('publicProcedure');
    expect(lawyers).not.toContain('publicProcedure');
    expect(lawyers).toContain('create: adminProcedure');
    expect(email).not.toContain('publicProcedure');
  });

  it('loads matcher datasets from packaged assets', () => {
    const matching = readFileSync(join(ROOT, 'server/matching.ts'), 'utf8');
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    const packagedAssets = pkg.build.extraResources.find((entry: { from?: string }) => entry.from === 'assets');
    expect(matching).toContain('assets');
    expect(packagedAssets.filter).toEqual([
      'legal-taxonomy-mapping.json',
      'rechtspraak-keywords-analysis.json',
    ]);
    expect(packagedAssets.filter).not.toContain('**/*');
    expect(readFileSync(join(ROOT, 'assets/legal-taxonomy-mapping.json'), 'utf8')).toContain('specializationToCourtCategories');
    expect(readFileSync(join(ROOT, 'assets/rechtspraak-keywords-analysis.json'), 'utf8')).toContain('keywords_by_area');
  });

  it('does not invent an active dashboard case or preserve unverified OAuth status', () => {
    const dashboard = readFileSync(join(ROOT, 'frontend/dashboard_dark.html'), 'utf8');
    expect(dashboard).toContain('No case selected');
    expect(dashboard).not.toContain('params.get("case") || 1');
    expect(dashboard).not.toContain('Live status refresh is temporarily unavailable');
  });

  it('keeps API-only deployments explicit and runs compatibility schema repair after migrations', () => {
    const server = readFileSync(join(ROOT, 'server/index.ts'), 'utf8');
    const database = readFileSync(join(ROOT, 'server/db.ts'), 'utf8');
    expect(server).toContain('!ENV.SERVER_ONLY');
    expect(database.indexOf('migrate(_db')).toBeLessThan(database.lastIndexOf('ensureSupportTicketsTable(sqlite)'));
  });

  it('generates collision-resistant case identifiers', async () => {
    const { createCaseId } = await import('../../server/ids');
    const ids = Array.from({ length: 1_000 }, createCaseId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith('CASE-'))).toBe(true);
  });

  it('uses persisted evidence storage from every renderer upload surface', () => {
    for (const component of ['BulkEvidenceUpload.tsx', 'FileUploadDialog.tsx', 'EnhancedEvidenceUpload.tsx']) {
      const upload = readFileSync(join(ROOT, 'src/renderer/components', component), 'utf8');
      expect(upload).toContain('evidenceFiles.upload');
      expect(upload).not.toContain('storage.example.com');
      expect(upload).not.toMatch(/simulate(d)? upload/i);
    }
  });
});
