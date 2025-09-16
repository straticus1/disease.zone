#!/bin/bash

# =============================================================================
# HEALTH Token Management Script
# =============================================================================
# Comprehensive token management for the HEALTH token ecosystem
# Features: minting, burning, transfers, airdrops, vesting, analytics
# =============================================================================

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
LEDGER_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${LEDGER_ROOT}/.env"
TOKEN_LOG="${LEDGER_ROOT}/logs/token-operations.log"

# Default values
NETWORK="localhost"
COMMAND=""
AMOUNT=""
ADDRESS=""
RECIPIENT=""
CSV_FILE=""

# Create logs directory if it doesn't exist
mkdir -p "${LEDGER_ROOT}/logs"

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$TOKEN_LOG"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$TOKEN_LOG"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$TOKEN_LOG"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$TOKEN_LOG"
}

log_token() {
    echo -e "${PURPLE}[TOKEN]${NC} $1" | tee -a "$TOKEN_LOG"
}

# Help function
show_help() {
    cat << EOF
HEALTH Token Management Script

Usage: $0 [COMMAND] [OPTIONS]

COMMANDS:
    balance ADDRESS                 Check token balance for address
    mint ADDRESS AMOUNT            Mint tokens to address (admin only)
    burn AMOUNT                    Burn tokens from caller's address
    transfer FROM TO AMOUNT        Transfer tokens between addresses
    airdrop CSV_FILE               Distribute tokens via CSV file
    analytics                      Show token analytics and statistics
    vesting ADDRESS                Show vesting schedule for address
    holders                        List all token holders
    supply                         Show token supply information
    rewards RECIPIENT AMOUNT       Issue reward tokens for health data
    validate ADDRESS               Validate if address can receive tokens

OPTIONS:
    -n, --network NETWORK          Target network (localhost, polygon-mumbai, polygon-mainnet)
    -f, --from ADDRESS             Source address for transfers
    -t, --to ADDRESS               Destination address for transfers
    -a, --amount AMOUNT            Token amount (in HEALTH tokens)
    -c, --csv FILE                 CSV file for bulk operations
    --wei                          Amount is in wei units instead of HEALTH
    --dry-run                      Preview operation without executing
    -h, --help                     Show this help message

CSV FORMAT (for airdrops):
    address,amount,reason
    0x1234...,100,Early supporter reward
    0x5678...,50,Beta tester bonus

EXAMPLES:
    $0 balance 0x1234567890123456789012345678901234567890
    $0 mint 0x1234567890123456789012345678901234567890 1000
    $0 transfer --from 0xABC... --to 0xDEF... --amount 500
    $0 airdrop --csv rewards.csv --network polygon-mumbai
    $0 analytics --network polygon-mainnet
    $0 rewards 0x1234567890123456789012345678901234567890 25

TOKEN ECONOMICS:
    Total Supply:     1,000,000,000 HEALTH
    Decimals:         18
    Symbol:           HEALTH
    Patient Rewards:  400M (40%)
    Medical Rewards:  250M (25%)
    Research Fund:    200M (20%)
    Public Reserve:   100M (10%)
    Team Allocation:  50M (5%)

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
            -n|--network)
                NETWORK="$2"
                shift 2
                ;;
            -f|--from)
                FROM_ADDRESS="$2"
                shift 2
                ;;
            -t|--to)
                TO_ADDRESS="$2"
                shift 2
                ;;
            -a|--amount)
                AMOUNT="$2"
                shift 2
                ;;
            -c|--csv)
                CSV_FILE="$2"
                shift 2
                ;;
            --wei)
                USE_WEI=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                # Handle positional arguments based on command
                case "$COMMAND" in
                    balance)
                        ADDRESS="$1"
                        shift
                        ;;
                    mint)
                        if [[ -z "$ADDRESS" ]]; then
                            ADDRESS="$1"
                            shift
                        elif [[ -z "$AMOUNT" ]]; then
                            AMOUNT="$1"
                            shift
                        else
                            log_error "Unknown argument: $1"
                            exit 1
                        fi
                        ;;
                    transfer)
                        if [[ -z "$FROM_ADDRESS" ]]; then
                            FROM_ADDRESS="$1"
                            shift
                        elif [[ -z "$TO_ADDRESS" ]]; then
                            TO_ADDRESS="$1"
                            shift
                        elif [[ -z "$AMOUNT" ]]; then
                            AMOUNT="$1"
                            shift
                        else
                            log_error "Unknown argument: $1"
                            exit 1
                        fi
                        ;;
                    rewards)
                        if [[ -z "$RECIPIENT" ]]; then
                            RECIPIENT="$1"
                            shift
                        elif [[ -z "$AMOUNT" ]]; then
                            AMOUNT="$1"
                            shift
                        else
                            log_error "Unknown argument: $1"
                            exit 1
                        fi
                        ;;
                    validate)
                        ADDRESS="$1"
                        shift
                        ;;
                    airdrop)
                        if [[ -z "$CSV_FILE" ]]; then
                            CSV_FILE="$1"
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

