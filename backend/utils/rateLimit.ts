import { getRedisClient } from "../db/redis";

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000,
  maxRequests: 60,
};

export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): Promise<RateLimitResult> {
  const client = getRedisClient();
  const now = Date.now();
  const windowStart = Math.floor(now / config.windowMs) * config.windowMs;
  const key = `ratelimit:${identifier}:${windowStart}`;
  const resetAt = windowStart + config.windowMs;

  try {
    const results = await client
      .multi()
      .incr(key)
      .pexpire(key, config.windowMs + 1000)
      .exec();

    const count = results?.[0]?.[1] as number;

    return {
      allowed: count <= config.maxRequests,
      remaining: Math.max(0, config.maxRequests - count),
      resetAt: Math.floor(resetAt / 1000),
    };
  } catch (error) {
    console.error("Rate limit check failed:", error);
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetAt: Math.floor(resetAt / 1000),
    };
  }
}

export const RateLimitConfigs = {
  standard: {
    windowMs: 60 * 1000,
    maxRequests: 60,
  },
  write: {
    windowMs: 60 * 1000,
    maxRequests: 20,
  },
  upload: {
    windowMs: 60 * 1000,
    maxRequests: 10,
  },
  auth: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 10,
  },
} as const;
