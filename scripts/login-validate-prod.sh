#!/bin/bash

# Production Login Validator Wrapper
# Sets common AWS/Production environment variables

echo "🚀 Starting Disease.Zone Login Validator - Production Mode"
echo "============================================================"

# Set production environment variables
export NODE_ENV=production
export API_URL=${API_URL:-https://disease.zone}
export DB_PATH=${DB_PATH:-/opt/app/database/diseaseZone.db}

# Common AWS environment indicators
export AWS_REGION=${AWS_REGION:-us-east-1}

# Show what we're using
echo "Environment: Production"
echo "API URL: $API_URL" 
echo "Database: $DB_PATH"
echo "AWS Region: $AWS_REGION"
echo "============================================================"
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Run the validator from the scripts directory
cd "$SCRIPT_DIR"
node login-validate.js "$@"
