import { eq, and, sql, inArray, like, or } from "drizzle-orm";
import { getDb } from "./db";
import { lawyers } from "./schema";
import { createPaginatedResponse, normalizePagination, PaginatedResponse } from "./pagination";

export interface LawyerSearchFilters {
  city?: string;
  legalAreas?: string[];
  name?: string;
  firm?: string;
  minResponseRate?: number;
}

export interface PaginatedLawyerSearch extends LawyerSearchFilters {
  page?: number;
  limit?: number;
}

/**
 * Search lawyers with pagination and filters
 */
export async function searchLawyersPaginated(
  filters: PaginatedLawyerSearch
): Promise<PaginatedResponse<typeof lawyers.$inferSelect>> {
  const db = await getDb();
  if (!db) {
    return createPaginatedResponse([], 1, 20, 0);
  }

  const { page, limit, offset } = normalizePagination({
    page: filters.page,
    limit: filters.limit,
  });

  // Build WHERE conditions
  const conditions = [];

  if (filters.city) {
    conditions.push(eq(lawyers.city, filters.city));
  }

  if (filters.name) {
    conditions.push(
      or(
        like(lawyers.name, `%${filters.name}%`),
        like(lawyers.firm, `%${filters.name}%`)
      )
    );
  }

  if (filters.firm) {
    conditions.push(like(lawyers.firm, `%${filters.firm}%`));
  }

  // Get total count
  const countQuery = conditions.length > 0
    ? db.select({ count: sql<number>`count(*)` }).from(lawyers).where(and(...conditions))
    : db.select({ count: sql<number>`count(*)` }).from(lawyers);

  const countResult = await countQuery;
  const total = Number(countResult[0]?.count || 0);

  // Get paginated results
  let query = db.select().from(lawyers);

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  const results = await query.limit(limit).offset(offset);

  // Filter by legal areas if specified (JSON field)
  let filteredResults = results;
  if (filters.legalAreas && filters.legalAreas.length > 0) {
    filteredResults = results.filter((lawyer) => {
      if (!lawyer.legalAreas) return false;
      try {
        const areas = JSON.parse(lawyer.legalAreas as string);
        return filters.legalAreas!.some((area) =>
          areas.some((la: string) => la.toLowerCase().includes(area.toLowerCase()))
        );
      } catch {
        return false;
      }
    });
  }

  return createPaginatedResponse(filteredResults, page, limit, total);
}

/**
 * Get all unique cities from lawyers (for filter dropdown)
 */
export async function getLawyerCities(): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];

  const result = await db
    .selectDistinct({ city: lawyers.city })
    .from(lawyers)
    .where(sql`${lawyers.city} IS NOT NULL AND ${lawyers.city} != ''`);

  return result.map((r) => r.city).filter((c): c is string => !!c).sort();
}

/**
 * Get all unique legal areas from lawyers (for filter dropdown)
 */
export async function getLawyerLegalAreas(): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];

  const result = await db
    .select({ legalAreas: lawyers.legalAreas })
    .from(lawyers)
    .where(sql`${lawyers.legalAreas} IS NOT NULL`);

  const areasSet = new Set<string>();
  
  result.forEach((r) => {
    if (r.legalAreas) {
      try {
        const areas = JSON.parse(r.legalAreas as string);
        areas.forEach((area: string) => areasSet.add(area));
      } catch {
        // Skip invalid JSON
      }
    }
  });

  return Array.from(areasSet).sort();
}

