# Coffea Relay Service API Reference

## Overview

The Coffea Relay Service provides a RESTful API for gasless transaction execution. This API is designed to be compatible with Gelato Network's relay service, making it a drop-in replacement for existing integrations.

## Base URL

```
# Development
http://localhost:3003/api

# Production (example)
https://relay.coffea.io/api
```

## Authentication

Currently, the service does not require authentication for public endpoints. Future versions may include API key authentication for rate limiting and access control.

## Rate Limiting

- **Default**: 100 requests per minute per IP
- **Burst**: Up to 20 requests in a 10-second window
- **Headers**: Rate limit information in response headers

## API Endpoints

### Relay Endpoints

#### Submit Gasless Transaction

Submit a transaction for gasless execution.

**Endpoint:** `POST /relay/sponsored-call`

**Request Body:**
```typescript
{
  chainId: number;           // Blockchain network ID (1, 11155111, 31337)
  target: string;            // Target contract address (0x...)
  data: string;              // Encoded transaction data (0x...)
  user: string;              // User wallet address (0x...)
  gasLimit?: number;         // Optional gas limit (default: estimated)
  gasPrice?: string;         // Optional gas price in wei (legacy)
  maxFeePerGas?: string;     // Optional max fee per gas (EIP-1559)
  maxPriorityFeePerGas?: string; // Optional priority fee (EIP-1559)
}
```

**Example Request:**
```bash
curl -X POST http://localhost:3003/api/relay/sponsored-call \
  -H "Content-Type: application/json" \
  -d '{
    "chainId": 1,
    "target": "0x1234567890123456789012345678901234567890",
    "data": "0xa9059cbb000000000000000000000000abcdefabcdefabcdefabcdefabcdefabcdefabcdef0000000000000000000000000000000000000000000000000de0b6b3a7640000",
    "user": "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef"
  }'
```

**Response:**
```typescript
{
  taskId: string;    // Unique task identifier
  success: boolean;  // Whether submission was successful
  message?: string;  // Additional information or error message
}
```

**Example Response:**
```json
{
  "taskId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "success": true,
  "message": "Transaction submitted successfully"
}
```

**Status Codes:**
- `200 OK`: Transaction submitted successfully
- `400 Bad Request`: Invalid request parameters
- `500 Internal Server Error`: Transaction submission failed

---

#### Get Transaction Status

Get the current status of a submitted transaction.

**Endpoint:** `GET /relay/status/:taskId`

**Parameters:**
- `taskId`: Unique task identifier from submission response

**Example Request:**
```bash
curl http://localhost:3003/api/relay/status/f47ac10b-58cc-4372-a567-0e02b2c3d479
```

**Response:**
```typescript
{
  taskId: string;              // Unique task identifier
  chainId: number;             // Blockchain network ID
  status: string;              // Current status (pending, submitted, success, failed, cancelled)
  transactionHash?: string;    // Transaction hash (when submitted)
  blockNumber?: number;        // Block number (when confirmed)
  gasUsed?: number;           // Gas consumed by transaction
  effectiveGasPrice?: string; // Actual gas price paid
  createdAt: string;          // Task creation timestamp (ISO 8601)
  updatedAt: string;          // Last update timestamp (ISO 8601)
  error?: string;             // Error message (if failed)
}
```

**Example Response:**
```json
{
  "taskId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "chainId": 1,
  "status": "success",
  "transactionHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  "blockNumber": 18500000,
  "gasUsed": 21000,
  "effectiveGasPrice": "20000000000",
  "createdAt": "2024-01-01T12:00:00.000Z",
  "updatedAt": "2024-01-01T12:01:30.000Z"
}
```

**Status Values:**
- `pending`: Task created, waiting for execution
- `submitted`: Transaction submitted to blockchain
- `success`: Transaction confirmed successfully
- `failed`: Transaction failed or reverted
- `cancelled`: Task cancelled before execution

**Status Codes:**
- `200 OK`: Status retrieved successfully
- `404 Not Found`: Task not found

---

#### Cancel Pending Transaction

Cancel a pending transaction before it's submitted to the blockchain.

**Endpoint:** `DELETE /relay/cancel/:taskId`

**Parameters:**
- `taskId`: Unique task identifier to cancel

**Example Request:**
```bash
curl -X DELETE http://localhost:3003/api/relay/cancel/f47ac10b-58cc-4372-a567-0e02b2c3d479
```

**Response:**
```typescript
{
  success: boolean;  // Whether cancellation was successful
  message?: string;  // Additional information
}
```

**Example Response:**
```json
{
  "success": true,
  "message": "Task cancelled successfully"
}
```

**Status Codes:**
- `200 OK`: Cancellation processed (check success field)
- `404 Not Found`: Task not found

**Notes:**
- Only pending tasks can be cancelled
- Submitted transactions cannot be cancelled
- Cancellation is not guaranteed if execution has already started

---

### Health Endpoints

#### Basic Health Check

