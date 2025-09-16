#!/bin/bash

# =============================================================================
# diseaseZone Network Management Script
# =============================================================================
# Comprehensive network management for multi-chain blockchain infrastructure
# Supports Hyperledger Fabric, Polygon, Ethereum, and local development networks
# =============================================================================

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
LEDGER_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${LEDGER_ROOT}/.env"
NETWORK_LOG="${LEDGER_ROOT}/logs/network-operations.log"

# Default values
COMMAND=""
NETWORK=""
SERVICE=""
FORCE=false

# Network configurations
declare -A NETWORKS=(
    ["hyperledger"]="Hyperledger Fabric permissioned network"
    ["polygon-local"]="Local Polygon development network"
    ["polygon-mumbai"]="Polygon Mumbai testnet"
    ["polygon-mainnet"]="Polygon mainnet"
    ["ethereum-local"]="Local Ethereum development network"
    ["ethereum-goerli"]="Ethereum Goerli testnet"
    ["ethereum-mainnet"]="Ethereum mainnet"
)

# Service configurations
declare -A SERVICES=(
    ["fabric-peer"]="Hyperledger Fabric peer nodes"
    ["fabric-orderer"]="Hyperledger Fabric orderer nodes"
    ["fabric-ca"]="Hyperledger Fabric certificate authority"
    ["couchdb"]="CouchDB state database"
    ["polygon-node"]="Polygon network node"
    ["ethereum-node"]="Ethereum network node"
    ["ipfs"]="IPFS distributed storage"
    ["monitoring"]="Monitoring and analytics stack"
)

# Create logs directory if it doesn't exist
mkdir -p "${LEDGER_ROOT}/logs"

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$NETWORK_LOG"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$NETWORK_LOG"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$NETWORK_LOG"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$NETWORK_LOG"
}

log_network() {
    echo -e "${PURPLE}[NETWORK]${NC} $1" | tee -a "$NETWORK_LOG"
}

log_service() {
    echo -e "${CYAN}[SERVICE]${NC} $1" | tee -a "$NETWORK_LOG"
}

# Help function
show_help() {
    cat << EOF
diseaseZone Network Management Script

Usage: $0 [COMMAND] [OPTIONS]

COMMANDS:
    start [NETWORK]                Start network or all networks
    stop [NETWORK]                 Stop network or all networks
    restart [NETWORK]              Restart network or all networks
    status [NETWORK]               Show network status
    logs [SERVICE]                 Show service logs
    health                         Check health of all networks
    reset [NETWORK]                Reset network (removes all data)
    backup [NETWORK]               Backup network data
    restore [NETWORK] [BACKUP]     Restore network from backup
    upgrade [NETWORK]              Upgrade network to latest version
    config [NETWORK]               Show network configuration
    peers [NETWORK]                List network peers
    channels [NETWORK]             List Hyperledger Fabric channels
    monitor                        Start network monitoring dashboard

NETWORKS:
    hyperledger                    Hyperledger Fabric network
    polygon-local                  Local Polygon development
    polygon-mumbai                 Polygon Mumbai testnet
    polygon-mainnet                Polygon mainnet
    ethereum-local                 Local Ethereum development
    ethereum-goerli                Ethereum Goerli testnet
    ethereum-mainnet               Ethereum mainnet
    all                           All configured networks

SERVICES:
    fabric-peer                    Hyperledger Fabric peers
    fabric-orderer                 Hyperledger Fabric orderers
    fabric-ca                      Certificate authorities
    couchdb                        CouchDB databases
    polygon-node                   Polygon network nodes
    ethereum-node                  Ethereum network nodes
    ipfs                          IPFS storage nodes
    monitoring                     Monitoring stack

OPTIONS:
    -f, --force                    Force operation (skip confirmations)
    -v, --verbose                  Verbose output
    -n, --network NETWORK          Target specific network
    -s, --service SERVICE          Target specific service
    -h, --help                     Show this help message

EXAMPLES:
    $0 start hyperledger           # Start Hyperledger Fabric network
    $0 stop all                    # Stop all networks
    $0 status                      # Show status of all networks
    $0 logs fabric-peer            # Show Fabric peer logs
    $0 backup hyperledger          # Backup Hyperledger data
    $0 health                      # Check health of all networks
    $0 monitor                     # Start monitoring dashboard

NETWORK ARCHITECTURE:
    📊 diseaseZone Multi-Chain Infrastructure

    ┌─── Hyperledger Fabric ───┐    ┌─── Polygon Network ───┐
    │  • Private health data   │    │  • HEALTH tokens      │
    │  • HIPAA compliance      │    │  • Public research    │
    │  • Medical validation    │    │  • Low-cost txns      │
    └──────────────────────────┘    └──────────────────────┘

    ┌─── IPFS Storage ─────────┐    ┌─── Monitoring ────────┐
    │  • Encrypted files       │    │  • Network metrics    │
    │  • Distributed backup    │    │  • Health dashboard   │
    │  • Content addressing    │    │  • Alert system      │
    └──────────────────────────┘    └──────────────────────┘

EOF
}

