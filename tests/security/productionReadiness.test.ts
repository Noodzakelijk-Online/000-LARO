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

  it('accepts documented loopback development origins without weakening CSRF', async () => {
    const { isAllowedOrigin } = await import('../../server/_core/csrf');
    expect(isAllowedOrigin('http://localhost:5173')).toBe(true);
    expect(isAllowedOrigin('http://127.0.0.1:5173')).toBe(true);
    expect(isAllowedOrigin('https://attacker.example')).toBe(false);
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

  it('fails closed for unsigned or version-mismatched tagged releases', () => {
    const workflow = readFileSync(join(ROOT, '.github/workflows/build.yml'), 'utf8');
    expect(workflow).toContain('WINDOWS_CSC_LINK is required for tagged releases');
    expect(workflow).toContain("Tag ${{ github.ref_name }} does not match package version");
    expect(workflow).toContain("$signature.Status -ne 'Valid'");
    expect(workflow).toContain('release-artifacts/*');
    expect(workflow).not.toContain('path: release/**/*.exe');
  });

  it('does not invent an active dashboard case or preserve unverified OAuth status', () => {
    const dashboard = readFileSync(join(ROOT, 'frontend/dashboard_dark.html'), 'utf8');
    expect(dashboard).toContain('No case selected');
    expect(dashboard).not.toContain('params.get("case") || 1');
    expect(dashboard).not.toContain('Live status refresh is temporarily unavailable');
    expect(dashboard).toContain('localStorage.removeItem("auth_token")');
    expect(dashboard).toContain('localStorage.removeItem("access_token")');
    expect(dashboard).toContain('const token = localStorage.getItem("laroAuthToken") || localStorage.getItem("auth_token") || localStorage.getItem("access_token")');
  });

  it('keeps API-only deployments explicit and runs compatibility schema repair after migrations', () => {
    const server = readFileSync(join(ROOT, 'server/index.ts'), 'utf8');
    const database = readFileSync(join(ROOT, 'server/db.ts'), 'utf8');
    expect(server).toContain('!ENV.SERVER_ONLY');
    expect(database.indexOf('migrate(_db')).toBeLessThan(database.lastIndexOf('ensureSupportTicketsTable(sqlite)'));
  });

  it('binds packaged Desktop to an available loopback port', () => {
    const server = readFileSync(join(ROOT, 'server/index.ts'), 'utf8');
    const main = readFileSync(join(ROOT, 'src-main/index.ts'), 'utf8');
    const provider = readFileSync(join(ROOT, 'src/renderer/providers/TrpcProvider.tsx'), 'utf8');
    expect(main).toContain('resolveDesktopServerPort(process.env.OAUTH_REDIRECT_BASE_URL)');
    expect(main).toContain('const actualPort = await startServer(requestedPort)');
    expect(main).toContain('agentConfig.apiUrl = laroUrl');
    expect(main).toContain('process.env.OAUTH_REDIRECT_BASE_URL = laroUrl');
    expect(main).toContain("process.env.LARO_PACKAGED_DESKTOP = app.isPackaged ? 'true' : 'false'");
    expect(server).toContain("const packagedDesktop = process.env.LARO_PACKAGED_DESKTOP === 'true'");
    expect(server.indexOf("path.join(process.cwd(), '.env')"))
      .toBeGreaterThan(server.indexOf(': ['));
    expect(provider).toContain('window.location.origin');
    expect(provider).not.toContain('window.location.port !== "5173"');
    expect(main).not.toContain('await startServer(PORT)');
  });

  it('reports the package version consistently across operational endpoints', () => {
    const health = readFileSync(join(ROOT, 'server/index.ts'), 'utf8');
    const system = readFileSync(join(ROOT, 'server/_core/systemRouter.ts'), 'utf8');
    const admin = readFileSync(join(ROOT, 'server/routers/admin.ts'), 'utf8');
    const main = readFileSync(join(ROOT, 'src-main/index.ts'), 'utf8');
    expect(health).toContain('version: APP_VERSION');
    expect(system.match(/version: APP_VERSION/g)).toHaveLength(2);
    expect(admin).toContain('appVersion: APP_VERSION');
    expect(main).toContain('process.env.LARO_APP_VERSION = app.getVersion()');
  });

  it('keeps operator readiness deterministic after Electron packaging', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    const readiness = readFileSync(join(ROOT, 'scripts/operator-readiness.mjs'), 'utf8');
    expect(pkg.scripts.readiness).toContain('npm run rebuild:node');
    expect(pkg.scripts['readiness:production']).toContain('npm run rebuild:node');
    expect(readiness).toContain('[result.stdout, result.stderr]');
  });

  it('builds the shipped renderer with production React regardless of local env files', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    const rendererBuild = readFileSync(join(ROOT, 'scripts/build-renderer.mjs'), 'utf8');
    expect(pkg.scripts['build:renderer']).toBe('node scripts/build-renderer.mjs');
    expect(rendererBuild.indexOf('process.env.NODE_ENV = "production"'))
      .toBeLessThan(rendererBuild.indexOf('await import("vite")'));
  });

  it('keeps horizontal tabs stacked above their content at every viewport', () => {
    const tabs = readFileSync(join(ROOT, 'src/renderer/components/ui/tabs.tsx'), 'utf8');
    expect(tabs).toContain('data-[orientation=horizontal]:flex-col');
    expect(tabs).not.toContain('data-horizontal:flex-col');
    expect(tabs).not.toContain('group-data-horizontal/tabs');
  });

  it('ships its dashboard mark locally and uses it for Windows packaging', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    const constants = readFileSync(join(ROOT, 'shared/const.ts'), 'utf8');
    expect(pkg.build.win.icon).toBe('build/icon.png');
    expect(constants).toContain('APP_LOGO = "/laro-logo.png"');
    expect(constants).not.toContain('manuscdn.com');
    expect(readFileSync(join(ROOT, 'public/laro-logo.png')).byteLength).toBeGreaterThan(1_000);
    expect(readFileSync(join(ROOT, 'build/icon.png')).byteLength).toBeGreaterThan(1_000);
  });

  it('attaches authenticated realtime updates without render-loop reconnects', () => {
    const server = readFileSync(join(ROOT, 'server/index.ts'), 'utf8');
    const realtime = readFileSync(join(ROOT, 'server/realtime.ts'), 'utf8');
    const notifications = readFileSync(join(ROOT, 'server/notifications.ts'), 'utf8');
    const client = readFileSync(join(ROOT, 'src/renderer/contexts/WebSocketContext.tsx'), 'utf8');
    const dashboard = readFileSync(join(ROOT, 'src/renderer/DashboardApp.tsx'), 'utf8');
    const notificationCenter = readFileSync(join(ROOT, 'src/renderer/components/NotificationCenter.tsx'), 'utf8');
    const vite = readFileSync(join(ROOT, 'vite.config.ts'), 'utf8');
    expect(server).toContain('initializeRealtimeServer(httpServer)');
    expect(realtime).toContain('jwt.verify(token, ENV.JWT_SECRET)');
    expect(realtime).toContain('isTokenRevoked(decoded.userId, decoded.iat)');
    expect(realtime).toContain('socket.join(userRoom(userId))');
    expect(notifications).toContain('emitRealtimeNotification(params.userId');
    expect(client).toContain('const push = useCallback');
    expect(client).toContain('io(window.location.origin)');
    expect(client).not.toContain('transports: ["websocket", "polling"]');
    expect(client).not.toContain('socketInstance.emit("join"');
    expect(dashboard).toContain('<WebSocketProvider>');
    expect(notificationCenter).toContain('@/contexts/WebSocketContext');
    expect(notificationCenter).not.toContain('@/_core/hooks/useWebSocket');
    expect(vite).toContain("'/socket.io'");
    expect(vite.match(/target: 'http:\/\/127\.0\.0\.1:3000'/g)).toHaveLength(2);
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

  it('keeps production search honest and routes lawyer actions to real records', () => {
    const search = readFileSync(join(ROOT, 'src/renderer/components/SmartSearchFilters.tsx'), 'utf8');
    const lawyers = readFileSync(join(ROOT, 'src/renderer/components/Lawyers.tsx'), 'utf8');
    const dashboard = readFileSync(join(ROOT, 'src/renderer/DashboardApp.tsx'), 'utf8');
    expect(search).not.toContain('divorce lawyer Amsterdam');
    expect(search).not.toContain('employment law urgent');
    expect(search).not.toContain('Math.random()');
    expect(lawyers).toContain('searchType="lawyers"');
    expect(lawyers).toContain('setLocation(`/lawyers/${lawyer.id}`)');
    expect(dashboard).not.toContain('RoutePlaceholder');
    expect(dashboard).not.toContain('/email-automation');
    expect(dashboard).not.toContain('/billing');
    expect(dashboard).not.toContain('/reports');
    expect(dashboard).toContain('lazy(() => import("@/components/Cases"))');
    expect(dashboard).toContain('<Suspense fallback={<DashboardSkeleton />}>');
  });
});
