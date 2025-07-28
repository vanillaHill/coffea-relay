import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { v4 as uuidv4 } from 'uuid';
import { 
  RelayTransactionRequest, 
  RelayTransactionResponse, 
  RelayTaskStatus, 
  RelayTaskState,
  IRelayService 
} from '../interfaces/relay.interface';
import { WalletService } from './wallet.service';
import { GasEstimatorService } from './gas-estimator.service';
import { TaskTrackerService } from './task-tracker.service';

@Injectable()
export class RelayService implements IRelayService {
  private readonly logger = new Logger(RelayService.name);
  private readonly supportedChains = [1, 11155111, 31337]; // Mainnet, Sepolia, Hardhat

  constructor(
    private readonly configService: ConfigService,
    private readonly walletService: WalletService,
    private readonly gasEstimator: GasEstimatorService,
    private readonly taskTracker: TaskTrackerService,
  ) {}

  async submitTransaction(request: RelayTransactionRequest): Promise<RelayTransactionResponse> {
    const taskId = uuidv4();
    
    try {
      this.logger.log(`Submitting transaction for task ${taskId}`, {
        chainId: request.chainId,
        target: request.target,
        user: request.user,
      });

      // Validate chain support
      if (!this.isSupported(request.chainId)) {
        throw new Error(`Chain ID ${request.chainId} is not supported`);
      }

      // Create initial task record
      await this.taskTracker.createTask(taskId, request);

      // Estimate gas if not provided
      let gasParams = {
        gasLimit: request.gasLimit || 500000,
        gasPrice: request.gasPrice,
        maxFeePerGas: request.maxFeePerGas,
        maxPriorityFeePerGas: request.maxPriorityFeePerGas,
      };

      if (!gasParams.gasPrice && !gasParams.maxFeePerGas) {
        const gasEstimation = await this.gasEstimator.estimateGas(request);
        gasParams = { ...gasParams, ...gasEstimation };
      }

      // Submit transaction
      const transactionHash = await this.walletService.submitTransaction({
        ...request,
        ...gasParams,
      });

      // Update task status
      await this.taskTracker.updateTaskStatus(taskId, RelayTaskState.SUBMITTED, {
        transactionHash,
      });

      // Start monitoring transaction
      this.monitorTransaction(taskId, transactionHash, request.chainId);

      return {
        taskId,
        success: true,
        message: 'Transaction submitted successfully',
      };
    } catch (error) {
      this.logger.error(`Transaction submission failed for task ${taskId}:`, error);
      
      // Update task with error
      await this.taskTracker.updateTaskStatus(taskId, RelayTaskState.FAILED, {
        error: error.message,
      });

      return {
        taskId,
        success: false,
        message: error.message,
      };
    }
  }

  async getTaskStatus(taskId: string): Promise<RelayTaskStatus> {
    try {
      const status = await this.taskTracker.getTaskStatus(taskId);
      return status;
    } catch (error) {
      this.logger.error(`Failed to get task status for ${taskId}:`, error);
      throw new Error(`Task ${taskId} not found`);
    }
  }

  async cancelTask(taskId: string): Promise<boolean> {
    try {
      const status = await this.taskTracker.getTaskStatus(taskId);
      
      // Can only cancel pending tasks
      if (status.status !== RelayTaskState.PENDING) {
        this.logger.warn(`Cannot cancel task ${taskId} with status ${status.status}`);
        return false;
      }

      await this.taskTracker.updateTaskStatus(taskId, RelayTaskState.CANCELLED);
      this.logger.log(`Task ${taskId} cancelled successfully`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to cancel task ${taskId}:`, error);
      return false;
    }
  }

  isSupported(chainId: number): boolean {
    return this.supportedChains.includes(chainId);
  }

  async checkHealth(): Promise<boolean> {
    try {
      // Check wallet service health
      const walletHealthy = await this.walletService.checkHealth();
      
      // Check gas estimator health
      const gasEstimatorHealthy = await this.gasEstimator.checkHealth();
      
      // Check task tracker health
      const taskTrackerHealthy = await this.taskTracker.checkHealth();

      return walletHealthy && gasEstimatorHealthy && taskTrackerHealthy;
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return false;
    }
  }

  private async monitorTransaction(taskId: string, transactionHash: string, chainId: number): Promise<void> {
    const maxRetries = this.configService.get<number>('MAX_RETRY_ATTEMPTS', 60);
    const pollingInterval = this.configService.get<number>('POLLING_INTERVAL_MS', 5000);
    
    let retries = 0;

    const monitor = async () => {
      try {
        const receipt = await this.walletService.getTransactionReceipt(transactionHash, chainId);
        
        if (receipt) {
          // Transaction confirmed
          const status = receipt.status === 1 ? RelayTaskState.SUCCESS : RelayTaskState.FAILED;
          
          await this.taskTracker.updateTaskStatus(taskId, status, {
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed,
            effectiveGasPrice: receipt.effectiveGasPrice,
            error: receipt.status === 0 ? 'Transaction reverted' : undefined,
          });

          this.logger.log(`Transaction ${transactionHash} completed with status: ${status}`);
          return;
        }

        // Transaction still pending
        retries++;
        if (retries >= maxRetries) {
          await this.taskTracker.updateTaskStatus(taskId, RelayTaskState.FAILED, {
            error: 'Transaction timeout - not confirmed within time limit',
          });
          this.logger.error(`Transaction ${transactionHash} timed out after ${retries} retries`);
          return;
        }

        // Schedule next retry
        setTimeout(monitor, pollingInterval);
      } catch (error) {
        this.logger.error(`Error monitoring transaction ${transactionHash}:`, error);
        retries++;
        
        if (retries >= maxRetries) {
          await this.taskTracker.updateTaskStatus(taskId, RelayTaskState.FAILED, {
            error: `Monitoring failed: ${error.message}`,
          });
          return;
        }

        // Retry monitoring
        setTimeout(monitor, pollingInterval);
      }
    };

    // Start monitoring (non-blocking)
    setTimeout(monitor, pollingInterval);
  }
}