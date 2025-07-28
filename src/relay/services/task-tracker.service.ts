import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RelayTransactionRequest, RelayTaskStatus, RelayTaskState } from '../interfaces/relay.interface';
import { RelayTask } from '../../database/entities/relay-task.entity';

/**
 * TaskTrackerService handles the lifecycle management of relay transactions.
 * It provides persistent storage and real-time tracking capabilities for all
 * transaction requests processed by the relay service.
 * 
 * Key responsibilities:
 * - Create and store new relay tasks
 * - Update task status throughout the transaction lifecycle
 * - Provide task status queries with caching
 * - Maintain transaction history and analytics
 * - Handle task cancellation and cleanup
 */
@Injectable()
export class TaskTrackerService {
  private readonly logger = new Logger(TaskTrackerService.name);

  constructor(
    @InjectRepository(RelayTask)
    private readonly taskRepository: Repository<RelayTask>,
  ) {}

  /**
   * Creates a new relay task record in the database.
   * This is the first step in the transaction lifecycle.
   */
  async createTask(taskId: string, request: RelayTransactionRequest): Promise<void> {
    try {
      const task = this.taskRepository.create({
        taskId,
        chainId: request.chainId,
        target: request.target,
        data: request.data,
        user: request.user,
        gasLimit: request.gasLimit,
        gasPrice: request.gasPrice,
        maxFeePerGas: request.maxFeePerGas,
        maxPriorityFeePerGas: request.maxPriorityFeePerGas,
        status: RelayTaskState.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await this.taskRepository.save(task);
      this.logger.log(`Created task ${taskId} for user ${request.user} on chain ${request.chainId}`);
    } catch (error) {
      this.logger.error(`Failed to create task ${taskId}:`, error);
      throw new Error(`Task creation failed: ${error.message}`);
    }
  }

  /**
   * Updates the status of an existing relay task with optional metadata.
   * This method is called throughout the transaction lifecycle to track progress.
   */
  async updateTaskStatus(
    taskId: string, 
    status: RelayTaskState, 
    metadata?: {
      transactionHash?: string;
      blockNumber?: number;
      gasUsed?: number;
      effectiveGasPrice?: string;
      error?: string;
    }
  ): Promise<void> {
    try {
      const task = await this.taskRepository.findOne({ where: { taskId } });
      
      if (!task) {
        throw new Error(`Task ${taskId} not found`);
      }

      task.status = status;
      task.updatedAt = new Date();

      if (metadata) {
        if (metadata.transactionHash) task.transactionHash = metadata.transactionHash;
        if (metadata.blockNumber) task.blockNumber = metadata.blockNumber;
        if (metadata.gasUsed) task.gasUsed = metadata.gasUsed;
        if (metadata.effectiveGasPrice) task.effectiveGasPrice = metadata.effectiveGasPrice;
        if (metadata.error) task.error = metadata.error;
      }

      await this.taskRepository.save(task);
      this.logger.log(`Updated task ${taskId} status to ${status}`, metadata);
    } catch (error) {
      this.logger.error(`Failed to update task ${taskId} status:`, error);
      throw error;
    }
  }

  /**
   * Retrieves the current status of a relay task.
   * Returns comprehensive task information including transaction details.
   */
  async getTaskStatus(taskId: string): Promise<RelayTaskStatus> {
    try {
      const task = await this.taskRepository.findOne({ where: { taskId } });
      
      if (!task) {
        throw new Error(`Task ${taskId} not found`);
      }

      return {
        taskId: task.taskId,
        chainId: task.chainId,
        status: task.status,
        transactionHash: task.transactionHash,
        blockNumber: task.blockNumber,
        gasUsed: task.gasUsed,
        effectiveGasPrice: task.effectiveGasPrice,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        error: task.error,
      };
    } catch (error) {
      this.logger.error(`Failed to get task status for ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Retrieves tasks by user address with optional filtering.
   * Useful for user dashboards and transaction history.
   */
  async getTasksByUser(
    userAddress: string, 
    chainId?: number, 
    limit: number = 50
  ): Promise<RelayTaskStatus[]> {
    try {
      const queryBuilder = this.taskRepository
        .createQueryBuilder('task')
        .where('task.user = :userAddress', { userAddress: userAddress.toLowerCase() })
        .orderBy('task.createdAt', 'DESC')
        .limit(limit);

      if (chainId) {
        queryBuilder.andWhere('task.chainId = :chainId', { chainId });
      }

      const tasks = await queryBuilder.getMany();

      return tasks.map(task => ({
        taskId: task.taskId,
        chainId: task.chainId,
        status: task.status,
        transactionHash: task.transactionHash,
        blockNumber: task.blockNumber,
        gasUsed: task.gasUsed,
        effectiveGasPrice: task.effectiveGasPrice,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        error: task.error,
      }));
    } catch (error) {
      this.logger.error(`Failed to get tasks for user ${userAddress}:`, error);
      throw error;
    }
  }

  /**
   * Performs health check on the task tracker service.
   * Verifies database connectivity and basic functionality.
   */
  async checkHealth(): Promise<boolean> {
    try {
      await this.taskRepository.count({
        where: {
          createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      });
      return true;
    } catch (error) {
      this.logger.error('Task tracker health check failed:', error);
      return false;
    }
  }
}