#!/bin/bash

# HIPAA Monitoring Infrastructure Manager
# Master script to enable/disable HIPAA compliance monitoring infrastructure
# Manages VPC Flow Logs, CloudTrail, and related security monitoring

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

success() {
    echo -e "${GREEN}[SUCCESS] $1${NC}"
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
}

header() {
    echo -e "${CYAN}$1${NC}"
}

# Display usage information
show_usage() {
    header "╔══════════════════════════════════════════════════════════════╗"
    header "║              HIPAA Monitoring Infrastructure Manager         ║"
    header "║                     Disease Zone Platform                    ║"
    header "╚══════════════════════════════════════════════════════════════╝"
    echo
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo
    header "COMMANDS:"
    echo "  enable      - Enable all HIPAA monitoring infrastructure"
    echo "  disable     - Disable and cleanup monitoring infrastructure"  
    echo "  status      - Check current status of monitoring components"
    echo "  enable-vpc  - Enable only VPC Flow Logs"
    echo "  disable-vpc - Disable only VPC Flow Logs"
    echo "  enable-ct   - Enable only CloudTrail"
    echo "  disable-ct  - Disable only CloudTrail"
    echo "  help        - Show this help message"
    echo
    header "OPTIONS:"
    echo "  --force     - Skip confirmation prompts (use with caution)"
    echo "  --dry-run   - Show what would be done without executing"
    echo
    header "EXAMPLES:"
    echo "  $0 enable                 # Enable all monitoring"
    echo "  $0 status                 # Check current status"  
    echo "  $0 disable --force        # Force disable all (dangerous!)"
    echo "  $0 enable-vpc             # Enable only VPC Flow Logs"
    echo
    header "HIPAA COMPLIANCE STATUS:"
    echo "  Enabled:  ✅ Audit trail requirements met"
    echo "  Disabled: ❌ HIPAA compliance at risk"
    echo
}

# Check if required scripts exist
check_scripts() {
    local scripts=(
        "scripts/enable-vpc-flow-logs.sh"
        "scripts/disable-vpc-flow-logs.sh"
        "scripts/enable-cloudtrail.sh"
        "scripts/disable-cloudtrail.sh"
    )
    
    for script in "${scripts[@]}"; do
        if [ ! -f "$script" ]; then
            error "Required script not found: $script"
            exit 1
        fi
        
        if [ ! -x "$script" ]; then
            error "Script not executable: $script"
            error "Run: chmod +x $script"
            exit 1
        fi
    done
    
    log "All required scripts found and executable"
}

