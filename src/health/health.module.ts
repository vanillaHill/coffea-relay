import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";
import { RelayModule } from "../relay/relay.module";

/**
 * HealthModule provides comprehensive health monitoring for the Coffea Relay Service.
 *
 * This module exposes health check endpoints and monitors:
 * - Database connectivity
 * - Blockchain RPC providers
 * - Wallet service functionality
 * - Gas estimation service
 * - Task tracking service
 *
 * Endpoints:
 * - GET /health: Overall service health status
 * - GET /health/detailed: Detailed component health breakdown
 */
@Module({
  imports: [RelayModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
