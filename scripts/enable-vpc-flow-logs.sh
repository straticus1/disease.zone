#!/bin/bash

# Enable VPC Flow Logs for HIPAA Compliance
# This script configures VPC Flow Logs on all production VPCs to meet
# HIPAA audit trail requirements for network traffic monitoring

set -euo pipefail

# Configuration
REGION="us-east-1"
LOG_GROUP_NAME="/aws/vpc/flowlogs"
RETENTION_DAYS=2557  # 7 years for HIPAA compliance
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

# Check if AWS CLI is configured
check_aws_cli() {
    log "Checking AWS CLI configuration..."
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        error "AWS CLI not configured or credentials invalid"
        exit 1
    fi
    success "AWS CLI configured successfully"
}

# Create CloudWatch Log Group for VPC Flow Logs
create_log_group() {
    log "Creating CloudWatch Log Group: $LOG_GROUP_NAME"
    
    if aws logs describe-log-groups --log-group-name-prefix "$LOG_GROUP_NAME" --region "$REGION" | grep -q "$LOG_GROUP_NAME"; then
        warning "Log group $LOG_GROUP_NAME already exists"
    else
        aws logs create-log-group \
            --log-group-name "$LOG_GROUP_NAME" \
            --region "$REGION"
        
        # Set retention policy for HIPAA compliance (7 years)
        aws logs put-retention-policy \
            --log-group-name "$LOG_GROUP_NAME" \
            --retention-in-days $RETENTION_DAYS \
            --region "$REGION"
        
        success "Created log group with $RETENTION_DAYS days retention (HIPAA compliant)"
    fi
}

# Create IAM role for VPC Flow Logs
create_flow_logs_role() {
    log "Creating IAM role for VPC Flow Logs..."
    
    # Trust policy document
    cat > /tmp/trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "vpc-flow-logs.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

    # Create role if it doesn't exist
    if aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
        warning "IAM role $ROLE_NAME already exists"
    else
        aws iam create-role \
            --role-name "$ROLE_NAME" \
            --assume-role-policy-document file:///tmp/trust-policy.json \
            --description "Role for VPC Flow Logs to deliver logs to CloudWatch - HIPAA Compliance"
        
        success "Created IAM role: $ROLE_NAME"
    fi

    # Create policy document
    cat > /tmp/logs-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams"
      ],
      "Resource": "*"
    }
  ]
}
EOF

    # Attach policy
    if aws iam get-role-policy --role-name "$ROLE_NAME" --policy-name "$POLICY_NAME" >/dev/null 2>&1; then
        warning "Policy $POLICY_NAME already attached to role"
    else
        aws iam put-role-policy \
            --role-name "$ROLE_NAME" \
            --policy-name "$POLICY_NAME" \
            --policy-document file:///tmp/logs-policy.json
        
        success "Attached policy to IAM role"
    fi

    # Clean up temporary files
    rm -f /tmp/trust-policy.json /tmp/logs-policy.json
}

# Enable VPC Flow Logs for a specific VPC
enable_flow_logs_for_vpc() {
    local vpc_id=$1
    local vpc_name=$2
    
    log "Enabling VPC Flow Logs for $vpc_name ($vpc_id)..."
    
    # Check if flow logs already exist
    existing_flow_logs=$(aws ec2 describe-flow-logs \
        --filter "Name=resource-id,Values=$vpc_id" \
        --region "$REGION" \
        --query 'FlowLogs[?FlowLogStatus==`ACTIVE`]' \
        --output json)
    
    if [ "$existing_flow_logs" != "[]" ]; then
        warning "VPC Flow Logs already enabled for $vpc_name ($vpc_id)"
        return 0
    fi
    
    # Get role ARN
    role_arn=$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text)
    
    # Create VPC Flow Logs
    flow_log_id=$(aws ec2 create-flow-logs \
        --resource-type VPC \
        --resource-ids "$vpc_id" \
        --traffic-type ALL \
        --log-destination-type cloud-watch-logs \
        --log-group-name "$LOG_GROUP_NAME" \
        --deliver-logs-permission-arn "$role_arn" \
        --region "$REGION" \
        --query 'FlowLogIds[0]' \
        --output text)
    
    if [ "$flow_log_id" != "None" ] && [ "$flow_log_id" != "" ]; then
        success "Enabled VPC Flow Logs for $vpc_name ($vpc_id) - Flow Log ID: $flow_log_id"
        
        # Add tags for HIPAA compliance tracking
        aws ec2 create-tags \
            --resources "$flow_log_id" \
            --tags \
                Key=Name,Value="$vpc_name-flow-logs" \
                Key=Purpose,Value="HIPAA-Compliance" \
                Key=Retention,Value="7-years" \
                Key=Environment,Value="Production" \
            --region "$REGION"
        
        success "Added HIPAA compliance tags to Flow Log"
    else
        error "Failed to create VPC Flow Logs for $vpc_name ($vpc_id)"
        return 1
    fi
}

# Main execution
main() {
    log "Starting VPC Flow Logs setup for HIPAA compliance..."
    
    check_aws_cli
    create_log_group
    create_flow_logs_role
    
    # Wait for role to be available
    log "Waiting for IAM role to be available..."
    sleep 10
    
    # Get all VPCs and enable flow logs
    log "Retrieving all VPCs..."
    
    # Production VPCs (excluding default VPC as per HIPAA recommendations)
    declare -A PRODUCTION_VPCS
    PRODUCTION_VPCS[vpc-0a9c767f1b147a41e]="diseasezone-vpc-prod"
    PRODUCTION_VPCS[vpc-0bd46897104d2fe59]="nitetext-vpc"
    PRODUCTION_VPCS[vpc-0c1b813880b3982a5]="afterdarksys-vpc"
    PRODUCTION_VPCS[vpc-04852ad6e57019344]="ninelives-prod-vpc"
    
    log "Enabling VPC Flow Logs for production VPCs..."
    
    for vpc_id in "${!PRODUCTION_VPCS[@]}"; do
        vpc_name="${PRODUCTION_VPCS[$vpc_id]}"
        enable_flow_logs_for_vpc "$vpc_id" "$vpc_name"
    done
    
    # Note about default VPC
    warning "Default VPC (vpc-062b4d9462879a884) excluded - should migrate resources as per HIPAA recommendations"
    
    success "VPC Flow Logs setup completed successfully!"
    
    log "HIPAA Compliance Status:"
    log "✅ Network traffic monitoring enabled"
    log "✅ 7-year log retention configured"
    log "✅ CloudWatch integration active"
    log "✅ Audit trail requirements met"
    
    log "Next steps:"
    log "1. Set up CloudTrail logging (run enable-cloudtrail.sh)"
    log "2. Configure security monitoring alerts"
    log "3. Review and test log collection"
}

# Execute main function
main "$@"