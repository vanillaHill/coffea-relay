# Coffea Relay Service

A custom blockchain transaction relay service that provides gasless transaction execution for DeFi strategies. Built as a cost-effective alternative to Gelato Network's relay service.

## Features

- **Gasless Transactions**: Users can execute DeFi strategies without paying gas fees
- **Multi-Chain Support**: Ethereum Mainnet, Sepolia testnet, and Hardhat development
- **Compatible API**: Drop-in replacement for Gelato relay with the same interface
- **Transaction Monitoring**: Real-time status tracking with WebSocket and polling support
- **Cost Optimization**: No premium fees, only actual gas costs
- **Robust Security**: Secure transaction signing and validation
- **Comprehensive Logging**: Full transaction history and analytics

## Architecture

### Core Components

- **Relay Service**: Main transaction submission and monitoring service
- **Wallet Manager**: Secure private key management and transaction signing
- **Gas Estimator**: Intelligent gas price prediction and optimization
- **Status Tracker**: Real-time transaction status monitoring
- **Database**: Transaction logging and analytics storage

### API Endpoints

- `POST /relay/sponsored-call` - Submit gasless transaction
- `GET /relay/status/:taskId` - Get transaction status
- `DELETE /relay/cancel/:taskId` - Cancel pending transaction
- `GET /relay/health` - Service health check

## Installation

```bash
# Install dependencies
yarn install

# Copy environment configuration
cp .env.example .env

# Edit configuration
nano .env

# Start development server
yarn start:dev
```

## Configuration

Key environment variables:

- `RELAY_PRIVATE_KEY`: Private key for the relay wallet (keep secure!)
- `RPC_URL_*`: Blockchain RPC endpoints for each network
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection for caching

## API Compatibility

This service implements the same API interface as Gelato relay:

```typescript
// Submit transaction
const response = await fetch('/relay/sponsored-call', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    chainId: 1,
    target: '0x...',
    data: '0x...',
    user: '0x...',
    gasLimit: 500000
  })
});

// Monitor status
const status = await fetch(`/relay/status/${taskId}`);
```

## Integration with Coffea Engine

To use this relay service in your Coffea Engine:

1. Update `.env` in coffea-engine:
```bash
GELATO_ENABLED=false
CUSTOM_RELAY_ENABLED=true
CUSTOM_RELAY_URL=http://localhost:3003
```

2. The existing `RelayManagerService` will automatically route to the custom relay.

## Development

```bash
# Start development server
yarn start:dev

# Run tests
yarn test

# Run e2e tests
yarn test:e2e

# Build for production
yarn build

# Start production server
yarn start:prod
```

## Security Considerations

- Store private keys securely (use hardware wallets in production)
- Implement proper API authentication
- Monitor for suspicious transaction patterns
- Set appropriate gas limits and spending caps
- Use SSL/TLS for all API communication

## Cost Benefits

Compared to Gelato Network:

- **No premium fees**: Save 8-10% on every transaction
- **No monthly costs**: No $89-599/month subscription fees
- **No request limits**: Handle unlimited transaction volume
- **Full control**: Customize gas optimization strategies

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.