# Parse command line arguments
parse_args() {
    if [[ $# -eq 0 ]]; then
        show_help
        exit 1
    fi

    COMMAND="$1"
    shift

    while [[ $# -gt 0 ]]; do
        case $1 in
            -f|--force)
                FORCE=true
                shift
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -n|--network)
                NETWORK="$2"
                shift 2
                ;;
            -s|--service)
                SERVICE="$2"
                shift 2
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                # Handle positional arguments based on command
                case "$COMMAND" in
                    start|stop|restart|status|reset|backup|config|peers|channels)
                        if [[ -z "$NETWORK" ]]; then
                            NETWORK="$1"
                            shift
                        else
                            log_error "Unknown argument: $1"
                            exit 1
                        fi
                        ;;
                    logs)
                        if [[ -z "$SERVICE" ]]; then
                            SERVICE="$1"
                            shift
                        else
                            log_error "Unknown argument: $1"
                            exit 1
                        fi
                        ;;
                    restore)
                        if [[ -z "$NETWORK" ]]; then
                            NETWORK="$1"
                            shift
                        elif [[ -z "$BACKUP_FILE" ]]; then
                            BACKUP_FILE="$1"
                            shift
                        else
                            log_error "Unknown argument: $1"
                            exit 1
                        fi
                        ;;
                    *)
                        log_error "Unknown argument: $1"
                        exit 1
                        ;;
                esac
                ;;
        esac
    done
}

# Validate environment
validate_environment() {
    log_info "Validating network environment..."

    # Check required tools
    local required_tools=("docker" "docker-compose")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "$tool is required but not installed"
            exit 1
        fi
    done

    # Check Docker daemon
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        exit 1
    fi

    # Check environment file
    if [[ ! -f "$ENV_FILE" ]]; then
        log_warning ".env file not found, copying from template..."
        if [[ -f "${LEDGER_ROOT}/.env.example" ]]; then
            cp "${LEDGER_ROOT}/.env.example" "$ENV_FILE"
            log_info "Please configure $ENV_FILE before proceeding"
        fi
    fi

    # Load environment variables
    if [[ -f "$ENV_FILE" ]]; then
        source "$ENV_FILE"
    fi

    log_success "Environment validation completed"
}

# Start network services
start_network() {
    local network="$1"

    if [[ -z "$network" ]] || [[ "$network" == "all" ]]; then
        log_info "Starting all networks..."
        start_network "hyperledger"
        start_network "polygon-local"
        start_network "ipfs"
        start_network "monitoring"
        return 0
    fi

    case "$network" in
        hyperledger)
            start_hyperledger_fabric
            ;;
        polygon-local)
            start_polygon_local
            ;;
        polygon-mumbai|polygon-mainnet)
            log_info "Connecting to $network..."
            verify_polygon_connection "$network"
            ;;
        ethereum-local)
            start_ethereum_local
            ;;
        ethereum-goerli|ethereum-mainnet)
            log_info "Connecting to $network..."
            verify_ethereum_connection "$network"
            ;;
        ipfs)
            start_ipfs_network
            ;;
        monitoring)
            start_monitoring_stack
            ;;
        *)
            log_error "Unknown network: $network"
            exit 1
            ;;
    esac
}

# Start Hyperledger Fabric network
start_hyperledger_fabric() {
    log_network "Starting Hyperledger Fabric network..."

    cd "${LEDGER_ROOT}/hyperledger"

    # Check if network already running
    if docker ps | grep -q "hyperledger/fabric"; then
        log_warning "Hyperledger Fabric network already running"
        return 0
    fi

    # Start the network
    ./network.sh up createChannel -ca -s couchdb

    # Deploy chaincode
    ./network.sh deployCC -ccn health-records -ccp ../chaincode/health-records/ -ccl javascript

    # Verify network health
    sleep 10
    if verify_fabric_health; then
        log_success "Hyperledger Fabric network started successfully"
    else
        log_error "Hyperledger Fabric network failed to start properly"
        exit 1
    fi
}

