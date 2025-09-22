#!/bin/bash

# Disable VPC Flow Logs and Cleanup Infrastructure
# This script removes VPC Flow Logs configuration and associated resources
# Use with caution - this will remove audit trail infrastructure

set -euo pipefail

# Configuration
REGION="us-east-1"
LOG_GROUP_NAME="/aws/vpc/flowlogs"
ROLE_NAME="VPCFlowLogsRole"
POLICY_NAME="VPCFlowLogsDeliveryRolePolicy"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# Confirmation prompt
confirm_cleanup() {
    warning "This script will disable VPC Flow Logs and remove associated infrastructure!"
    warning "This will affect HIPAA audit trail compliance and should only be done for maintenance."
    echo
    read -p "Are you sure you want to continue? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        log "Operation cancelled by user"
        exit 0
    fi
    
    log "User confirmed - proceeding with cleanup..."
}

# Check if AWS CLI is configured
check_aws_cli() {
    log "Checking AWS CLI configuration..."
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        error "AWS CLI not configured or credentials invalid"
        exit 1
    fi
    success "AWS CLI configured successfully"
}

# Disable VPC Flow Logs for a specific VPC
disable_flow_logs_for_vpc() {
    local vpc_id=$1
    local vpc_name=$2
    
    log "Disabling VPC Flow Logs for $vpc_name ($vpc_id)..."
    
    # Get existing flow logs
    flow_log_ids=$(aws ec2 describe-flow-logs \
        --filter "Name=resource-id,Values=$vpc_id" \
        --region "$REGION" \
        --query 'FlowLogs[?FlowLogStatus==`ACTIVE`].FlowLogId' \
        --output text)
    
    if [ -z "$flow_log_ids" ] || [ "$flow_log_ids" = "None" ]; then
        warning "No active VPC Flow Logs found for $vpc_name ($vpc_id)"
        return 0
    fi
    
    # Delete each flow log
    for flow_log_id in $flow_log_ids; do
        log "Deleting Flow Log: $flow_log_id"
        
        aws ec2 delete-flow-logs \
            --flow-log-ids "$flow_log_id" \
            --region "$REGION" >/dev/null
        
        success "Deleted Flow Log: $flow_log_id"
    done
}

# Delete CloudWatch Log Group
delete_log_group() {
    log "Checking CloudWatch Log Group: $LOG_GROUP_NAME"
    
    if aws logs describe-log-groups --log-group-name-prefix "$LOG_GROUP_NAME" --region "$REGION" | grep -q "$LOG_GROUP_NAME"; then
        warning "Deleting CloudWatch Log Group: $LOG_GROUP_NAME"
        warning "This will permanently delete all VPC Flow Log data!"
        
        aws logs delete-log-group \
            --log-group-name "$LOG_GROUP_NAME" \
            --region "$REGION"
        
        success "Deleted CloudWatch Log Group: $LOG_GROUP_NAME"
    else
        log "CloudWatch Log Group $LOG_GROUP_NAME does not exist"
    fi
}

# Delete IAM role and policy
delete_iam_role() {
    log "Checking IAM role: $ROLE_NAME"
    
    if aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
        log "Deleting IAM role policy: $POLICY_NAME"
        
        # Delete role policy first
        if aws iam get-role-policy --role-name "$ROLE_NAME" --policy-name "$POLICY_NAME" >/dev/null 2>&1; then
            aws iam delete-role-policy \
                --role-name "$ROLE_NAME" \
                --policy-name "$POLICY_NAME"
            success "Deleted IAM role policy: $POLICY_NAME"
        fi
        
        # Delete role
        aws iam delete-role --role-name "$ROLE_NAME"
        success "Deleted IAM role: $ROLE_NAME"
    else
        log "IAM role $ROLE_NAME does not exist"
    fi
}

# Main execution
main() {
    log "Starting VPC Flow Logs cleanup..."
    
    confirm_cleanup
    check_aws_cli
    
    # Production VPCs
    declare -A PRODUCTION_VPCS
    PRODUCTION_VPCS[vpc-0a9c767f1b147a41e]="diseasezone-vpc-prod"
    PRODUCTION_VPCS[vpc-0bd46897104d2fe59]="nitetext-vpc"
    PRODUCTION_VPCS[vpc-0c1b813880b3982a5]="afterdarksys-vpc"
    PRODUCTION_VPCS[vpc-04852ad6e57019344]="ninelives-prod-vpc"
    
    log "Disabling VPC Flow Logs for production VPCs..."
    
    for vpc_id in "${!PRODUCTION_VPCS[@]}"; do
        vpc_name="${PRODUCTION_VPCS[$vpc_id]}"
        disable_flow_logs_for_vpc "$vpc_id" "$vpc_name"
    done
    
    # Wait for flow logs to be fully deleted
    log "Waiting for flow logs to be fully deleted..."
    sleep 5
    
    # Delete supporting infrastructure
    delete_log_group
    delete_iam_role
    
    success "VPC Flow Logs cleanup completed successfully!"
    
    warning "HIPAA Compliance Impact:"
    warning "❌ Network traffic monitoring disabled"
    warning "❌ Audit trail requirements no longer met"
    warning "❌ Log retention policies removed"
    
    log "To re-enable VPC Flow Logs for HIPAA compliance:"
    log "  ./scripts/enable-vpc-flow-logs.sh"
}

# Execute main function
main "$@"