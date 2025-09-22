#!/bin/bash

# Disable CloudTrail and Cleanup Infrastructure  
# This script removes CloudTrail configuration and associated resources
# Use with extreme caution - this will remove critical audit trail infrastructure

set -euo pipefail

# Configuration
REGION="us-east-1"
TRAIL_NAME="disease-zone-hipaa-trail"
KMS_KEY_ALIAS="alias/disease-zone-cloudtrail-key"
LOG_GROUP_NAME="/aws/cloudtrail/disease-zone"

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

# Confirmation prompt with extra safety checks
confirm_cleanup() {
    error "⚠️  CRITICAL WARNING ⚠️"
    error "This script will disable CloudTrail and remove ALL audit trail infrastructure!"
    error "This will SEVERELY impact HIPAA compliance and security posture!"
    echo
    warning "This action will:"
    warning "• Delete CloudTrail logs and configuration"
    warning "• Remove S3 buckets containing audit data" 
    warning "• Delete KMS encryption keys (if not used elsewhere)"
    warning "• Remove CloudWatch log groups"
    warning "• Delete IAM roles and policies"
    echo
    error "This should ONLY be done during:"
    error "• Complete infrastructure migration"
    error "• Emergency maintenance requiring full cleanup"
    error "• Decommissioning of the entire system"
    echo
    
    read -p "Do you understand the risks? (yes/no): " understand
    if [ "$understand" != "yes" ]; then
        log "Operation cancelled - user did not confirm understanding of risks"
        exit 0
    fi
    
    read -p "Are you absolutely sure you want to continue? (DELETE/no): " confirm
    if [ "$confirm" != "DELETE" ]; then
        log "Operation cancelled - user did not type 'DELETE'"
        exit 0
    fi
    
    error "Final confirmation - this action cannot be undone!"
    read -p "Type the trail name '$TRAIL_NAME' to proceed: " trail_confirm
    if [ "$trail_confirm" != "$TRAIL_NAME" ]; then
        log "Operation cancelled - trail name confirmation failed"
        exit 0
    fi
    
    warning "User confirmed all safety checks - proceeding with cleanup..."
    sleep 3
}

# Check if AWS CLI is configured
check_aws_cli() {
    log "Checking AWS CLI configuration..."
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        error "AWS CLI not configured or credentials invalid"
        exit 1
    fi
    
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    success "AWS CLI configured successfully (Account: $ACCOUNT_ID)"
}

# Stop and delete CloudTrail
delete_cloudtrail() {
    log "Checking CloudTrail: $TRAIL_NAME"
    
    if ! aws cloudtrail describe-trails --trail-name-list "$TRAIL_NAME" --region "$REGION" | grep -q "$TRAIL_NAME"; then
        log "CloudTrail $TRAIL_NAME does not exist"
        return 0
    fi
    
    log "Stopping CloudTrail logging..."
    aws cloudtrail stop-logging \
        --name "$TRAIL_NAME" \
        --region "$REGION"
    
    success "Stopped CloudTrail logging"
    
    log "Deleting CloudTrail: $TRAIL_NAME"
    aws cloudtrail delete-trail \
        --name "$TRAIL_NAME" \
        --region "$REGION"
    
    success "Deleted CloudTrail: $TRAIL_NAME"
}

# Get and delete S3 bucket
delete_s3_bucket() {
    log "Finding CloudTrail S3 bucket..."
    
    # Try to get bucket name from CloudTrail (if it still exists)
    bucket_name=""
    if aws cloudtrail describe-trails --trail-name-list "$TRAIL_NAME" --region "$REGION" >/dev/null 2>&1; then
        bucket_name=$(aws cloudtrail describe-trails --trail-name-list "$TRAIL_NAME" --region "$REGION" --query 'trailList[0].S3BucketName' --output text 2>/dev/null || echo "")
    fi
    
    # If bucket name not found, try to find buckets with our naming pattern
    if [ -z "$bucket_name" ] || [ "$bucket_name" = "None" ]; then
        log "Searching for CloudTrail buckets with disease-zone prefix..."
        bucket_name=$(aws s3api list-buckets --query 'Buckets[?starts_with(Name, `disease-zone-cloudtrail-logs`)].Name' --output text | head -1)
    fi
    
    if [ -z "$bucket_name" ] || [ "$bucket_name" = "None" ]; then
        warning "No CloudTrail S3 bucket found to delete"
        return 0
    fi
    
    log "Found CloudTrail S3 bucket: $bucket_name"
    warning "Deleting S3 bucket and ALL audit log data: $bucket_name"
    
    # Empty bucket first (required before deletion)
    log "Emptying S3 bucket..."
    aws s3 rm s3://"$bucket_name" --recursive >/dev/null 2>&1 || true
    
    # Delete all object versions (if versioning was enabled)
    log "Deleting all object versions..."
    aws s3api delete-objects \
        --bucket "$bucket_name" \
        --delete "$(aws s3api list-object-versions \
            --bucket "$bucket_name" \
            --query '{Objects: Versions[].{Key:Key,VersionId:VersionId}}' \
            --max-items 1000)" >/dev/null 2>&1 || true
    
    # Delete delete markers
    aws s3api delete-objects \
        --bucket "$bucket_name" \
        --delete "$(aws s3api list-object-versions \
            --bucket "$bucket_name" \
            --query '{Objects: DeleteMarkers[].{Key:Key,VersionId:VersionId}}' \
            --max-items 1000)" >/dev/null 2>&1 || true
    
    # Delete bucket
    aws s3api delete-bucket --bucket "$bucket_name" --region "$REGION"
    success "Deleted S3 bucket: $bucket_name"
}