# Start local Polygon network
start_polygon_local() {
    log_network "Starting local Polygon development network..."

    cd "${LEDGER_ROOT}/sidechain"

    # Start Polygon local network
    docker-compose -f docker-compose.polygon.yml up -d

    # Wait for network to be ready
    local retries=30
    while [[ $retries -gt 0 ]]; do
        if curl -s http://localhost:8545 &> /dev/null; then
            break
        fi
        log_info "Waiting for Polygon node to start... ($retries retries left)"
        sleep 2
        retries=$((retries - 1))
    done

    if [[ $retries -eq 0 ]]; then
        log_error "Polygon local network failed to start"
        exit 1
    fi

    log_success "Local Polygon network started successfully"
}

# Start local Ethereum network
start_ethereum_local() {
    log_network "Starting local Ethereum development network..."

    cd "${LEDGER_ROOT}/smart-contracts"

    # Start Hardhat node in background
    npx hardhat node &
    HARDHAT_PID=$!

    # Wait for node to be ready
    sleep 5

    # Deploy contracts
    npx hardhat run --network localhost scripts/deploy-all.js

    log_success "Local Ethereum network started successfully (PID: $HARDHAT_PID)"
}

# Start IPFS network
start_ipfs_network() {
    log_network "Starting IPFS network..."

    cd "${LEDGER_ROOT}"

    docker-compose -f docker-compose.yml up -d ipfs

    # Wait for IPFS to be ready
    sleep 10

    # Verify IPFS connection
    if docker exec ipfs_container ipfs id &> /dev/null; then
        log_success "IPFS network started successfully"
    else
        log_error "IPFS network failed to start"
        exit 1
    fi
}

# Start monitoring stack
start_monitoring_stack() {
    log_network "Starting monitoring stack..."

    cd "${LEDGER_ROOT}/monitoring"

    docker-compose up -d

    # Wait for services to be ready
    sleep 15

    log_success "Monitoring stack started successfully"
    log_info "Grafana dashboard: http://localhost:3000"
    log_info "Prometheus: http://localhost:9090"
}

# Stop network services
stop_network() {
    local network="$1"

    if [[ -z "$network" ]] || [[ "$network" == "all" ]]; then
        log_info "Stopping all networks..."
        stop_network "hyperledger"
        stop_network "polygon-local"
        stop_network "ethereum-local"
        stop_network "ipfs"
        stop_network "monitoring"
        return 0
    fi

    case "$network" in
        hyperledger)
            stop_hyperledger_fabric
            ;;
        polygon-local)
            stop_polygon_local
            ;;
        ethereum-local)
            stop_ethereum_local
            ;;
        ipfs)
            stop_ipfs_network
            ;;
        monitoring)
            stop_monitoring_stack
            ;;
        *)
            log_warning "Cannot stop remote network: $network"
            ;;
    esac
}

# Stop Hyperledger Fabric network
stop_hyperledger_fabric() {
    log_network "Stopping Hyperledger Fabric network..."

    cd "${LEDGER_ROOT}/hyperledger"

    ./network.sh down

    log_success "Hyperledger Fabric network stopped"
}

# Stop local Polygon network
stop_polygon_local() {
    log_network "Stopping local Polygon network..."

    cd "${LEDGER_ROOT}/sidechain"

    docker-compose -f docker-compose.polygon.yml down

    log_success "Local Polygon network stopped"
}

# Stop local Ethereum network
stop_ethereum_local() {
    log_network "Stopping local Ethereum network..."

    # Kill Hardhat node if running
    pkill -f "hardhat node" || true

    log_success "Local Ethereum network stopped"
}

# Stop IPFS network
stop_ipfs_network() {
    log_network "Stopping IPFS network..."

    cd "${LEDGER_ROOT}"

    docker-compose -f docker-compose.yml stop ipfs

    log_success "IPFS network stopped"
}

# Stop monitoring stack
stop_monitoring_stack() {
    log_network "Stopping monitoring stack..."

    cd "${LEDGER_ROOT}/monitoring"

    docker-compose down

    log_success "Monitoring stack stopped"
}

# Show network status
show_network_status() {
    local network="$1"

    echo
    echo "==============================================="
    echo "          NETWORK STATUS REPORT"
    echo "==============================================="

    if [[ -z "$network" ]] || [[ "$network" == "all" ]]; then
        # Show status of all networks
        for net in hyperledger polygon-local ethereum-local ipfs monitoring; do
            show_single_network_status "$net"
            echo "-----------------------------------------------"
        done
    else
        show_single_network_status "$network"
    fi

    echo "==============================================="
}

