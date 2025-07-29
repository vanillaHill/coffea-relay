import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private redis: Redis;

  constructor(private configService: ConfigService) {
    const redisConfig = {
      host: this.configService.get<string>("REDIS_HOST", "localhost"),
      port: this.configService.get<number>("REDIS_PORT", 6379),
      password: this.configService.get<string>("REDIS_PASSWORD"),
      db: this.configService.get<number>("REDIS_DB", 0),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    };

    this.redis = new Redis(redisConfig);

    this.redis.on("error", (error) => {
      this.logger.error("Redis connection error:", error);
    });
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      this.logger.error(`Error getting cache key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
    try {
      await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (error) {
      this.logger.error(`Error setting cache key ${key}:`, error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      this.logger.error(`Error deleting cache key ${key}:`, error);
    }
  }

  async deletePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.logger.log(
          `Deleted ${keys.length} keys matching pattern: ${pattern}`,
        );
      }
    } catch (error) {
      this.logger.error(`Error deleting cache pattern ${pattern}:`, error);
    }
  }

  async getKeys(pattern: string): Promise<string[]> {
    try {
      return await this.redis.keys(pattern);
    } catch (error) {
      this.logger.error(`Error getting keys for pattern ${pattern}:`, error);
      return [];
    }
  }

  async flushAll(): Promise<void> {
    try {
      await this.redis.flushall();
      this.logger.log("Redis cache flushed");
    } catch (error) {
      this.logger.error("Error flushing Redis cache:", error);
    }
  }
}