Get basic service health status.

**Endpoint:** `GET /health`

**Example Request:**
```bash
curl http://localhost:3003/api/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 12345
}
```

**Status Codes:**
- `200 OK`: Service is healthy
- `503 Service Unavailable`: Service is unhealthy

---

#### Detailed Health Check

Get detailed component health information.

**Endpoint:** `GET /health/detailed`

**Example Request:**
```bash
curl http://localhost:3003/api/health/detailed
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "components": {
    "database": true,
    "wallet": true,
    "gasEstimator": true,
    "taskTracker": true
  },
  "supportedChains": [1, 11155111, 31337],
  "version": "1.0.0"
}
```

## Error Responses

All endpoints return consistent error responses:

```typescript
{
  statusCode: number;    // HTTP status code
  message: string;       // Error description
  error?: string;        // Error type
  timestamp: string;     // Error timestamp
  path: string;         // Request path
}
```

**Example Error Response:**
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "path": "/api/relay/sponsored-call"
}
```

## Common Error Codes

### 400 Bad Request
- Invalid Ethereum address format
- Missing required fields
- Invalid chain ID
- Gas parameters out of range

### 404 Not Found
- Task ID not found
- Endpoint not found

### 500 Internal Server Error
- Database connection issues
- RPC provider failures
- Transaction submission failures
- Unexpected system errors

### 503 Service Unavailable
- Service health check failures
- Maintenance mode
- System overload

## SDK Integration

### JavaScript/TypeScript

```typescript
import axios from 'axios';

class CoffeaRelayClient {
  private baseURL: string;

  constructor(baseURL: string = 'http://localhost:3003/api') {
    this.baseURL = baseURL;
  }

  async submitTransaction(request: {
    chainId: number;
    target: string;
    data: string;
    user: string;
    gasLimit?: number;
  }) {
    const response = await axios.post(`${this.baseURL}/relay/sponsored-call`, request);
    return response.data;
  }

  async getTaskStatus(taskId: string) {
    const response = await axios.get(`${this.baseURL}/relay/status/${taskId}`);
    return response.data;
  }

  async cancelTask(taskId: string) {
    const response = await axios.delete(`${this.baseURL}/relay/cancel/${taskId}`);
    return response.data;
  }

  async checkHealth() {
    const response = await axios.get(`${this.baseURL}/health`);
    return response.data;
  }
}

// Usage example
const relay = new CoffeaRelayClient();

const { taskId } = await relay.submitTransaction({
  chainId: 1,
  target: '0x...',
  data: '0x...',
  user: '0x...'
});

// Monitor status
const status = await relay.getTaskStatus(taskId);
console.log(`Transaction status: ${status.status}`);
```

### Python

```python
import requests
from typing import Optional, Dict, Any

class CoffeaRelayClient:
    def __init__(self, base_url: str = "http://localhost:3003/api"):
        self.base_url = base_url

    def submit_transaction(self, 
                         chain_id: int,
                         target: str,
                         data: str,
                         user: str,
                         gas_limit: Optional[int] = None) -> Dict[str, Any]:
        payload = {
            "chainId": chain_id,
            "target": target,
            "data": data,
            "user": user
        }
        if gas_limit:
            payload["gasLimit"] = gas_limit
            
        response = requests.post(f"{self.base_url}/relay/sponsored-call", json=payload)
        response.raise_for_status()
        return response.json()

    def get_task_status(self, task_id: str) -> Dict[str, Any]:
        response = requests.get(f"{self.base_url}/relay/status/{task_id}")
        response.raise_for_status()
        return response.json()

    def cancel_task(self, task_id: str) -> Dict[str, Any]:
        response = requests.delete(f"{self.base_url}/relay/cancel/{task_id}")
        response.raise_for_status()
        return response.json()

# Usage example
relay = CoffeaRelayClient()

result = relay.submit_transaction(
    chain_id=1,
    target="0x...",
    data="0x...",
    user="0x..."
)

task_id = result["taskId"]
status = relay.get_task_status(task_id)
print(f"Transaction status: {status['status']}")
```

## Webhook Notifications (Future Feature)

Future versions will support webhook notifications for transaction status updates:

```typescript
// Webhook payload example
{
  taskId: string;
  status: string;
  transactionHash?: string;
  blockNumber?: number;
  timestamp: string;
  user: string;
}
```

## API Versioning

The API follows semantic versioning:
- **v1.x**: Current stable version
- **Breaking changes**: Will be introduced in major version updates (v2.x)
- **Backward compatibility**: Maintained within major versions

## OpenAPI Specification

The complete OpenAPI 3.0 specification is available at:
- **Development**: http://localhost:3003/api/docs/json
- **Production**: https://relay.coffea.io/api/docs/json

## Support

For API support and questions:
- **GitHub Issues**: https://github.com/coffea/relay/issues
- **Documentation**: https://docs.coffea.io/relay
- **Discord**: https://discord.gg/coffea