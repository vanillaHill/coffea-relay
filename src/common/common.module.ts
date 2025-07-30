import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HttpModule } from "@nestjs/axios";
import { CacheService } from "./services/cache.service";
import { DatabaseClient } from "../database/database.client";
import { DatabaseAuthClient } from "../auth/database-auth.client";

/**
 * CommonModule provides shared services and utilities used across the application.
 *
 * This module contains:
 * - CacheService: Redis-based caching functionality
 * - DatabaseClient: API client for database service integration
 * - DatabaseAuthClient: Authentication client for database service
 * - BaseProviderService: Abstract base class for blockchain provider management
 * - Configuration utilities and constants
 *
 * Services exported from this module can be used by other modules
 * without duplicating dependencies or configuration.
 */
@Module({
  imports: [ConfigModule, HttpModule],
  providers: [CacheService, DatabaseClient, DatabaseAuthClient],
  exports: [CacheService, DatabaseClient, DatabaseAuthClient],
})
export class CommonModule {}