# Validate environment and load contract info
validate_environment() {
    log_info "Validating environment for network: $NETWORK"

    # Check environment file
    if [[ ! -f "$ENV_FILE" ]]; then
        log_error ".env file not found: $ENV_FILE"
        exit 1
    fi

    # Load environment variables
    source "$ENV_FILE"

    # Check contract deployment
    local contract_file="${LEDGER_ROOT}/smart-contracts/deployments/${NETWORK}/HealthToken.json"
    if [[ ! -f "$contract_file" ]]; then
        log_error "HEALTH token not deployed on $NETWORK. Run deploy.sh first."
        exit 1
    fi

    # Load contract address
    TOKEN_ADDRESS=$(cat "$contract_file" | jq -r '.address')
    log_success "HEALTH token found at: $TOKEN_ADDRESS"
}

# Convert HEALTH tokens to wei
to_wei() {
    local amount="$1"
    if [[ "$USE_WEI" == "true" ]]; then
        echo "$amount"
    else
        # Convert HEALTH to wei (18 decimals)
        node -e "console.log((parseFloat('$amount') * Math.pow(10, 18)).toString())"
    fi
}

# Convert wei to HEALTH tokens
from_wei() {
    local amount="$1"
    node -e "console.log((parseFloat('$amount') / Math.pow(10, 18)).toFixed(6))"
}

# Check token balance
check_balance() {
    local address="$1"

    log_info "Checking HEALTH token balance for $address"

    cd "${LEDGER_ROOT}/smart-contracts"

    local balance=$(npx hardhat run --network "$NETWORK" scripts/get-balance.js --address "$address")
    local balance_formatted=$(from_wei "$balance")

    log_token "Balance: $balance_formatted HEALTH ($balance wei)"

    return 0
}

# Mint tokens (admin only)
mint_tokens() {
    local recipient="$1"
    local amount="$2"

    if [[ -z "$recipient" ]] || [[ -z "$amount" ]]; then
        log_error "Recipient address and amount required for minting"
        exit 1
    fi

    local amount_wei=$(to_wei "$amount")
    local amount_formatted=$(from_wei "$amount_wei")

    log_info "Minting $amount_formatted HEALTH tokens to $recipient"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_warning "DRY RUN: Would mint $amount_formatted HEALTH tokens"
        return 0
    fi

    cd "${LEDGER_ROOT}/smart-contracts"

    # Execute mint transaction
    npx hardhat run --network "$NETWORK" scripts/mint-tokens.js \
        --recipient "$recipient" \
        --amount "$amount_wei"

    log_success "Successfully minted $amount_formatted HEALTH tokens to $recipient"
}

# Burn tokens
burn_tokens() {
    local amount="$1"

    if [[ -z "$amount" ]]; then
        log_error "Amount required for burning"
        exit 1
    fi

    local amount_wei=$(to_wei "$amount")
    local amount_formatted=$(from_wei "$amount_wei")

    log_info "Burning $amount_formatted HEALTH tokens"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_warning "DRY RUN: Would burn $amount_formatted HEALTH tokens"
        return 0
    fi

    cd "${LEDGER_ROOT}/smart-contracts"

    npx hardhat run --network "$NETWORK" scripts/burn-tokens.js --amount "$amount_wei"

    log_success "Successfully burned $amount_formatted HEALTH tokens"
}

