import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { CacheService } from "./services/cache.service";

/**
 * CommonModule provides shared services and utilities used across the application.
 * 
 * This module contains:
 * - CacheService: Redis-based caching functionality
 * - BaseProviderService: Abstract base class for blockchain provider management
 * - Configuration utilities and constants
 * 
 * Services exported from this module can be used by other modules
 * without duplicating dependencies or configuration.
 */
@Module({
  imports: [ConfigModule],
  providers: [CacheService],
  exports: [CacheService],
})
export class CommonModule {}