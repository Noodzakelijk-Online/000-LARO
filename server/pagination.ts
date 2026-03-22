import { z } from "zod";

/**
 * Standard pagination input schema for tRPC procedures
 */
export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

/**
 * Standard pagination response metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Generic paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * Calculate pagination metadata
 */
export function calculatePaginationMeta(
  page: number,
  limit: number,
  total: number
): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

/**
 * Calculate offset for SQL queries
 */
export function calculateOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}

/**
 * Create a paginated response
 */
export function createPaginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number
): PaginatedResponse<T> {
  return {
    data,
    meta: calculatePaginationMeta(page, limit, total),
  };
}

/**
 * Validate and normalize pagination input
 */
export function normalizePagination(input?: Partial<PaginationInput>): {
  page: number;
  limit: number;
  offset: number;
} {
  const page = Math.max(1, input?.page || 1);
  const limit = Math.min(100, Math.max(1, input?.limit || 20));
  const offset = calculateOffset(page, limit);

  return { page, limit, offset };
}

