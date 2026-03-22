/**
 * Health Check and Monitoring
 * 
 * Provides endpoints for system health monitoring, metrics collection,
 * and operational insights.
 */

import { getDb } from "../db";
import { cache } from "../cache";
import { rateLimiter } from "../rate-limiter";
import { publicProcedure, router } from "../_core/trpc";

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    database: HealthCheck;
    cache: HealthCheck;
    rateLimiter: HealthCheck;
    memory: HealthCheck;
    disk: HealthCheck;
  };
}

export interface HealthCheck {
  status: "pass" | "warn" | "fail";
  message?: string;
  responseTime?: number;
  details?: Record<string, any>;
}

/**
 * Perform comprehensive health check
 */
export async function performHealthCheck(): Promise<HealthStatus> {
  const startTime = Date.now();

  // Check database
  const databaseCheck = await checkDatabase();

  // Check cache
  const cacheCheck = checkCache();

  // Check rate limiter
  const rateLimiterCheck = checkRateLimiter();

  // Check memory
  const memoryCheck = checkMemory();

  // Check disk (placeholder)
  const diskCheck = checkDisk();

  // Determine overall status
  const checks = {
    database: databaseCheck,
    cache: cacheCheck,
    rateLimiter: rateLimiterCheck,
    memory: memoryCheck,
    disk: diskCheck,
  };

  const hasFailures = Object.values(checks).some(c => c.status === "fail");
  const hasWarnings = Object.values(checks).some(c => c.status === "warn");

  const status: HealthStatus["status"] = hasFailures
    ? "unhealthy"
    : hasWarnings
    ? "degraded"
    : "healthy";

  return {
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || "1.0.0",
    checks,
  };
}

/**
 * Check database connectivity and performance
 */
async function checkDatabase(): Promise<HealthCheck> {
  const startTime = Date.now();

  try {
    const db = await getDb();
    if (!db) {
      return {
        status: "fail",
        message: "Database connection not available",
        responseTime: Date.now() - startTime,
      };
    }

    // Perform simple query to test connectivity
    await db.execute("SELECT 1");

    const responseTime = Date.now() - startTime;

    return {
      status: responseTime < 100 ? "pass" : "warn",
      message: responseTime < 100 ? "Database healthy" : "Database slow",
      responseTime,
      details: {
        connected: true,
      },
    };
  } catch (error) {
    return {
      status: "fail",
      message: `Database error: ${(error as Error).message}`,
      responseTime: Date.now() - startTime,
    };
  }
}

/**
 * Check cache health
 */
function checkCache(): HealthCheck {
  try {
    const stats = cache.getStats();

    return {
      status: "pass",
      message: "Cache operational",
      details: {
        size: stats.size,
        keys: stats.keys.length,
      },
    };
  } catch (error) {
    return {
      status: "fail",
      message: `Cache error: ${(error as Error).message}`,
    };
  }
}

/**
 * Check rate limiter health
 */
function checkRateLimiter(): HealthCheck {
  try {
    const stats = rateLimiter.getStats();

    return {
      status: "pass",
      message: "Rate limiter operational",
      details: {
        totalKeys: stats.totalKeys,
      },
    };
  } catch (error) {
    return {
      status: "fail",
      message: `Rate limiter error: ${(error as Error).message}`,
    };
  }
}

/**
 * Check memory usage
 */
function checkMemory(): HealthCheck {
  const usage = process.memoryUsage();
  const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
  const heapUsagePercent = Math.round((usage.heapUsed / usage.heapTotal) * 100);

  const status =
    heapUsagePercent > 90
      ? "fail"
      : heapUsagePercent > 75
      ? "warn"
      : "pass";

  return {
    status,
    message:
      status === "fail"
        ? "Memory usage critical"
        : status === "warn"
        ? "Memory usage high"
        : "Memory usage normal",
    details: {
      heapUsedMB,
      heapTotalMB,
      heapUsagePercent,
      rssMB: Math.round(usage.rss / 1024 / 1024),
    },
  };
}

/**
 * Check disk usage (placeholder)
 */
function checkDisk(): HealthCheck {
  // In production, use a library like 'diskusage' to check actual disk space
  return {
    status: "pass",
    message: "Disk usage normal",
    details: {
      available: "N/A",
      total: "N/A",
    },
  };
}

/**
 * Get system metrics
 */
export interface SystemMetrics {
  timestamp: string;
  uptime: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
  };
  cpu: {
    user: number;
    system: number;
  };
  process: {
    pid: number;
    version: string;
    platform: string;
    arch: string;
  };
  cache: {
    size: number;
    keys: number;
  };
  rateLimiter: {
    totalKeys: number;
  };
}

