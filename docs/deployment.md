# Coffea Relay Service Deployment Guide

## Overview

This guide covers the deployment of the Coffea Relay Service across different environments, from local development to production-ready infrastructure.

## Prerequisites

### System Requirements

**Minimum System Requirements:**
- **CPU**: 2 cores, 2.4 GHz
- **RAM**: 4 GB
- **Storage**: 20 GB SSD
- **Network**: 100 Mbps internet connection

**Recommended Production Requirements:**
- **CPU**: 4 cores, 3.0 GHz
- **RAM**: 8 GB
- **Storage**: 100 GB SSD
- **Network**: 1 Gbps internet connection

### Software Dependencies

- **Node.js**: v18.0.0 or higher
- **npm/yarn**: Latest stable version
- **PostgreSQL**: v14.0 or higher
- **Redis**: v6.0 or higher (optional, for caching)
- **Docker**: v20.0 or higher (for containerized deployment)

### External Services

- **RPC Providers**: Ethereum node access (Infura, Alchemy, etc.)
- **Database**: PostgreSQL instance
- **Monitoring**: Prometheus/Grafana (optional)
- **Load Balancer**: Nginx, HAProxy, or cloud load balancer

## Environment Configuration

### Environment Variables

Create a `.env` file with the following variables:

```bash
# Application Configuration
NODE_ENV=production
PORT=3003
LOG_LEVEL=info

# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/coffea_relay
REDIS_URL=redis://localhost:6379

# Blockchain RPC Endpoints (Multi-Provider Configuration)
# Primary provider (Alchemy) - Priority 1
ALCHEMY_MAINNET_RPC_URL=https://eth-mainnet.alchemyapi.io/v2/YOUR_PROJECT_ID
ALCHEMY_SEPOLIA_RPC_URL=https://eth-sepolia.alchemyapi.io/v2/YOUR_PROJECT_ID

# Fallback provider (Infura) - Priority 2
INFURA_MAINNET_RPC_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID
INFURA_SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID

# Legacy support - backward compatibility
ETHEREUM_MAINNET_RPC_URL=https://eth-mainnet.alchemyapi.io/v2/YOUR_PROJECT_ID

# Development environment
HARDHAT_MAINNET_RPC_URL=http://localhost:8545

# Relay Service Configuration
RELAY_PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
RELAY_WALLET_ADDRESS=0x742d35Cc6634C0532925a3b8D11B1020532f4567

# Gas Configuration
DEFAULT_GAS_LIMIT=500000
GAS_PRICE_MULTIPLIER=1.1
MAX_GAS_PRICE_GWEI=100

# Monitoring & Security
ENABLE_SWAGGER=false
JWT_SECRET=your_jwt_secret_here
API_KEY_SALT=your_api_key_salt

# Transaction Monitoring
TRANSACTION_TIMEOUT_MS=300000
POLLING_INTERVAL_MS=5000
MAX_RETRY_ATTEMPTS=60
```

### Multi-Provider Failover System

The Coffea Relay Service implements an advanced multi-provider failover system through the `BaseProviderService`, ensuring high availability and reliability:

**Provider Priority System:**
1. **Alchemy** (Priority 1) - Primary provider with best performance
2. **Infura** (Priority 2) - Secondary fallback provider  
3. **Public Nodes** (Priority 3) - Tertiary fallback for maximum redundancy

**Key Features:**
- **Automatic Failover**: Seamlessly switches between providers when one fails
- **Health Monitoring**: Continuous provider health checks with 5-second timeout
- **Provider Statistics**: Real-time monitoring of provider performance
- **Timeout Protection**: 8-second timeout per provider operation
- **Chain-Specific Configuration**: Independent provider management per blockchain

**Configuration Best Practices:**

```bash
# Configure multiple providers for maximum reliability
ALCHEMY_MAINNET_RPC_URL=https://eth-mainnet.alchemyapi.io/v2/YOUR_ALCHEMY_KEY
INFURA_MAINNET_RPC_URL=https://mainnet.infura.io/v3/YOUR_INFURA_KEY

# Optional: Monitor provider performance
# The service automatically logs provider switches and failures
LOG_LEVEL=info  # Set to 'debug' for detailed provider switching logs
```

**Health Check Endpoints:**
- `/api/health` - Overall service health including provider status
- Provider health is automatically monitored and reported in service logs

### Security Considerations

**Private Key Management:**
```bash
# Generate a new private key (development only)
node -e "console.log('0x' + require('crypto').randomBytes(32).toString('hex'))"

# Production: Use hardware wallets or key management services
# - AWS KMS
# - Azure Key Vault
# - HashiCorp Vault
```

