#!/bin/bash

# =============================================================================
# diseaseZone Development Environment Setup Script
# =============================================================================
# One-command setup for the complete blockchain development environment
# Includes all dependencies, networks, contracts, and development tools
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
PROJECT_ROOT="$(dirname "$LEDGER_ROOT")"
ENV_FILE="${LEDGER_ROOT}/.env"
SETUP_LOG="${LEDGER_ROOT}/logs/dev-setup.log"

# Default values
SKIP_DEPS=false
SKIP_DOCKER=false
SKIP_CONTRACTS=false
SKIP_NETWORKS=false
QUICK_MODE=false
CLEAN_INSTALL=false

# System information
OS_TYPE="$(uname -s)"
ARCH_TYPE="$(uname -m)"

# Create logs directory if it doesn't exist
mkdir -p "${LEDGER_ROOT}/logs"

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$SETUP_LOG"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$SETUP_LOG"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$SETUP_LOG"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$SETUP_LOG"
}

log_step() {
    echo -e "${PURPLE}[STEP]${NC} $1" | tee -a "$SETUP_LOG"
}

log_deps() {
    echo -e "${CYAN}[DEPS]${NC} $1" | tee -a "$SETUP_LOG"
}

# Help function
show_help() {
    cat << EOF
diseaseZone Development Environment Setup Script

Usage: $0 [OPTIONS]

OPTIONS:
    --skip-deps                    Skip system dependency installation
    --skip-docker                  Skip Docker setup and containers
    --skip-contracts               Skip smart contract deployment
    --skip-networks                Skip network initialization
    --quick                        Quick setup (minimal components)
    --clean                        Clean install (remove existing data)
    -h, --help                     Show this help message

WHAT THIS SCRIPT DOES:
    ✅ Install system dependencies (Node.js, Docker, etc.)
    ✅ Set up environment configuration
    ✅ Initialize Docker containers and networks
    ✅ Deploy smart contracts to local networks
    ✅ Set up Hyperledger Fabric network
    ✅ Configure IPFS storage
    ✅ Start monitoring dashboard
    ✅ Create sample data and test accounts
    ✅ Run health checks and validation

SYSTEM REQUIREMENTS:
    • Operating System: macOS, Linux, or Windows (WSL2)
    • RAM: 8GB minimum, 16GB recommended
    • Storage: 10GB free space
    • Internet connection for downloads

COMPONENTS INSTALLED:
    🔧 Node.js v18+ & npm
    🐳 Docker & Docker Compose
    🔗 Hyperledger Fabric
    ⚡ Hardhat development environment
    🌐 Local blockchain networks
    📊 Monitoring & analytics tools
    🗃️ IPFS distributed storage

EOF
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-deps)
                SKIP_DEPS=true
                shift
                ;;
            --skip-docker)
                SKIP_DOCKER=true
                shift
                ;;
            --skip-contracts)
                SKIP_CONTRACTS=true
                shift
                ;;
            --skip-networks)
                SKIP_NETWORKS=true
                shift
                ;;
            --quick)
                QUICK_MODE=true
                shift
                ;;
            --clean)
                CLEAN_INSTALL=true
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

# Show welcome banner
show_banner() {
    clear
    echo -e "${BLUE}"
    cat << 'EOF'
╔══════════════════════════════════════════════════════════════════════╗
║                                                                      ║
║    🌍 diseaseZone Development Environment Setup                      ║
║                                                                      ║
║    Setting up blockchain infrastructure for global health research   ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}\n"

    log_info "Setup started at $(date)"
    log_info "System: $OS_TYPE $ARCH_TYPE"
    log_info "Project root: $PROJECT_ROOT"
}

