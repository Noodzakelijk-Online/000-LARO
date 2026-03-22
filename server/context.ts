import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "./schema";
import { sdk } from "./sdk";
import { getDb, upsertUser } from "./db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // If authentication fails, use demo user for public access
    user = null;
  }

  // If no authenticated user, default to demo user for public showcase
  if (!user) {
    user = {
      id: 'demo-user-123',
      name: 'Demo User',
      email: 'demo@example.com',
      loginMethod: 'demo',
      role: 'user',
      createdAt: new Date(),
      lastSignedIn: new Date(),
    } as User;
    
    // Ensure demo user exists in database
    try {
      await upsertUser({
        id: user.id,
        name: user.name,
        email: user.email,
        loginMethod: user.loginMethod,
        role: user.role,
        lastSignedIn: user.lastSignedIn,
      });
    } catch (error) {
      console.warn('[Context] Failed to upsert demo user:', error);
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