**Database Security:**
```bash
# Create dedicated database user with minimal permissions
sudo -u postgres psql
CREATE USER coffea_relay WITH PASSWORD 'secure_password';
CREATE DATABASE coffea_relay OWNER coffea_relay;
GRANT CONNECT ON DATABASE coffea_relay TO coffea_relay;
GRANT ALL PRIVILEGES ON DATABASE coffea_relay TO coffea_relay;
```

## Deployment Methods

### 1. Local Development Deployment

**Setup:**
```bash
# Clone repository
git clone https://github.com/your-org/coffea-relay.git
cd coffea-relay

# Install dependencies
yarn install

# Setup environment
cp .env.example .env
# Edit .env with your configuration

# Setup database
yarn db:setup

# Start development server
yarn start:dev
```

**Development Database Setup:**
```bash
# Start PostgreSQL (using Docker)
docker run --name coffea-postgres \
  -e POSTGRES_DB=coffea_relay \
  -e POSTGRES_USER=coffea_relay \
  -e POSTGRES_PASSWORD=dev_password \
  -p 5432:5432 \
  -d postgres:14

# Start Redis (optional)
docker run --name coffea-redis \
  -p 6379:6379 \
  -d redis:6-alpine
```

### 2. Docker Deployment

**Dockerfile:**
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN yarn install --frozen-lockfile

# Copy source code
COPY . .

# Build application
RUN yarn build

# Expose port
EXPOSE 3003

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3003/api/health || exit 1

# Start application
CMD ["yarn", "start:prod"]
```

**Docker Compose:**
```yaml
version: '3.8'

services:
  coffea-relay:
    build: .
    ports:
      - "3003:3003"
    environment:
      - NODE_ENV=production
      - PORT=3003
      - DATABASE_URL=postgresql://coffea_relay:password@postgres:5432/coffea_relay
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped

  postgres:
    image: postgres:14-alpine
    environment:
      - POSTGRES_DB=coffea_relay
      - POSTGRES_USER=coffea_relay
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init.sql:/docker-entrypoint-initdb.d/init.sql
    restart: unless-stopped

  redis:
    image: redis:6-alpine
    volumes:
      - redis_data:/data
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - coffea-relay
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

**Build and Deploy:**
```bash
# Build and start services
docker-compose up -d

# View logs
docker-compose logs -f coffea-relay

# Scale service
docker-compose up -d --scale coffea-relay=3
```

### 3. Kubernetes Deployment

**Namespace:**
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: coffea-relay
```

**ConfigMap:**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: coffea-relay-config
  namespace: coffea-relay
data:
  NODE_ENV: "production"
  PORT: "3003"
  LOG_LEVEL: "info"
  DEFAULT_GAS_LIMIT: "500000"
  GAS_PRICE_MULTIPLIER: "1.1"
  MAX_GAS_PRICE_GWEI: "100"
  TRANSACTION_TIMEOUT_MS: "300000"
  POLLING_INTERVAL_MS: "5000"
  MAX_RETRY_ATTEMPTS: "60"
```

**Secret:**
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: coffea-relay-secrets
  namespace: coffea-relay
type: Opaque
data:
  DATABASE_URL: <base64-encoded-database-url>
  RELAY_PRIVATE_KEY: <base64-encoded-private-key>
  RPC_URL_MAINNET: <base64-encoded-rpc-url>
  RPC_URL_SEPOLIA: <base64-encoded-rpc-url>
  JWT_SECRET: <base64-encoded-jwt-secret>
```

**Deployment:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: coffea-relay
  namespace: coffea-relay
spec:
  replicas: 3
  selector:
    matchLabels:
      app: coffea-relay
  template:
    metadata:
      labels:
        app: coffea-relay
    spec:
      containers:
      - name: coffea-relay
        image: coffea/relay:latest
        ports:
        - containerPort: 3003
        envFrom:
        - configMapRef:
            name: coffea-relay-config
        - secretRef:
            name: coffea-relay-secrets
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3003
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3003
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
```

**Service:**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: coffea-relay-service
  namespace: coffea-relay
spec:
  selector:
    app: coffea-relay
  ports:
  - port: 80
    targetPort: 3003
  type: ClusterIP
```

**Ingress:**
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: coffea-relay-ingress
  namespace: coffea-relay
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "100"
spec:
  tls:
  - hosts:
    - relay.coffea.io
    secretName: coffea-relay-tls
  rules:
  - host: relay.coffea.io
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: coffea-relay-service
            port:
              number: 80
```

**Deploy to Kubernetes:**
```bash
# Apply configurations
kubectl apply -f k8s/

# Check deployment status
kubectl get pods -n coffea-relay

# View logs
kubectl logs -f deployment/coffea-relay -n coffea-relay

# Scale deployment
kubectl scale deployment coffea-relay --replicas=5 -n coffea-relay
```