# Check system requirements
check_system_requirements() {
    log_step "Checking system requirements..."

    # Check available memory
    case "$OS_TYPE" in
        Darwin)  # macOS
            local memory_gb=$(sysctl -n hw.memsize | awk '{print int($1/1024/1024/1024)}')
            ;;
        Linux)
            local memory_gb=$(free -g | awk '/^Mem:/{print $2}')
            ;;
        *)
            log_warning "Cannot detect memory on $OS_TYPE, assuming sufficient"
            memory_gb=8
            ;;
    esac

    if [[ $memory_gb -lt 8 ]]; then
        log_warning "Only ${memory_gb}GB RAM detected. 8GB minimum, 16GB recommended"
    else
        log_success "Memory check passed: ${memory_gb}GB RAM available"
    fi

    # Check available disk space
    local disk_space_gb=$(df -BG "$LEDGER_ROOT" | awk 'NR==2 {print int($4)}')
    if [[ $disk_space_gb -lt 10 ]]; then
        log_error "Insufficient disk space: ${disk_space_gb}GB available, 10GB required"
        exit 1
    else
        log_success "Disk space check passed: ${disk_space_gb}GB available"
    fi

    # Check internet connectivity
    if ! ping -c 1 google.com &> /dev/null; then
        log_error "No internet connection. Internet access required for setup"
        exit 1
    else
        log_success "Internet connectivity verified"
    fi

    log_success "System requirements check completed"
}

# Install system dependencies
install_dependencies() {
    if [[ "$SKIP_DEPS" == "true" ]]; then
        log_warning "Skipping system dependency installation"
        return 0
    fi

    log_step "Installing system dependencies..."

    case "$OS_TYPE" in
        Darwin)  # macOS
            install_macos_deps
            ;;
        Linux)
            install_linux_deps
            ;;
        *)
            log_error "Unsupported operating system: $OS_TYPE"
            exit 1
            ;;
    esac

    log_success "System dependencies installed"
}

# Install macOS dependencies
install_macos_deps() {
    log_deps "Installing macOS dependencies..."

    # Check if Homebrew is installed
    if ! command -v brew &> /dev/null; then
        log_info "Installing Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    fi

    # Install Node.js
    if ! command -v node &> /dev/null; then
        log_info "Installing Node.js..."
        brew install node@18
        brew link node@18 --force
    fi

    # Install Docker
    if ! command -v docker &> /dev/null; then
        log_info "Installing Docker Desktop..."
        brew install --cask docker
        log_warning "Please start Docker Desktop manually and accept the license agreement"
        read -p "Press Enter after Docker Desktop is running..."
    fi

    # Install additional tools
    brew install git curl jq wget
}

# Install Linux dependencies
install_linux_deps() {
    log_deps "Installing Linux dependencies..."

    # Detect Linux distribution
    if [[ -f /etc/os-release ]]; then
        source /etc/os-release
        DISTRO=$ID
    else
        log_error "Cannot detect Linux distribution"
        exit 1
    fi

    case "$DISTRO" in
        ubuntu|debian)
            install_ubuntu_deps
            ;;
        centos|rhel|fedora)
            install_rhel_deps
            ;;
        *)
            log_error "Unsupported Linux distribution: $DISTRO"
            exit 1
            ;;
    esac
}

# Install Ubuntu/Debian dependencies
install_ubuntu_deps() {
    log_deps "Installing Ubuntu/Debian dependencies..."

    # Update package list
    sudo apt-get update

    # Install basic tools
    sudo apt-get install -y curl wget git jq build-essential

    # Install Node.js
    if ! command -v node &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi

    # Install Docker
    if ! command -v docker &> /dev/null; then
        curl -fsSL https://get.docker.com | sh
        sudo usermod -aG docker $USER
        log_warning "Please log out and back in to use Docker without sudo"
    fi

    # Install Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        sudo apt-get install -y docker-compose-plugin
    fi
}

# Install RHEL/CentOS/Fedora dependencies
install_rhel_deps() {
    log_deps "Installing RHEL/CentOS/Fedora dependencies..."

    # Install basic tools
    sudo dnf install -y curl wget git jq gcc-c++ make

    # Install Node.js
    if ! command -v node &> /dev/null; then
        curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
        sudo dnf install -y nodejs
    fi

    # Install Docker
    if ! command -v docker &> /dev/null; then
        sudo dnf install -y docker
        sudo systemctl start docker
        sudo systemctl enable docker
        sudo usermod -aG docker $USER
    fi
}

