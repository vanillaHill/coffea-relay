# Coffea Relay Integration Guide

## Overview

This guide demonstrates how to integrate the Coffea Relay Service with existing applications, particularly the Coffea Engine ecosystem. The service provides a drop-in replacement for Gelato Network's relay service with identical API compatibility.

## Quick Start Integration

### Existing Gelato Integration Migration

If you're currently using Gelato Network's relay service, migrating to Coffea Relay requires minimal changes:

**Before (Gelato):**
```typescript
const response = await fetch('https://relay.gelato.digital/relays/v2/sponsored-call', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${GELATO_API_KEY}`
  },
  body: JSON.stringify({
    chainId: 1,
    target: contractAddress,
    data: encodedFunctionCall,
    user: userAddress,
    gasLimit: 500000
  })
});
```

**After (Coffea Relay):**
```typescript
const response = await fetch('http://localhost:3003/api/relay/sponsored-call', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
    // No API key required for self-hosted service
  },
  body: JSON.stringify({
    chainId: 1,
    target: contractAddress,
    data: encodedFunctionCall,
    user: userAddress,
    gasLimit: 500000
  })
});
```

## Coffea Engine Integration

### Updating the Existing Relay Module

The Coffea Engine already has relay abstraction in place. Here's how to integrate the custom relay service:

**1. Update Environment Variables**

Add to your `.env` file:
```bash
# Disable Gelato
GELATO_ENABLED=false

# Enable custom relay
CUSTOM_RELAY_ENABLED=true
CUSTOM_RELAY_URL=http://localhost:3003/api
```

**2. Create Custom Relay Service**

Create a new service that implements the existing `IRelayService` interface:

```typescript
// src/relay/services/coffea-relay.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { 
  RelayTransactionRequest, 
  RelayTransactionResponse, 
  RelayTaskStatus,
  IRelayService 
} from '../interfaces/relay.interface';

