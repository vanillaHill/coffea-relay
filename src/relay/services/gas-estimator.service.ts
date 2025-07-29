import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ethers } from "ethers";
import {
  RelayTransactionRequest,
  GasEstimation,
} from "../interfaces/relay.interface";
import { BaseProviderService } from "../../common/services/base-provider.service";
import { CacheService } from "../../common/services/cache.service";

interface GasPrices {
  slow: string;
  standard: string;
  fast: string;
}

@Injectable()
export class GasEstimatorService extends BaseProviderService {
  private readonly CACHE_TTL = 60; // 1 minute cache in seconds for Redis

  constructor(
    configService: ConfigService,
    cacheService: CacheService,
  ) {
    super(configService, cacheService);
  }

  async estimateGas(request: RelayTransactionRequest): Promise<GasEstimation> {
    try {
      // Estimate gas limit with fallback
      const gasLimit = await this.executeWithFallback(
        async (provider) => {
          const gasEstimate = await provider.estimateGas({
            to: request.target,
            data: request.data,
          });
          return Math.floor(Number(gasEstimate) * 1.2); // Add 20% buffer
        },
        "gas estimation",
        request.chainId,
      ).catch((error) => {
        this.logger.warn("Gas estimation failed, using default:", error);
        return this.configService.get<number>("DEFAULT_GAS_LIMIT", 500000);
      });

      // Get gas prices
      const gasPrices = await this.getGasPrices(request.chainId);

      // Use standard gas price by default
      const gasPrice = gasPrices.standard;
      const estimatedCost = (BigInt(gasLimit) * BigInt(gasPrice)).toString();

      // Check if chain supports EIP-1559
      const supportsEIP1559 = await this.supportsEIP1559(request.chainId);

      if (supportsEIP1559) {
        const feeData = await this.executeWithFallback(
          async (provider) => provider.getFeeData(),
          "fee data retrieval",
          request.chainId,
        );

        return {
          gasLimit,
          gasPrice,
          maxFeePerGas: feeData.maxFeePerGas?.toString() || gasPrice,
          maxPriorityFeePerGas:
            feeData.maxPriorityFeePerGas?.toString() ||
            ethers.parseUnits("2", "gwei").toString(),
          estimatedCost,
        };
      } else {
        return {
          gasLimit,
          gasPrice,
          estimatedCost,
        };
      }
    } catch (error) {
      this.logger.error("Gas estimation failed:", error);

      // Return fallback estimation
      const defaultGasLimit = this.configService.get<number>(
        "DEFAULT_GAS_LIMIT",
        500000,
      );
      const defaultGasPrice = ethers.parseUnits("20", "gwei").toString(); // 20 gwei fallback

      return {
        gasLimit: defaultGasLimit,
        gasPrice: defaultGasPrice,
        estimatedCost: (
          BigInt(defaultGasLimit) * BigInt(defaultGasPrice)
        ).toString(),
      };
    }
  }

  async getGasPrices(chainId: number): Promise<GasPrices> {
    const cacheKey = `gas_prices:${chainId}`;
    
    // Check Redis cache first
    const cached = await this.cacheService.get<GasPrices>(cacheKey);
    if (cached) {
      this.logger.debug(`Retrieved gas prices for chain ${chainId} from cache`);
      return cached;
    }

    try {
      const feeData = await this.executeWithFallback(
        async (provider) => provider.getFeeData(),
        "gas price retrieval",
        chainId,
      );

      const baseGasPrice = feeData.gasPrice || ethers.parseUnits("20", "gwei");
      const multiplier = this.configService.get<number>(
        "GAS_PRICE_MULTIPLIER",
        1.1,
      );

      // Calculate different speed prices
      const slow = Math.floor(Number(baseGasPrice) * 0.8).toString();
      const standard = Math.floor(Number(baseGasPrice) * multiplier).toString();
      const fast = Math.floor(
        Number(baseGasPrice) * multiplier * 1.5,
      ).toString();

      const prices: GasPrices = { slow, standard, fast };

      // Cache the prices in Redis
      await this.cacheService.set(cacheKey, prices, this.CACHE_TTL);

      this.logger.log(`Updated gas prices for chain ${chainId}:`, {
        slow: ethers.formatUnits(slow, "gwei"),
        standard: ethers.formatUnits(standard, "gwei"),
        fast: ethers.formatUnits(fast, "gwei"),
      });

      return prices;
    } catch (error) {
      this.logger.error(
        `Failed to get gas prices for chain ${chainId}:`,
        error,
      );

      // Return fallback prices
      const fallbackPrice = ethers.parseUnits("20", "gwei").toString();
      return {
        slow: fallbackPrice,
        standard: fallbackPrice,
        fast: fallbackPrice,
      };
    }
  }

  private async supportsEIP1559(chainId: number): Promise<boolean> {
    try {
      const feeData = await this.executeWithFallback(
        async (provider) => provider.getFeeData(),
        "EIP-1559 support check",
        chainId,
      );
      return (
        feeData.maxFeePerGas !== null && feeData.maxPriorityFeePerGas !== null
      );
    } catch (error) {
      this.logger.warn(
        `Failed to check EIP-1559 support for chain ${chainId}:`,
        error,
      );
      return false;
    }
  }

  async validateGasParams(
    chainId: number,
    gasLimit?: number,
    gasPrice?: string,
    maxFeePerGas?: string,
  ): Promise<boolean> {
    try {
      const maxGasPrice = ethers.parseUnits(
        this.configService.get<string>("MAX_GAS_PRICE_GWEI", "100"),
        "gwei",
      );

      // Validate gas limit
      if (gasLimit && gasLimit > 10000000) {
        // 10M gas limit
        return false;
      }

      // Validate gas price
      if (gasPrice && BigInt(gasPrice) > maxGasPrice) {
        return false;
      }

      // Validate max fee per gas
      if (maxFeePerGas && BigInt(maxFeePerGas) > maxGasPrice) {
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error("Gas parameter validation failed:", error);
      return false;
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      // Try to get gas prices for at least one supported chain
      for (const chainId of this.getSupportedChains()) {
        try {
          await this.getGasPrices(chainId);
          return true; // At least one chain is working
        } catch (error) {
          this.logger.warn(
            `Gas estimator health check failed for chain ${chainId}:`,
            error,
          );
        }
      }
      return false;
    } catch (error) {
      this.logger.error("Gas estimator health check failed:", error);
      return false;
    }
  }
}