# Show status of a single network
show_single_network_status() {
    local network="$1"

    echo "Network: $network"
    echo "Description: ${NETWORKS[$network]:-Unknown network}"

    case "$network" in
        hyperledger)
            if docker ps | grep -q "hyperledger/fabric"; then
                echo "Status: 🟢 Running"
                echo "Peers: $(docker ps | grep -c "peer[0-9]")"
                echo "Orderers: $(docker ps | grep -c "orderer")"
                echo "CAs: $(docker ps | grep -c "ca\.")"
            else
                echo "Status: 🔴 Stopped"
            fi
            ;;
        polygon-local)
            if docker ps | grep -q "polygon"; then
                echo "Status: 🟢 Running"
                echo "RPC: http://localhost:8545"
            else
                echo "Status: 🔴 Stopped"
            fi
            ;;
        ethereum-local)
            if pgrep -f "hardhat node" &> /dev/null; then
                echo "Status: 🟢 Running"
                echo "RPC: http://localhost:8545"
            else
                echo "Status: 🔴 Stopped"
            fi
            ;;
        ipfs)
            if docker ps | grep -q "ipfs"; then
                echo "Status: 🟢 Running"
                echo "API: http://localhost:5001"
                echo "Gateway: http://localhost:8080"
            else
                echo "Status: 🔴 Stopped"
            fi
            ;;
        monitoring)
            if docker ps | grep -q "grafana"; then
                echo "Status: 🟢 Running"
                echo "Grafana: http://localhost:3000"
                echo "Prometheus: http://localhost:9090"
            else
                echo "Status: 🔴 Stopped"
            fi
            ;;
    esac

    echo
}

# Check network health
check_network_health() {
    log_info "Performing comprehensive network health check..."

    echo
    echo "==============================================="
    echo "          NETWORK HEALTH CHECK"
    echo "==============================================="

    local overall_health=0

    # Check Hyperledger Fabric
    if verify_fabric_health; then
        echo "Hyperledger Fabric: 🟢 Healthy"
    else
        echo "Hyperledger Fabric: 🔴 Unhealthy"
        overall_health=1
    fi

    # Check Polygon connection
    if verify_polygon_connection "polygon-local"; then
        echo "Polygon Local: 🟢 Healthy"
    else
        echo "Polygon Local: 🔴 Unhealthy"
        overall_health=1
    fi

    # Check IPFS
    if verify_ipfs_health; then
        echo "IPFS: 🟢 Healthy"
    else
        echo "IPFS: 🔴 Unhealthy"
        overall_health=1
    fi

    # Check monitoring
    if verify_monitoring_health; then
        echo "Monitoring: 🟢 Healthy"
    else
        echo "Monitoring: 🔴 Unhealthy"
        overall_health=1
    fi

    echo "==============================================="

    if [[ $overall_health -eq 0 ]]; then
        log_success "All networks are healthy"
    else
        log_warning "Some networks require attention"
    fi

    return $overall_health
}

# Verify Hyperledger Fabric health
verify_fabric_health() {
    if ! docker ps | grep -q "hyperledger/fabric"; then
        return 1
    fi

    # Test peer connection
    cd "${LEDGER_ROOT}/hyperledger"

    # Query chaincode to test health
    if ./network.sh query-chaincode &> /dev/null; then
        return 0
    else
        return 1
    fi
}

# Verify Polygon connection
verify_polygon_connection() {
    local network="$1"

    case "$network" in
        polygon-local)
            curl -s -X POST -H "Content-Type: application/json" \
                --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
                http://localhost:8545 &> /dev/null
            ;;
        polygon-mumbai)
            curl -s -X POST -H "Content-Type: application/json" \
                --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
                https://rpc-mumbai.maticvigil.com &> /dev/null
            ;;
        polygon-mainnet)
            curl -s -X POST -H "Content-Type: application/json" \
                --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
                https://polygon-rpc.com &> /dev/null
            ;;
        *)
            return 1
            ;;
    esac
}

