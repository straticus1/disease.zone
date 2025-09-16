#!/bin/bash

# =============================================================================
# diseaseZone Blockchain Deployment Script
# =============================================================================
# Comprehensive deployment script for HEALTH token ecosystem
# Supports multiple networks: localhost, testnet, mainnet
# =============================================================================

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
LEDGER_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${LEDGER_ROOT}/.env"
DEPLOY_LOG="${LEDGER_ROOT}/logs/deploy.log"

# Default values
NETWORK="localhost"
ENVIRONMENT="development"
SKIP_TESTS=false
FORCE_DEPLOY=false
HEALTH_TOKEN_SUPPLY="1000000000000000000000000000" # 1B tokens
DEPLOY_ALL=true

# Create logs directory if it doesn't exist
mkdir -p "${LEDGER_ROOT}/logs"

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$DEPLOY_LOG"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$DEPLOY_LOG"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$DEPLOY_LOG"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$DEPLOY_LOG"
}

# Help function
show_help() {
    cat << EOF
diseaseZone Blockchain Deployment Script

Usage: $0 [OPTIONS]

OPTIONS:
    -n, --network NETWORK           Target network (localhost, polygon-mumbai, polygon-mainnet)
    -e, --environment ENV           Environment (development, staging, production)
    -s, --skip-tests               Skip contract tests before deployment
    -f, --force                    Force deployment even if contracts exist
    --token-only                   Deploy only HEALTH token contract
    --bridge-only                  Deploy only bridge contracts
    --all                          Deploy all contracts (default)
    -h, --help                     Show this help message

EXAMPLES:
    $0 -n localhost                 # Deploy to local blockchain
    $0 -n polygon-mumbai -e staging # Deploy to Polygon testnet
    $0 --token-only -f              # Force redeploy token contract only
    $0 -n polygon-mainnet -e production # Production deployment

NETWORKS:
    localhost        - Local blockchain (Hardhat/Ganache)
    polygon-mumbai   - Polygon testnet (Mumbai)
    polygon-mainnet  - Polygon mainnet (production)

EOF
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -n|--network)
                NETWORK="$2"
                shift 2
                ;;
            -e|--environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -s|--skip-tests)
                SKIP_TESTS=true
                shift
                ;;
            -f|--force)
                FORCE_DEPLOY=true
                shift
                ;;
            --token-only)
                DEPLOY_ALL=false
                DEPLOY_TOKEN=true
                shift
                ;;
            --bridge-only)
                DEPLOY_ALL=false
                DEPLOY_BRIDGE=true
                shift
                ;;
            --all)
                DEPLOY_ALL=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# Validate environment
validate_environment() {
    log_info "Validating deployment environment..."

    # Check required tools
    local required_tools=("node" "npm" "npx")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "$tool is required but not installed"
            exit 1
        fi
    done

    # Check Node.js version
    local node_version=$(node --version | sed 's/v//')
    local required_node="16.0.0"
    if ! npx --package semver -c "semver -r '>=$required_node' '$node_version'" &> /dev/null; then
        log_error "Node.js >= $required_node required, found $node_version"
        exit 1
    fi

    # Validate network
    case "$NETWORK" in
        localhost|polygon-mumbai|polygon-mainnet)
            log_success "Network '$NETWORK' is supported"
            ;;
        *)
            log_error "Unsupported network: $NETWORK"
            exit 1
            ;;
    esac

    # Check environment file
    if [[ ! -f "$ENV_FILE" ]]; then
        log_warning ".env file not found, copying from template..."
        if [[ -f "${LEDGER_ROOT}/.env.example" ]]; then
            cp "${LEDGER_ROOT}/.env.example" "$ENV_FILE"
            log_info "Please configure $ENV_FILE before proceeding"
            exit 1
        else
            log_error "No .env.example file found"
            exit 1
        fi
    fi

    log_success "Environment validation completed"
}

# Install dependencies
install_dependencies() {
    log_info "Installing blockchain dependencies..."

    cd "$LEDGER_ROOT"

    if [[ ! -d "node_modules" ]]; then
        npm install
    else
        npm ci
    fi

    log_success "Dependencies installed"
}

# Compile contracts
compile_contracts() {
    log_info "Compiling smart contracts..."

    cd "${LEDGER_ROOT}/smart-contracts"

    # Install contract dependencies
    if [[ ! -d "node_modules" ]]; then
        npm install
    fi

    # Compile contracts
    npx hardhat compile

    log_success "Smart contracts compiled"
}

# Run tests
run_tests() {
    if [[ "$SKIP_TESTS" == "true" ]]; then
        log_warning "Skipping contract tests"
        return 0
    fi

    log_info "Running smart contract tests..."

    cd "${LEDGER_ROOT}/smart-contracts"

    # Run all tests
    npx hardhat test

    # Run coverage if in development
    if [[ "$ENVIRONMENT" == "development" ]]; then
        npx hardhat coverage
    fi

    log_success "All tests passed"
}

