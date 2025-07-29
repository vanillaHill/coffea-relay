export interface RelayTransactionRequest {
  chainId: number;
  target: string;
  data: string;
  user: string;
  gasLimit?: number;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
}

export interface RelayTransactionResponse {
  taskId: string;
  success: boolean;
  message?: string;
}

export interface RelayTaskStatus {
  taskId: string;
  chainId: number;
  status: RelayTaskState;
  transactionHash?: string;
  blockNumber?: number;
  gasUsed?: number;
  effectiveGasPrice?: string;
  createdAt: Date;
  updatedAt: Date;
  error?: string;
}

export enum RelayTaskState {
  PENDING = "pending",
  SUBMITTED = "submitted",
  SUCCESS = "success",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

export interface IRelayService {
  submitTransaction(
    request: RelayTransactionRequest,
  ): Promise<RelayTransactionResponse>;
  getTaskStatus(taskId: string): Promise<RelayTaskStatus>;
  cancelTask(taskId: string): Promise<boolean>;
  isSupported(chainId: number): boolean;
}

export interface GasEstimation {
  gasLimit: number;
  gasPrice: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  estimatedCost: string;
}

export interface TransactionReceipt {
  transactionHash: string;
  blockNumber: number;
  gasUsed: number;
  effectiveGasPrice: string;
  status: number;
}