# Transfer tokens
transfer_tokens() {
    local from="$1"
    local to="$2"
    local amount="$3"

    if [[ -z "$from" ]] || [[ -z "$to" ]] || [[ -z "$amount" ]]; then
        log_error "From address, to address, and amount required for transfer"
        exit 1
    fi

    local amount_wei=$(to_wei "$amount")
    local amount_formatted=$(from_wei "$amount_wei")

    log_info "Transferring $amount_formatted HEALTH tokens from $from to $to"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_warning "DRY RUN: Would transfer $amount_formatted HEALTH tokens"
        return 0
    fi

    cd "${LEDGER_ROOT}/smart-contracts"

    npx hardhat run --network "$NETWORK" scripts/transfer-tokens.js \
        --from "$from" \
        --to "$to" \
        --amount "$amount_wei"

    log_success "Successfully transferred $amount_formatted HEALTH tokens"
}

# Airdrop tokens from CSV
airdrop_tokens() {
    local csv_file="$1"

    if [[ -z "$csv_file" ]] || [[ ! -f "$csv_file" ]]; then
        log_error "Valid CSV file required for airdrop"
        exit 1
    fi

    log_info "Processing airdrop from CSV file: $csv_file"

    # Validate CSV format
    local line_count=$(wc -l < "$csv_file")
    log_info "Found $((line_count - 1)) recipients in CSV file"

    # Process CSV file (skip header)
    local total_amount=0
    local recipient_count=0

    while IFS=',' read -r address amount reason; do
        # Skip header line
        if [[ "$address" == "address" ]]; then
            continue
        fi

        # Validate address format
        if [[ ! "$address" =~ ^0x[a-fA-F0-9]{40}$ ]]; then
            log_warning "Invalid address format: $address, skipping..."
            continue
        fi

        local amount_wei=$(to_wei "$amount")
        local amount_formatted=$(from_wei "$amount_wei")

        log_info "Airdrop: $amount_formatted HEALTH → $address ($reason)"

        if [[ "$DRY_RUN" != "true" ]]; then
            # Execute transfer
            cd "${LEDGER_ROOT}/smart-contracts"
            npx hardhat run --network "$NETWORK" scripts/airdrop-single.js \
                --recipient "$address" \
                --amount "$amount_wei" \
                --reason "$reason"
        fi

        total_amount=$(node -e "console.log($total_amount + $amount)")
        recipient_count=$((recipient_count + 1))

        # Add small delay to avoid overwhelming the network
        sleep 0.5
    done < "$csv_file"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_warning "DRY RUN: Would airdrop $total_amount HEALTH tokens to $recipient_count recipients"
    else
        log_success "Airdrop completed: $total_amount HEALTH tokens distributed to $recipient_count recipients"
    fi
}

# Show token analytics
show_analytics() {
    log_info "Generating HEALTH token analytics for network: $NETWORK"

    cd "${LEDGER_ROOT}/smart-contracts"

    echo
    echo "==============================================="
    echo "          HEALTH TOKEN ANALYTICS"
    echo "==============================================="

    # Get basic token info
    local total_supply=$(npx hardhat run --network "$NETWORK" scripts/get-total-supply.js)
    local circulating_supply=$(npx hardhat run --network "$NETWORK" scripts/get-circulating-supply.js)
    local holder_count=$(npx hardhat run --network "$NETWORK" scripts/get-holder-count.js)

    echo "Token Address:      $TOKEN_ADDRESS"
    echo "Network:            $NETWORK"
    echo "Total Supply:       $(from_wei $total_supply) HEALTH"
    echo "Circulating:        $(from_wei $circulating_supply) HEALTH"
    echo "Unique Holders:     $holder_count"
    echo

    # Distribution breakdown
    echo "DISTRIBUTION BREAKDOWN:"
    echo "  Patient Rewards:   $(from_wei $(node -e "console.log($total_supply * 0.4)")) HEALTH (40%)"
    echo "  Medical Rewards:   $(from_wei $(node -e "console.log($total_supply * 0.25)")) HEALTH (25%)"
    echo "  Research Fund:     $(from_wei $(node -e "console.log($total_supply * 0.20)")) HEALTH (20%)"
    echo "  Public Reserve:    $(from_wei $(node -e "console.log($total_supply * 0.10)")) HEALTH (10%)"
    echo "  Team Allocation:   $(from_wei $(node -e "console.log($total_supply * 0.05)")) HEALTH (5%)"
    echo

    # Recent activity
    echo "RECENT ACTIVITY (Last 24h):"
    npx hardhat run --network "$NETWORK" scripts/get-recent-activity.js

    echo "==============================================="
}