# Deploy HEALTH credit
deploy_health_credit() {
    log_info "Deploying HEALTH credit contract..."

    cd "${LEDGER_ROOT}/smart-contracts"

    local deploy_args="--network $NETWORK"
    if [[ "$FORCE_DEPLOY" == "true" ]]; then
        deploy_args="$deploy_args --reset"
    fi

    # Deploy token contract
    npx hardhat run scripts/deploy-token.js $deploy_args

    # Verify contract on explorer (if not localhost)
    if [[ "$NETWORK" != "localhost" ]]; then
        log_info "Verifying HEALTH token contract..."
        npx hardhat verify --network $NETWORK --constructor-args scripts/token-args.js
    fi

    log_success "HEALTH credit deployed successfully"
}

# Deploy bridge contracts
deploy_bridge_contracts() {
    log_info "Deploying bridge contracts..."

    cd "${LEDGER_ROOT}/smart-contracts"

    local deploy_args="--network $NETWORK"
    if [[ "$FORCE_DEPLOY" == "true" ]]; then
        deploy_args="$deploy_args --reset"
    fi

    # Deploy bridge contracts
    npx hardhat run scripts/deploy-bridge.js $deploy_args

    log_success "Bridge contracts deployed successfully"
}

# Deploy Hyperledger Fabric network
deploy_hyperledger() {
    log_info "Deploying Hyperledger Fabric network..."

    cd "${LEDGER_ROOT}/hyperledger"

    # Stop any existing network
    ./network.sh down

    # Start new network
    ./network.sh up createChannel -ca -s couchdb

    # Deploy chaincode
    ./network.sh deployCC -ccn health-records -ccp ../chaincode/health-records/ -ccl javascript

    log_success "Hyperledger Fabric network deployed"
}

# Start monitoring services
start_monitoring() {
    log_info "Starting monitoring services..."

    cd "$LEDGER_ROOT"

    # Start monitoring stack
    docker-compose -f monitoring/docker-compose.yml up -d

    log_success "Monitoring services started"
}

# Save deployment info
save_deployment_info() {
    log_info "Saving deployment information..."

    local deploy_info_file="${LEDGER_ROOT}/deployments/${NETWORK}-${ENVIRONMENT}.json"
    mkdir -p "$(dirname "$deploy_info_file")"

    cat > "$deploy_info_file" << EOF
{
    "network": "$NETWORK",
    "environment": "$ENVIRONMENT",
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "contracts": {
        "healthCredit": {
            "address": "$(cat ${LEDGER_ROOT}/smart-contracts/deployments/${NETWORK}/HealthCredit.json | jq -r '.address')",
            "blockNumber": "$(cat ${LEDGER_ROOT}/smart-contracts/deployments/${NETWORK}/HealthCredit.json | jq -r '.receipt.blockNumber')"
        }
    },
    "networks": {
        "hyperledger": {
            "channelName": "health-channel",
            "chaincodeName": "health-records"
        }
    }
}
EOF

    log_success "Deployment info saved to $deploy_info_file"
}

# Print deployment summary
print_summary() {
    echo
    log_success "🎉 Deployment completed successfully!"
    echo
    echo "==============================================="
    echo "          DEPLOYMENT SUMMARY"
    echo "==============================================="
    echo "Network:        $NETWORK"
    echo "Environment:    $ENVIRONMENT"
    echo "Timestamp:      $(date)"
    echo

    if [[ -f "${LEDGER_ROOT}/smart-contracts/deployments/${NETWORK}/HealthCredit.json" ]]; then
        local credit_address=$(cat "${LEDGER_ROOT}/smart-contracts/deployments/${NETWORK}/HealthCredit.json" | jq -r '.address')
        echo "HEALTH Credit:  $credit_address"
    fi

    echo
    echo "Next Steps:"
    echo "1. Update frontend configuration with contract addresses"
    echo "2. Configure monitoring dashboards"
    echo "3. Set up backup and recovery procedures"
    echo "4. Update documentation with deployment details"
    echo
    echo "Log file: $DEPLOY_LOG"
    echo "==============================================="
}

# Main deployment function
main() {
    echo "🚀 Starting diseaseZone blockchain deployment..."
    echo "================================================"

    parse_args "$@"

    log_info "Deployment started at $(date)"
    log_info "Network: $NETWORK, Environment: $ENVIRONMENT"

    # Deployment steps
    validate_environment
    install_dependencies
    compile_contracts
    run_tests

    # Deploy contracts based on options
    if [[ "$DEPLOY_ALL" == "true" ]] || [[ "$DEPLOY_TOKEN" == "true" ]]; then
        deploy_health_credit
    fi

    if [[ "$DEPLOY_ALL" == "true" ]] || [[ "$DEPLOY_BRIDGE" == "true" ]]; then
        deploy_bridge_contracts
    fi

    if [[ "$DEPLOY_ALL" == "true" ]]; then
        deploy_hyperledger
        start_monitoring
    fi

    save_deployment_info
    print_summary

    log_success "Deployment completed at $(date)"
}

# Handle script interruption
trap 'log_error "Deployment interrupted by user"; exit 1' INT TERM

# Run main function
main "$@"