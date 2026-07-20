import { describe, expect, it } from 'vitest';
import {
  DEFAULT_AUDIT_RETENTION_DAYS,
  MAX_AUDIT_RETENTION_DAYS,
  MIN_AUDIT_RETENTION_DAYS,
  parseAuditRetentionDays,
} from '../../server/_core/env';
import { CRON_SCHEDULES } from '../../server/cronScheduler';

describe('retention configuration', () => {
  it('uses the documented default and accepts bounded whole-day values', () => {
    expect(parseAuditRetentionDays(undefined)).toBe(DEFAULT_AUDIT_RETENTION_DAYS);
    expect(parseAuditRetentionDays('')).toBe(DEFAULT_AUDIT_RETENTION_DAYS);
    expect(parseAuditRetentionDays(String(MIN_AUDIT_RETENTION_DAYS))).toBe(MIN_AUDIT_RETENTION_DAYS);
    expect(parseAuditRetentionDays(String(MAX_AUDIT_RETENTION_DAYS))).toBe(MAX_AUDIT_RETENTION_DAYS);
  });

  it.each(['abc', '0', '29', '3650.5', '3651', '-1'])(
    'rejects unsafe retention value %s',
    (value) => {
      expect(() => parseAuditRetentionDays(value)).toThrow(/AUDIT_RETENTION_DAYS/);
    }
  );

  it('registers a daily retention schedule separate from collection', () => {
    expect(CRON_SCHEDULES.retention).toBe('30 3 * * *');
    expect(CRON_SCHEDULES.retention).not.toBe(CRON_SCHEDULES.autoCollection);
  });
});
