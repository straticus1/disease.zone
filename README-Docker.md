# Disease Zone Docker Deployment Guide

This guide explains how to deploy the Disease Zone platform using Docker and Docker Compose.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- At least 4GB RAM
- 10GB free disk space

## Quick Start

1. **Clone and setup environment:**
   ```bash
   git clone <repository-url>
   cd disease.zone
   cp .env.example .env
   # Edit .env with your configuration
   ```

2. **Start the full platform:**
   ```bash
   # Start main application stack
   docker-compose up -d

   # Start blockchain services (optional)
   cd ledger
   docker-compose up -d
   cd ..
   ```

3. **Access the application:**
   - Main Platform: http://localhost:3000
   - Comprehensive Web App: http://localhost:3000/app.html
   - Blockchain API: http://localhost:4000
   - Monitoring (Grafana): http://localhost:3001

## Services Overview

### Main Stack (docker-compose.yml)

- **disease-zone-app**: Main Node.js application serving the web frontend
- **postgres**: PostgreSQL database for user data and medical records
- **redis**: Session storage and caching
- **nginx**: Reverse proxy and load balancer
- **blockchain-api**: Blockchain integration API
- **prometheus/grafana**: Monitoring and metrics

### Blockchain Stack (ledger/docker-compose.yml)

- **Hyperledger Fabric**: Private blockchain network
- **Polygon Supernet**: EVM-compatible sidechain
- **Bridge Services**: Cross-chain communication
- **Kafka/Zookeeper**: Event streaming

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Database
DATABASE_URL=postgresql://diseaseZone:changeme@postgres:5432/disease_zone
POSTGRES_PASSWORD=your-secure-password

# Application Security
SESSION_SECRET=your-secure-session-secret
JWT_SECRET=your-secure-jwt-secret

# External Services
MAPBOX_ACCESS_TOKEN=your-mapbox-token
GOOGLE_MAPS_API_KEY=your-google-maps-key

# Monitoring
GRAFANA_PASSWORD=your-grafana-password
```

### Mapping Services Configuration

The platform supports three tiers of mapping services:

1. **Free Tier**: OpenStreetMap only
2. **Silver Tier**: OSM + Mapbox (requires MAPBOX_ACCESS_TOKEN)
3. **Gold Tier**: OSM + Mapbox + Google Maps (requires both tokens)

## Database Setup

The PostgreSQL database is automatically initialized with:

- User management tables
- Medical condition tracking
- Disease reporting system
- Research marketplace
- Insurance analytics
- Audit trails

Default users:
- Admin: `admin@disease.zone` (password: `admin123` - change immediately)
- Doctor: `dr.smith@hospital.disease.zone`

## Web Frontend Features

The comprehensive web frontend (`/app.html`) provides:

### For Patients
- Personal health dashboard
- Disease tracking and family history
- HEALTH token wallet
- Data sharing controls

### For Medical Professionals
- Clinical assessment tools
- Patient management
- Outbreak monitoring
- Research tools

### For Insurance Companies
- Risk assessment analytics
- Population health metrics
- Claims prediction models

### For Researchers
- Data marketplace access
- Analytics tools
- Blockchain-verified datasets

## Security Features

- JWT-based authentication
- Role-based access control (RBAC)
- HIPAA/GDPR compliance features
- Content Security Policy (CSP)
- Rate limiting
- Audit logging
- Data encryption

## Monitoring

Access Grafana at http://localhost:3001:
- Default credentials: admin/admin (change in production)
- Pre-configured dashboards for application metrics
- System health monitoring
- API usage analytics

## Development vs Production

### Development Mode
```bash
# Use development settings
export NODE_ENV=development
docker-compose up
```

### Production Mode
```bash
# Use production settings
export NODE_ENV=production
# Configure SSL certificates in nginx/ssl/
# Update nginx.conf to enable HTTPS redirect
docker-compose up -d
```

## Scaling

### Horizontal Scaling
```bash
# Scale application containers
docker-compose up -d --scale disease-zone-app=3

# Load balancing is handled by nginx
```

### Database Scaling
For production, consider:
- PostgreSQL master-slave replication
- Redis clustering
- External managed database services

## Blockchain Integration

The blockchain integration provides:

- **Hyperledger Fabric**: Private permissioned network for medical data
- **Polygon Supernet**: Public EVM-compatible chain for HEALTH tokens
- **Cross-chain bridges**: Data and token transfers between networks

Start blockchain services:
```bash
cd ledger
docker-compose up -d
```

Blockchain endpoints:
- Fabric API: http://localhost:7051
- Supernet RPC: http://localhost:8545
- Bridge API: http://localhost:4000

## Troubleshooting

### Common Issues

1. **Port conflicts:**
   ```bash
   # Check for running services
   docker ps
   lsof -i :3000
   ```

2. **Database connection issues:**
   ```bash
   # Check PostgreSQL logs
   docker-compose logs postgres

   # Reset database
   docker-compose down -v
   docker-compose up -d
   ```

3. **Frontend not loading:**
   ```bash
   # Check nginx logs
   docker-compose logs nginx

   # Restart application
   docker-compose restart disease-zone-app
   ```

### Health Checks

The platform includes health check endpoints:
- Main app: http://localhost:3000/api/health
- Blockchain: http://localhost:4000/health
- Nginx: http://localhost/health

### Logs

View service logs:
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f disease-zone-app

# Blockchain services
cd ledger && docker-compose logs -f blockchain-api
```

## Backup and Recovery

### Database Backup
```bash
# Create backup
docker-compose exec postgres pg_dump -U diseaseZone disease_zone > backup.sql

# Restore backup
docker-compose exec -T postgres psql -U diseaseZone disease_zone < backup.sql
```

### Volume Backup
```bash
# Backup all volumes
docker run --rm -v disease-zone_postgres-data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz -C /data .
```

## Updates and Maintenance

### Application Updates
```bash
# Pull latest images
docker-compose pull

# Restart with new images
docker-compose up -d
```

### Security Updates
```bash
# Update base images
docker-compose build --no-cache
docker-compose up -d
```

## Support

For issues and questions:
- Check logs first: `docker-compose logs`
- Review this documentation
- Check GitHub issues
- Contact support team

---

**Note**: This is a comprehensive medical surveillance platform. Ensure compliance with applicable healthcare regulations (HIPAA, GDPR, etc.) in your deployment environment.