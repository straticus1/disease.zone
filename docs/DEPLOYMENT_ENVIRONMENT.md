# Deployment Environment Configuration

## Overview

This document outlines the environment variables and configuration required for deploying Disease.Zone with Epic EHR integration to production environments.

## Required Environment Variables

### Core Application Security
These are **CRITICAL** and must be set for the application to start:

```bash
# Required for JWT authentication
JWT_SECRET=your-secure-jwt-secret-32-chars-min

# Required for session management  
SESSION_SECRET=your-secure-session-secret-32-chars-min

# Application environment
NODE_ENV=production

# Enable security features
API_RATE_LIMIT_ENABLED=true
```

### Epic EHR Integration
Required for Epic FHIR integration functionality:

```bash
# Epic Sandbox Credentials (for development/testing)
EPIC_SANDBOX_CLIENT_ID=your-epic-sandbox-client-id
EPIC_SANDBOX_CLIENT_SECRET=your-epic-sandbox-client-secret

# Epic Production Credentials (for live integration)
EPIC_PRODUCTION_CLIENT_ID=your-epic-production-client-id
EPIC_PRODUCTION_CLIENT_SECRET=your-epic-production-client-secret
```

### Optional Security Enhancements
Recommended for enhanced security:

```bash
# Multi-factor authentication
MFA_SECRET=your-secure-mfa-secret

# Account recovery
RECOVERY_CODE_SALT=your-secure-recovery-salt

# CORS configuration
ALLOWED_ORIGINS=https://disease.zone,https://www.disease.zone,https://api.disease.zone

# API rate limits (custom overrides)
AUTH_RATE_LIMIT=5          # Login attempts per hour
API_RATE_LIMIT=1000        # API calls per hour  
GENERAL_RATE_LIMIT=10000   # General requests per hour
```

### Database Configuration
```bash
# Primary database
DATABASE_URL=your-database-connection-string

# Redis for sessions and caching
REDIS_URL=redis://redis:6379

# PostgreSQL (if using)
POSTGRES_DB=disease_zone
POSTGRES_USER=diseaseZone
POSTGRES_PASSWORD=secure-database-password
```

### External Services
```bash
# Email service
SMTP_HOST=your-smtp-host
SMTP_PORT=587
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password

# AWS SES (alternative email)
AWS_SES_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
```

## AWS SSM Parameters (Recommended)

For sensitive configuration, use AWS Systems Manager Parameter Store:

```bash
# Map providers (stored as SecureString in SSM)
/diseasezone/prod/mapbox-token
/diseasezone/prod/google-maps-key

# Epic credentials (production)
/diseasezone/prod/epic-client-id
/diseasezone/prod/epic-client-secret

# Database credentials
/diseasezone/prod/database-url
/diseasezone/prod/redis-url

# Email service credentials
/diseasezone/prod/smtp-credentials
```

## Docker Environment Configuration

### docker-compose.yml Environment
```yaml
services:
  disease-zone-app:
    environment:
      - NODE_ENV=production
      - JWT_SECRET=${JWT_SECRET}
      - SESSION_SECRET=${SESSION_SECRET}
      - API_RATE_LIMIT_ENABLED=true
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=redis://redis:6379
      - EPIC_SANDBOX_CLIENT_ID=${EPIC_SANDBOX_CLIENT_ID}
      - EPIC_SANDBOX_CLIENT_SECRET=${EPIC_SANDBOX_CLIENT_SECRET}
```

### Dockerfile Environment
The Dockerfile is configured to read from environment variables at runtime.

## ECS Task Definition

For AWS ECS deployment, environment variables are configured in the task definition:

```json
{
  "environment": [
    {
      "name": "NODE_ENV",
      "value": "production"
    },
    {
      "name": "JWT_SECRET",
      "valueFrom": "arn:aws:ssm:us-east-1:account:parameter/diseasezone/prod/jwt-secret"
    },
    {
      "name": "SESSION_SECRET", 
      "valueFrom": "arn:aws:ssm:us-east-1:account:parameter/diseasezone/prod/session-secret"
    },
    {
      "name": "API_RATE_LIMIT_ENABLED",
      "value": "true"
    }
  ]
}
```

## Deployment Scripts Configuration

The `deploy.sh` script automatically handles:

1. **Security Setup** - Generates secure secrets if missing
2. **Environment Validation** - Checks required variables
3. **SSM Integration** - Reads from AWS Parameter Store
4. **Health Checks** - Validates Epic connectivity

## Security Best Practices

### Secret Generation
Use cryptographically secure methods to generate secrets:

```bash
# JWT Secret (32+ characters)
openssl rand -hex 32

# Session Secret (32+ characters)  
openssl rand -base64 32

# MFA Secret (base32 encoded)
openssl rand -base64 20 | base32
```

### Environment File (.env)
For local development, create a `.env` file:

```bash
NODE_ENV=development
JWT_SECRET=dev-jwt-secret-change-in-production
SESSION_SECRET=dev-session-secret-change-in-production
API_RATE_LIMIT_ENABLED=false
EPIC_SANDBOX_CLIENT_ID=your-dev-client-id
EPIC_SANDBOX_CLIENT_SECRET=your-dev-client-secret
```

**Never commit .env files to version control!**

## Epic Integration Specific

### Epic Sandbox (Development)
```bash
EPIC_BASE_URL=https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4
EPIC_AUTH_URL=https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize
EPIC_TOKEN_URL=https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token
EPIC_SANDBOX_CLIENT_ID=your-sandbox-client-id
EPIC_SANDBOX_CLIENT_SECRET=your-sandbox-client-secret
```

### Epic Production (Live)
Production Epic credentials must be obtained through Epic App Orchard certification:

```bash
EPIC_PRODUCTION_CLIENT_ID=your-certified-client-id
EPIC_PRODUCTION_CLIENT_SECRET=your-certified-client-secret
# Base URLs vary by Epic organization
```

### Epic Rate Limiting
Epic enforces 60 requests per minute. The integration automatically respects this limit.

## Troubleshooting

### Common Issues

**Application won't start:**
- Check that `JWT_SECRET` and `SESSION_SECRET` are set
- Verify `NODE_ENV=production` in production
- Ensure database connectivity

**Epic integration failing:**
- Verify Epic client credentials are correct
- Check Epic sandbox/production endpoints are accessible  
- Confirm rate limiting isn't being exceeded (60/min)

**Security validation errors:**
- Run `npm run security:validate-config` to check configuration
- Use the security crisis recovery script: `./scripts/security-crisis-recovery.sh --validate`

### Health Checks

Check application health:
```bash
curl https://disease.zone/api/health
curl https://disease.zone/api/epic/health
curl https://disease.zone/security/status
```

### Logs

Check application logs for configuration issues:
```bash
# ECS logs
aws logs get-log-events --log-group-name /ecs/diseasezone-prod

# Docker logs
docker logs disease-zone-app
```

## Production Deployment Checklist

- [ ] All required environment variables set
- [ ] Secrets generated securely (32+ character length)
- [ ] Epic credentials configured (sandbox for dev, production for live)
- [ ] Database connection tested
- [ ] Redis connection tested  
- [ ] Rate limiting enabled
- [ ] Security middleware enabled
- [ ] HTTPS enabled with valid certificates
- [ ] Health checks passing
- [ ] Epic integration health check passing
- [ ] Backup procedures in place
- [ ] Monitoring and alerting configured

## Support

For deployment support:
- Review deployment logs for specific error messages
- Use the security crisis recovery script for emergency fixes
- Check Epic connectivity and credentials
- Contact support for Epic App Orchard certification assistance