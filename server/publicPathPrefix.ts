import type { NextFunction, Request, Response } from "express";

export function normalizePublicPathPrefix(value: string | undefined): string {
  const trimmed = (value || "").trim();
  if (!trimmed || trimmed === "/") return "";
  const normalized = trimmed.replace(/\/+$/, "");
  const segments = normalized.slice(1).split("/");
  if (
    !/^\/[A-Za-z0-9._~-]+(?:\/[A-Za-z0-9._~-]+)*$/.test(normalized) ||
    segments.some((segment) => segment === "." || segment === "..")
  ) {
    throw new Error("PUBLIC_PATH_PREFIX must be an absolute URL path such as /laro");
  }
  return normalized;
}

export function stripPublicPathPrefix(url: string, prefix: string): string {
  if (!prefix) return url;
  if (url === prefix) return "/";
  if (url.startsWith(`${prefix}/`)) {
    return url.slice(prefix.length) || "/";
  }
  if (url.startsWith(`${prefix}?`)) return `/${url.slice(prefix.length)}`;
  return url;
}

export function publicPathPrefixMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const prefix = normalizePublicPathPrefix(process.env.PUBLIC_PATH_PREFIX);
  req.url = stripPublicPathPrefix(req.url, prefix);
  next();
}