@Injectable()
export class CoffeaRelayService implements IRelayService {
  private readonly logger = new Logger(CoffeaRelayService.name);
  private readonly baseUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.baseUrl = this.configService.get<string>('CUSTOM_RELAY_URL');
  }

  async submitTransaction(request: RelayTransactionRequest): Promise<RelayTransactionResponse> {
    try {
      const response = await this.httpService.axiosRef.post(
        `${this.baseUrl}/relay/sponsored-call`,
        request
      );

      this.logger.log(`Transaction submitted via Coffea Relay: ${response.data.taskId}`, {
        chainId: request.chainId,
        user: request.user,
        target: request.target,
      });

      return response.data;
    } catch (error) {
      this.logger.error('Coffea Relay transaction submission failed:', error);
      throw new Error(`Coffea Relay submission failed: ${error.message}`);
    }
  }

  async getTaskStatus(taskId: string): Promise<RelayTaskStatus> {
    try {
      const response = await this.httpService.axiosRef.get(
        `${this.baseUrl}/relay/status/${taskId}`
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get task status from Coffea Relay: ${taskId}`, error);
      throw new Error(`Task status retrieval failed: ${error.message}`);
    }
  }

  async cancelTask(taskId: string): Promise<boolean> {
    try {
      const response = await this.httpService.axiosRef.delete(
        `${this.baseUrl}/relay/cancel/${taskId}`
      );

      return response.data.success;
    } catch (error) {
      this.logger.error(`Failed to cancel task via Coffea Relay: ${taskId}`, error);
      return false;
    }
  }

  isSupported(chainId: number): boolean {
    // Same chains as Coffea Relay Service
    return [1, 11155111, 31337].includes(chainId);
  }
}
```

**3. Update Relay Manager Service**

Modify the existing `RelayManagerService` to use the custom relay:

```typescript
// src/relay/services/relay-manager.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GelatoRelayService } from './gelato-relay.service';
import { CoffeaRelayService } from './coffea-relay.service';
import { IRelayService } from '../interfaces/relay.interface';

@Injectable()
export class RelayManagerService {
  private readonly logger = new Logger(RelayManagerService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly gelatoRelayService: GelatoRelayService,
    private readonly coffeaRelayService: CoffeaRelayService,
  ) {}

  private getRelayService(chainId: number): IRelayService | null {
    const customRelayEnabled = this.configService.get<string>('CUSTOM_RELAY_ENABLED') === 'true';
    const gelatoEnabled = this.configService.get<string>('GELATO_ENABLED') === 'true';

    // Prioritize custom relay if enabled
    if (customRelayEnabled && this.coffeaRelayService.isSupported(chainId)) {
      this.logger.log(`Using Coffea Relay for chain ${chainId}`);
      return this.coffeaRelayService;
    }

    // Fallback to Gelato if enabled
    if (gelatoEnabled && this.gelatoRelayService.isSupported(chainId)) {
      this.logger.log(`Using Gelato Relay for chain ${chainId}`);
      return this.gelatoRelayService;
    }

    this.logger.error(`No relay service available for chain ${chainId}`);
    return null;
  }

  // Rest of the RelayManagerService methods remain unchanged
  async submitTransaction(request: RelayTransactionRequest): Promise<RelayTransactionResponse> {
    const relayService = this.getRelayService(request.chainId);
    if (!relayService) {
      throw new Error(`No relay service available for chain ${request.chainId}`);
    }
    return relayService.submitTransaction(request);
  }

  // ... other methods
}
```

**4. Update Relay Module**

Add the new service to the relay module:

```typescript
// src/relay/relay.module.ts
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { RelayManagerService } from './services/relay-manager.service';
import { GelatoRelayService } from './services/gelato-relay.service';
import { CoffeaRelayService } from './services/coffea-relay.service';

@Module({
  imports: [
    HttpModule,
    ConfigModule,
  ],
  providers: [
    RelayManagerService,
    GelatoRelayService,
    CoffeaRelayService, // Add new service
  ],
  exports: [RelayManagerService],
})
export class RelayModule {}
```

## Frontend Integration

### React/TypeScript Integration

Create a React hook for relay integration:

```typescript
// hooks/useRelayService.ts
import { useState, useCallback } from 'react';
import { ethers } from 'ethers';

interface RelayConfig {
  baseUrl: string;
}

interface RelayTransactionRequest {
  chainId: number;
  target: string;
  data: string;
  user: string;
  gasLimit?: number;
}

interface RelayTaskStatus {
  taskId: string;
  status: 'pending' | 'submitted' | 'success' | 'failed' | 'cancelled';
  transactionHash?: string;
  blockNumber?: number;
  error?: string;
}

export const useRelayService = (config: RelayConfig) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitTransaction = useCallback(async (request: RelayTransactionRequest) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${config.baseUrl}/relay/sponsored-call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Transaction submission failed');
      }

      return result.taskId;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, [config.baseUrl]);

  const getTaskStatus = useCallback(async (taskId: string): Promise<RelayTaskStatus> => {
    const response = await fetch(`${config.baseUrl}/relay/status/${taskId}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }, [config.baseUrl]);

  const monitorTransaction = useCallback(async (
    taskId: string,
    onUpdate: (status: RelayTaskStatus) => void,
    maxAttempts: number = 60
  ) => {
    let attempts = 0;
    
    const poll = async () => {
      try {
        const status = await getTaskStatus(taskId);
        onUpdate(status);

        // Continue polling if transaction is still pending or submitted
        if (status.status === 'pending' || status.status === 'submitted') {
          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(poll, 5000); // Poll every 5 seconds
          } else {
            throw new Error('Transaction monitoring timeout');
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Monitoring failed');
        throw err;
      }
    };

    poll();
  }, [getTaskStatus]);

  return {
    submitTransaction,
    getTaskStatus,
    monitorTransaction,
    isSubmitting,
    error,
  };
};
```

**Usage in React Component:**

```typescript
// components/GaslessTransaction.tsx
import React, { useState } from 'react';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';
import { useRelayService } from '../hooks/useRelayService';

interface Props {
  contractAddress: string;
  functionData: string;
  chainId: number;
}

export const GaslessTransaction: React.FC<Props> = ({
  contractAddress,
  functionData,
  chainId,
}) => {
  const { address } = useAccount();
  const [taskId, setTaskId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('idle');
  const [transactionHash, setTransactionHash] = useState<string | null>(null);

  const relay = useRelayService({
    baseUrl: process.env.NEXT_PUBLIC_RELAY_URL || 'http://localhost:3003/api',
  });

  const handleSubmitTransaction = async () => {
    if (!address) {
      alert('Please connect your wallet');
      return;
    }

    try {
      setStatus('submitting');
      
      const submittedTaskId = await relay.submitTransaction({
        chainId,
        target: contractAddress,
        data: functionData,
        user: address,
      });

      setTaskId(submittedTaskId);
      setStatus('monitoring');

      // Monitor transaction status
      await relay.monitorTransaction(submittedTaskId, (taskStatus) => {
        setStatus(taskStatus.status);
        if (taskStatus.transactionHash) {
          setTransactionHash(taskStatus.transactionHash);
        }
      });

    } catch (error) {
      console.error('Transaction failed:', error);
      setStatus('failed');
    }
  };

  return (
    <div className="gasless-transaction">
      <h3>Gasless Transaction</h3>
      
      <div className="transaction-info">
        <p><strong>Contract:</strong> {contractAddress}</p>
        <p><strong>Chain ID:</strong> {chainId}</p>
        <p><strong>User:</strong> {address}</p>
      </div>

      <button 
        onClick={handleSubmitTransaction}
        disabled={!address || relay.isSubmitting}
        className="submit-button"
      >
        {relay.isSubmitting ? 'Submitting...' : 'Execute Gasless Transaction'}
      </button>

      {status !== 'idle' && (
        <div className="status-info">
          <p><strong>Status:</strong> {status}</p>
          {taskId && <p><strong>Task ID:</strong> {taskId}</p>}
          {transactionHash && (
            <p>
              <strong>Transaction:</strong> 
              <a 
                href={`https://etherscan.io/tx/${transactionHash}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {transactionHash}
              </a>
            </p>
          )}
        </div>
      )}

      {relay.error && (
        <div className="error-info" style={{ color: 'red' }}>
          <p><strong>Error:</strong> {relay.error}</p>
        </div>
      )}
    </div>
  );
};
```

### Vue.js Integration

```typescript
// composables/useRelayService.ts
import { ref, reactive } from 'vue';

export const useRelayService = (baseUrl: string) => {
  const isSubmitting = ref(false);
  const error = ref<string | null>(null);

  const submitTransaction = async (request: RelayTransactionRequest) => {
    isSubmitting.value = true;
    error.value = null;

    try {
      const response = await fetch(`${baseUrl}/relay/sponsored-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message);
      }

      return result.taskId;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error';
      throw err;
    } finally {
      isSubmitting.value = false;
    }
  };

  return {
    submitTransaction,
    isSubmitting: readonly(isSubmitting),
    error: readonly(error),
  };
};
```

## Smart Contract Integration

### Contract Interface for Gasless Transactions

Create a contract that supports gasless execution:

```solidity
// contracts/GaslessExecutor.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title GaslessExecutor
 * @dev Contract for executing gasless transactions via Coffea Relay
 */
contract GaslessExecutor is Ownable, ReentrancyGuard {
    
    // Events
    event GaslessExecution(
        address indexed user,
        address indexed target,
        bytes data,
        bool success,
        bytes returnData
    );
    
    event RelayerAdded(address indexed relayer);
    event RelayerRemoved(address indexed relayer);
    
    // State variables
    mapping(address => bool) public authorizedRelayers;
    mapping(bytes32 => bool) public executedTransactions;
    
    // Modifiers
    modifier onlyAuthorizedRelayer() {
        require(authorizedRelayers[msg.sender], "GaslessExecutor: unauthorized relayer");
        _;
    }
    
    modifier notExecuted(bytes32 txHash) {
        require(!executedTransactions[txHash], "GaslessExecutor: transaction already executed");
        _;
    }
    
    constructor(address initialRelayer) {
        authorizedRelayers[initialRelayer] = true;
        emit RelayerAdded(initialRelayer);
    }
    
    /**
     * @dev Execute a gasless transaction on behalf of a user
     * @param user The user address
     * @param target The target contract address
     * @param data The function call data
     * @param nonce User's transaction nonce
     * @param signature User's signature for the transaction
     */
    function executeGasless(
        address user,
        address target,
        bytes calldata data,
        uint256 nonce,
        bytes calldata signature
    ) external onlyAuthorizedRelayer nonReentrant {
        
        // Create transaction hash
        bytes32 txHash = keccak256(abi.encodePacked(
            user,
            target,
            data,
            nonce,
            block.chainid
        ));
        
        // Prevent replay attacks
        require(!executedTransactions[txHash], "Transaction already executed");
        executedTransactions[txHash] = true;
        
        // Verify signature
        require(_verifySignature(txHash, signature, user), "Invalid signature");
        
        // Execute the transaction
        (bool success, bytes memory returnData) = target.call(data);
        
        emit GaslessExecution(user, target, data, success, returnData);
        
        // Optionally revert if the call failed
        require(success, "Target transaction failed");
    }
    
    /**
     * @dev Verify user signature
     */
    function _verifySignature(
        bytes32 hash,
        bytes memory signature,
        address signer
    ) internal pure returns (bool) {
        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", hash)
        );
        
        return _recoverSigner(ethSignedMessageHash, signature) == signer;
    }
    
    /**
     * @dev Recover signer from signature
     */
    function _recoverSigner(
        bytes32 hash,
        bytes memory signature
    ) internal pure returns (address) {
        require(signature.length == 65, "Invalid signature length");
        
        bytes32 r;
        bytes32 s;
        uint8 v;
        
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }
        
        return ecrecover(hash, v, r, s);
    }
    
    /**
     * @dev Add authorized relayer
     */
    function addRelayer(address relayer) external onlyOwner {
        authorizedRelayers[relayer] = true;
        emit RelayerAdded(relayer);
    }
    
    /**
     * @dev Remove authorized relayer
     */
    function removeRelayer(address relayer) external onlyOwner {
        authorizedRelayers[relayer] = false;
        emit RelayerRemoved(relayer);
    }
}
```

### Integration with Strategy Contracts

Update existing strategy contracts to support gasless execution:

```solidity
// contracts/StrategyExecutor.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./GaslessExecutor.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract StrategyExecutor is GaslessExecutor {
    
    struct Strategy {
        address tokenIn;
        address tokenOut;
        address protocol;
        uint256 amount;
        bytes protocolData;
    }
    
    event StrategyExecuted(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );
    
    constructor(address relayer) GaslessExecutor(relayer) {}
    
    /**
     * @dev Execute a DeFi strategy gaslessly
     */
    function executeStrategy(
        Strategy calldata strategy,
        address user,
        uint256 nonce,
        bytes calldata signature
    ) external onlyAuthorizedRelayer {
        
        // Create strategy hash
        bytes32 strategyHash = keccak256(abi.encode(
            strategy,
            user,
            nonce,
            block.chainid
        ));
        
        // Verify signature and prevent replay
        require(!executedTransactions[strategyHash], "Strategy already executed");
        require(_verifySignature(strategyHash, signature, user), "Invalid signature");
        
        executedTransactions[strategyHash] = true;
        
        // Execute strategy logic
        uint256 balanceBefore = IERC20(strategy.tokenOut).balanceOf(user);
        
        // Transfer tokens from user
        IERC20(strategy.tokenIn).transferFrom(user, address(this), strategy.amount);
        
        // Execute protocol interaction
        (bool success,) = strategy.protocol.call(strategy.protocolData);
        require(success, "Protocol interaction failed");
        
        uint256 balanceAfter = IERC20(strategy.tokenOut).balanceOf(user);
        uint256 amountOut = balanceAfter - balanceBefore;
        
        emit StrategyExecuted(
            user,
            strategy.tokenIn,
            strategy.tokenOut,
            strategy.amount,
            amountOut
        );
    }
}
```

## WebSocket Integration for Real-time Updates

### Server-side WebSocket Implementation

```typescript
// src/relay/gateways/relay.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class RelayGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger = new Logger(RelayGateway.name);
  private clients = new Map<string, string[]>(); // userId -> socketIds

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    // Remove client from all user subscriptions
    for (const [userId, socketIds] of this.clients.entries()) {
      const index = socketIds.indexOf(client.id);
      if (index > -1) {
        socketIds.splice(index, 1);
        if (socketIds.length === 0) {
          this.clients.delete(userId);
        }
      }
    }
  }

  @SubscribeMessage('subscribe-task')
  handleSubscribeTask(client: Socket, payload: { taskId: string; userId: string }) {
    const { taskId, userId } = payload;
    
    // Add client to user's socket list
    if (!this.clients.has(userId)) {
      this.clients.set(userId, []);
    }
    this.clients.get(userId).push(client.id);
    
    // Join task-specific room
    client.join(`task-${taskId}`);
    
    this.logger.log(`Client ${client.id} subscribed to task ${taskId}`);
  }

  @SubscribeMessage('unsubscribe-task')
  handleUnsubscribeTask(client: Socket, payload: { taskId: string }) {
    const { taskId } = payload;
    client.leave(`task-${taskId}`);
    this.logger.log(`Client ${client.id} unsubscribed from task ${taskId}`);
  }

  // Method to send task updates to subscribers
  sendTaskUpdate(taskId: string, status: any) {
    this.server.to(`task-${taskId}`).emit('task-update', {
      taskId,
      status,
      timestamp: new Date().toISOString(),
    });
  }
}
```

### Client-side WebSocket Integration

```typescript
// hooks/useRelayWebSocket.ts
import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface TaskUpdate {
  taskId: string;
  status: any;
  timestamp: string;
}