# Setup environment configuration
setup_environment_config() {
    log_step "Setting up environment configuration..."

    # Copy environment template if it doesn't exist
    if [[ ! -f "$ENV_FILE" ]]; then
        if [[ -f "${LEDGER_ROOT}/.env.example" ]]; then
            cp "${LEDGER_ROOT}/.env.example" "$ENV_FILE"
            log_success "Created .env file from template"
        else
            create_default_env_file
        fi
    else
        log_info "Environment file already exists"
    fi

    # Generate secure values for development
    generate_development_secrets

    # Load environment variables
    source "$ENV_FILE"

    log_success "Environment configuration completed"
}

# Create default environment file
create_default_env_file() {
    log_info "Creating default environment configuration..."

    cat > "$ENV_FILE" << 'EOF'
# diseaseZone Development Environment Configuration

# Network Settings
NODE_ENV=development
PORT=4000
HOST=localhost

# Blockchain Networks
ETHEREUM_RPC_URL=http://localhost:8545
POLYGON_RPC_URL=http://localhost:8545
HYPERLEDGER_PEER_URL=localhost:7051

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/disease_zone_dev
REDIS_URL=redis://localhost:6379

# IPFS Configuration
IPFS_API_URL=http://localhost:5001
IPFS_GATEWAY_URL=http://localhost:8080

# Security Keys (Development Only)
JWT_SECRET=dev_jwt_secret_change_in_production
ENCRYPTION_KEY=dev_encryption_key_32_characters
SIGNING_KEY=dev_signing_key_for_blockchain_ops

# API Keys (Add your keys here)
INFURA_PROJECT_ID=your_infura_project_id
ALCHEMY_API_KEY=your_alchemy_api_key
ETHERSCAN_API_KEY=your_etherscan_api_key
POLYGONSCAN_API_KEY=your_polygonscan_api_key

# Monitoring
GRAFANA_ADMIN_PASSWORD=admin
PROMETHEUS_RETENTION_TIME=15d

# Development Flags
DEBUG=true
VERBOSE_LOGGING=true
ENABLE_CORS=true
SKIP_AUTH_IN_DEV=true
EOF

    log_success "Default environment file created"
}

# Generate development secrets
generate_development_secrets() {
    log_info "Generating development secrets..."

    # Generate JWT secret
    local jwt_secret=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
    sed -i.bak "s/JWT_SECRET=.*/JWT_SECRET=$jwt_secret/" "$ENV_FILE"

    # Generate encryption key
    local encryption_key=$(openssl rand -hex 16)
    sed -i.bak "s/ENCRYPTION_KEY=.*/ENCRYPTION_KEY=$encryption_key/" "$ENV_FILE"

    # Generate signing key
    local signing_key=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
    sed -i.bak "s/SIGNING_KEY=.*/SIGNING_KEY=$signing_key/" "$ENV_FILE"

    # Remove backup file
    rm -f "${ENV_FILE}.bak"

    log_success "Development secrets generated"
}

# Install Node.js dependencies
install_node_dependencies() {
    log_step "Installing Node.js dependencies..."

    # Install root dependencies
    cd "$LEDGER_ROOT"
    if [[ -f package.json ]]; then
        npm install
    fi

    # Install smart contract dependencies
    cd "${LEDGER_ROOT}/smart-contracts"
    if [[ -f package.json ]]; then
        npm install
    fi

    # Install API dependencies
    cd "${LEDGER_ROOT}/api"
    if [[ -f package.json ]]; then
        npm install
    fi

    # Install main project dependencies
    cd "$PROJECT_ROOT"
    if [[ -f package.json ]]; then
        npm install
    fi

    log_success "Node.js dependencies installed"
}

# Setup Docker environment
setup_docker_environment() {
    if [[ "$SKIP_DOCKER" == "true" ]]; then
        log_warning "Skipping Docker environment setup"
        return 0
    fi

    log_step "Setting up Docker environment..."

    # Verify Docker is running
    if ! docker info &> /dev/null; then
        log_error "Docker is not running. Please start Docker and try again"
        exit 1
    fi

    # Pull required Docker images
    pull_docker_images

    # Setup Docker networks
    setup_docker_networks

    log_success "Docker environment setup completed"
}

