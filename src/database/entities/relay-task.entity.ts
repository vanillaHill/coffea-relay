import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { RelayTaskState } from '../../relay/interfaces/relay.interface';

/**
 * RelayTask entity represents a transaction relay request in the database.
 * This entity tracks the complete lifecycle of gasless transactions from
 * submission to completion, providing persistence and analytics capabilities.
 * 
 * Key features:
 * - Unique task identification with UUID
 * - Complete transaction metadata storage
 * - Status tracking through enum states
 * - Gas parameter logging for optimization
 * - Indexed fields for efficient querying
 * - Automatic timestamp management
 */
@Entity('relay_tasks')
@Index(['user', 'createdAt']) // Optimize user history queries
@Index(['chainId', 'status']) // Optimize chain-specific status queries
@Index(['transactionHash'], { unique: true, where: 'transaction_hash IS NOT NULL' })
export class RelayTask {
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * Unique identifier for the relay task (UUID format)
   * Used as the primary reference for API calls and status tracking
   */
  @Column({ type: 'varchar', length: 36, unique: true })
  @Index()
  taskId: string;

  /**
   * Blockchain network chain ID where the transaction will be executed
   * Supported chains: 1 (Mainnet), 11155111 (Sepolia), 31337 (Hardhat)
   */
  @Column({ type: 'int' })
  chainId: number;

  /**
   * Target smart contract address for the transaction
   * Must be a valid Ethereum address format
   */
  @Column({ type: 'varchar', length: 42 })
  target: string;

  /**
   * Encoded transaction data (function call with parameters)
   * Hex-encoded string starting with '0x'
   */
  @Column({ type: 'text' })
  data: string;

  /**
   * User wallet address requesting the gasless transaction
   * Stored in lowercase for consistent querying
   */
  @Column({ type: 'varchar', length: 42, transformer: {
    to: (value: string) => value?.toLowerCase(),
    from: (value: string) => value
  }})
  user: string;

  /**
   * Gas limit for the transaction execution
   * Optional - defaults to estimated value if not provided
   */
  @Column({ type: 'int', nullable: true })
  gasLimit?: number;

  /**
   * Legacy gas price in wei (for pre-EIP-1559 transactions)
   * Stored as string to handle large numbers
   */
  @Column({ type: 'varchar', nullable: true })
  gasPrice?: string;

  /**
   * Maximum fee per gas for EIP-1559 transactions
   * Stored as string to handle large numbers
   */
  @Column({ type: 'varchar', nullable: true })
  maxFeePerGas?: string;

  /**
   * Maximum priority fee per gas for EIP-1559 transactions
   * Stored as string to handle large numbers
   */
  @Column({ type: 'varchar', nullable: true })
  maxPriorityFeePerGas?: string;

  /**
   * Current status of the relay task
   * Enum values: pending, submitted, success, failed, cancelled
   */
  @Column({ 
    type: 'enum', 
    enum: RelayTaskState,
    default: RelayTaskState.PENDING 
  })
  status: RelayTaskState;

  /**
   * Blockchain transaction hash (set when transaction is submitted)
   * Null until transaction is actually broadcast to the network
   */
  @Column({ type: 'varchar', length: 66, nullable: true })
  transactionHash?: string;

  /**
   * Block number where the transaction was included
   * Only set for confirmed transactions (success or failed)
   */
  @Column({ type: 'int', nullable: true })
  blockNumber?: number;

  /**
   * Actual gas consumed by the transaction
   * Available after transaction confirmation
   */
  @Column({ type: 'int', nullable: true })
  gasUsed?: number;

  /**
   * Effective gas price paid for the transaction
   * Actual price paid, may differ from estimated price
   */
  @Column({ type: 'varchar', nullable: true })
  effectiveGasPrice?: string;

  /**
   * Error message for failed transactions
   * Contains detailed error information for debugging
   */
  @Column({ type: 'text', nullable: true })
  error?: string;

  /**
   * Task creation timestamp
   * Automatically set when record is created
   */
  @CreateDateColumn()
  createdAt: Date;

  /**
   * Last update timestamp
   * Automatically updated on any field change
   */
  @UpdateDateColumn()
  updatedAt: Date;

  /**
   * Calculate the total cost of the transaction in ETH
   * Returns the cost as a string to maintain precision
   */
  getTotalCostETH(): string | null {
    if (!this.gasUsed || !this.effectiveGasPrice) {
      return null;
    }
    
    const totalWei = BigInt(this.gasUsed) * BigInt(this.effectiveGasPrice);
    const totalETH = Number(totalWei) / Math.pow(10, 18);
    return totalETH.toFixed(6);
  }

  /**
   * Check if the task is in a final state (completed, failed, or cancelled)
   * Used to determine if the task can still be modified
   */
  isFinalState(): boolean {
    return [
      RelayTaskState.SUCCESS,
      RelayTaskState.FAILED,
      RelayTaskState.CANCELLED
    ].includes(this.status);
  }

  /**
   * Get a human-readable status description
   * Used for API responses and logging
   */
  getStatusDescription(): string {
    switch (this.status) {
      case RelayTaskState.PENDING:
        return 'Waiting for transaction submission';
      case RelayTaskState.SUBMITTED:
        return 'Transaction submitted to blockchain';
      case RelayTaskState.SUCCESS:
        return 'Transaction confirmed successfully';
      case RelayTaskState.FAILED:
        return 'Transaction failed or reverted';
      case RelayTaskState.CANCELLED:
        return 'Transaction cancelled before submission';
      default:
        return 'Unknown status';
    }
  }
}