export const useRelayWebSocket = (url: string, userId: string) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [taskUpdates, setTaskUpdates] = useState<TaskUpdate[]>([]);

  useEffect(() => {
    const newSocket = io(url);
    
    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to relay WebSocket');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from relay WebSocket');
    });

    newSocket.on('task-update', (update: TaskUpdate) => {
      setTaskUpdates(prev => [...prev, update]);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [url]);

  const subscribeToTask = useCallback((taskId: string) => {
    if (socket) {
      socket.emit('subscribe-task', { taskId, userId });
    }
  }, [socket, userId]);

  const unsubscribeFromTask = useCallback((taskId: string) => {
    if (socket) {
      socket.emit('unsubscribe-task', { taskId });
    }
  }, [socket]);

  return {
    isConnected,
    taskUpdates,
    subscribeToTask,
    unsubscribeFromTask,
  };
};
```

## Testing Integration

### Integration Test Example

```typescript
// test/relay-integration.test.ts
import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { CoffeaRelayService } from '../src/relay/services/coffea-relay.service';

describe('Coffea Relay Integration', () => {
  let service: CoffeaRelayService;
  let httpService: HttpService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoffeaRelayService,
        {
          provide: HttpService,
          useValue: {
            axiosRef: {
              post: jest.fn(),
              get: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key) => {
              if (key === 'CUSTOM_RELAY_URL') return 'http://localhost:3003/api';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<CoffeaRelayService>(CoffeaRelayService);
    httpService = module.get<HttpService>(HttpService);
  });

  describe('submitTransaction', () => {
    const mockRequest = {
      chainId: 1,
      target: '0x1234567890123456789012345678901234567890',
      data: '0xabcdef',
      user: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef',
    };

    it('should submit transaction successfully', async () => {
      const mockResponse = {
        data: {
          taskId: 'test-task-id',
          success: true,
          message: 'Transaction submitted successfully',
        },
      };

      jest.spyOn(httpService.axiosRef, 'post').mockResolvedValue(mockResponse);

      const result = await service.submitTransaction(mockRequest);

      expect(result).toEqual(mockResponse.data);
      expect(httpService.axiosRef.post).toHaveBeenCalledWith(
        'http://localhost:3003/api/relay/sponsored-call',
        mockRequest
      );
    });

    it('should handle submission errors', async () => {
      jest.spyOn(httpService.axiosRef, 'post').mockRejectedValue(
        new Error('Network error')
      );

      await expect(service.submitTransaction(mockRequest)).rejects.toThrow(
        'Coffea Relay submission failed: Network error'
      );
    });
  });

  describe('getTaskStatus', () => {
    it('should retrieve task status successfully', async () => {
      const mockTaskId = 'test-task-id';
      const mockResponse = {
        data: {
          taskId: mockTaskId,
          status: 'success',
          transactionHash: '0x1234567890abcdef',
        },
      };

      jest.spyOn(httpService.axiosRef, 'get').mockResolvedValue(mockResponse);

      const result = await service.getTaskStatus(mockTaskId);

      expect(result).toEqual(mockResponse.data);
      expect(httpService.axiosRef.get).toHaveBeenCalledWith(
        `http://localhost:3003/api/relay/status/${mockTaskId}`
      );
    });
  });

  describe('isSupported', () => {
    it('should return true for supported chains', () => {
      expect(service.isSupported(1)).toBe(true);      // Mainnet
      expect(service.isSupported(11155111)).toBe(true); // Sepolia
      expect(service.isSupported(31337)).toBe(true);   // Hardhat
    });

    it('should return false for unsupported chains', () => {
      expect(service.isSupported(137)).toBe(false);   // Polygon
      expect(service.isSupported(42161)).toBe(false); // Arbitrum
    });
  });
});
```

### End-to-End Test

```typescript
// test/e2e/relay-e2e.test.ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Relay Service E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/api/relay/sponsored-call (POST)', () => {
    it('should submit a gasless transaction', async () => {
      const transactionRequest = {
        chainId: 31337, // Hardhat local chain
        target: '0x1234567890123456789012345678901234567890',
        data: '0xa9059cbb000000000000000000000000abcdefabcdefabcdefabcdefabcdefabcdefabcdef0000000000000000000000000000000000000000000000000de0b6b3a7640000',
        user: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef',
      };

      const response = await request(app.getHttpServer())
        .post('/api/relay/sponsored-call')
        .send(transactionRequest)
        .expect(200);

      expect(response.body).toHaveProperty('taskId');
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.taskId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('should reject invalid requests', async () => {
      const invalidRequest = {
        chainId: 999, // Unsupported chain
        target: 'invalid-address',
        data: '0xabcdef',
        user: 'invalid-user',
      };

      await request(app.getHttpServer())
        .post('/api/relay/sponsored-call')
        .send(invalidRequest)
        .expect(400);
    });
  });

  describe('/api/relay/status/:taskId (GET)', () => {
    it('should return task status', async () => {
      // First submit a transaction
      const transactionRequest = {
        chainId: 31337,
        target: '0x1234567890123456789012345678901234567890',
        data: '0xabcdef',
        user: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef',
      };

      const submitResponse = await request(app.getHttpServer())
        .post('/api/relay/sponsored-call')
        .send(transactionRequest);

      const taskId = submitResponse.body.taskId;

      // Then check status
      const statusResponse = await request(app.getHttpServer())
        .get(`/api/relay/status/${taskId}`)
        .expect(200);

      expect(statusResponse.body).toHaveProperty('taskId', taskId);
      expect(statusResponse.body).toHaveProperty('status');
      expect(statusResponse.body).toHaveProperty('chainId', 31337);
    });

    it('should return 404 for non-existent task', async () => {
      const nonExistentTaskId = '00000000-0000-0000-0000-000000000000';
      
      await request(app.getHttpServer())
        .get(`/api/relay/status/${nonExistentTaskId}`)
        .expect(404);
    });
  });

  describe('/api/health (GET)', () => {
    it('should return health status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });
  });
});
```

## Production Deployment Integration

### Docker Compose for Full Stack

```yaml
# docker-compose.full-stack.yml
version: '3.8'