# Pull required Docker images
pull_docker_images() {
    log_info "Pulling required Docker images..."

    local images=(
        "hyperledger/fabric-peer:2.4"
        "hyperledger/fabric-orderer:2.4"
        "hyperledger/fabric-ca:1.5"
        "couchdb:3.1"
        "ipfs/go-ipfs:latest"
        "grafana/grafana:latest"
        "prom/prometheus:latest"
        "mongo:5.0"
        "redis:7-alpine"
    )

    for image in "${images[@]}"; do
        log_info "Pulling $image..."
        docker pull "$image" || log_warning "Failed to pull $image"
    done

    log_success "Docker images pulled successfully"
}

# Setup Docker networks
setup_docker_networks() {
    log_info "Setting up Docker networks..."

    # Create networks if they don't exist
    docker network create disease-zone-network 2>/dev/null || true
    docker network create fabric-network 2>/dev/null || true

    log_success "Docker networks configured"
}

# Initialize blockchain networks
initialize_networks() {
    if [[ "$SKIP_NETWORKS" == "true" ]]; then
        log_warning "Skipping network initialization"
        return 0
    fi

    log_step "Initializing blockchain networks..."

    # Start networks using network manager
    "${SCRIPT_DIR}/network-manager.sh" start all

    # Wait for networks to be ready
    sleep 10

    # Verify network health
    "${SCRIPT_DIR}/network-manager.sh" health

    log_success "Blockchain networks initialized"
}

# Deploy smart contracts
deploy_contracts() {
    if [[ "$SKIP_CONTRACTS" == "true" ]]; then
        log_warning "Skipping smart contract deployment"
        return 0
    fi

    log_step "Deploying smart contracts..."

    # Deploy to local networks
    "${SCRIPT_DIR}/deploy.sh" -n localhost -e development

    log_success "Smart contracts deployed"
}

# Create sample data
create_sample_data() {
    if [[ "$QUICK_MODE" == "true" ]]; then
        log_warning "Skipping sample data creation in quick mode"
        return 0
    fi

    log_step "Creating sample data..."

    # Create sample health records
    cd "${LEDGER_ROOT}/api"
    node scripts/create-sample-data.js || log_warning "Failed to create sample data"

    # Create test accounts with tokens
    "${SCRIPT_DIR}/token-manager.sh" mint 0x0000000000000000000000000000000000000001 1000 || log_warning "Failed to create test tokens"

    log_success "Sample data created"
}

# Run health checks
run_health_checks() {
    log_step "Running system health checks..."

    # Check all networks
    "${SCRIPT_DIR}/network-manager.sh" health

    # Check token contracts
    "${SCRIPT_DIR}/token-manager.sh" analytics || log_warning "Token analytics unavailable"

    # Check API endpoints
    check_api_endpoints

    log_success "Health checks completed"
}

# Check API endpoints
check_api_endpoints() {
    log_info "Checking API endpoints..."

    local endpoints=(
        "http://localhost:4000/health"
        "http://localhost:3000"
        "http://localhost:5001/api/v0/version"
    )

    for endpoint in "${endpoints[@]}"; do
        if curl -s "$endpoint" &> /dev/null; then
            log_success "✅ $endpoint"
        else
            log_warning "❌ $endpoint"
        fi
    done
}

# Clean existing installation
clean_installation() {
    if [[ "$CLEAN_INSTALL" != "true" ]]; then
        return 0
    fi

    log_step "Cleaning existing installation..."

    # Stop all networks
    "${SCRIPT_DIR}/network-manager.sh" stop all || true

    # Remove Docker volumes
    docker volume prune -f || true

    # Clean Node.js dependencies
    find "$LEDGER_ROOT" -name "node_modules" -type d -exec rm -rf {} + 2>/dev/null || true
    find "$LEDGER_ROOT" -name "package-lock.json" -delete 2>/dev/null || true

    # Clean build artifacts
    cd "${LEDGER_ROOT}/smart-contracts" && npm run clean 2>/dev/null || true

    log_success "Installation cleaned"
}

