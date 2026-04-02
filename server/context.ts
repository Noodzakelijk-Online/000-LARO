import { type Request, type Response } from "express";
import { COOKIE_NAME } from "../shared/const";

export interface TrpcContext {
  req: Request;
  res: Response;
  user: { id: string; role: string } | null;
}

export const createContext = async ({
  req,
  res,
}: {
  req: Request;
  res: Response;
}): Promise<TrpcContext> => {
  // Simple session check for MVP
  const sessionToken = req.cookies[COOKIE_NAME];
  const user = sessionToken ? { id: "demo-user-123", role: "admin" } : null;

  return {
    req,
    res,
    user,
  };
};
