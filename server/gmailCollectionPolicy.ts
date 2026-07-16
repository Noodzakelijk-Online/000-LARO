export interface StoredGmailEvidenceState {
  messageStored: boolean;
  attachmentIds: Set<string>;
}

export function resolveGmailAccountIds(
  requestedAccountIds: string[] | undefined,
  configuredAccountIds: string | null | undefined,
): string[] | undefined {
  if (requestedAccountIds !== undefined) {
    return [...new Set(requestedAccountIds.map((id) => id.trim()).filter(Boolean))];
  }

  if (!configuredAccountIds) return undefined;
  try {
    const parsed = JSON.parse(configuredAccountIds);
    if (!Array.isArray(parsed)) return undefined;
    return [...new Set(parsed.filter((id): id is string => typeof id === 'string').map((id) => id.trim()).filter(Boolean))];
  } catch {
    return undefined;
  }
}

export function getStoredGmailEvidenceState(
  metadataRows: Array<string | null>,
  accountId: string,
  messageId: string,
): StoredGmailEvidenceState {
  const state: StoredGmailEvidenceState = {
    messageStored: false,
    attachmentIds: new Set<string>(),
  };

  for (const rawMetadata of metadataRows) {
    if (!rawMetadata) continue;
    try {
      const metadata = JSON.parse(rawMetadata) as Record<string, unknown>;
      if (metadata.gmailMessageId !== messageId) continue;
      if (typeof metadata.accountId === 'string' && metadata.accountId !== accountId) continue;

      if (typeof metadata.attachmentId === 'string' && metadata.attachmentId) {
        state.attachmentIds.add(metadata.attachmentId);
      } else {
        state.messageStored = true;
      }
    } catch {
      // Invalid legacy metadata cannot safely participate in deduplication.
    }
  }

  return state;
}