# Verify Ethereum connection
verify_ethereum_connection() {
    local network="$1"

    case "$network" in
        ethereum-local)
            curl -s -X POST -H "Content-Type: application/json" \
                --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
                http://localhost:8545 &> /dev/null
            ;;
        ethereum-goerli)
            curl -s -X POST -H "Content-Type: application/json" \
                --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
                https://goerli.infura.io/v3/$INFURA_PROJECT_ID &> /dev/null
            ;;
        ethereum-mainnet)
            curl -s -X POST -H "Content-Type: application/json" \
                --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
                https://mainnet.infura.io/v3/$INFURA_PROJECT_ID &> /dev/null
            ;;
        *)
            return 1
            ;;
    esac
}

# Verify IPFS health
verify_ipfs_health() {
    docker exec ipfs_container ipfs id &> /dev/null
}

# Verify monitoring health
verify_monitoring_health() {
    curl -s http://localhost:3000/api/health &> /dev/null
}

# Show service logs
show_service_logs() {
    local service="$1"

    if [[ -z "$service" ]]; then
        log_error "Service name required"
        exit 1
    fi

    log_info "Showing logs for service: $service"

    case "$service" in
        fabric-peer|fabric-orderer|fabric-ca)
            cd "${LEDGER_ROOT}/hyperledger"
            docker-compose logs -f "$service" 2>/dev/null || \
            docker logs -f "${service}.example.com" 2>/dev/null || \
            log_error "Service $service not found"
            ;;
        couchdb)
            docker logs -f couchdb0
            ;;
        polygon-node)
            cd "${LEDGER_ROOT}/sidechain"
            docker-compose -f docker-compose.polygon.yml logs -f polygon-node
            ;;
        ipfs)
            docker logs -f ipfs_container
            ;;
        monitoring)
            cd "${LEDGER_ROOT}/monitoring"
            docker-compose logs -f
            ;;
        *)
            log_error "Unknown service: $service"
            exit 1
            ;;
    esac
}

# Reset network (WARNING: This removes all data)
reset_network() {
    local network="$1"

    if [[ "$FORCE" != "true" ]]; then
        echo "⚠️  WARNING: This will delete ALL data for network '$network'"
        echo "This action cannot be undone!"
        read -p "Are you sure you want to continue? (yes/no): " confirm

        if [[ "$confirm" != "yes" ]]; then
            log_info "Reset cancelled"
            return 0
        fi
    fi

    log_warning "Resetting network: $network"

    case "$network" in
        hyperledger)
            cd "${LEDGER_ROOT}/hyperledger"
            ./network.sh down
            docker volume prune -f
            docker system prune -f
            rm -rf organizations/
            rm -rf channel-artifacts/
            log_success "Hyperledger Fabric network reset"
            ;;
        polygon-local)
            cd "${LEDGER_ROOT}/sidechain"
            docker-compose -f docker-compose.polygon.yml down -v
            docker volume prune -f
            log_success "Local Polygon network reset"
            ;;
        ethereum-local)
            pkill -f "hardhat node" || true
            cd "${LEDGER_ROOT}/smart-contracts"
            rm -rf cache/ artifacts/ deployments/localhost/
            log_success "Local Ethereum network reset"
            ;;
        *)
            log_error "Cannot reset network: $network"
            exit 1
            ;;
    esac
}

# Start monitoring dashboard
start_monitoring_dashboard() {
    log_info "Starting network monitoring dashboard..."

    if ! docker ps | grep -q "grafana"; then
        start_monitoring_stack
    fi

    # Open dashboard in browser
    if command -v open &> /dev/null; then
        open http://localhost:3000
    elif command -v xdg-open &> /dev/null; then
        xdg-open http://localhost:3000
    else
        log_info "Monitoring dashboard available at: http://localhost:3000"
        log_info "Default login: admin/admin"
    fi
}

# Main function
main() {
    log_info "Starting network management operation: $COMMAND"

    parse_args "$@"
    validate_environment

    case "$COMMAND" in
        start)
            start_network "$NETWORK"
            ;;
        stop)
            stop_network "$NETWORK"
            ;;
        restart)
            stop_network "$NETWORK"
            start_network "$NETWORK"
            ;;
        status)
            show_network_status "$NETWORK"
            ;;
        logs)
            show_service_logs "$SERVICE"
            ;;
        health)
            check_network_health
            ;;
        reset)
            reset_network "$NETWORK"
            ;;
        monitor)
            start_monitoring_dashboard
            ;;
        *)
            log_error "Unknown command: $COMMAND"
            show_help
            exit 1
            ;;
    esac

    log_success "Network management operation completed successfully"
}

# Handle script interruption
trap 'log_error "Network operation interrupted by user"; exit 1' INT TERM

# Run main function
main "$@"