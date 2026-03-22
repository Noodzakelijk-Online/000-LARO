/**
 * Query optimization utilities to prevent N+1 problems
 * 
 * N+1 Problem: When you query a list of items, then for each item
 * make another query to get related data. This results in N+1 queries
 * instead of 2 queries (1 for the list, 1 for all related data).
 * 
 * Solution: Use eager loading / batch loading to fetch all related
 * data in a single query.
 */

/**
 * Batch load related data to prevent N+1 queries
 * 
 * Example:
 * Instead of:
 *   cases.forEach(c => getDocuments(c.id)) // N queries
 * 
 * Use:
 *   const docs = await batchLoad(caseIds, getDocumentsByCaseIds) // 1 query
 */
export async function batchLoad<K, V>(
  keys: K[],
  loader: (keys: K[]) => Promise<V[]>,
  keyExtractor: (item: V) => K
): Promise<Map<K, V[]>> {
  if (keys.length === 0) {
    return new Map();
  }

  const results = await loader(keys);
  const map = new Map<K, V[]>();

  // Group results by key
  results.forEach((item) => {
    const key = keyExtractor(item);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(item);
  });

  return map;
}

/**
 * DataLoader pattern for batching and caching
 * Useful for GraphQL-style data loading
 */
export class DataLoader<K, V> {
  private batchLoadFn: (keys: K[]) => Promise<V[]>;
  private cache: Map<K, Promise<V | undefined>>;
  private batch: K[];
  private batchPromise: Promise<void> | null;

  constructor(batchLoadFn: (keys: K[]) => Promise<V[]>) {
    this.batchLoadFn = batchLoadFn;
    this.cache = new Map();
    this.batch = [];
    this.batchPromise = null;
  }

  async load(key: K): Promise<V | undefined> {
    // Check cache first
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    // Add to batch
    this.batch.push(key);

    // Create promise for this key
    const promise = new Promise<V | undefined>((resolve) => {
      // Schedule batch execution
      if (!this.batchPromise) {
        this.batchPromise = Promise.resolve().then(() => this.executeBatch());
      }

      this.batchPromise.then(() => {
        resolve(this.cache.get(key) as Promise<V | undefined>);
      });
    });

    this.cache.set(key, promise);
    return promise;
  }

  private async executeBatch(): Promise<void> {
    const keys = [...this.batch];
    this.batch = [];
    this.batchPromise = null;

    if (keys.length === 0) return;

    try {
      const results = await this.batchLoadFn(keys);
      
      // Map results to keys
      keys.forEach((key, index) => {
        const value = results[index];
        this.cache.set(key, Promise.resolve(value));
      });
    } catch (error) {
      // Clear cache on error
      keys.forEach((key) => {
        this.cache.delete(key);
      });
      throw error;
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}

/**
 * Memoize expensive function calls
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  keyFn?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>();

  return ((...args: Parameters<T>) => {
    const key = keyFn ? keyFn(...args) : JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key)!;
    }

    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

/**
 * Debounce function calls to reduce database load
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let timeoutId: NodeJS.Timeout | null = null;
  let latestResolve: ((value: ReturnType<T>) => void) | null = null;
  let latestReject: ((error: any) => void) | null = null;

  return (...args: Parameters<T>): Promise<ReturnType<T>> => {
    return new Promise((resolve, reject) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      latestResolve = resolve;
      latestReject = reject;

      timeoutId = setTimeout(async () => {
        try {
          const result = await fn(...args);
          latestResolve?.(result);
        } catch (error) {
          latestReject?.(error);
        }
      }, delay);
    });
  };
}

