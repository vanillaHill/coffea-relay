import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { RelayTransactionRequest, TransactionReceipt } from '../interfaces/relay.interface';

interface TransactionParams extends RelayTransactionRequest {
  gasLimit: number;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
}

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);
  private readonly providers: Map<number, ethers.Provider> = new Map();
  private readonly wallet: ethers.Wallet;

  constructor(private readonly configService: ConfigService) {
    // Initialize wallet
    const privateKey = this.configService.get<string>('RELAY_PRIVATE_KEY');
    if (!privateKey) {
      throw new Error('RELAY_PRIVATE_KEY environment variable is required');
    }

    this.wallet = new ethers.Wallet(privateKey);
    this.initializeProviders();
  }

  private initializeProviders(): void {
    // Initialize RPC providers for each supported chain
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
          this.logger.log(`Initialized provider for chain ${chain.chainId}`);
        } catch (error) {
          this.logger.error(`Failed to initialize provider for chain ${chain.chainId}:`, error);
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

  private getConnectedWallet(chainId: number): ethers.Wallet {
    const provider = this.getProvider(chainId);
    return this.wallet.connect(provider);
  }

  async submitTransaction(params: TransactionParams): Promise<string> {
    try {
      const connectedWallet = this.getConnectedWallet(params.chainId);
      
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
        throw new Error('Either gasPrice or maxFeePerGas/maxPriorityFeePerGas must be provided');
      }

      this.logger.log('Submitting transaction:', {
        chainId: params.chainId,
        to: transaction.to,
        gasLimit: transaction.gasLimit?.toString(),
        gasPrice: transaction.gasPrice?.toString(),
        maxFeePerGas: transaction.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: transaction.maxPriorityFeePerGas?.toString(),
      });

      // Submit transaction
      const txResponse = await connectedWallet.sendTransaction(transaction);
      
      this.logger.log(`Transaction submitted: ${txResponse.hash}`);
      return txResponse.hash;
    } catch (error) {
      this.logger.error('Transaction submission failed:', error);
      throw new Error(`Transaction submission failed: ${error.message}`);
    }
  }

  async getTransactionReceipt(transactionHash: string, chainId: number): Promise<TransactionReceipt | null> {
    try {
      const provider = this.getProvider(chainId);
      const receipt = await provider.getTransactionReceipt(transactionHash);
      
      if (!receipt) {
        return null; // Transaction still pending
      }

      return {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: Number(receipt.gasUsed),
        effectiveGasPrice: receipt.gasPrice?.toString() || '0',
        status: receipt.status || 0,
      };
    } catch (error) {
      this.logger.error(`Failed to get transaction receipt for ${transactionHash}:`, error);
      throw error;
    }
  }

  async estimateGas(params: RelayTransactionRequest): Promise<number> {
    try {
      const provider = this.getProvider(params.chainId);
      
      const gasEstimate = await provider.estimateGas({
        to: params.target,
        data: params.data,
      });

      return Number(gasEstimate);
    } catch (error) {
      this.logger.error('Gas estimation failed:', error);
      // Return default gas limit if estimation fails
      return this.configService.get<number>('DEFAULT_GAS_LIMIT', 500000);
    }
  }

  async getBalance(chainId: number): Promise<string> {
    try {
      const provider = this.getProvider(chainId);
      const balance = await provider.getBalance(this.wallet.address);
      return ethers.formatEther(balance);
    } catch (error) {
      this.logger.error(`Failed to get balance for chain ${chainId}:`, error);
      return '0';
    }
  }

  getWalletAddress(): string {
    return this.wallet.address;
  }

  async checkHealth(): boolean {
    try {
      // Check wallet address is valid
      if (!ethers.isAddress(this.wallet.address)) {
        return false;
      }

      // Check at least one provider is working
      for (const [chainId, provider] of this.providers) {
        try {
          await provider.getBlockNumber();
          return true; // At least one provider is working
        } catch (error) {
          this.logger.warn(`Provider for chain ${chainId} is not responding:`, error);
        }
      }

      return false; // No providers are working
    } catch (error) {
      this.logger.error('Wallet health check failed:', error);
      return false;
    }
  }
}