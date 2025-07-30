import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ethers } from "ethers";
import {
  getAlchemyRpcUrl,
  getEthereumRpcUrl,
  getInfuraRpcUrl,
} from "../config/rpc-config";
import {
  DEFAULT_CHAIN_ID,
  getNetworkConfig,
  isChainSupported,
} from "../constants/networks";
import { CacheService } from "./cache.service";

interface ProviderConfig {
  name: string;
  url: string;
  priority: number;
}

interface ChainProviders {
  providers: Map<string, ethers.JsonRpcProvider>;
  currentProvider: ethers.JsonRpcProvider;
  configs: ProviderConfig[];
}

@Injectable()
export abstract class BaseProviderService {
  protected readonly logger = new Logger(this.constructor.name);
  protected chainProviders: Map<number, ChainProviders> = new Map();
  protected readonly PROVIDER_TIMEOUT = 8000;
  private readonly PROVIDER_HEALTH_CACHE_TTL = 300; // 5 minutes

  constructor(
    protected configService: ConfigService,
    protected cacheService: CacheService,
  ) {
    // Initialize providers for supported chains
    this.initializeAllProviders();
  }

  private initializeProviderConfigs(chainId: number): ProviderConfig[] {
    const rpcUrls = [
      getAlchemyRpcUrl(chainId),
      getInfuraRpcUrl(chainId),
      getEthereumRpcUrl(chainId),
    ];
    const configs: ProviderConfig[] = [];

    // Map RPC URLs to provider configs with priorities
    rpcUrls.forEach((url, index) => {
      let name = "custom";
      let priority = index + 1;

      // Identify provider type based on URL patterns
      if (url.includes("alchemy")) {
        name = "alchemy";
        priority = 1;
      } else if (url.includes("infura")) {
        name = "infura";
        priority = 2;
      } else if (url.includes("publicnode")) {
        name = "publicnode";
        priority = 3;
      } else {
        name = `provider_${index}`;
        priority = index + 4;
      }

      configs.push({ name: `${name}_${chainId}`, url, priority });
    });

    // Fallback if no RPC URLs configured
    if (configs.length === 0) {
      const networkConfig = getNetworkConfig(chainId);
      if (networkConfig) {
        configs.push({
          name: `fallback_${chainId}`,
          url: rpcUrls[0] || "https://ethereum.publicnode.com",
          priority: 99,
        });
      }
    }

    return configs;
  }

  private initializeAllProviders(): void {
    // Initialize providers for all supported chains
    const supportedChains = [1, 11155111, 31337]; // Mainnet, Sepolia, Hardhat

    for (const chainId of supportedChains) {
      if (isChainSupported(chainId)) {
        this.initializeProvidersForChain(chainId);
      }
    }
  }

  private initializeProvidersForChain(chainId: number): void {
    if (this.chainProviders.has(chainId)) {
      return; // Already initialized
    }

    const configs = this.initializeProviderConfigs(chainId);
    const providers = new Map<string, ethers.JsonRpcProvider>();
    let currentProvider: ethers.JsonRpcProvider | null = null;

    for (const config of configs) {
      try {
        const provider = new ethers.JsonRpcProvider(config.url);
        providers.set(config.name, provider);

        // Set the first successfully created provider as current
        if (!currentProvider) {
          currentProvider = provider;
        }

        this.logger.debug(
          `Initialized ${config.name} provider for chain ${chainId}`,
        );
      } catch (error) {
        this.logger.warn(
          `Failed to initialize ${config.name} provider for chain ${chainId}:`,
          error,
        );
      }
    }

    if (currentProvider && providers.size > 0) {
      this.chainProviders.set(chainId, {
        providers,
        currentProvider,
        configs,
      });
    } else {
      this.logger.error(
        `No RPC providers could be initialized for chain ${chainId}`,
      );
    }
  }

