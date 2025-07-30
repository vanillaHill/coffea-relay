import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { RelayModule } from "./relay/relay.module";
import { HealthModule } from "./health/health.module";

/**
 * AppModule is the root module of the Coffea Relay Service.
 *
 * This module bootstraps the entire application and configures:
 * - Environment variable loading and validation
 * - Database service client connectivity
 * - Core relay service functionality
 * - Health monitoring and diagnostics
 *
 * Architecture Overview:
 * ```
 * AppModule
 * ├── ConfigModule (Environment configuration)
 * ├── RelayModule (Core relay functionality)
 * └── HealthModule (Service monitoring)
 * ```
 *
 * Environment Variables Required:
 * - NODE_ENV: Application environment (development/production)
 * - PORT: HTTP server port (default: 3003)
 * - DATABASE_SERVICE_URL: Database service API endpoint
 * - RELAY_PRIVATE_KEY: Private key for transaction signing
 * - RPC_URL_*: Blockchain RPC endpoints for each supported chain
 *
 * Features:
 * - Multi-chain gasless transaction execution
 * - Real-time transaction monitoring
 * - Comprehensive logging and analytics
 * - Health checks and diagnostics
 * - Swagger API documentation
 */
@Module({
  imports: [
    // Global configuration module
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env.local", ".env"],
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),

    // Core relay functionality
    RelayModule,

    // Health monitoring
    HealthModule,
  ],
})
export class AppModule {}