services:
  # Coffea Relay Service
  coffea-relay:
    build: ./coffea-relay
    ports:
      - "3003:3003"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://coffea:password@postgres:5432/coffea_relay
      - RPC_URL_MAINNET=${RPC_URL_MAINNET}
      - RPC_URL_SEPOLIA=${RPC_URL_SEPOLIA}
      - RELAY_PRIVATE_KEY=${RELAY_PRIVATE_KEY}
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  # Coffea Engine (updated to use custom relay)
  coffea-engine:
    build: ./coffea-engine
    ports:
      - "3002:3002"
    environment:
      - NODE_ENV=production
      - GELATO_ENABLED=false
      - CUSTOM_RELAY_ENABLED=true
      - CUSTOM_RELAY_URL=http://coffea-relay:3003/api
    depends_on:
      - coffea-relay
      - postgres
    restart: unless-stopped

  # Coffea API
  coffea-api:
    build: ./coffea-api
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - STRATEGY_ENGINE_URL=http://coffea-engine:3002
    depends_on:
      - coffea-engine
    restart: unless-stopped

  # Frontend
  coffea-frontend:
    build: ./coffea
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:3001
      - NEXT_PUBLIC_RELAY_URL=http://localhost:3003/api
    depends_on:
      - coffea-api
    restart: unless-stopped

  # Shared Database
  postgres:
    image: postgres:14-alpine
    environment:
      - POSTGRES_DB=coffea
      - POSTGRES_USER=coffea
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  # Shared Cache
  redis:
    image: redis:6-alpine
    volumes:
      - redis_data:/data
    restart: unless-stopped

  # Load Balancer
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
    depends_on:
      - coffea-frontend
      - coffea-api
      - coffea-relay
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

This integration guide provides comprehensive coverage for integrating the Coffea Relay Service with existing applications, frontend frameworks, smart contracts, and the broader Coffea ecosystem.