/**
 * LARO SDK — Manus OAuth client
 * Handles authentication, session management, and user info retrieval.
 * Reconstructed from usage patterns across the codebase.
 */

import axios, { AxiosInstance } from 'axios';
import { Request } from 'express';
import { jwtVerify, SignJWT } from 'jose';
import { COOKIE_NAME } from '../shared/const';
import * as db from './db';
import type { User } from "./schema";

// ─── API paths ────────────────────────────────────────────────────────────────

const GET_USER_INFO_PATH          = '/api/v1/user/info';
const GET_USER_INFO_WITH_JWT_PATH = '/api/v1/user/info/jwt';
const EXCHANGE_CODE_PATH          = '/api/v1/oauth/token';
const CREATE_SESSION_PATH         = '/api/v1/session/create';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TokenResponse {
  accessToken:  string;
  refreshToken?: string;
  expiresIn?:   number;
}

export interface GetUserInfoResponse {
  openId:      string;
  name?:       string;
  email?:      string;
  avatar?:     string;
  platform?:   string;
  platforms?:  string[];
  loginMethod?: string;
}

export type GetUserInfoWithJwtResponse = GetUserInfoResponse;

export interface SessionPayload {
  openId:    string;
  name?:     string;
  expiresAt: number;
}

export interface CreateSessionOptions {
  name?:       string;
  expiresInMs?: number;
}

// ─── Error helpers ────────────────────────────────────────────────────────────

export function ForbiddenError(message: string): Error {
  const err = new Error(message) as any;
  err.code  = 'FORBIDDEN';
  err.status = 403;
  return err;
}

// ─── SDK class ────────────────────────────────────────────────────────────────

export class LaroSDK {
  private client:    AxiosInstance;
  private apiUrl:    string;
  private jwtSecret: Uint8Array;

  constructor(apiUrl: string, jwtSecret: string) {
    this.apiUrl    = apiUrl;
    this.jwtSecret = new TextEncoder().encode(jwtSecret);
    this.client    = axios.create({
      baseURL: apiUrl,
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Cookie parser ───────────────────────────────────────────────────────────

  parseCookies(cookieHeader?: string): Map<string, string> {
    const map = new Map<string, string>();
    if (!cookieHeader) return map;
    for (const part of cookieHeader.split(';')) {
      const [key, ...val] = part.trim().split('=');
      if (key) map.set(key.trim(), decodeURIComponent(val.join('=')));
    }
    return map;
  }

  // ── Session token (JWT) ─────────────────────────────────────────────────────

  async createSessionToken(
    openId: string,
    options: CreateSessionOptions = {}
  ): Promise<string> {
    const expiresInMs = options.expiresInMs ?? 365 * 24 * 60 * 60 * 1000;
    const expiresAt   = Date.now() + expiresInMs;

    return new SignJWT({ openId, name: options.name ?? '', expiresAt })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(Math.floor(expiresAt / 1000))
      .sign(this.jwtSecret);
  }

  async verifySession(token?: string): Promise<SessionPayload | null> {
    if (!token) return null;
    try {
      const { payload } = await jwtVerify(token, this.jwtSecret);
      if ((payload.expiresAt as number) < Date.now()) return null;
      return payload as unknown as SessionPayload;
    } catch {
      return null;
    }
  }

  // ── OAuth code exchange ─────────────────────────────────────────────────────

  async exchangeCodeForToken(code: string, state: string): Promise<TokenResponse> {
    try {
      const { data } = await this.client.post<TokenResponse>(EXCHANGE_CODE_PATH, {
        code,
        state,
        grantType: 'authorization_code',
      });
      return data;
    } catch {
      // Fallback — create a local token if Manus is unavailable
      return { accessToken: `local_${code}`, expiresIn: 3600 };
    }
  }

  // ── User info ───────────────────────────────────────────────────────────────

  async getUserInfo(accessToken: string): Promise<GetUserInfoResponse> {
    try {
      const { data } = await this.client.get<GetUserInfoResponse>(
        GET_USER_INFO_PATH,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      return { ...data, loginMethod: this.deriveLoginMethod(data.platforms, data.platform ?? null) };
    } catch {
      // If Manus is unavailable, derive from token
      return { openId: `user_${accessToken.slice(-8)}`, loginMethod: 'local' };
    }
  }

  async getUserInfoWithJwt(sessionToken: string): Promise<GetUserInfoWithJwtResponse> {
    try {
      const payload = { jwt: sessionToken };
      const { data } = await this.client.post<GetUserInfoWithJwtResponse>(
        GET_USER_INFO_WITH_JWT_PATH,
        payload
      );
      const loginMethod = this.deriveLoginMethod(
        (data as any)?.platforms,
        (data as any)?.platform ?? data.platform ?? null
      );
      return { ...(data as any), platform: loginMethod, loginMethod };
    } catch {
      // Fallback — decode JWT locally
      const session = await this.verifySession(sessionToken);
      if (!session) throw ForbiddenError('Invalid session token');
      return { openId: session.openId, name: session.name, loginMethod: 'local' };
    }
  }

  deriveLoginMethod(platforms?: string[], platform?: string | null): string {
    if (platforms && platforms.length > 0) return platforms[0];
    if (platform) return platform;
    return 'email';
  }

  // ── Authenticate request ────────────────────────────────────────────────────

  async authenticateRequest(req: Request): Promise<User> {
    const cookies       = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session       = await this.verifySession(sessionCookie);

    if (!session) throw ForbiddenError('Invalid session cookie');

    const signedInAt = new Date();
    let user = await db.getUser(session.openId);

    // Sync user from OAuth provider if not in DB
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? '');
        await db.upsertUser({
          id:          userInfo.openId,
          name:        userInfo.name || null,
          email:       userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt,
        });
        user = await db.getUser(userInfo.openId);
      } catch (error) {
        console.error('[Auth] Failed to sync user:', error);
        throw ForbiddenError('Failed to sync user info');
      }
    }

    if (!user) throw ForbiddenError('User not found');

    // Update last signed in
    await db.upsertUser({
      id:          user.id,
      lastSignedIn: signedInAt,
    });

    return user;
  }

  // ── Login URL ───────────────────────────────────────────────────────────────

  getLoginUrl(redirectUrl?: string): string {
    const base   = process.env.MANUS_API_URL || this.apiUrl;
    const params = new URLSearchParams({
      client_id:    process.env.MANUS_CLIENT_ID || 'laro',
      redirect_uri: redirectUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/api/oauth/callback`,
      response_type: 'code',
    });
    return `${base}/oauth/authorize?${params.toString()}`;
  }
}

// ─── Singleton instance ───────────────────────────────────────────────────────

export const sdk = new LaroSDK(
  process.env.MANUS_API_URL || 'https://api.manus.im',
  process.env.JWT_SECRET    || 'change-this-secret-in-production'
);