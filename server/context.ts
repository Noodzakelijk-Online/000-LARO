import { type Request, type Response } from "express";
import { COOKIE_NAME } from "../shared/const";
import jwt from "jsonwebtoken";
import { ENV } from "./_core/env";
import { getUser } from "./db";

export interface TrpcContext {
  req: Request;
  res: Response;
  user: { id: string; role: string; email: string | null } | null;
}

export const createContext = async ({
  req,
  res,
}: {
  req: Request;
  res: Response;
}): Promise<TrpcContext> => {
  const sessionToken = req.cookies[COOKIE_NAME];

  if (!sessionToken) {
    return { req, res, user: null };
  }

  try {
    const decoded = jwt.verify(sessionToken, ENV.JWT_SECRET) as { userId: string };
    const user = await getUser(decoded.userId);

    if (!user) {
      return { req, res, user: null };
    }

    return {
      req,
      res,
      user: {
        id: user.id,
        role: user.role || 'user',
        email: user.email || null
      },
    };
  } catch (error) {
    console.error("[Auth] Session verification failed:", error);
    return { req, res, user: null };
  }
};
