import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { HealthService } from "./health.service";

/**
 * HealthController provides endpoints for monitoring the Coffea Relay Service.
 * These endpoints are essential for:
 * - Load balancer health checks
 * - Service monitoring and alerting
 * - Debugging connectivity issues
 * - Performance monitoring
 */
@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * Basic health check endpoint that returns overall service status.
   * Used by load balancers and monitoring systems for quick health verification.
   */
  @Get()
  @ApiOperation({ summary: "Get basic service health status" })
  @ApiResponse({
    status: 200,
    description: "Service is healthy",
    schema: {
      properties: {
        status: { type: "string", example: "healthy" },
        timestamp: { type: "string", example: "2024-01-01T00:00:00.000Z" },
        uptime: { type: "number", example: 12345 },
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: "Service is unhealthy",
  })
  async getHealth() {
    const isHealthy = await this.healthService.checkOverallHealth();

    return {
      status: isHealthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  /**
   * Detailed health check that provides component-level status information.
   * Useful for debugging and detailed monitoring.
   */
  @Get("detailed")
  @ApiOperation({ summary: "Get detailed component health status" })
  @ApiResponse({
    status: 200,
    description: "Detailed health information",
    schema: {
      properties: {
        status: { type: "string" },
        timestamp: { type: "string" },
        components: {
          type: "object",
          properties: {
            database: { type: "boolean" },
            wallet: { type: "boolean" },
            gasEstimator: { type: "boolean" },
            taskTracker: { type: "boolean" },
          },
        },
        supportedChains: { type: "array", items: { type: "number" } },
        version: { type: "string" },
      },
    },
  })
  async getDetailedHealth() {
    const healthStatus = await this.healthService.getDetailedHealth();

    return {
      ...healthStatus,
      timestamp: new Date().toISOString(),
      supportedChains: [1, 11155111, 31337], // Mainnet, Sepolia, Hardhat
      version: process.env.npm_package_version || "1.0.0",
    };
  }
}
