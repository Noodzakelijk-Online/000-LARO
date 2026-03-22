/**
 * Centralized Error Handling and Logging Service
 * 
 * Provides consistent error handling, logging, and monitoring across the application.
 */

import { getDb } from "./db";
import { auditLogs } from "./schema";
import { nanoid } from "nanoid";

export enum ErrorSeverity {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

export enum ErrorCategory {
  DATABASE = "DATABASE",
  EMAIL = "EMAIL",
  API = "API",
  AUTHENTICATION = "AUTHENTICATION",
  VALIDATION = "VALIDATION",
  BUSINESS_LOGIC = "BUSINESS_LOGIC",
  EXTERNAL_SERVICE = "EXTERNAL_SERVICE",
  UNKNOWN = "UNKNOWN",
}

export interface ErrorContext {
  userId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface LogEntry {
  severity: ErrorSeverity;
  category: ErrorCategory;
  message: string;
  error?: Error;
  context?: ErrorContext;
  timestamp: Date;
}

/**
 * Log error to console and database
 */
export async function logError(entry: LogEntry): Promise<void> {
  const timestamp = entry.timestamp || new Date();
  const errorMessage = entry.error?.message || entry.message;
  const stackTrace = entry.error?.stack || "";

  // Console logging with color coding
  const severityColors = {
    [ErrorSeverity.LOW]: "\x1b[36m", // Cyan
    [ErrorSeverity.MEDIUM]: "\x1b[33m", // Yellow
    [ErrorSeverity.HIGH]: "\x1b[31m", // Red
    [ErrorSeverity.CRITICAL]: "\x1b[35m", // Magenta
  };

  const color = severityColors[entry.severity] || "\x1b[0m";
  const reset = "\x1b[0m";

  console.error(
    `${color}[${entry.severity}] [${entry.category}] ${timestamp.toISOString()}${reset}`,
    `\n  Message: ${errorMessage}`,
    entry.context ? `\n  Context: ${JSON.stringify(entry.context, null, 2)}` : "",
    stackTrace ? `\n  Stack: ${stackTrace}` : ""
  );

  // Database logging (audit log)
  try {
    const db = await getDb();
    if (db) {
      await db.insert(auditLogs).values({
        id: nanoid(),
        userId: entry.context?.userId || null,
        action: `ERROR_${entry.category}`,
        entityType: entry.context?.entityType || null,
        entityId: entry.context?.entityId || null,
        details: JSON.stringify({
          severity: entry.severity,
          category: entry.category,
          message: errorMessage,
          stack: stackTrace,
          context: entry.context?.details,
        }),
        ipAddress: entry.context?.ipAddress || null,
        userAgent: entry.context?.userAgent || null,
      });
    }
  } catch (dbError) {
    // If database logging fails, at least log to console
    console.error("[Error Handler] Failed to log error to database:", dbError);
  }

  // TODO: Send critical errors to monitoring service (e.g., Sentry, DataDog)
  if (entry.severity === ErrorSeverity.CRITICAL) {
    // await sendToMonitoringService(entry);
  }
}

/**
 * Log info message (non-error events)
 */
export async function logInfo(
  message: string,
  context?: ErrorContext
): Promise<void> {
  console.log(`[INFO] ${new Date().toISOString()}`, message, context || "");

  try {
    const db = await getDb();
    if (db) {
      await db.insert(auditLogs).values({
        id: nanoid(),
        userId: context?.userId || null,
        action: context?.action || "INFO",
        entityType: context?.entityType || null,
        entityId: context?.entityId || null,
        details: JSON.stringify({
          message,
          ...context?.details,
        }),
        ipAddress: context?.ipAddress || null,
        userAgent: context?.userAgent || null,
      });
    }
  } catch (error) {
    console.error("[Error Handler] Failed to log info to database:", error);
  }
}

/**
 * Wrap async function with error handling
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  category: ErrorCategory,
  context?: Partial<ErrorContext>
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    try {
      return await fn(...args);
    } catch (error) {
      await logError({
        severity: ErrorSeverity.HIGH,
        category,
        message: `Error in ${fn.name || "anonymous function"}`,
        error: error as Error,
        context: context as ErrorContext,
        timestamp: new Date(),
      });
      throw error; // Re-throw to let caller handle
    }
  }) as T;
}

/**
 * Create error response for API endpoints
 */
export function createErrorResponse(
  error: Error,
  category: ErrorCategory = ErrorCategory.UNKNOWN
): {
  success: false;
  error: string;
  category: ErrorCategory;
  timestamp: string;
} {
  return {
    success: false,
    error: error.message,
    category,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Validate required fields
 */
export function validateRequired(
  data: Record<string, any>,
  requiredFields: string[]
): void {
  const missing = requiredFields.filter((field) => !data[field]);
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(", ")}`);
  }
}

/**
 * Safe JSON parse with error handling
 */
export function safeJSONParse<T = any>(
  json: string | null | undefined,
  defaultValue: T
): T {
  if (!json) return defaultValue;
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    logError({
      severity: ErrorSeverity.LOW,
      category: ErrorCategory.VALIDATION,
      message: "Failed to parse JSON",
      error: error as Error,
      context: { details: { json } },
      timestamp: new Date(),
    });
    return defaultValue;
  }
}

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i);
        console.log(`[Retry] Attempt ${i + 1} failed, retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error("Max retries exceeded");
}

