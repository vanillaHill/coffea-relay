import {
  IsString,
  IsNumber,
  IsOptional,
  IsEthereumAddress,
  IsHexadecimal,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class SubmitTransactionDto {
  @ApiProperty({ description: "Blockchain network chain ID", example: 1 })
  @IsNumber()
  chainId: number;

  @ApiProperty({ description: "Target contract address", example: "0x..." })
  @IsEthereumAddress()
  target: string;

  @ApiProperty({ description: "Encoded transaction data", example: "0x..." })
  @IsHexadecimal()
  data: string;

  @ApiProperty({ description: "User wallet address", example: "0x..." })
  @IsEthereumAddress()
  user: string;

  @ApiProperty({
    description: "Gas limit for transaction",
    required: false,
    example: 500000,
  })
  @IsOptional()
  @IsNumber()
  gasLimit?: number;

  @ApiProperty({ description: "Gas price in wei (legacy)", required: false })
  @IsOptional()
  @IsString()
  gasPrice?: string;

  @ApiProperty({ description: "Max fee per gas (EIP-1559)", required: false })
  @IsOptional()
  @IsString()
  maxFeePerGas?: string;

  @ApiProperty({
    description: "Max priority fee per gas (EIP-1559)",
    required: false,
  })
  @IsOptional()
  @IsString()
  maxPriorityFeePerGas?: string;
}

export class TransactionResponseDto {
  @ApiProperty({ description: "Unique task identifier" })
  taskId: string;

  @ApiProperty({ description: "Whether submission was successful" })
  success: boolean;

  @ApiProperty({
    description: "Additional information or error message",
    required: false,
  })
  message?: string;
}

export class TaskStatusDto {
  @ApiProperty({ description: "Unique task identifier" })
  taskId: string;

  @ApiProperty({ description: "Blockchain network chain ID" })
  chainId: number;

  @ApiProperty({
    description: "Current task status",
    enum: ["pending", "submitted", "success", "failed", "cancelled"],
  })
  status: string;

  @ApiProperty({
    description: "Transaction hash when submitted",
    required: false,
  })
  transactionHash?: string;

  @ApiProperty({ description: "Block number when confirmed", required: false })
  blockNumber?: number;

  @ApiProperty({ description: "Gas used by transaction", required: false })
  gasUsed?: number;

  @ApiProperty({ description: "Effective gas price paid", required: false })
  effectiveGasPrice?: string;

  @ApiProperty({ description: "Task creation timestamp" })
  createdAt: Date;

  @ApiProperty({ description: "Last update timestamp" })
  updatedAt: Date;

  @ApiProperty({ description: "Error message if failed", required: false })
  error?: string;
}

export class CancelTaskResponseDto {
  @ApiProperty({ description: "Whether cancellation was successful" })
  success: boolean;

  @ApiProperty({ description: "Additional information", required: false })
  message?: string;
}
