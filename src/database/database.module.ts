import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { RelayTask } from "./entities/relay-task.entity";

/**
 * DatabaseModule configures TypeORM for the Coffea Relay Service.
 *
 * This module provides:
 * - PostgreSQL database connection configuration
 * - Entity registration for relay tasks
 * - Migration and synchronization settings
 * - Environment-based configuration
 *
 * Database Schema:
 * - relay_tasks: Core table for tracking transaction relay requests
 *
 * Configuration via environment variables:
 * - DATABASE_URL: PostgreSQL connection string
 * - NODE_ENV: Environment mode (development/production)
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: "postgres",
        url: configService.get<string>("DATABASE_URL"),
        entities: [RelayTask],
        synchronize: configService.get<string>("NODE_ENV") === "development",
        logging: configService.get<string>("NODE_ENV") === "development",
        migrations: ["dist/database/migrations/*.js"],
        migrationsRun: true,
        ssl:
          configService.get<string>("NODE_ENV") === "production"
            ? {
                rejectUnauthorized: false,
              }
            : false,
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([RelayTask]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
