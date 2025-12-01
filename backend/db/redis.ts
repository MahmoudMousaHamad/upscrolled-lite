import Redis from "ioredis";

let redis: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      connectTimeout: 5000,
    });

    redis.on("error", (err) => {
      console.error("Redis connection error:", err);
    });
  }
  return redis;
}

export async function closeRedisConnection(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

export async function safeRedisOperation<T>(
  operation: (client: Redis) => Promise<T>
): Promise<T | null> {
  try {
    const client = getRedisClient();
    return await operation(client);
  } catch (error) {
    console.error("Redis operation failed:", error);
    return null;
  }
}