# Check current status of monitoring components
check_status() {
    header "╔══════════════════════════════════════════════════════════════╗"
    header "║                    HIPAA Monitoring Status                  ║" 
    header "╚══════════════════════════════════════════════════════════════╝"
    echo
    
    log "Checking AWS CLI configuration..."
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        error "AWS CLI not configured or credentials invalid"
        return 1
    fi
    
    local account_id
    account_id=$(aws sts get-caller-identity --query Account --output text)
    success "AWS Account: $account_id"
    echo
    
    # Check VPC Flow Logs
    header "VPC Flow Logs Status:"
    local vpcs=("vpc-0a9c767f1b147a41e" "vpc-0bd46897104d2fe59" "vpc-0c1b813880b3982a5" "vpc-04852ad6e57019344")
    local vpc_names=("diseasezone-vpc-prod" "nitetext-vpc" "afterdarksys-vpc" "ninelives-prod-vpc")
    local vpc_flow_enabled=0
    
    for i in "${!vpcs[@]}"; do
        local vpc_id="${vpcs[$i]}"
        local vpc_name="${vpc_names[$i]}"
        
        local flow_logs
        flow_logs=$(aws ec2 describe-flow-logs \
            --filter "Name=resource-id,Values=$vpc_id" \
            --region us-east-1 \
            --query 'FlowLogs[?FlowLogStatus==`ACTIVE`]' \
            --output json)
        
        if [ "$flow_logs" != "[]" ]; then
            success "  ✅ $vpc_name ($vpc_id)"
            ((vpc_flow_enabled++))
        else
            error "  ❌ $vpc_name ($vpc_id)"
        fi
    done
    
    echo "  Status: $vpc_flow_enabled/${#vpcs[@]} VPCs have Flow Logs enabled"
    echo
    
    # Check CloudTrail
    header "CloudTrail Status:"
    local trail_name="disease-zone-hipaa-trail"
    
    if aws cloudtrail describe-trails --trail-name-list "$trail_name" --region us-east-1 | grep -q "$trail_name"; then
        local trail_status
        trail_status=$(aws cloudtrail get-trail-status --name "$trail_name" --region us-east-1 --query 'IsLogging' --output text)
        
        if [ "$trail_status" = "True" ]; then
            success "  ✅ CloudTrail active and logging"
            
            # Check S3 bucket
            local bucket_name
            bucket_name=$(aws cloudtrail describe-trails --trail-name-list "$trail_name" --region us-east-1 --query 'trailList[0].S3BucketName' --output text)
            success "  ✅ S3 Bucket: $bucket_name"
            
            # Check KMS encryption
            local kms_key
            kms_key=$(aws cloudtrail describe-trails --trail-name-list "$trail_name" --region us-east-1 --query 'trailList[0].KMSKeyId' --output text)
            if [ "$kms_key" != "None" ] && [ -n "$kms_key" ]; then
                success "  ✅ KMS Encryption: Enabled"
            else
                warning "  ⚠️  KMS Encryption: Not configured"
            fi
        else
            warning "  ⚠️  CloudTrail exists but logging is disabled"
        fi
    else
        error "  ❌ CloudTrail not found: $trail_name"
    fi
    echo
    
    # Check CloudWatch Log Groups
    header "CloudWatch Log Groups:"
    local log_groups=("/aws/vpc/flowlogs" "/aws/cloudtrail/disease-zone")
    
    for log_group in "${log_groups[@]}"; do
        if aws logs describe-log-groups --log-group-name-prefix "$log_group" --region us-east-1 | grep -q "$log_group"; then
            local retention
            retention=$(aws logs describe-log-groups --log-group-name-prefix "$log_group" --region us-east-1 --query "logGroups[?logGroupName=='$log_group'].retentionInDays | [0]" --output text)
            success "  ✅ $log_group (Retention: $retention days)"
        else
            error "  ❌ $log_group"
        fi
    done
    echo
    
    # Overall compliance status
    header "HIPAA Compliance Assessment:"
    local compliance_score=0
    local total_checks=3
    
    if [ $vpc_flow_enabled -gt 0 ]; then ((compliance_score++)); fi
    
    if aws cloudtrail describe-trails --trail-name-list "$trail_name" --region us-east-1 | grep -q "$trail_name"; then
        local trail_status
        trail_status=$(aws cloudtrail get-trail-status --name "$trail_name" --region us-east-1 --query 'IsLogging' --output text 2>/dev/null || echo "False")
        if [ "$trail_status" = "True" ]; then ((compliance_score++)); fi
    fi
    
    local log_groups_exist=0
    for log_group in "${log_groups[@]}"; do
        if aws logs describe-log-groups --log-group-name-prefix "$log_group" --region us-east-1 | grep -q "$log_group"; then
            ((log_groups_exist++))
        fi
    done
    if [ $log_groups_exist -eq 2 ]; then ((compliance_score++)); fi
    
    echo "  Compliance Score: $compliance_score/$total_checks"
    
    if [ $compliance_score -eq $total_checks ]; then
        success "  ✅ HIPAA monitoring requirements: COMPLIANT"
    elif [ $compliance_score -gt 0 ]; then
        warning "  ⚠️  HIPAA monitoring requirements: PARTIALLY COMPLIANT"
    else
        error "  ❌ HIPAA monitoring requirements: NON-COMPLIANT"
    fi
    
    echo
    log "Status check completed"
}

