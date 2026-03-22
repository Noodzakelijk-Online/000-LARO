import { nanoid } from "nanoid";
import { getDb } from "./db";
import { evidenceSources } from "./schema";
import { and, eq } from "drizzle-orm";

export interface SlackChannel {
  id: string;
  name: string;
  is_private?: boolean;
}

export interface SlackMessage {
  ts: string;
  text?: string;
  user?: string;
}

function getSlackOAuthConfig() {
  const clientId = process.env.SLACK_CLIENT_ID || "";
  const clientSecret = process.env.SLACK_CLIENT_SECRET || "";
  const redirectUri =
    process.env.SLACK_REDIRECT_URI || "http://localhost:3000/api/oauth/slack/callback";
  return { clientId, clientSecret, redirectUri };
}

export function getSlackAuthorizationUrl(userId: string, caseId: string): string {
  const { clientId, redirectUri } = getSlackOAuthConfig();
  const state = Buffer.from(JSON.stringify({ userId, caseId }), "utf-8").toString("base64");
  const params = new URLSearchParams({
    client_id: clientId,
    scope: "channels:history,channels:read,chat:write,users:read",
    redirect_uri: redirectUri,
    state,
  });
  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

export async function exchangeSlackCodeForTokens(code: string): Promise<{
  accessToken: string;
  teamId: string;
  teamName: string;
  botUserId?: string;
  authedUser?: { id: string; accessToken: string };
}> {
  const config = getSlackOAuthConfig();
  const response = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
    }),
  });
  const data = (await response.json()) as Record<string, unknown> & {
    ok?: boolean;
    error?: string;
    access_token?: string;
    team?: { id?: string; name?: string };
    bot_user_id?: string;
    authed_user?: { id?: string; access_token?: string };
  };
  if (!data.ok) {
    throw new Error(`Slack token exchange failed: ${data.error || "unknown"}`);
  }
  return {
    accessToken: String(data.access_token || ""),
    teamId: String(data.team?.id || ""),
    teamName: String(data.team?.name || ""),
    botUserId: data.bot_user_id ? String(data.bot_user_id) : undefined,
    authedUser: data.authed_user
      ? {
          id: String(data.authed_user.id),
          accessToken: String(data.authed_user.access_token),
        }
      : undefined,
  };
}

export async function listSlackChannels(accessToken: string): Promise<SlackChannel[]> {
  const channels: SlackChannel[] = [];
  let cursor: string | undefined;
  do {
    const params = new URLSearchParams({ types: "public_channel,private_channel", limit: "200" });
    if (cursor) params.append("cursor", cursor);
    const response = await fetch(`https://slack.com/api/conversations.list?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = (await response.json()) as {
      ok?: boolean;
      channels?: SlackChannel[];
      response_metadata?: { next_cursor?: string };
      error?: string;
    };
    if (!data.ok) throw new Error(data.error || "conversations.list failed");
    channels.push(...(data.channels || []));
    cursor = data.response_metadata?.next_cursor;
  } while (cursor);
  return channels;
}

export async function getChannelMessages(
  accessToken: string,
  channelId: string,
  limit: number = 100
): Promise<SlackMessage[]> {
  const params = new URLSearchParams({ channel: channelId, limit: String(limit) });
  const response = await fetch(`https://slack.com/api/conversations.history?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await response.json()) as {
    ok?: boolean;
    messages?: SlackMessage[];
    error?: string;
  };
  if (!data.ok) throw new Error(data.error || "conversations.history failed");
  return data.messages || [];
}

export async function testSlackConnection(botToken: string): Promise<{
  ok: boolean;
  error?: string;
  teamId?: string;
  team?: string;
}> {
  const response = await fetch("https://slack.com/api/auth.test", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Bearer ${botToken}`,
    },
    body: new URLSearchParams({ token: botToken }),
  });
  const data = (await response.json()) as {
    ok?: boolean;
    error?: string;
    team_id?: string;
    team?: string;
  };
  if (!data.ok) return { ok: false, error: data.error || "auth.test failed" };
  return { ok: true, teamId: data.team_id, team: data.team };
}

export async function connectSlack(
  userId: string,
  caseId: string,
  accessToken: string,
  teamId: string,
  teamName: string
): Promise<string> {
  const db = await getDb();
  const id = nanoid();
  const metadata = JSON.stringify({ teamId, teamName });
  if (db) {
    await db.insert(evidenceSources).values({
      id,
      caseId,
      userId,
      provider: "slack",
      externalId: teamId || id,
      status: "connected",
      accessToken,
      metadata,
    });
  }
  return id;
}

export async function getSlackStatus(caseId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(evidenceSources)
    .where(and(eq(evidenceSources.caseId, caseId), eq(evidenceSources.provider, "slack")))
    .limit(1);
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    status: r.status || "connected",
    metadata: r.metadata,
    itemsCollected: 0,
    lastSyncedAt: null as Date | null,
    errorMessage: null as string | null,
    accessToken: r.accessToken,
  };
}

export async function disconnectSlack(sourceId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(evidenceSources).where(eq(evidenceSources.id, sourceId));
}

export async function syncSlackForCase(
  _userId: string,
  _caseId: string,
  _accessToken: string,
  _sourceId: string,
  _channelIds?: string[]
): Promise<{
  totalMessages: number;
  totalFiles: number;
  processedChannels: number;
  errors: string[];
}> {
  void _userId;
  void _caseId;
  void _accessToken;
  void _sourceId;
  void _channelIds;
  return { totalMessages: 0, totalFiles: 0, processedChannels: 0, errors: [] };
}