### 4. Cloud Provider Deployments

#### AWS ECS Deployment

**Task Definition:**
```json
{
  "family": "coffea-relay",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::account:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "coffea-relay",
      "image": "your-account.dkr.ecr.region.amazonaws.com/coffea-relay:latest",
      "portMappings": [
        {
          "containerPort": 3003,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:coffea-relay/database-url"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/coffea-relay",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

#### GCP Cloud Run Deployment

**Deploy to Cloud Run:**
```bash
# Build and push image
gcloud builds submit --tag gcr.io/PROJECT_ID/coffea-relay

# Deploy to Cloud Run
gcloud run deploy coffea-relay \
  --image gcr.io/PROJECT_ID/coffea-relay \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --concurrency 100 \
  --max-instances 10 \
  --set-env-vars NODE_ENV=production \
  --set-secrets DATABASE_URL=database-url:latest
```

## Database Migration and Setup

### Initial Database Setup

**Migration Script:**
```sql
-- Create database and user
CREATE DATABASE coffea_relay;
CREATE USER coffea_relay WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE coffea_relay TO coffea_relay;

-- Connect to database
\c coffea_relay;

-- Create tables
CREATE TABLE relay_tasks (
  id SERIAL PRIMARY KEY,
  task_id VARCHAR(36) UNIQUE NOT NULL,
  chain_id INTEGER NOT NULL,
  target VARCHAR(42) NOT NULL,
  data TEXT NOT NULL,
  user_address VARCHAR(42) NOT NULL,
  gas_limit INTEGER,
  gas_price VARCHAR(32),
  max_fee_per_gas VARCHAR(32),
  max_priority_fee_per_gas VARCHAR(32),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  transaction_hash VARCHAR(66),
  block_number INTEGER,
  gas_used INTEGER,
  effective_gas_price VARCHAR(32),
  error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient querying
CREATE INDEX idx_relay_tasks_user_created ON relay_tasks(user_address, created_at);
CREATE INDEX idx_relay_tasks_chain_status ON relay_tasks(chain_id, status);
CREATE INDEX idx_relay_tasks_task_id ON relay_tasks(task_id);
CREATE UNIQUE INDEX idx_relay_tasks_tx_hash ON relay_tasks(transaction_hash) WHERE transaction_hash IS NOT NULL;

-- Create update trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_relay_tasks_updated_at 
  BEFORE UPDATE ON relay_tasks 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Migration Commands

```bash
# Run migrations
yarn migration:run

# Generate new migration
yarn migration:generate -n AddNewColumn

# Revert migration
yarn migration:revert

# Check migration status
yarn migration:show
```

## Monitoring and Logging

### Application Monitoring

**Prometheus Metrics Endpoint:**
```typescript
// Add to main.ts
import { PrometheusModule } from '@willsoto/nestjs-prometheus';

// Metrics available at /metrics
```

**Custom Metrics:**
```typescript
// Transaction metrics
transaction_total{status="success|failed", chain_id="1"}
transaction_duration_seconds{chain_id="1"}
gas_used_total{chain_id="1"}
gas_price_gwei{chain_id="1", speed="slow|standard|fast"}

// Service metrics
http_requests_total{method="GET|POST", status_code="200"}
database_connections_active
wallet_balance_eth{chain_id="1"}
```

### Log Configuration

**Winston Logger Setup:**
```typescript
// logger.config.ts
import winston from 'winston';

export const loggerConfig = {
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
};
```

### Health Monitoring

**Health Check Endpoints:**
- `GET /api/health` - Basic health status
- `GET /api/health/detailed` - Component-level health
- `GET /metrics` - Prometheus metrics

**Monitoring Setup with Grafana:**
```yaml
# grafana-dashboard.json
{
  "dashboard": {
    "title": "Coffea Relay Service",
    "panels": [
      {
        "title": "Transaction Success Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(transaction_total{status=\"success\"}[5m]) / rate(transaction_total[5m]) * 100"
          }
        ]
      },
      {
        "title": "Average Gas Price",
        "type": "graph",
        "targets": [
          {
            "expr": "avg(gas_price_gwei{speed=\"standard\"})"
          }
        ]
      }
    ]
  }
}
```

## Load Balancing and High Availability

### Nginx Configuration

```nginx
upstream coffea_relay {
    server 127.0.0.1:3003 weight=1 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3004 weight=1 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3005 weight=1 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    server_name relay.coffea.io;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name relay.coffea.io;
    
    # SSL Configuration
    ssl_certificate /etc/ssl/certs/coffea-relay.crt;
    ssl_certificate_key /etc/ssl/private/coffea-relay.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;
    
    # Proxy settings
    location /api/ {
        proxy_pass http://coffea_relay;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
        
        # Health check
        proxy_next_upstream error timeout http_500 http_502 http_503 http_504;
    }
    
    # Health check endpoint (bypass rate limiting)
    location /api/health {
        limit_req off;
        proxy_pass http://coffea_relay;
        proxy_set_header Host $host;
    }
}
```

### Database High Availability

**Primary-Replica Setup:**
```bash
# Primary database configuration
# postgresql.conf
wal_level = replica
max_wal_senders = 3
wal_keep_segments = 32
archive_mode = on
archive_command = 'cp %p /var/lib/postgresql/archive/%f'

# pg_hba.conf
host replication replica_user replica_server_ip/32 md5
```

**Connection Pooling with PgBouncer:**
```ini
[databases]
coffea_relay = host=localhost port=5432 dbname=coffea_relay

[pgbouncer]
listen_port = 6432
listen_addr = *
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
server_reset_query = DISCARD ALL
max_client_conn = 100
default_pool_size = 25
```

## Backup and Recovery

### Database Backup

**Automated Backup Script:**
```bash
#!/bin/bash
# backup-database.sh

DB_NAME="coffea_relay"
BACKUP_DIR="/var/backups/coffea-relay"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/coffea_relay_$DATE.sql"

# Create backup directory
mkdir -p $BACKUP_DIR

# Create backup
pg_dump $DB_NAME > $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

# Upload to S3 (optional)
aws s3 cp $BACKUP_FILE.gz s3://coffea-relay-backups/

# Clean old backups (keep last 7 days)
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_FILE.gz"
```

**Crontab Entry:**
```cron
# Daily backup at 2 AM
0 2 * * * /path/to/backup-database.sh
```

### Disaster Recovery

**Recovery Procedure:**
```bash
# 1. Stop application
docker-compose down

# 2. Restore database
gunzip -c backup_file.sql.gz | psql coffea_relay

# 3. Verify data integrity
psql coffea_relay -c "SELECT COUNT(*) FROM relay_tasks;"

# 4. Start application
docker-compose up -d

# 5. Verify health
curl http://localhost:3003/api/health
```

## Performance Tuning

### Database Optimization

**PostgreSQL Configuration:**
```postgresql
# postgresql.conf
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
```

### Application Optimization

**Node.js Performance:**
```bash
# Environment variables for production
NODE_ENV=production
NODE_OPTIONS="--max-old-space-size=2048 --optimize-for-size"
UV_THREADPOOL_SIZE=16
```

**Connection Pooling:**
```typescript
// typeorm.config.ts
{
  type: 'postgres',
  url: process.env.DATABASE_URL,
  extra: {
    max: 20,
    min: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  }
}
```

## Security Hardening

### Network Security

**Firewall Rules:**
```bash
# UFW configuration
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80
ufw allow 443
ufw allow from 10.0.0.0/8 to any port 5432  # Database access
ufw enable
```

### Application Security

**Security Headers:**
```typescript
// main.ts
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
  },
}));
```

### Secret Management

**Using AWS Secrets Manager:**
```typescript
// secrets.service.ts
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

async getSecret(secretName: string): Promise<string> {
  const client = new SecretsManagerClient({ region: "us-east-1" });
  const command = new GetSecretValueCommand({ SecretId: secretName });
  const response = await client.send(command);
  return response.SecretString;
}
```

## Troubleshooting

### Common Issues

**Issue: High Memory Usage**
```bash
# Check memory usage
docker stats coffea-relay
node --max-old-space-size=1024 dist/main.js

# Solution: Increase heap size or add memory limits
```

**Issue: Database Connection Timeout**
```bash
# Check connection pool
psql -c "SELECT * FROM pg_stat_activity WHERE datname = 'coffea_relay';"

# Solution: Adjust connection pool settings
```

**Issue: Transaction Monitoring Delays**
```bash
# Check RPC provider health
curl -X POST $RPC_URL -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Solution: Switch to backup RPC provider
```

### Debugging Tools

**Application Logs:**
```bash
# View real-time logs
docker-compose logs -f coffea-relay

# Search logs
grep "ERROR" logs/combined.log | tail -20

# Structured log analysis
jq '.level == "error"' logs/combined.log
```

**Database Debugging:**
```sql
-- Check slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;

-- Check active connections
SELECT * FROM pg_stat_activity 
WHERE datname = 'coffea_relay';

-- Check table sizes
SELECT schemaname, tablename, 
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

This deployment guide provides comprehensive coverage of all deployment scenarios and operational considerations for the Coffea Relay Service.