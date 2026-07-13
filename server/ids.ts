import { randomUUID } from 'crypto';

export function createCaseId(): string {
  return `CASE-${randomUUID()}`;
}