# Delete CloudWatch Log Group
delete_cloudwatch_log_group() {
    log "Checking CloudWatch Log Group: $LOG_GROUP_NAME"
    
    if aws logs describe-log-groups --log-group-name-prefix "$LOG_GROUP_NAME" --region "$REGION" | grep -q "$LOG_GROUP_NAME"; then
        warning "Deleting CloudWatch Log Group: $LOG_GROUP_NAME"
        warning "This will permanently delete all CloudTrail log data!"
        
        aws logs delete-log-group \
            --log-group-name "$LOG_GROUP_NAME" \
            --region "$REGION"
        
        success "Deleted CloudWatch Log Group: $LOG_GROUP_NAME"
    else
        log "CloudWatch Log Group $LOG_GROUP_NAME does not exist"
    fi
}

# Delete IAM roles
delete_iam_roles() {
    local roles=("CloudTrailLogsRole")
    
    for role_name in "${roles[@]}"; do
        log "Checking IAM role: $role_name"
        
        if aws iam get-role --role-name "$role_name" >/dev/null 2>&1; then
            log "Deleting IAM role: $role_name"
            
            # List and delete all attached policies
            policies=$(aws iam list-role-policies --role-name "$role_name" --query 'PolicyNames' --output text)
            for policy in $policies; do
                if [ "$policy" != "None" ] && [ -n "$policy" ]; then
                    aws iam delete-role-policy --role-name "$role_name" --policy-name "$policy"
                    log "Deleted policy: $policy from role: $role_name"
                fi
            done
            
            # Delete role
            aws iam delete-role --role-name "$role_name"
            success "Deleted IAM role: $role_name"
        else
            log "IAM role $role_name does not exist"
        fi
    done
}

# Delete KMS key (with extreme caution)
delete_kms_key() {
    log "Checking KMS key: $KMS_KEY_ALIAS"
    
    if aws kms describe-key --key-id "$KMS_KEY_ALIAS" >/dev/null 2>&1; then
        warning "Found KMS key: $KMS_KEY_ALIAS"
        warning "Checking if key is used by other services..."
        
        # Get key ID
        key_id=$(aws kms describe-key --key-id "$KMS_KEY_ALIAS" --query 'KeyMetadata.KeyId' --output text)
        
        error "⚠️  CRITICAL: About to schedule KMS key deletion!"
        error "Key ID: $key_id"
        error "This will make ALL data encrypted with this key PERMANENTLY UNRECOVERABLE!"
        echo
        
        read -p "Do you want to schedule this KMS key for deletion? (yes/no): " delete_key
        
        if [ "$delete_key" = "yes" ]; then
            # Schedule key deletion (7-day minimum waiting period)
            aws kms schedule-key-deletion \
                --key-id "$key_id" \
                --pending-window-in-days 7 \
                --region "$REGION"
            
            warning "KMS key scheduled for deletion in 7 days: $key_id"
            warning "You can cancel this deletion with: aws kms cancel-key-deletion --key-id $key_id"
            
            # Delete alias
            aws kms delete-alias --alias-name "$KMS_KEY_ALIAS" --region "$REGION"
            success "Deleted KMS alias: $KMS_KEY_ALIAS"
        else
            log "Skipped KMS key deletion - keeping key: $key_id"
        fi
    else
        log "KMS key $KMS_KEY_ALIAS does not exist"
    fi
}

# Main execution
main() {
    log "Starting CloudTrail cleanup..."
    
    confirm_cleanup
    check_aws_cli
    
    delete_cloudtrail
    delete_s3_bucket
    delete_cloudwatch_log_group
    delete_iam_roles
    delete_kms_key
    
    success "CloudTrail cleanup completed!"
    
    error "HIPAA Compliance Impact:"
    error "❌ CloudTrail audit logging disabled"
    error "❌ API call tracking removed" 
    error "❌ Security event monitoring lost"
    error "❌ Compliance audit trail deleted"
    error "❌ Data integrity validation removed"
    
    warning "Security Posture Severely Degraded!"
    warning "Immediate action required to restore audit capabilities"
    
    log "To re-enable CloudTrail for HIPAA compliance:"
    log "  ./scripts/enable-cloudtrail.sh"
}

# Execute main function
main "$@"