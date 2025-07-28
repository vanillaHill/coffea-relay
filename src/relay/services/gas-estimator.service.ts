import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { RelayTransactionRequest, GasEstimation } from '../interfaces/relay.interface';

interface GasPrices {
  slow: string;
  standard: string;
  fast: string;
}

@Injectable()
export class GasEstimatorService {
  private readonly logger = new Logger(GasEstimatorService.name);
  private readonly providers: Map<number, ethers.Provider> = new Map();
  private readonly gasCache: Map<number, { prices: GasPrices, timestamp: number }> = new Map();
  private readonly CACHE_TTL = 60000; // 1 minute cache

  constructor(private readonly configService: ConfigService) {
    this.initializeProviders();
  }

  private initializeProviders(): void {
    const chains = [
      { chainId: 1, rpcUrl: this.configService.get<string>('RPC_URL_MAINNET') },
      { chainId: 11155111, rpcUrl: this.configService.get<string>('RPC_URL_SEPOLIA') },
      { chainId: 31337, rpcUrl: this.configService.get<string>('RPC_URL_HARDHAT') },
    ];

    for (const chain of chains) {
      if (chain.rpcUrl) {
        try {
          const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
          this.providers.set(chain.chainId, provider);
        } catch (error) {
          this.logger.error(`Failed to initialize gas estimator provider for chain ${chain.chainId}:`, error);
        }
      }
    }
  }

  private getProvider(chainId: number): ethers.Provider {
    const provider = this.providers.get(chainId);
    if (!provider) {
      throw new Error(`No provider configured for chain ID ${chainId}`);
    }
    return provider;
  }

  async estimateGas(request: RelayTransactionRequest): Promise<GasEstimation> {
    try {
      const provider = this.getProvider(request.chainId);
      
      // Estimate gas limit
      let gasLimit: number;
      try {
        const gasEstimate = await provider.estimateGas({
          to: request.target,
          data: request.data,
        });
        gasLimit = Math.floor(Number(gasEstimate) * 1.2); // Add 20% buffer
      } catch (error) {
        this.logger.warn('Gas estimation failed, using default:', error);
        gasLimit = this.configService.get<number>('DEFAULT_GAS_LIMIT', 500000);
      }

      // Get gas prices
      const gasPrices = await this.getGasPrices(request.chainId);
      
      // Use standard gas price by default
      const gasPrice = gasPrices.standard;
      const estimatedCost = (BigInt(gasLimit) * BigInt(gasPrice)).toString();

      // Check if chain supports EIP-1559
      const supportsEIP1559 = await this.supportsEIP1559(request.chainId);
      
      if (supportsEIP1559) {
        const feeData = await provider.getFeeData();
        return {
          gasLimit,
          gasPrice,
          maxFeePerGas: feeData.maxFeePerGas?.toString() || gasPrice,
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString() || ethers.parseGwei('2').toString(),
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
      this.logger.error('Gas estimation failed:', error);
      
      // Return fallback estimation
      const defaultGasLimit = this.configService.get<number>('DEFAULT_GAS_LIMIT', 500000);
      const defaultGasPrice = ethers.parseGwei('20').toString(); // 20 gwei fallback
      
      return {
        gasLimit: defaultGasLimit,
        gasPrice: defaultGasPrice,
        estimatedCost: (BigInt(defaultGasLimit) * BigInt(defaultGasPrice)).toString(),
      };
    }
  }

  async getGasPrices(chainId: number): Promise<GasPrices> {
    // Check cache first
    const cached = this.gasCache.get(chainId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.prices;
    }

    try {
      const provider = this.getProvider(chainId);
      const feeData = await provider.getFeeData();
      
      const baseGasPrice = feeData.gasPrice || ethers.parseGwei('20');
      const multiplier = this.configService.get<number>('GAS_PRICE_MULTIPLIER', 1.1);
      
      // Calculate different speed prices
      const slow = Math.floor(Number(baseGasPrice) * 0.8).toString();
      const standard = Math.floor(Number(baseGasPrice) * multiplier).toString();
      const fast = Math.floor(Number(baseGasPrice) * multiplier * 1.5).toString();
      
      const prices: GasPrices = { slow, standard, fast };
      
      // Cache the prices
      this.gasCache.set(chainId, {
        prices,
        timestamp: Date.now(),
      });
      
      this.logger.log(`Updated gas prices for chain ${chainId}:`, {
        slow: ethers.formatGwei(slow),
        standard: ethers.formatGwei(standard),
        fast: ethers.formatGwei(fast),
      });
      
      return prices;
    } catch (error) {
      this.logger.error(`Failed to get gas prices for chain ${chainId}:`, error);
      
      // Return fallback prices
      const fallbackPrice = ethers.parseGwei('20').toString();
      return {
        slow: fallbackPrice,
        standard: fallbackPrice,
        fast: fallbackPrice,
      };
    }
  }

  private async supportsEIP1559(chainId: number): boolean {
    try {
      const provider = this.getProvider(chainId);
      const feeData = await provider.getFeeData();
      return feeData.maxFeePerGas !== null && feeData.maxPriorityFeePerGas !== null;
    } catch (error) {
      this.logger.warn(`Failed to check EIP-1559 support for chain ${chainId}:`, error);
      return false;
    }
  }

  async validateGasParams(chainId: number, gasLimit?: number, gasPrice?: string, maxFeePerGas?: string): Promise<boolean> {
    try {
      const maxGasPrice = ethers.parseGwei(this.configService.get<string>('MAX_GAS_PRICE_GWEI', '100'));
      
      // Validate gas limit
      if (gasLimit && gasLimit > 10000000) { // 10M gas limit
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
      this.logger.error('Gas parameter validation failed:', error);
      return false;
    }
  }

  async checkHealth(): boolean {
    try {
      // Try to get gas prices for at least one chain
      for (const chainId of this.providers.keys()) {
        try {
          await this.getGasPrices(chainId);
          return true; // At least one chain is working
        } catch (error) {
          this.logger.warn(`Gas estimator health check failed for chain ${chainId}:`, error);
        }
      }
      return false;
    } catch (error) {
      this.logger.error('Gas estimator health check failed:', error);
      return false;
    }
  }
}