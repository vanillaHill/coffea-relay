import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ethers } from "ethers";
import {
  RelayTransactionRequest,
  TransactionReceipt,
} from "../interfaces/relay.interface";
import { BaseProviderService } from "../../common/services/base-provider.service";
import { CacheService } from "../../common/services/cache.service";

interface TransactionParams extends RelayTransactionRequest {
  gasLimit: number;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
}

@Injectable()
export class WalletService extends BaseProviderService {
  private readonly wallet: ethers.Wallet;

  constructor(
    configService: ConfigService,
    cacheService: CacheService,
  ) {
    super(configService, cacheService);

    // Initialize wallet
    const privateKey = this.configService.get<string>("RELAY_PRIVATE_KEY");
    if (!privateKey) {
      throw new Error("RELAY_PRIVATE_KEY environment variable is required");
    }

    this.wallet = new ethers.Wallet(privateKey);
  }

  private getConnectedWallet(chainId: number): ethers.Wallet {
    const provider = this.getCurrentProvider(chainId);
    if (!provider) {
      throw new Error(`No provider available for chain ID ${chainId}`);
    }
    return this.wallet.connect(provider);
  }

  async submitTransaction(params: TransactionParams): Promise<string> {
    try {
      // Prepare transaction object
      const transaction: ethers.TransactionRequest = {
        to: params.target,
        data: params.data,
        gasLimit: params.gasLimit,
      };

      // Set gas pricing based on EIP-1559 support
      if (params.maxFeePerGas && params.maxPriorityFeePerGas) {
        // EIP-1559 transaction
        transaction.maxFeePerGas = params.maxFeePerGas;
        transaction.maxPriorityFeePerGas = params.maxPriorityFeePerGas;
        transaction.type = 2;
      } else if (params.gasPrice) {
        // Legacy transaction
        transaction.gasPrice = params.gasPrice;
        transaction.type = 0;
      } else {
        throw new Error(
          "Either gasPrice or maxFeePerGas/maxPriorityFeePerGas must be provided",
        );
      }

      this.logger.log("Submitting transaction:", {
        chainId: params.chainId,
        to: transaction.to,
        gasLimit: transaction.gasLimit?.toString(),
        gasPrice: transaction.gasPrice?.toString(),
        maxFeePerGas: transaction.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: transaction.maxPriorityFeePerGas?.toString(),
      });

      // Submit transaction with fallback support
      const txHash = await this.executeWithFallback(
        async (provider) => {
          const connectedWallet = this.wallet.connect(provider);
          const txResponse = await connectedWallet.sendTransaction(transaction);
          return txResponse.hash;
        },
        "transaction submission",
        params.chainId,
      );

      this.logger.log(`Transaction submitted: ${txHash}`);
      return txHash;
    } catch (error) {
      this.logger.error("Transaction submission failed:", error);
      throw new Error(`Transaction submission failed: ${error.message}`);
    }
  }

  async getTransactionReceipt(
    transactionHash: string,
    chainId: number,
  ): Promise<TransactionReceipt | null> {
    try {
      const receipt = await this.executeWithFallback(
        async (provider) => provider.getTransactionReceipt(transactionHash),
        "transaction receipt retrieval",
        chainId,
      );

      if (!receipt) {
        return null; // Transaction still pending
      }

      return {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: Number(receipt.gasUsed),
        effectiveGasPrice: receipt.gasPrice?.toString() || "0",
        status: receipt.status || 0,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get transaction receipt for ${transactionHash}:`,
        error,
      );
      throw error;
    }
  }

  async estimateGas(params: RelayTransactionRequest): Promise<number> {
    try {
      const gasEstimate = await this.executeWithFallback(
        async (provider) =>
          provider.estimateGas({
            to: params.target,
            data: params.data,
          }),
        "gas estimation",
        params.chainId,
      );

      return Number(gasEstimate);
    } catch (error) {
      this.logger.error("Gas estimation failed:", error);
      // Return default gas limit if estimation fails
      return this.configService.get<number>("DEFAULT_GAS_LIMIT", 500000);
    }
  }

  async getBalance(chainId: number): Promise<string> {
    try {
      const balance = await this.executeWithFallback(
        async (provider) => provider.getBalance(this.wallet.address),
        "balance retrieval",
        chainId,
      );
      return ethers.formatEther(balance);
    } catch (error) {
      this.logger.error(`Failed to get balance for chain ${chainId}:`, error);
      return "0";
    }
  }

  getWalletAddress(): string {
    return this.wallet.address;
  }

  async checkHealth(): Promise<boolean> {
    try {
      // Check wallet address is valid
      if (!ethers.isAddress(this.wallet.address)) {
        return false;
      }

      // Check at least one provider is working by trying to get block number
      for (const chainId of this.getSupportedChains()) {
        try {
          await this.executeWithFallback(
            async (provider) => provider.getBlockNumber(),
            "health check",
            chainId,
          );
          return true; // At least one chain is working
        } catch (error) {
          this.logger.warn(`Health check failed for chain ${chainId}:`, error);
        }
      }

      return false; // No providers are working
    } catch (error) {
      this.logger.error("Wallet health check failed:", error);
      return false;
    }
  }
}