# Setup development tools
setup_development_tools() {
    log_step "Setting up development tools..."

    # Install global npm packages
    npm install -g hardhat-shorthand truffle ganache-cli

    # Setup VS Code extensions (if VS Code is installed)
    setup_vscode_extensions

    # Create useful aliases
    create_development_aliases

    log_success "Development tools configured"
}

# Setup VS Code extensions
setup_vscode_extensions() {
    if command -v code &> /dev/null; then
        log_info "Installing VS Code extensions..."

        local extensions=(
            "ms-vscode.vscode-json"
            "bradlc.vscode-tailwindcss"
            "esbenp.prettier-vscode"
            "ms-vscode.vscode-typescript-next"
        )

        for ext in "${extensions[@]}"; do
            code --install-extension "$ext" 2>/dev/null || true
        done
    fi
}

# Create development aliases
create_development_aliases() {
    log_info "Creating development aliases..."

    local alias_file="$HOME/.bash_aliases"

    cat >> "$alias_file" << EOF

# diseaseZone Development Aliases
alias dz-start='cd $LEDGER_ROOT && scripts/network-manager.sh start all'
alias dz-stop='cd $LEDGER_ROOT && scripts/network-manager.sh stop all'
alias dz-status='cd $LEDGER_ROOT && scripts/network-manager.sh status'
alias dz-logs='cd $LEDGER_ROOT && scripts/network-manager.sh logs'
alias dz-deploy='cd $LEDGER_ROOT && scripts/deploy.sh -n localhost'
alias dz-tokens='cd $LEDGER_ROOT && scripts/token-manager.sh'

EOF

    log_info "Aliases added to $alias_file"
}

# Show completion summary
show_completion_summary() {
    echo
    echo "==============================================="
    echo "          🎉 SETUP COMPLETED!"
    echo "==============================================="
    echo
    echo "diseaseZone development environment is ready!"
    echo
    echo "📍 Next Steps:"
    echo "  1. Source your environment: source ~/.bash_aliases"
    echo "  2. Start all networks: dz-start"
    echo "  3. Check status: dz-status"
    echo "  4. Access dashboard: http://localhost:3000"
    echo
    echo "🔗 Important URLs:"
    echo "  • Main Dashboard:     http://localhost:3000"
    echo "  • API Server:         http://localhost:4000"
    echo "  • Grafana Monitor:    http://localhost:3000"
    echo "  • IPFS Gateway:       http://localhost:8080"
    echo "  • Blockchain RPC:     http://localhost:8545"
    echo
    echo "📖 Documentation:"
    echo "  • Project README:     $PROJECT_ROOT/README.md"
    echo "  • Ledger README:      $LEDGER_ROOT/README.md"
    echo "  • API Docs:           $LEDGER_ROOT/api/README.md"
    echo
    echo "🛠️ Useful Commands:"
    echo "  • dz-start           Start all networks"
    echo "  • dz-stop            Stop all networks"
    echo "  • dz-status          Check network status"
    echo "  • dz-deploy          Deploy contracts"
    echo "  • dz-tokens          Manage HEALTH tokens"
    echo
    echo "Setup log: $SETUP_LOG"
    echo "==============================================="
}

# Main function
main() {
    show_banner
    parse_args "$@"

    log_info "Starting development environment setup with options:"
    log_info "  Skip dependencies: $SKIP_DEPS"
    log_info "  Skip Docker: $SKIP_DOCKER"
    log_info "  Skip contracts: $SKIP_CONTRACTS"
    log_info "  Skip networks: $SKIP_NETWORKS"
    log_info "  Quick mode: $QUICK_MODE"
    log_info "  Clean install: $CLEAN_INSTALL"

    # Setup steps
    clean_installation
    check_system_requirements
    install_dependencies
    setup_environment_config
    install_node_dependencies
    setup_docker_environment
    setup_development_tools
    initialize_networks
    deploy_contracts
    create_sample_data
    run_health_checks

    show_completion_summary

    log_success "Development environment setup completed at $(date)"
}

# Handle script interruption
trap 'log_error "Setup interrupted by user"; exit 1' INT TERM

# Run main function
main "$@"