/**
 * Rate Limiting Middleware
 * 
 * Protects against abuse, DDoS attacks, and brute force attempts.
 * Implements token bucket algorithm for flexible rate limiting.
 */

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message?: string; // Error message when limit exceeded
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Check if request should be rate limited
   */
  check(
    key: string,
    config: RateLimitConfig
  ): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    // No entry or expired - create new
    if (!entry || now >= entry.resetTime) {
      this.store.set(key, {
        count: 1,
        resetTime: now + config.windowMs,
      });
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetTime: now + config.windowMs,
      };
    }

    // Entry exists and not expired
    if (entry.count >= config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
      };
    }

    // Increment count
    entry.count++;
    this.store.set(key, entry);

    return {
      allowed: true,
      remaining: config.maxRequests - entry.count,
      resetTime: entry.resetTime,
    };
  }

  /**
   * Reset rate limit for a key
   */
  reset(key: string): void {
    this.store.delete(key);
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.store.entries()) {
      if (now >= entry.resetTime) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.store.delete(key));

    if (keysToDelete.length > 0) {
      console.log(`[RateLimiter] Cleaned up ${keysToDelete.length} expired entries`);
    }
  }

  /**
   * Get statistics
   */
  getStats(): { totalKeys: number; keys: string[] } {
    return {
      totalKeys: this.store.size,
      keys: Array.from(this.store.keys()),
    };
  }

  /**
   * Destroy rate limiter
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.store.clear();
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter();

/**
 * Rate limit configurations for different endpoints
 */
export const RateLimitConfigs = {
  // Authentication endpoints - strict limits
  login: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    message: "Too many login attempts, please try again later",
  },

  // API endpoints - moderate limits
  api: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60,
    message: "Too many requests, please slow down",
  },

  // Case creation - prevent spam
  createCase: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,
    message: "Too many cases created, please wait before creating more",
  },

  // Email sending - prevent abuse
  sendEmail: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 50,
    message: "Email rate limit exceeded, please try again later",
  },

  // File uploads - prevent storage abuse
  fileUpload: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 20,
    message: "File upload limit exceeded, please try again later",
  },

  // Search/query endpoints - prevent scraping
  search: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
    message: "Search rate limit exceeded, please slow down",
  },

  // AI inference - expensive operations
  aiInference: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    message: "AI inference rate limit exceeded, please wait",
  },
};

/**
 * Generate rate limit key from request context
 */
export function getRateLimitKey(
  identifier: string,
  endpoint: string
): string {
  return `ratelimit:${endpoint}:${identifier}`;
}

/**
 * Check rate limit for a request
 */
export function checkRateLimit(
  identifier: string,
  endpoint: keyof typeof RateLimitConfigs
): {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  message?: string;
} {
  const config = RateLimitConfigs[endpoint];
  const key = getRateLimitKey(identifier, endpoint);
  const result = rateLimiter.check(key, config);

  return {
    ...result,
    message: result.allowed ? undefined : config.message,
  };
}

/**
 * Middleware factory for Express/tRPC
 */
export function createRateLimitMiddleware(
  endpoint: keyof typeof RateLimitConfigs,
  getIdentifier: (ctx: any) => string
) {
  return async (ctx: any, next: () => Promise<any>) => {
    const identifier = getIdentifier(ctx);
    const result = checkRateLimit(identifier, endpoint);

    if (!result.allowed) {
      throw new Error(result.message || "Rate limit exceeded");
    }

    // Add rate limit headers to response (if applicable)
    if (ctx.res) {
      ctx.res.setHeader("X-RateLimit-Limit", RateLimitConfigs[endpoint].maxRequests);
      ctx.res.setHeader("X-RateLimit-Remaining", result.remaining);
      ctx.res.setHeader("X-RateLimit-Reset", result.resetTime);
    }

    return next();
  };
}

/**
 * Reset rate limit for a user (admin function)
 */
export function resetUserRateLimit(
  userId: string,
  endpoint?: keyof typeof RateLimitConfigs
): void {
  if (endpoint) {
    const key = getRateLimitKey(userId, endpoint);
    rateLimiter.reset(key);
  } else {
    // Reset all endpoints for user
    const stats = rateLimiter.getStats();
    stats.keys
      .filter(key => key.includes(userId))
      .forEach(key => rateLimiter.reset(key));
  }
}

/**
 * Adaptive rate limiting - adjust limits based on user behavior
 */
export class AdaptiveRateLimiter {
  private trustScores: Map<string, number> = new Map();

  /**
   * Get trust score for a user (0-100)
   */
  getTrustScore(userId: string): number {
    return this.trustScores.get(userId) || 50; // Default: neutral
  }

  /**
   * Update trust score based on behavior
   */
  updateTrustScore(userId: string, delta: number): void {
    const current = this.getTrustScore(userId);
    const newScore = Math.max(0, Math.min(100, current + delta));
    this.trustScores.set(userId, newScore);
  }

  /**
   * Get adjusted rate limit based on trust score
   */
  getAdjustedLimit(
    userId: string,
    baseConfig: RateLimitConfig
  ): RateLimitConfig {
    const trustScore = this.getTrustScore(userId);

    // High trust (80+): 2x limit
    // Medium trust (40-79): 1x limit
    // Low trust (0-39): 0.5x limit
    const multiplier =
      trustScore >= 80 ? 2 : trustScore >= 40 ? 1 : 0.5;

    return {
      ...baseConfig,
      maxRequests: Math.floor(baseConfig.maxRequests * multiplier),
    };
  }

  /**
   * Record good behavior (successful requests, no errors)
   */
  recordGoodBehavior(userId: string): void {
    this.updateTrustScore(userId, 1);
  }

  /**
   * Record bad behavior (errors, abuse attempts)
   */
  recordBadBehavior(userId: string): void {
    this.updateTrustScore(userId, -5);
  }
}

// Singleton adaptive rate limiter
export const adaptiveRateLimiter = new AdaptiveRateLimiter();

/**
 * IP-based rate limiting (for unauthenticated requests)
 */
export function checkIPRateLimit(
  ipAddress: string,
  endpoint: keyof typeof RateLimitConfigs
): {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  message?: string;
} {
  return checkRateLimit(ipAddress, endpoint);
}

/**
 * Distributed rate limiting (for multi-server deployments)
 * TODO: Implement with Redis for production
 */
export class DistributedRateLimiter {
  // Placeholder for Redis-based rate limiting
  async check(key: string, config: RateLimitConfig): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
  }> {
    // In production, use Redis INCR with EXPIRE
    return rateLimiter.check(key, config);
  }
}