export function getSystemMetrics(): SystemMetrics {
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  const cacheStats = cache.getStats();
  const rateLimiterStats = rateLimiter.getStats();

  return {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      rss: Math.round(memUsage.rss / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024),
    },
    cpu: {
      user: Math.round(cpuUsage.user / 1000),
      system: Math.round(cpuUsage.system / 1000),
    },
    process: {
      pid: process.pid,
      version: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    cache: {
      size: cacheStats.size,
      keys: cacheStats.keys.length,
    },
    rateLimiter: {
      totalKeys: rateLimiterStats.totalKeys,
    },
  };
}

/**
 * Get application statistics
 */
export interface AppStatistics {
  timestamp: string;
  database: {
    totalUsers: number;
    totalCases: number;
    totalLawyers: number;
    totalOutreaches: number;
  };
  performance: {
    averageResponseTime: number;
    requestsPerMinute: number;
  };
  errors: {
    last24Hours: number;
    lastError?: {
      message: string;
      timestamp: string;
    };
  };
}

export async function getAppStatistics(): Promise<AppStatistics> {
  const db = await getDb();

  let dbStats = {
    totalUsers: 0,
    totalCases: 0,
    totalLawyers: 0,
    totalOutreaches: 0,
  };

  if (db) {
    try {
      // Get counts from database
      const [users, cases, lawyers, outreaches] = await Promise.all([
        db.execute("SELECT COUNT(*) as count FROM users"),
        db.execute("SELECT COUNT(*) as count FROM cases"),
        db.execute("SELECT COUNT(*) as count FROM lawyers"),
        db.execute("SELECT COUNT(*) as count FROM outreach_status"),
      ]);

      dbStats = {
        totalUsers: (users as any)[0]?.count || 0,
        totalCases: (cases as any)[0]?.count || 0,
        totalLawyers: (lawyers as any)[0]?.count || 0,
        totalOutreaches: (outreaches as any)[0]?.count || 0,
      };
    } catch (error) {
      console.error("[Health] Failed to get database statistics:", error);
    }
  }

  return {
    timestamp: new Date().toISOString(),
    database: dbStats,
    performance: {
      averageResponseTime: 0, // TODO: Implement request tracking
      requestsPerMinute: 0, // TODO: Implement request tracking
    },
    errors: {
      last24Hours: 0, // TODO: Query audit logs for errors
    },
  };
}

/**
 * Readiness check (for Kubernetes/load balancers)
 */
export async function checkReadiness(): Promise<{
  ready: boolean;
  message: string;
}> {
  try {
    const db = await getDb();
    if (!db) {
      return { ready: false, message: "Database not available" };
    }

    // Test database connectivity
    await db.execute("SELECT 1");

    return { ready: true, message: "Service ready" };
  } catch (error) {
    return {
      ready: false,
      message: `Service not ready: ${(error as Error).message}`,
    };
  }
}

/**
 * Liveness check (for Kubernetes/load balancers)
 */
export function checkLiveness(): {
  alive: boolean;
  message: string;
} {
  // Simple check - if process is running, it's alive
  return { alive: true, message: "Service alive" };
}

/**
 * Performance metrics tracker
 */
export class PerformanceTracker {
  private requests: Array<{ timestamp: number; duration: number }> = [];
  private maxEntries = 1000;

  /**
   * Record a request
   */
  recordRequest(duration: number): void {
    this.requests.push({
      timestamp: Date.now(),
      duration,
    });

    // Keep only recent entries
    if (this.requests.length > this.maxEntries) {
      this.requests.shift();
    }
  }

  /**
   * Get average response time
   */
  getAverageResponseTime(): number {
    if (this.requests.length === 0) return 0;

    const sum = this.requests.reduce((acc, req) => acc + req.duration, 0);
    return Math.round(sum / this.requests.length);
  }

  /**
   * Get requests per minute
   */
  getRequestsPerMinute(): number {
    const oneMinuteAgo = Date.now() - 60 * 1000;
    const recentRequests = this.requests.filter(
      req => req.timestamp >= oneMinuteAgo
    );
    return recentRequests.length;
  }

  /**
   * Get 95th percentile response time
   */
  getP95ResponseTime(): number {
    if (this.requests.length === 0) return 0;

    const sorted = [...this.requests]
      .map(r => r.duration)
      .sort((a, b) => a - b);
    const index = Math.floor(sorted.length * 0.95);
    return sorted[index] || 0;
  }
}

// Singleton performance tracker
export const performanceTracker = new PerformanceTracker();

export const healthRouter = router({
  check: publicProcedure.query(async () => performHealthCheck()),
  readiness: publicProcedure.query(async () => checkReadiness()),
  liveness: publicProcedure.query(() => checkLiveness()),
});
