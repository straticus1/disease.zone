# Disease.Zone CLI Configuration Guide

## Overview
The Disease.Zone CLI configuration tool provides a powerful command-line interface for managing platform settings, feature flags, pricing configuration, and system parameters.

## Table of Contents
1. [Installation and Setup](#installation-and-setup)
2. [Basic Usage](#basic-usage)
3. [Configuration Management](#configuration-management)
4. [Feature Flag Management](#feature-flag-management)
5. [Pricing Configuration](#pricing-configuration)
6. [Package Management](#package-management)
7. [Webhook Configuration](#webhook-configuration)
8. [Import/Export Operations](#importexport-operations)
9. [Advanced Operations](#advanced-operations)
10. [Troubleshooting](#troubleshooting)

## Installation and Setup

### Prerequisites
- Node.js v16+ installed
- Access to Disease.Zone project directory
- Appropriate permissions for configuration changes

### Setup
```bash
# Navigate to project directory
cd /path/to/disease.zone

# Make CLI script executable
chmod +x cli-config.js

# Test installation
./cli-config.js help
```

## Basic Usage

### Command Structure
```bash
./cli-config.js <command> [subcommand] [value]
```

### Help and Documentation
```bash
# Show help
./cli-config.js help

# Show configuration status
./cli-config.js status
```

### Example Output
```
╔══════════════════════════════════════════════════════════════╗
║                    Disease.Zone CLI Config                  ║
║                  Platform Configuration Tool               ║
╚══════════════════════════════════════════════════════════════╝

Configuration Status:
Version: 2.0.0
Last Updated: 9/19/2025, 12:00:00 PM

Features: 5/10 enabled
API Tiers: 4
License Tiers: 4
Vertical Packages: 3
Webhooks: enabled
```

## Configuration Management

### Get Configuration Values
```bash
# Get specific configuration value
./cli-config.js get features.professionalTier
# Output: true

# Get complex configuration object
./cli-config.js get apiTiers.professional
# Output: JSON object with pricing details

# Get nested configuration
./cli-config.js get webhooks.maxWebhooksPerTier
```

### Set Configuration Values
```bash
# Set boolean value
./cli-config.js set features.professionalTier true

# Set numeric value
./cli-config.js set apiTiers.professional.price 24.99

# Set string value
./cli-config.js set apiTiers.professional.name "Professional Plus"

# Set JSON object (quoted)
./cli-config.js set 'webhooks.retryPolicy' '{"maxRetries": 5, "backoffMultiplier": 2}'
```

### List Configuration Sections
```bash
# List all configuration
./cli-config.js list

# List specific section
./cli-config.js list features
./cli-config.js list apiTiers
./cli-config.js list verticalPackages
```

### Example List Output
```
Configuration Section: features
  professionalTier: ENABLED
  hospitalTier: ENABLED
  usageBasedPricing: ENABLED
  webhookSystem: ENABLED
  verticalPackages: ENABLED
  internationalSupport: DISABLED
  blockchainAudit: DISABLED
  graphqlApi: DISABLED
```

## Feature Flag Management

### List All Features
```bash
./cli-config.js features list
```

### Enable/Disable Features
```bash
# Enable a feature
./cli-config.js features enable professionalTier
# Output: ✓ Enabled feature: professionalTier

# Disable a feature
./cli-config.js features disable blockchainAudit
# Output: ✓ Disabled feature: blockchainAudit
```

### Check Feature Status
```bash
./cli-config.js features status professionalTier
# Output: Feature professionalTier: ENABLED
```

### Available Features
- `professionalTier` - Professional API tier
- `hospitalTier` - Hospital license validation tier
- `usageBasedPricing` - Overage billing system
- `webhookSystem` - Real-time event notifications
- `verticalPackages` - Industry-specific packages
- `internationalSupport` - Multi-country support
- `blockchainAudit` - Blockchain audit trails
- `graphqlApi` - GraphQL API endpoints
- `mobileSDK` - Mobile development kit
- `aiPredictiveCredentialing` - AI-powered credentialing

## Pricing Configuration

### List All Pricing
```bash
./cli-config.js pricing list
```

### API Pricing Management
```bash
# Show all API pricing tiers
./cli-config.js pricing api

# Show specific API tier
./cli-config.js pricing api professional
```

### License Validation Pricing
```bash
# Show all license validation tiers
./cli-config.js pricing license

# Show specific license tier
./cli-config.js pricing license hospital
```

### Update Pricing (Examples)
```bash
# Update API tier price
./cli-config.js set apiTiers.professional.price 24.99

# Update daily request limits
./cli-config.js set apiTiers.professional.requestsPerDay 20000

# Update overage rates
./cli-config.js set apiTiers.professional.overageRate 0.10
```

### Example Pricing Output
```
Pricing Configuration:

API Tiers:
  free: $0/month - 1000 requests/day
  professional: $19.99/month - 15000 requests/day
  pro: $49.99/month - 50000 requests/day
  enterprise: $499.99/month - 1000000 requests/day

License Validation Tiers:
  free: $0/month - 25 searches/day
  premium: $14.99/month - 250 searches/day
  hospital: $29.99/month - 500 searches/day
  enterprise: $69.99/month - unlimited
```

## Package Management

### List Packages
```bash
./cli-config.js packages list
```

### Show Package Details
```bash
./cli-config.js packages show hospitalSystems
./cli-config.js packages show insuranceCompany
./cli-config.js packages show telemedicinePlatform
```

### Example Package Output
```
Vertical Packages:
  hospitalSystems: $199.99/month - Complete solution for hospital systems
    Includes: epic_integration, license_validation, health_assessments
  insuranceCompany: $299.99/month - Risk assessment and provider verification for insurers
    Includes: risk_assessment_api, claims_validation, provider_verification
  telemedicinePlatform: $149.99/month - Provider verification and patient assessment for telehealth
    Includes: provider_verification, patient_health_assessments, epic_integration
```

### Update Package Configuration
```bash
# Update package price
./cli-config.js set verticalPackages.hospitalSystems.price 219.99

# Update package limits
./cli-config.js set verticalPackages.hospitalSystems.limits.users 150
```

## Webhook Configuration

### Show Webhook Configuration
```bash
./cli-config.js webhooks config
```

### List Supported Events
```bash
./cli-config.js webhooks events
```

### Show Webhook Limits
```bash
./cli-config.js webhooks limits
```

### Example Webhook Output
```
Supported Event Types:
  license_status_change
  violation_detected
  credential_expiring
  outbreak_alert
  health_assessment_complete
  api_limit_reached
  payment_processed
  subscription_changed

Webhook Limits by Tier:
  free: 0 webhooks
  professional: 10 webhooks
  pro: 50 webhooks
  enterprise: unlimited
```

### Update Webhook Configuration
```bash
# Enable/disable webhooks
./cli-config.js set webhooks.enabled true

# Update retry policy
./cli-config.js set webhooks.retryPolicy.maxRetries 5

# Update webhook limits
./cli-config.js set webhooks.maxWebhooksPerTier.professional 15
```

## Import/Export Operations

### Export Configuration
```bash
# Export to file
./cli-config.js export config-backup.json
# Output: ✓ Configuration exported to: /path/to/config-backup.json

# Export with timestamp
./cli-config.js export "config-$(date +%Y%m%d-%H%M%S).json"
```

### Import Configuration
```bash
# Import from file
./cli-config.js import config-backup.json
# Output: ✓ Configuration imported from: /path/to/config-backup.json
```

### Export File Format
```json
{
  "timestamp": "2025-09-19T12:00:00.000Z",
  "config": {
    "version": "2.0.0",
    "lastUpdated": "2025-09-19T12:00:00.000Z",
    "features": {
      "professionalTier": true,
      "hospitalTier": true,
      "usageBasedPricing": true
    },
    "apiTiers": {
      "free": {
        "name": "Free",
        "price": 0,
        "requestsPerDay": 1000
      }
    }
  }
}
```

## Advanced Operations

### Configuration Validation
```bash
./cli-config.js validate
```

### Example Validation Output
```
Configuration Validation:
✓ Configuration is valid
```

### Error Example
```
Configuration Validation:
✗ Configuration has errors:
  • Invalid price for apiTiers.professional
  • Feature flag professionalTier must be boolean
```

### Reset Configuration
```bash
./cli-config.js reset
# Output: ⚠️  This will reset ALL configuration to defaults!
# Type "yes" to confirm:
```

⚠️ **Warning**: Reset operation will restore all settings to default values. Always export your configuration before resetting.

### Batch Operations
```bash
# Multiple configuration changes
./cli-config.js set features.professionalTier true
./cli-config.js set features.hospitalTier true
./cli-config.js set apiTiers.professional.price 24.99
./cli-config.js validate
```

### Configuration Backup Script
```bash
#!/bin/bash
# backup-config.sh

DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="config-backup-${DATE}.json"

echo "Creating configuration backup..."
./cli-config.js export "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "Backup created: $BACKUP_FILE"
    
    # Optional: Upload to cloud storage
    # aws s3 cp "$BACKUP_FILE" s3://disease-zone-backups/config/
else
    echo "Backup failed!"
    exit 1
fi
```

## Automation and Scripting

### Environment-Specific Configuration
```bash
# Development environment
./cli-config.js set features.blockchainAudit false
./cli-config.js set features.internationalSupport false
./cli-config.js set apiTiers.professional.price 19.99

# Production environment  
./cli-config.js set features.blockchainAudit true
./cli-config.js set features.internationalSupport true
./cli-config.js set apiTiers.professional.price 24.99
```

### Configuration Migration Script
```bash
#!/bin/bash
# migrate-config.sh

echo "Migrating configuration to v2.0..."

# Enable new features
./cli-config.js features enable professionalTier
./cli-config.js features enable hospitalTier
./cli-config.js features enable usageBasedPricing

# Update pricing
./cli-config.js set apiTiers.professional.price 19.99
./cli-config.js set licenseValidationTiers.premium.price 14.99
./cli-config.js set licenseValidationTiers.hospital.price 29.99

# Validate configuration
./cli-config.js validate

if [ $? -eq 0 ]; then
    echo "Migration completed successfully!"
else
    echo "Migration failed - please check configuration"
    exit 1
fi
```

### Integration with CI/CD
```yaml
# .github/workflows/config-deploy.yml
name: Deploy Configuration

on:
  push:
    paths:
      - 'config/**'

jobs:
  deploy-config:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm install
        
      - name: Validate configuration
        run: ./cli-config.js validate
        
      - name: Deploy to staging
        if: github.ref == 'refs/heads/develop'
        run: |
          ./cli-config.js import config/staging.json
          ./cli-config.js validate
          
      - name: Deploy to production
        if: github.ref == 'refs/heads/main'
        run: |
          ./cli-config.js import config/production.json
          ./cli-config.js validate
```

## Troubleshooting

### Common Issues

#### Permission Errors
```bash
# Error: EACCES: permission denied
chmod +x cli-config.js

# Error: Cannot write configuration
# Check file permissions for config directory
ls -la config/
chmod 755 config/
```

#### Invalid Configuration Values
```bash
# Error: Invalid price for apiTiers.professional
./cli-config.js validate
# Review and fix validation errors

# Check current value
./cli-config.js get apiTiers.professional.price

# Set correct value
./cli-config.js set apiTiers.professional.price 19.99
```

#### JSON Parse Errors
```bash
# Error: Unexpected token in JSON
# When setting complex objects, ensure proper quoting:

# ❌ Incorrect
./cli-config.js set webhooks.retryPolicy {"maxRetries": 3}

# ✅ Correct
./cli-config.js set 'webhooks.retryPolicy' '{"maxRetries": 3}'
```

#### Configuration Not Found
```bash
# Error: Configuration path 'features.invalidFeature' not found
./cli-config.js list features
# Check available configuration paths
```

### Debug Mode
```bash
# Enable debug logging (if implemented)
DEBUG=cli-config ./cli-config.js status

# Verbose output
./cli-config.js list | head -20
```

### Recovery Procedures

#### Restore from Backup
```bash
# If configuration is corrupted
./cli-config.js import config-backup-20250919-120000.json
./cli-config.js validate
```

#### Reset to Defaults
```bash
# Last resort - reset everything
./cli-config.js export emergency-backup.json
./cli-config.js reset
./cli-config.js validate
```

### Getting Help

#### Check Configuration Status
```bash
./cli-config.js status
./cli-config.js validate
```

#### Configuration Health Check
```bash
#!/bin/bash
# health-check.sh

echo "Disease.Zone Configuration Health Check"
echo "======================================"

echo "1. Configuration Status:"
./cli-config.js status

echo -e "\n2. Configuration Validation:"
./cli-config.js validate

echo -e "\n3. Critical Features:"
critical_features=("professionalTier" "usageBasedPricing" "webhookSystem")

for feature in "${critical_features[@]}"; do
    status=$(./cli-config.js features status "$feature" 2>/dev/null)
    echo "   $feature: $status"
done

echo -e "\n4. Webhook Configuration:"
./cli-config.js webhooks config | grep -E "(enabled|maxWebhooksPerTier)"

echo -e "\nHealth check completed."
```

## Best Practices

### Configuration Management
1. **Always validate** after making changes
2. **Export backups** before major changes
3. **Use version control** for configuration files
4. **Test changes** in development environment first
5. **Document configuration** changes in commit messages

### Security Considerations
1. **Restrict access** to CLI configuration tool
2. **Audit configuration changes** in production
3. **Use environment-specific** configurations
4. **Encrypt sensitive** configuration values
5. **Monitor configuration** drift

### Automation Guidelines
1. **Script repetitive** configuration tasks
2. **Validate configuration** in CI/CD pipelines
3. **Use idempotent** configuration commands
4. **Implement rollback** procedures
5. **Monitor configuration** health

---

**Document Version**: 1.0.0  
**Last Updated**: September 19, 2025  
**CLI Version**: 2.0.0