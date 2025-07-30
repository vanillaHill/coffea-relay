# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Building and Running
- `npm run build` - Build the NestJS application
- `npm run start` - Start the production server
- `npm run start:dev` - Start development server with hot reload
- `npm run start:debug` - Start with debug mode and hot reload
- `npm run start:prod` - Start production server from built files

### Testing
- `npm test` - Run unit tests with Jest
- `npm run test:watch` - Run tests in watch mode
- `npm run test:cov` - Run tests with coverage report
- `npm run test:debug` - Run tests with Node.js debugger
- `npm run test:e2e` - Run end-to-end tests

### Code Quality
- `npm run lint` - Run ESLint and auto-fix issues
- `npm run format` - Format code with Prettier

## Architecture Overview

This is a **NestJS-based blockchain transaction relay service** that provides gasless transaction execution for DeFi strategies. It serves as a custom alternative to Gelato Network's relay service.

### Core Architecture Pattern
The application follows NestJS modular architecture with clear separation of concerns:

```
AppModule (Root)
├── ConfigModule (Global environment configuration)
├── DatabaseModule (PostgreSQL + TypeORM)
├── RelayModule (Core relay functionality)
└── HealthModule (Service monitoring)
```

### Key Services in RelayModule
- **RelayService**: Main orchestration and business logic for transaction relaying
- **WalletService**: Blockchain interaction and transaction signing using ethers.js
- **GasEstimatorService**: Intelligent gas price calculation and optimization
- **TaskTrackerService**: Database persistence and real-time status tracking

### Database Design
- **RelayTask Entity**: Core data model tracking complete transaction lifecycle
- Uses TypeORM with PostgreSQL for persistence
- Indexed fields for efficient querying by user, chain, and status
- Supports both legacy gas pricing and EIP-1559 transactions

### Multi-Chain Support
- Ethereum Mainnet (chainId: 1)
- Sepolia Testnet (chainId: 11155111) 
- Hardhat Development (chainId: 31337)
- RPC endpoints configured via `RPC_URL_*` environment variables

## API Endpoints

The service implements Gelato-compatible API:
- `POST /relay/sponsored-call` - Submit gasless transactions
- `GET /relay/status/:taskId` - Monitor transaction status
- `DELETE /relay/cancel/:taskId` - Cancel pending transactions
- `GET /relay/health` - Service health monitoring

## Environment Configuration

Critical environment variables:
- `RELAY_PRIVATE_KEY` - Private key for transaction signing (keep secure!)
- `RPC_URL_*` - Blockchain RPC endpoints for each supported network
- `DATABASE_SERVICE_URL` - Coffea Database service API endpoint
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` - Redis connection configuration for caching
- `NODE_ENV` - Application environment (development/production)
- `PORT` - HTTP server port (default: 3003)

## Key Implementation Details

### Transaction Flow
1. API receives gasless transaction request via RelayController
2. RelayService validates and creates RelayTask entity
3. GasEstimatorService calculates optimal gas parameters
4. WalletService signs and submits transaction to blockchain
5. TaskTrackerService monitors transaction status and updates database
6. Real-time monitoring with 5-second polling intervals and 5-minute timeout

### Gas Optimization
- Supports both legacy gas pricing and EIP-1559
- Intelligent gas estimation based on network conditions
- Gas parameters stored as strings to handle large BigInt values
- Multi-speed pricing (slow/standard/fast) with caching
- Gas price multipliers for safety buffers and optimization

### Security Considerations
- Private keys managed securely through WalletService
- All user addresses normalized to lowercase for consistency
- Transaction validation and error handling throughout the pipeline
- Comprehensive logging for security monitoring
- Gas limit enforcement to prevent abuse
- Chain-specific validation rules

### Performance Features
- Gas price caching with 60-second TTL
- Database connection pooling
- Strategic indexing for efficient queries
- Asynchronous transaction monitoring
- Health checks for all components

## Cost Benefits vs Gelato Network

### Economic Advantages
- **No Premium Fees**: Eliminates 8-10% markup on gas costs
- **No Subscription Costs**: No $89-599/month recurring fees  
- **Volume Scaling**: No artificial request limits or rate restrictions
- **Full Cost Control**: Direct gas cost management and optimization

### Technical Benefits
- **Custom Optimization**: Tailored gas estimation and pricing strategies
- **Data Ownership**: Complete transaction analytics and user insights
- **Infrastructure Control**: No dependency on third-party service availability
- **Integration Flexibility**: Custom features and API extensions

## Integration Notes

### Coffea Engine Integration
This service is designed to integrate with the Coffea Engine by:
1. Setting `GELATO_ENABLED=false` and `CUSTOM_RELAY_ENABLED=true`
2. Configuring `CUSTOM_RELAY_URL` to point to this service
3. Using the existing RelayManagerService which automatically routes to the custom relay
4. Implementing the same IRelayService interface for seamless compatibility

### Frontend Integration
- React hooks and Vue composables provided
- WebSocket support for real-time transaction updates
- TypeScript types for full API compatibility
- Error handling and retry logic built-in

## Testing Strategy

The codebase includes comprehensive testing at multiple levels:
- **Unit Tests**: Service-level logic and error handling
- **Integration Tests**: Database and external service interactions  
- **E2E Tests**: Full API workflow testing
- **Load Testing**: Performance under high transaction volume

Focus on testing transaction lifecycle, gas estimation accuracy, multi-chain functionality, and error recovery scenarios.

## Deployment Considerations

### Container Support
- Docker and Docker Compose configurations
- Kubernetes manifests for production deployment
- Health check integration for load balancer configuration

### High Availability  
- Stateless design for horizontal scaling
- Database read replicas for query optimization
- Load balancer integration with health checks

### Monitoring
- Application metrics via Prometheus
- Log aggregation with structured JSON logging
- Alert integration for service degradation

The service provides significant cost savings by eliminating Gelato's premium fees while maintaining API compatibility and adding enhanced features for the Coffea ecosystem.