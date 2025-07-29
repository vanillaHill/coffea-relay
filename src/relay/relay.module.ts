import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RelayController } from "./controllers/relay.controller";
import { RelayService } from "./services/relay.service";
import { WalletService } from "./services/wallet.service";
import { GasEstimatorService } from "./services/gas-estimator.service";
import { TaskTrackerService } from "./services/task-tracker.service";
import { RelayTask } from "../database/entities/relay-task.entity";
import { CommonModule } from "../common/common.module";

/**
 * RelayModule is the core module for the Coffea Relay Service.
 *
 * This module orchestrates all relay-related functionality including:
 * - Transaction submission and signing
 * - Gas estimation and optimization
 * - Task tracking and status monitoring
 * - Multi-chain support
 *
 * Key Services:
 * - RelayService: Main orchestration and business logic
 * - WalletService: Blockchain interaction and transaction signing
 * - GasEstimatorService: Intelligent gas price calculation
 * - TaskTrackerService: Database persistence and status tracking
 *
 * API Endpoints:
 * - POST /relay/sponsored-call: Submit gasless transactions
 * - GET /relay/status/:taskId: Monitor transaction status
 * - DELETE /relay/cancel/:taskId: Cancel pending transactions
 * - GET /relay/health: Service health monitoring
 *
 * Dependencies:
 * - ConfigModule: Environment configuration
 * - TypeOrmModule: Database access for task tracking
 * - RelayTask entity: Core data model
 */
@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([RelayTask]), CommonModule],
  controllers: [RelayController],
  providers: [
    RelayService,
    WalletService,
    GasEstimatorService,
    TaskTrackerService,
  ],
  exports: [
    RelayService,
    WalletService,
    GasEstimatorService,
    TaskTrackerService,
  ],
})
export class RelayModule {}
