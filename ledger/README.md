# Blockchain Infrastructure for ledger.disease.zone

## Overview

This directory contains the complete blockchain infrastructure for disease.zone, implementing a hybrid multi-chain approach with:

- **Hyperledger Fabric** private consortium for sensitive health data
- **Polygon Supernet** sidechain for research data and marketplace
- **Cross-chain bridges** for interoperability
- **Smart contracts** for tokenization and data marketplace

## Quick Start

### Development Environment

```bash
# Start all blockchain services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f blockchain-api

# Stop all services
docker-compose down
```

### API Access

- **Blockchain API**: http://localhost:4000
- **Health Check**: http://localhost:4000/health
- **API Status**: http://localhost:4000/api/v1/status

### Monitoring

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001 (admin/admin)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    LEDGER.DISEASE.ZONE                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Hyperledger Fabric Network (Private)                      │
│  ├── Hospital Consortium                                    │
│  ├── Research Organizations                                 │
│  ├── Government Agencies                                    │
│  └── Insurance Companies                                    │
│                          │                                  │
│                    Cross-Chain Bridge                       │
│                          ▼                                  │
│                                                             │
│  Polygon Supernet (Health Chain ID: 1337)                  │
│  ├── Anonymized Data Storage                                │
│  ├── Research Data Marketplace                              │
│  ├── HEALTH Token Economics                                 │
│  └── Public Health Analytics                                │
│                          │                                  │
│                    Bridge to Public Chains                 │
│                          ▼                                  │
│                                                             │
│  Public Chains (Ethereum/Polygon)                          │
│  ├── DeFi Integration                                       │
│  ├── Token Trading                                          │
│  └── External Oracles                                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Services

### 1. Blockchain API (Port 4000)
- REST API for blockchain operations
- Integration with main disease.zone platform
- Authentication and rate limiting

### 2. Hyperledger Fabric Network
- **Organizations**: Hospital, Research, Government, Insurance
- **Channels**: healthdata-channel, outbreak-alerts-channel, research-data-channel
- **Chaincode**: health-records for PHI data management

### 3. Polygon Supernet
- **Chain ID**: 1337
- **Validators**: 5 (hospital, research, government, insurance, disease.zone)
- **Performance**: 1000+ TPS
- **Gas**: Low cost transactions

### 4. Smart Contracts

#### HealthToken (HEALTH)
- ERC20 governance token
- Reward mechanism for data contributors
- Payment system for research access
- Deflationary tokenomics

#### DataMarketplace
- NFT-based dataset licensing
- Revenue sharing for data providers
- Quality scoring and compliance verification
- Research collaboration tools

#### HealthDataBridge
- Cross-chain data verification
- Multi-signature validation
- Compliance checking automation

## API Endpoints

### Blockchain Status
```bash
GET /health                           # Service health check
GET /api/v1/status                   # Detailed blockchain status
```

### Hyperledger Fabric
```bash
GET /api/v1/fabric/status            # Fabric network status
POST /api/v1/fabric/records          # Store health record
GET /api/v1/fabric/records/:id       # Query health record
GET /api/v1/fabric/records/:id/audit # Get audit trail
```

### Polygon Supernet
```bash
GET /api/v1/sidechain/status         # Supernet status
POST /api/v1/sidechain/data          # Store anonymized data
GET /api/v1/sidechain/transactions/:hash # Get transaction
GET /api/v1/sidechain/validators     # Get validator info
```

### Cross-Chain Bridge
```bash
GET /api/v1/bridge/status            # Bridge status
POST /api/v1/bridge/proofs           # Submit data proof
GET /api/v1/bridge/proofs/:id        # Get proof status
POST /api/v1/bridge/proofs/:id/validate # Validate proof
```

### HEALTH Token
```bash
GET /api/v1/token/info               # Token information
GET /api/v1/token/balance/:address   # Get token balance
POST /api/v1/token/reward            # Reward data contribution
POST /api/v1/token/payment           # Process research payment
GET /api/v1/token/stats              # Token statistics
```

### Data Marketplace
```bash
GET /api/v1/marketplace/status       # Marketplace status
GET /api/v1/marketplace/datasets     # Available datasets
GET /api/v1/marketplace/datasets/:id # Dataset details
POST /api/v1/marketplace/datasets/:id/purchase # Purchase license
GET /api/v1/marketplace/licenses/:address # User licenses
```