# Issue reward tokens for health data contribution
issue_rewards() {
    local recipient="$1"
    local amount="$2"

    if [[ -z "$recipient" ]] || [[ -z "$amount" ]]; then
        log_error "Recipient address and amount required for rewards"
        exit 1
    fi

    local amount_wei=$(to_wei "$amount")
    local amount_formatted=$(from_wei "$amount_wei")

    log_info "Issuing $amount_formatted HEALTH tokens as health data reward to $recipient"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_warning "DRY RUN: Would issue $amount_formatted HEALTH tokens as reward"
        return 0
    fi

    cd "${LEDGER_ROOT}/smart-contracts"

    # Issue reward with proper categorization
    npx hardhat run --network "$NETWORK" scripts/issue-reward.js \
        --recipient "$recipient" \
        --amount "$amount_wei" \
        --category "health_data_contribution"

    log_success "Successfully issued $amount_formatted HEALTH tokens as reward"

    # Log the reward for analytics
    echo "$(date -u +"%Y-%m-%dT%H:%M:%SZ"),$recipient,$amount_formatted,health_data_contribution" >> "${LEDGER_ROOT}/logs/rewards.csv"
}

# Validate address for token operations
validate_address() {
    local address="$1"

    if [[ -z "$address" ]]; then
        log_error "Address required for validation"
        exit 1
    fi

    log_info "Validating address: $address"

    # Check address format
    if [[ ! "$address" =~ ^0x[a-fA-F0-9]{40}$ ]]; then
        log_error "Invalid Ethereum address format"
        exit 1
    fi

    cd "${LEDGER_ROOT}/smart-contracts"

    # Check if address can receive tokens (not blacklisted, contract compatibility, etc.)
    local is_valid=$(npx hardhat run --network "$NETWORK" scripts/validate-recipient.js --address "$address")

    if [[ "$is_valid" == "true" ]]; then
        log_success "Address is valid for token operations"
    else
        log_error "Address cannot receive tokens (may be blacklisted or incompatible)"
        exit 1
    fi
}

# List token holders
list_holders() {
    log_info "Retrieving HEALTH token holders for network: $NETWORK"

    cd "${LEDGER_ROOT}/smart-contracts"

    echo
    echo "==============================================="
    echo "          HEALTH TOKEN HOLDERS"
    echo "==============================================="

    npx hardhat run --network "$NETWORK" scripts/list-holders.js

    echo "==============================================="
}

# Show token supply information
show_supply() {
    log_info "Retrieving HEALTH token supply information"

    cd "${LEDGER_ROOT}/smart-contracts"

    echo
    echo "==============================================="
    echo "          HEALTH TOKEN SUPPLY"
    echo "==============================================="

    local total_supply=$(npx hardhat run --network "$NETWORK" scripts/get-total-supply.js)
    local circulating_supply=$(npx hardhat run --network "$NETWORK" scripts/get-circulating-supply.js)
    local burned_tokens=$(npx hardhat run --network "$NETWORK" scripts/get-burned-tokens.js)

    echo "Total Supply:       $(from_wei $total_supply) HEALTH"
    echo "Circulating Supply: $(from_wei $circulating_supply) HEALTH"
    echo "Burned Tokens:      $(from_wei $burned_tokens) HEALTH"
    echo "Available to Mint:  $(from_wei $(node -e "console.log($total_supply - $circulating_supply)")) HEALTH"

    echo "==============================================="
}

# Main function
main() {
    log_info "Starting HEALTH token management operation: $COMMAND"

    parse_args "$@"
    validate_environment

    case "$COMMAND" in
        balance)
            check_balance "$ADDRESS"
            ;;
        mint)
            mint_tokens "$ADDRESS" "$AMOUNT"
            ;;
        burn)
            burn_tokens "$AMOUNT"
            ;;
        transfer)
            transfer_tokens "$FROM_ADDRESS" "$TO_ADDRESS" "$AMOUNT"
            ;;
        airdrop)
            airdrop_tokens "$CSV_FILE"
            ;;
        analytics)
            show_analytics
            ;;
        rewards)
            issue_rewards "$RECIPIENT" "$AMOUNT"
            ;;
        validate)
            validate_address "$ADDRESS"
            ;;
        holders)
            list_holders
            ;;
        supply)
            show_supply
            ;;
        *)
            log_error "Unknown command: $COMMAND"
            show_help
            exit 1
            ;;
    esac

    log_success "Token management operation completed successfully"
}

# Handle script interruption
trap 'log_error "Token operation interrupted by user"; exit 1' INT TERM

# Run main function
main "$@"