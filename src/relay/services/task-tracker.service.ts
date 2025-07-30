/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, Logger } from "@nestjs/common";
import {
  RelayTransactionRequest,
  RelayTaskStatus,
  RelayTaskState,
} from "../interfaces/relay.interface";
import { DatabaseClient } from "../../database/database.client";

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

  constructor(private readonly databaseClient: DatabaseClient) {}

  /**
   * Creates a new relay task record in the database.
   * This is the first step in the transaction lifecycle.
   */
  async createTask(
    taskId: string,
    request: RelayTransactionRequest
  ): Promise<void> {
    try {
      const taskDto = {
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
      };

      await this.databaseClient.createRelayTask(taskDto);
      this.logger.log(
        `Created task ${taskId} for user ${request.user} on chain ${request.chainId}`
      );
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
      const updates: any = { status };

      if (metadata) {
        if (metadata.transactionHash)
          updates.transactionHash = metadata.transactionHash;
        if (metadata.blockNumber) updates.blockNumber = metadata.blockNumber;
        if (metadata.gasUsed) updates.gasUsed = metadata.gasUsed;
        if (metadata.effectiveGasPrice)
          updates.effectiveGasPrice = metadata.effectiveGasPrice;
        if (metadata.error) updates.error = metadata.error;
      }

      await this.databaseClient.updateRelayTask(taskId, updates);
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
      const task = await this.databaseClient.getRelayTask(taskId);

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
      const tasks = await this.databaseClient.getRelayTasksByUser(
        userAddress,
        limit,
        0, // offset
        "createdAt", // orderBy
        "DESC" // orderDirection
      );

      // Filter by chainId if provided
      const filteredTasks = chainId
        ? tasks.filter((task: any) => task.chainId === chainId)
        : tasks;

      return filteredTasks.map((task: any) => ({
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
      // Try to get relay task stats as a health check
      await this.databaseClient.getRelayTaskStats();
      return true;
    } catch (error) {
      this.logger.error("Task tracker health check failed:", error);
      return false;
    }
  }
}
