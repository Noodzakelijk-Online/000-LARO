/**
 * Phase 003 — Critical Path Smoke Test
 * =====================================================================
 * The critical path for LARO (per the Giant Codex Goal Prompt) is:
 *
 *   User account -> case intake -> evidence ingestion -> legal-area
 *   classification -> lawyer matching -> outreach draft -> human review
 *   -> send via provider -> response tracking -> outcome -> export package.
 *
 * This fast suite covers pure normalization. The real DB/API path is covered
 * by the acceptance, e2e, evidence, and outreach lifecycle suites referenced
 * at the end of this file.
 */
import { describe, it, expect } from 'vitest';
import {
  validateAndNormalizeLegalAreas,
  parseLegalAreas,
  sanitizeLegalAreas,
  VALID_LEGAL_AREAS,
} from '../../server/legalAreasValidator';

describe('Critical path — legal-area normalization (wired, pure)', () => {
  it('normalizes a single valid area string into a JSON array', () => {
    const res = validateAndNormalizeLegalAreas('Employment Law');
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(JSON.parse(res.data)).toEqual(['Employment Law']);
    }
  });

  it('accepts an array of valid areas', () => {
    const res = validateAndNormalizeLegalAreas(['Family Law', 'Contract Law']);
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(JSON.parse(res.data)).toEqual(['Family Law', 'Contract Law']);
    }
  });

  it('rejects an unknown legal area', () => {
    const res = validateAndNormalizeLegalAreas(['Not A Real Area']);
    expect(res.valid).toBe(false);
  });

  it('rejects empty input', () => {
    expect(validateAndNormalizeLegalAreas(null).valid).toBe(false);
    expect(validateAndNormalizeLegalAreas([]).valid).toBe(false);
  });

  it('round-trips through sanitize + parse without losing valid areas', () => {
    const stored = sanitizeLegalAreas(['Tax Law', 'Litigation']);
    expect(parseLegalAreas(stored)).toEqual(['Tax Law', 'Litigation']);
  });

  it('parse drops values not in the canonical list', () => {
    const stored = JSON.stringify(['Tax Law', 'Bogus']);
    expect(parseLegalAreas(stored)).toEqual(['Tax Law']);
  });

  it('exposes a non-empty canonical legal-area vocabulary', () => {
    expect(VALID_LEGAL_AREAS.length).toBeGreaterThan(5);
    expect(VALID_LEGAL_AREAS).toContain('Other');
  });
});

/**
 * The DB-backed critical path is exercised in acceptance/acceptance.test.ts,
 * e2e/workflow.e2e.test.ts, backend/partials_hardening.test.ts, and
 * backend/realSend.test.ts. This file retains the fast pure normalization gate.
 */
