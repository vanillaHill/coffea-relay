import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { RelayService } from '../services/relay.service';
import {
  SubmitTransactionDto,
  TransactionResponseDto,
  TaskStatusDto,
  CancelTaskResponseDto,
} from '../dto/relay.dto';

@ApiTags('relay')
@Controller('relay')
export class RelayController {
  constructor(private readonly relayService: RelayService) {}

  @Post('sponsored-call')
  @ApiOperation({ summary: 'Submit a gasless transaction for execution' })
  @ApiResponse({
    status: 200,
    description: 'Transaction submitted successfully',
    type: TransactionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request parameters',
  })
  @ApiResponse({
    status: 500,
    description: 'Transaction submission failed',
  })
  async submitTransaction(@Body() request: SubmitTransactionDto): Promise<TransactionResponseDto> {
    try {
      const response = await this.relayService.submitTransaction(request);
      return response;
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: error.message || 'Transaction submission failed',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('status/:taskId')
  @ApiOperation({ summary: 'Get transaction status by task ID' })
  @ApiParam({ name: 'taskId', description: 'Unique task identifier' })
  @ApiResponse({
    status: 200,
    description: 'Task status retrieved successfully',
    type: TaskStatusDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Task not found',
  })
  async getTaskStatus(@Param('taskId') taskId: string): Promise<TaskStatusDto> {
    try {
      const status = await this.relayService.getTaskStatus(taskId);
      return status;
    } catch (error) {
      throw new HttpException(
        {
          message: error.message || 'Task not found',
        },
        HttpStatus.NOT_FOUND,
      );
    }
  }

  @Delete('cancel/:taskId')
  @ApiOperation({ summary: 'Cancel a pending transaction' })
  @ApiParam({ name: 'taskId', description: 'Unique task identifier' })
  @ApiResponse({
    status: 200,
    description: 'Task cancellation status',
    type: CancelTaskResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Task not found',
  })
  async cancelTask(@Param('taskId') taskId: string): Promise<CancelTaskResponseDto> {
    try {
      const success = await this.relayService.cancelTask(taskId);
      return {
        success,
        message: success ? 'Task cancelled successfully' : 'Task could not be cancelled',
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: error.message || 'Task cancellation failed',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('health')
  @ApiOperation({ summary: 'Check relay service health' })
  @ApiResponse({
    status: 200,
    description: 'Service health status',
  })
  async getHealth() {
    const supportedChains = [1, 11155111, 31337]; // Mainnet, Sepolia, Hardhat
    const isHealthy = await this.relayService.checkHealth();
    
    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      supportedChains,
      timestamp: new Date().toISOString(),
    };
  }
}