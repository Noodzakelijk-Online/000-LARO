import { describe, expect, it } from 'vitest';
import {
  getStoredGmailEvidenceState,
  resolveGmailAccountIds,
} from '../../server/gmailCollectionPolicy';

describe('Gmail collection policy', () => {
  it('preserves the explicitly selected account IDs', () => {
    expect(resolveGmailAccountIds(
      [' account-b ', 'account-a', 'account-b'],
      JSON.stringify(['account-c']),
    )).toEqual(['account-b', 'account-a']);
  });

  it('falls back to saved account IDs for one-shot pulls', () => {
    expect(resolveGmailAccountIds(undefined, JSON.stringify(['account-b']))).toEqual(['account-b']);
    expect(resolveGmailAccountIds(undefined, 'invalid-json')).toBeUndefined();
  });

  it('allows missing attachments to be collected for an existing message', () => {
    const state = getStoredGmailEvidenceState(
      [
        JSON.stringify({ gmailMessageId: 'message-1', accountId: 'account-b' }),
        JSON.stringify({ gmailMessageId: 'message-1', attachmentId: 'attachment-1', accountId: 'account-b' }),
        JSON.stringify({ gmailMessageId: 'message-1', attachmentId: 'attachment-2', accountId: 'account-a' }),
      ],
      'account-b',
      'message-1',
    );

    expect(state.messageStored).toBe(true);
    expect([...state.attachmentIds]).toEqual(['attachment-1']);
    expect(state.attachmentIds.has('attachment-2')).toBe(false);
  });

  it('does not deduplicate a selected account against another account', () => {
    const state = getStoredGmailEvidenceState(
      [JSON.stringify({ gmailMessageId: 'message-1', accountId: 'account-a' })],
      'account-b',
      'message-1',
    );

    expect(state.messageStored).toBe(false);
    expect(state.attachmentIds.size).toBe(0);
  });
});