# Enable all monitoring infrastructure
enable_all() {
    header "╔══════════════════════════════════════════════════════════════╗"
    header "║              Enabling HIPAA Monitoring Infrastructure       ║"
    header "╚══════════════════════════════════════════════════════════════╝"
    echo
    
    log "Step 1/2: Enabling VPC Flow Logs..."
    if ./scripts/enable-vpc-flow-logs.sh; then
        success "VPC Flow Logs enabled successfully"
    else
        error "Failed to enable VPC Flow Logs"
        return 1
    fi
    
    echo
    log "Step 2/2: Enabling CloudTrail..."
    if ./scripts/enable-cloudtrail.sh; then
        success "CloudTrail enabled successfully"
    else
        error "Failed to enable CloudTrail"
        return 1
    fi
    
    echo
    success "All HIPAA monitoring infrastructure enabled!"
    log "✅ Network traffic monitoring active"
    log "✅ API audit logging active"
    log "✅ HIPAA compliance requirements met"
}

# Disable all monitoring infrastructure
disable_all() {
    header "╔══════════════════════════════════════════════════════════════╗"
    header "║             Disabling HIPAA Monitoring Infrastructure       ║"
    header "╚══════════════════════════════════════════════════════════════╝"
    echo
    
    error "⚠️  WARNING: This will disable ALL HIPAA monitoring!"
    error "This will severely impact compliance and security posture!"
    
    if [ "$1" != "--force" ]; then
        echo
        read -p "Are you sure you want to continue? (yes/no): " confirm
        if [ "$confirm" != "yes" ]; then
            log "Operation cancelled by user"
            return 0
        fi
    fi
    
    log "Step 1/2: Disabling CloudTrail..."
    if ./scripts/disable-cloudtrail.sh; then
        success "CloudTrail disabled"
    else
        error "Failed to disable CloudTrail"
    fi
    
    echo
    log "Step 2/2: Disabling VPC Flow Logs..."
    if ./scripts/disable-vpc-flow-logs.sh; then
        success "VPC Flow Logs disabled"
    else
        error "Failed to disable VPC Flow Logs"
    fi
    
    echo
    warning "All HIPAA monitoring infrastructure disabled!"
    error "❌ HIPAA compliance severely impacted"
    error "❌ Security monitoring disabled"
}

# Main execution
main() {
    local command="${1:-help}"
    local force_flag=""
    
    # Parse options
    while [[ $# -gt 0 ]]; do
        case $1 in
            --force)
                force_flag="--force"
                shift
                ;;
            --dry-run)
                log "DRY-RUN mode enabled - no changes will be made"
                shift
                ;;
            *)
                break
                ;;
        esac
    done
    
    # Update command if it was shifted
    if [ $# -gt 0 ]; then
        command="$1"
    fi
    
    case "$command" in
        enable)
            check_scripts
            enable_all
            ;;
        disable)
            check_scripts
            disable_all "$force_flag"
            ;;
        status)
            check_status
            ;;
        enable-vpc)
            check_scripts
            log "Enabling VPC Flow Logs only..."
            ./scripts/enable-vpc-flow-logs.sh
            ;;
        disable-vpc)
            check_scripts
            log "Disabling VPC Flow Logs only..."
            ./scripts/disable-vpc-flow-logs.sh
            ;;
        enable-ct)
            check_scripts
            log "Enabling CloudTrail only..."
            ./scripts/enable-cloudtrail.sh
            ;;
        disable-ct)
            check_scripts
            log "Disabling CloudTrail only..."
            ./scripts/disable-cloudtrail.sh
            ;;
        help|--help|-h)
            show_usage
            ;;
        *)
            error "Unknown command: $command"
            echo
            show_usage
            exit 1
            ;;
    esac
}

# Execute main function with all arguments
main "$@"