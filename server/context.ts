import { type Request, type Response } from "express";
import { COOKIE_NAME } from "../shared/const";
import jwt from "jsonwebtoken";
import { ENV } from "./_core/env";
import { getUser } from "./db";

export interface TrpcContext {
  req: Request;
  res: Response;
  user: { id: string; name: string; role: string; email: string | null } | null;
}

export const createContext = async ({
  req,
  res,
}: {
  req: Request;
  res: Response;
}): Promise<TrpcContext> => {
  const authHeader = req.headers.authorization;
  let userId: string | null = null;
  const sessionToken = req.cookies[COOKIE_NAME];
  /** Placeholder bearer used by the desktop scanner — must not override a real browser session cookie */
  let useLocalDefaultFallback = false;

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);

    if (token === "local-default" || token === "local-dev-token") {
      useLocalDefaultFallback = true;
    } else {
      try {
        const decoded = jwt.verify(token, ENV.JWT_SECRET) as { userId: string };
        userId = decoded.userId;
      } catch {
        // invalid token
      }
    }
  }

  if (!userId && sessionToken) {
    try {
      const decoded = jwt.verify(sessionToken, ENV.JWT_SECRET) as { userId: string };
      userId = decoded.userId;
    } catch (error) {
      console.error("[Auth] Session verification failed:", error);
    }
  }

  if (!userId && useLocalDefaultFallback) {
    userId = "USER_LOCAL_DEFAULT";
  }

  if (!userId) {
    return { req, res, user: null };
  }

  try {
    let user = await getUser(userId);
    
    // Auto-create local user if using local fallback
    if (!user && (userId === 'USER_LOCAL_DEFAULT')) {
       user = { id: 'USER_LOCAL_DEFAULT', name: 'Local User', role: 'user', email: 'local@laro.internal' } as any;
    }

    if (!user) {
      return { req, res, user: null };
    }

    return {
      req,
      res,
      user: {
        id: user.id,
        name: user.name || 'Anonymous',
        role: user.role || 'user',
        email: user.email || null
      },
    };
  } catch (error) {
    console.error("[Auth] Session verification failed:", error);
    return { req, res, user: null };
  }
};
