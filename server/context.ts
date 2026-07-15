import { type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import { COOKIE_NAME } from "../shared/const";
import { ENV } from "./_core/env";
import { getUser } from "./db";

export type AuthScope = "session" | "evidence-scanner";

export interface TrpcContext {
  req: Request;
  res: Response;
  user: { id: string; name: string; role: string; email: string | null } | null;
  authScope?: AuthScope;
}

type TokenClaims = { userId: string; iat?: number; scope?: string };

export const createContext = async ({
  req,
  res,
}: {
  req: Request;
  res: Response;
}): Promise<TrpcContext> => {
  const authHeader = req.headers.authorization;
  const sessionToken = req.cookies[COOKIE_NAME];
  let userId: string | null = null;
  let authScope: AuthScope | undefined;

  if (authHeader?.startsWith("Bearer ")) {
    try {
      const decoded = jwt.verify(authHeader.substring(7), ENV.JWT_SECRET, {
        algorithms: ["HS256"],
      }) as TokenClaims;
      const { isTokenRevoked } = await import("./sessionRevocation");
      if (!(await isTokenRevoked(decoded.userId, decoded.iat))) {
        userId = decoded.userId;
        authScope = decoded.scope === "evidence-scanner" ? "evidence-scanner" : "session";
      }
    } catch {
      // Invalid bearer tokens do not suppress a valid browser session cookie.
    }
  }

  if (!userId && sessionToken) {
    try {
      const decoded = jwt.verify(sessionToken, ENV.JWT_SECRET, {
        algorithms: ["HS256"],
      }) as TokenClaims;
      const { isTokenRevoked } = await import("./sessionRevocation");
      if (!(await isTokenRevoked(decoded.userId, decoded.iat))) {
        userId = decoded.userId;
        authScope = "session";
      }
    } catch (error) {
      console.error("[Auth] Session verification failed:", error);
    }
  }

  if (!userId) return { req, res, user: null };

  try {
    const user = await getUser(userId);
    if (!user) return { req, res, user: null };

    return {
      req,
      res,
      user: {
        id: user.id,
        name: user.name || "Anonymous",
        role: user.role || "user",
        email: user.email || null,
      },
      authScope,
    };
  } catch (error) {
    console.error("[Auth] Session verification failed:", error);
    return { req, res, user: null };
  }
};