  protected async executeWithFallback<T>(
    operation: (provider: ethers.JsonRpcProvider) => Promise<T>,
    operationName: string,
    chainId: number = DEFAULT_CHAIN_ID,
  ): Promise<T> {
    // Ensure providers are initialized for this chain
    if (!this.chainProviders.has(chainId)) {
      this.initializeProvidersForChain(chainId);
    }

    const chainProvider = this.chainProviders.get(chainId);
    if (!chainProvider) {
      throw new Error(`No providers available for chain ${chainId}`);
    }

    const sortedProviders = Array.from(chainProvider.providers.entries()).sort(
      ([a], [b]) => {
        const configA = chainProvider.configs.find((c) => c.name === a);
        const configB = chainProvider.configs.find((c) => c.name === b);
        return (configA?.priority || 99) - (configB?.priority || 99);
      },
    );

    let lastError: Error;

    for (const [providerName, provider] of sortedProviders) {
      try {
        this.logger.debug(
          `Attempting ${operationName} with ${providerName} provider on chain ${chainId}`,
        );

        const result = await Promise.race([
          operation(provider),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error("Provider timeout")),
              this.PROVIDER_TIMEOUT,
            ),
          ),
        ]);

        if (chainProvider.currentProvider !== provider) {
          chainProvider.currentProvider = provider;
          this.logger.log(
            `Switched to ${providerName} provider for chain ${chainId}`,
          );
        }

        return result;
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(
          `${operationName} failed with ${providerName} on chain ${chainId}:`,
          error.message,
        );
      }
    }

    throw new Error(
      `All providers failed for ${operationName} on chain ${chainId}. Last error: ${lastError?.message}`,
    );
  }

  /**
   * Get current provider for a specific chain
   */
  protected getCurrentProvider(
    chainId: number = DEFAULT_CHAIN_ID,
  ): ethers.JsonRpcProvider | null {
    const chainProvider = this.chainProviders.get(chainId);
    return chainProvider?.currentProvider || null;
  }

  /**
   * Check health of all providers for a specific chain
   */
  async checkProviderHealth(
    chainId: number = DEFAULT_CHAIN_ID,
  ): Promise<{ [key: string]: boolean }> {
    const chainProvider = this.chainProviders.get(chainId);
    if (!chainProvider) {
      return {};
    }

    const cacheKey = `provider_health:${chainId}`;

    // Check Redis cache first
    const cached = await this.cacheService.get<{ [key: string]: boolean }>(
      cacheKey,
    );
    if (cached) {
      this.logger.debug(
        `Retrieved provider health for chain ${chainId} from cache`,
      );
      return cached;
    }

    const healthStatus: { [key: string]: boolean } = {};

    for (const [providerName, provider] of chainProvider.providers) {
      try {
        await Promise.race([
          provider.getBlockNumber(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Health check timeout")), 5000),
          ),
        ]);
        healthStatus[providerName] = true;
      } catch (error) {
        this.logger.warn(
          `Provider ${providerName} health check failed:`,
          error,
        );
        healthStatus[providerName] = false;
      }
    }

    // Cache the health status
    await this.cacheService.set(
      cacheKey,
      healthStatus,
      this.PROVIDER_HEALTH_CACHE_TTL,
    );

    return healthStatus;
  }

  /**
   * Get provider statistics
   */
  getProviderStats(chainId: number = DEFAULT_CHAIN_ID): {
    totalProviders: number;
    currentProvider: string | null;
    availableProviders: string[];
  } {
    const chainProvider = this.chainProviders.get(chainId);
    if (!chainProvider) {
      return {
        totalProviders: 0,
        currentProvider: null,
        availableProviders: [],
      };
    }

    const currentProviderName =
      Array.from(chainProvider.providers.entries()).find(
        ([, provider]) => provider === chainProvider.currentProvider,
      )?.[0] || null;

    return {
      totalProviders: chainProvider.providers.size,
      currentProvider: currentProviderName,
      availableProviders: Array.from(chainProvider.providers.keys()),
    };
  }

  /**
   * Force switch to a specific provider (useful for testing)
   */
  protected switchProvider(
    providerName: string,
    chainId: number = DEFAULT_CHAIN_ID,
  ): boolean {
    const chainProvider = this.chainProviders.get(chainId);
    if (!chainProvider) {
      this.logger.warn(`No providers initialized for chain ${chainId}`);
      return false;
    }

    const provider = chainProvider.providers.get(providerName);
    if (!provider) {
      this.logger.warn(
        `Provider ${providerName} not found for chain ${chainId}`,
      );
      return false;
    }

    chainProvider.currentProvider = provider;
    this.logger.log(
      `Manually switched to ${providerName} provider for chain ${chainId}`,
    );
    return true;
  }

  /**
   * Get all supported chain IDs
   */
  getSupportedChains(): number[] {
    return Array.from(this.chainProviders.keys());
  }
}
