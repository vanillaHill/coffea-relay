import { Injectable, Logger } from "@nestjs/common";
import { RelayService } from "../relay/services/relay.service";
import { WalletService } from "../relay/services/wallet.service";
import { GasEstimatorService } from "../relay/services/gas-estimator.service";
import { TaskTrackerService } from "../relay/services/task-tracker.service";

/**
 * HealthService monitors the operational status of all Coffea Relay Service components.
 *
 * This service performs comprehensive health checks on:
 * - Database connectivity and performance
 * - Blockchain RPC provider availability
 * - Wallet service functionality
 * - Gas estimation accuracy
 * - Task tracking persistence
 *
 * Health checks are designed to be:
 * - Fast (< 5 seconds total)
 * - Non-intrusive (read-only operations)
 * - Comprehensive (cover all critical paths)
 * - Reliable (consistent results)
 */
@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly relayService: RelayService,
    private readonly walletService: WalletService,
    private readonly gasEstimatorService: GasEstimatorService,
    private readonly taskTrackerService: TaskTrackerService,
  ) {}

  /**
   * Performs a quick overall health check.
   * Returns true only if all critical components are operational.
   */
  async checkOverallHealth(): Promise<boolean> {
    try {
      const healthStatus = await this.getDetailedHealth();
      return healthStatus.status === "healthy";
    } catch (error) {
      this.logger.error("Overall health check failed:", error);
      return false;
    }
  }

  /**
   * Performs detailed health checks on all service components.
   * Returns comprehensive status information for monitoring and debugging.
   */
  async getDetailedHealth() {
    const components = {
      database: false,
      wallet: false,
      gasEstimator: false,
      taskTracker: false,
    };

    const healthChecks = [
      this.checkWalletHealth(),
      this.checkGasEstimatorHealth(),
      this.checkTaskTrackerHealth(),
    ];

    try {
      const [walletHealthy, gasEstimatorHealthy, taskTrackerHealthy] =
        await Promise.allSettled(healthChecks);

      // Process health check results
      components.wallet =
        walletHealthy.status === "fulfilled" && walletHealthy.value;
      components.gasEstimator =
        gasEstimatorHealthy.status === "fulfilled" && gasEstimatorHealthy.value;
      components.taskTracker =
        taskTrackerHealthy.status === "fulfilled" && taskTrackerHealthy.value;

      // Database health is implied by task tracker health
      components.database = components.taskTracker;

      const allHealthy = Object.values(components).every((status) => status);

      return {
        status: allHealthy ? "healthy" : "unhealthy",
        components,
        errors: this.getComponentErrors(healthChecks),
      };
    } catch (error) {
      this.logger.error("Detailed health check failed:", error);
      return {
        status: "unhealthy",
        components,
        error: error.message,
      };
    }
  }

  /**
   * Checks wallet service health by verifying:
   * - Private key is loaded
   * - At least one RPC provider is responding
   * - Wallet address is valid
   */
  private async checkWalletHealth(): Promise<boolean> {
    try {
      const isHealthy = await this.walletService.checkHealth();
      if (!isHealthy) {
        this.logger.warn("Wallet service health check failed");
      }
      return isHealthy;
    } catch (error) {
      this.logger.error("Wallet health check error:", error);
      return false;
    }
  }

  /**
   * Checks gas estimator service health by verifying:
   * - RPC providers are responding
   * - Gas price data can be retrieved
   * - EIP-1559 support detection works
   */
  private async checkGasEstimatorHealth(): Promise<boolean> {
    try {
      const isHealthy = await this.gasEstimatorService.checkHealth();
      if (!isHealthy) {
        this.logger.warn("Gas estimator service health check failed");
      }
      return isHealthy;
    } catch (error) {
      this.logger.error("Gas estimator health check error:", error);
      return false;
    }
  }

  /**
   * Checks task tracker service health by verifying:
   * - Database connectivity
   * - Table accessibility
   * - Basic query operations
   */
  private async checkTaskTrackerHealth(): Promise<boolean> {
    try {
      const isHealthy = await this.taskTrackerService.checkHealth();
      if (!isHealthy) {
        this.logger.warn("Task tracker service health check failed");
      }
      return isHealthy;
    } catch (error) {
      this.logger.error("Task tracker health check error:", error);
      return false;
    }
  }

  /**
   * Extracts error messages from failed health check promises.
   * Used to provide detailed error information in health responses.
   */
  private getComponentErrors(
    healthCheckPromises: Promise<boolean>[],
  ): string[] {
    const errors: string[] = [];

    healthCheckPromises.forEach((promise, index) => {
      if (promise && typeof promise.then === "function") {
        promise.catch((error) => {
          const componentNames = ["wallet", "gasEstimator", "taskTracker"];
          errors.push(`${componentNames[index]}: ${error.message}`);
        });
      }
    });

    return errors;
  }
}