### Integration with Main System
```bash
POST /api/v1/integration/sync/outbreak-detection # Sync outbreak data
POST /api/v1/integration/sync/sti-surveillance   # Sync STI data
POST /api/v1/integration/sync/global-health      # Sync global data
POST /api/v1/integration/verify/data-integrity   # Verify data integrity
GET /api/v1/integration/metrics                  # Get blockchain metrics
```

## Configuration

### Environment Variables

```bash
# Server
PORT=4000
NODE_ENV=development

# Integration
MAIN_API_URL=http://localhost:3000
MAIN_API_KEY=your-integration-key

# Hyperledger Fabric
FABRIC_NETWORK_PATH=./hyperledger/network
FABRIC_WALLET_PATH=./hyperledger/wallet
FABRIC_CHANNEL_NAME=healthdata-channel
FABRIC_CHAINCODE_NAME=health-records

# Polygon Supernet
SUPERNET_RPC_URL=http://polygon-supernet:8545
SUPERNET_CHAIN_ID=1337

# Cross-Chain
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/YOUR-PROJECT-ID
POLYGON_RPC_URL=https://polygon-rpc.com

# Smart Contracts
HEALTH_TOKEN_ADDRESS=0x1000000000000000000000000000000000000001
DATA_MARKETPLACE_ADDRESS=0x1000000000000000000000000000000000000002

# Infrastructure
REDIS_URL=redis://redis:6379
KAFKA_BROKERS=kafka:9092
```

## Development

### Build Services
```bash
npm run build                        # Build all components
npm run build:hyperledger           # Build Fabric network
npm run build:sidechain             # Build supernet
```

### Deploy Contracts
```bash
npm run deploy:contracts            # Deploy smart contracts
```

### Start Individual Services
```bash
npm run start:hyperledger           # Start Fabric network
npm run start:sidechain             # Start supernet
npm run start:bridges               # Start bridge services
```

### Testing
```bash
npm test                            # Run all tests
npm run test:contracts              # Test smart contracts
npm run test:api                    # Test API endpoints
```

## Production Deployment

### Prerequisites
- Docker and Docker Compose
- Node.js 18+
- SSL certificates for domains
- API keys for external chains

### Deployment Steps

1. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with production values
   ```

2. **Generate Certificates**
   ```bash
   ./scripts/generate-certificates.sh
   ```

3. **Initialize Networks**
   ```bash
   ./scripts/setup-production.sh
   ```

4. **Deploy Smart Contracts**
   ```bash
   npm run deploy:contracts
   ```

5. **Start Services**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

### DNS Configuration

Set up the following DNS records:
- `ledger.disease.zone` → Load balancer IP
- `fabric.ledger.disease.zone` → Fabric network
- `supernet.ledger.disease.zone` → Polygon supernet
- `bridge.ledger.disease.zone` → Cross-chain bridge

## Monitoring & Maintenance

### Health Checks
```bash
curl http://localhost:4000/health
curl http://localhost:4000/api/v1/status
```

### Metrics
- **Prometheus**: http://localhost:9090
- **Grafana Dashboards**: http://localhost:3001
- **API Metrics**: http://localhost:4000/metrics

### Logs
```bash
docker-compose logs -f blockchain-api
docker-compose logs -f hyperledger-peer0-hospital
docker-compose logs -f polygon-supernet
docker-compose logs -f bridge-service
```

### Backup
```bash
# Backup blockchain data
docker-compose exec blockchain-api tar -czf /backup/blockchain-$(date +%Y%m%d).tar.gz /app/data

# Backup Fabric network
docker-compose exec hyperledger-peer0-hospital tar -czf /backup/fabric-$(date +%Y%m%d).tar.gz /var/hyperledger/production
```

## Security

### Access Control
- Role-based permissions for Fabric network
- Multi-signature validation for cross-chain operations
- API key authentication for external access

### Compliance
- HIPAA-compliant data handling in Fabric network
- GDPR compliance for anonymized data on sidechain
- Audit logging for all blockchain operations

### Incident Response
1. **Service Disruption**: Use Docker health checks and restart policies
2. **Security Breach**: Pause bridges, rotate keys, audit transactions
3. **Data Corruption**: Restore from backup, replay transactions

## Support

For technical support:
- **Documentation**: See `/docs/BLOCKCHAIN.md`
- **Issues**: Create GitHub issue
- **Emergency**: Contact blockchain team

## License

MIT License - see LICENSE file for details.