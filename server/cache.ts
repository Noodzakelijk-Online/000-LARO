/**
 * Caching Utilities
 * 
 * Simple in-memory caching for frequently accessed data to reduce database queries.
 * For production, consider Redis or similar distributed cache.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class Cache {
  private store: Map<string, CacheEntry<any>> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Get value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.store.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set value in cache
   */
  set<T>(key: string, data: T, ttlSeconds: number = 300): void {
    this.store.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlSeconds * 1000,
    });
  }

  /**
   * Delete value from cache
   */
  delete(key: string): void {
    this.store.delete(key);
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.store.size,
      keys: Array.from(this.store.keys()),
    };
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.store.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.store.delete(key));

    if (keysToDelete.length > 0) {
      console.log(`[Cache] Cleaned up ${keysToDelete.length} expired entries`);
    }
  }

  /**
   * Destroy cache and stop cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }
}

// Singleton cache instance
export const cache = new Cache();

/**
 * Cache decorator for async functions
 */
export function cached<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: {
    keyPrefix: string;
    ttlSeconds?: number;
    keyGenerator?: (...args: Parameters<T>) => string;
  }
): T {
  const { keyPrefix, ttlSeconds = 300, keyGenerator } = options;

  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    // Generate cache key
    const cacheKey = keyGenerator
      ? `${keyPrefix}:${keyGenerator(...args)}`
      : `${keyPrefix}:${JSON.stringify(args)}`;

    // Check cache
    const cached = cache.get<ReturnType<T>>(cacheKey);
    if (cached !== null) {
      console.log(`[Cache] HIT: ${cacheKey}`);
      return cached;
    }

    // Execute function
    console.log(`[Cache] MISS: ${cacheKey}`);
    const result = await fn(...args);

    // Store in cache
    cache.set(cacheKey, result, ttlSeconds);

    return result;
  }) as T;
}

/**
 * Invalidate cache entries by prefix
 */
export function invalidateCacheByPrefix(prefix: string): void {
  const stats = cache.getStats();
  const keysToDelete = stats.keys.filter(key => key.startsWith(prefix));
  
  keysToDelete.forEach(key => cache.delete(key));
  
  if (keysToDelete.length > 0) {
    console.log(`[Cache] Invalidated ${keysToDelete.length} entries with prefix: ${prefix}`);
  }
}

/**
 * Cache key generators for common patterns
 */
export const CacheKeys = {
  // Lawyers
  lawyersList: (page: number, limit: number) => `lawyers:list:${page}:${limit}`,
  lawyerById: (id: string) => `lawyers:by-id:${id}`,
  lawyersByCity: (city: string) => `lawyers:by-city:${city}`,
  lawyersCount: () => `lawyers:count`,

  // Cases
  casesList: (userId: string, page: number, limit: number) => 
    `cases:list:${userId}:${page}:${limit}`,
  caseById: (id: string) => `cases:by-id:${id}`,
  casesCount: (userId: string) => `cases:count:${userId}`,

  // Stats
  dashboardStats: (userId: string) => `stats:dashboard:${userId}`,
  emailStats: () => `stats:email`,

  // Clarifications
  pendingClarifications: (userId: string) => `clarifications:pending:${userId}`,
};

/**
 * Cache TTL presets (in seconds)
 */
export const CacheTTL = {
  SHORT: 60,          // 1 minute
  MEDIUM: 300,        // 5 minutes
  LONG: 1800,         // 30 minutes
  VERY_LONG: 3600,    // 1 hour
  DAY: 86400,         // 24 hours
};

/**
 * Wrapper for database queries with caching
 */
export async function cachedQuery<T>(
  key: string,
  queryFn: () => Promise<T>,
  ttlSeconds: number = CacheTTL.MEDIUM
): Promise<T> {
  // Check cache
  const cached = cache.get<T>(key);
  if (cached !== null) {
    console.log(`[Cache] HIT: ${key}`);
    return cached;
  }

  // Execute query
  console.log(`[Cache] MISS: ${key}`);
  const result = await queryFn();

  // Store in cache
  cache.set(key, result, ttlSeconds);

  return result;
}

/**
 * Batch cache operations
 */
export function batchInvalidate(keys: string[]): void {
  keys.forEach(key => cache.delete(key));
  console.log(`[Cache] Batch invalidated ${keys.length} entries`);
}

/**
 * Cache warming - preload frequently accessed data
 */
export async function warmCache(
  warmers: Array<{ key: string; fn: () => Promise<any>; ttl: number }>
): Promise<void> {
  console.log(`[Cache] Warming cache with ${warmers.length} entries...`);
  
  await Promise.all(
    warmers.map(async ({ key, fn, ttl }) => {
      try {
        const data = await fn();
        cache.set(key, data, ttl);
      } catch (error) {
        console.error(`[Cache] Failed to warm cache for key: ${key}`, error);
      }
    })
  );
  
  console.log(`[Cache] Cache warming complete`);
}

