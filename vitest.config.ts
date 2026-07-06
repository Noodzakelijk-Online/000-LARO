import { defineConfig } from 'vitest/config';

/**
 * Standalone Vitest config.
 *
 * Before this file existed, `vitest` fell back to loading `vite.config.ts`
 * (which pulls in the Electron/React renderer plugins) and could not start in a
 * headless checkout. This config is deliberately minimal and framework-free so
 * the backend/critical-path tests run without the renderer toolchain.
 *
 * Scope: currently limited to the Phase 003 smoke suite. The legacy `tests/*.test.ts`
 * files have broken import paths and tautological assertions (documented in
 * docs/phase-audit.md and docs/CRITICAL_PATH.md); they are repaired and folded
 * into `include` in Phases 040–041 (Backend / Frontend test suites).
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/smoke/**/*.test.ts'],
    testTimeout: 20_000,
  },
});
