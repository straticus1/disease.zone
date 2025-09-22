#!/bin/bash

# Enable CloudTrail for HIPAA Compliance
# This script configures AWS CloudTrail with encrypted S3 storage to meet
# HIPAA audit trail and data integrity requirements

set -euo pipefail

# Configuration
REGION="us-east-1"
TRAIL_NAME="disease-zone-hipaa-trail"
BUCKET_NAME="disease-zone-cloudtrail-logs-$(date +%s)"
KMS_KEY_ALIAS="alias/disease-zone-cloudtrail-key"
LOG_GROUP_NAME="/aws/cloudtrail/disease-zone"
RETENTION_DAYS=2557  # 7 years for HIPAA compliance

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
    
    # Get account ID
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    success "AWS CLI configured successfully (Account: $ACCOUNT_ID)"
}

# Create KMS key for CloudTrail encryption
create_kms_key() {
    log "Creating KMS key for CloudTrail encryption..."
    
    # Check if key alias already exists
    if aws kms describe-key --key-id "$KMS_KEY_ALIAS" >/dev/null 2>&1; then
        warning "KMS key alias $KMS_KEY_ALIAS already exists"
        return 0
    fi
    
    # Create KMS key policy for CloudTrail
    cat > /tmp/kms-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "Enable IAM root permissions",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::$ACCOUNT_ID:root"
      },
      "Action": "kms:*",
      "Resource": "*"
    },
    {
      "Sid": "Allow CloudTrail to encrypt logs",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudtrail.amazonaws.com"
      },
      "Action": [
        "kms:GenerateDataKey*",
        "kms:DescribeKey"
      ],
      "Resource": "*"
    },
    {
      "Sid": "Allow CloudWatch Logs",
      "Effect": "Allow",
      "Principal": {
        "Service": "logs.$REGION.amazonaws.com"
      },
      "Action": [
        "kms:Encrypt",
        "kms:Decrypt",
        "kms:ReEncrypt*",
        "kms:GenerateDataKey*",
        "kms:DescribeKey"
      ],
      "Resource": "*"
    }
  ]
}
EOF

    # Create KMS key
    key_id=$(aws kms create-key \
        --policy file:///tmp/kms-policy.json \
        --description "KMS key for Disease Zone CloudTrail encryption - HIPAA Compliance" \
        --region "$REGION" \
        --query 'KeyMetadata.KeyId' \
        --output text)
    
    # Create alias
    aws kms create-alias \
        --alias-name "$KMS_KEY_ALIAS" \
        --target-key-id "$key_id" \
        --region "$REGION"
    
    success "Created KMS key: $key_id with alias: $KMS_KEY_ALIAS"
    
    # Clean up
    rm -f /tmp/kms-policy.json
}

# Create S3 bucket for CloudTrail logs
create_s3_bucket() {
    log "Creating S3 bucket for CloudTrail logs: $BUCKET_NAME"
    
    # Create bucket
    aws s3api create-bucket \
        --bucket "$BUCKET_NAME" \
        --region "$REGION" \
        --create-bucket-configuration LocationConstraint="$REGION"
    
    # Enable versioning for audit trail integrity
    aws s3api put-bucket-versioning \
        --bucket "$BUCKET_NAME" \
        --versioning-configuration Status=Enabled
    
    # Enable server-side encryption
    aws s3api put-bucket-encryption \
        --bucket "$BUCKET_NAME" \
        --server-side-encryption-configuration '{
            "Rules": [
                {
                    "ApplyServerSideEncryptionByDefault": {
                        "SSEAlgorithm": "aws:kms",
                        "KMSMasterKeyID": "'"$KMS_KEY_ALIAS"'"
                    },
                    "BucketKeyEnabled": true
                }
            ]
        }'
    
    # Block public access
    aws s3api put-public-access-block \
        --bucket "$BUCKET_NAME" \
        --public-access-block-configuration \
            BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
    
    # Create bucket policy for CloudTrail
    cat > /tmp/bucket-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AWSCloudTrailAclCheck",
            "Effect": "Allow",
            "Principal": {
                "Service": "cloudtrail.amazonaws.com"
            },
            "Action": "s3:GetBucketAcl",
            "Resource": "arn:aws:s3:::$BUCKET_NAME"
        },
        {
            "Sid": "AWSCloudTrailWrite",
            "Effect": "Allow",
            "Principal": {
                "Service": "cloudtrail.amazonaws.com"
            },
            "Action": "s3:PutObject",
            "Resource": "arn:aws:s3:::$BUCKET_NAME/AWSLogs/$ACCOUNT_ID/*",
            "Condition": {
                "StringEquals": {
                    "s3:x-amz-acl": "bucket-owner-full-control"
                }
            }
        }
    ]
}
EOF

    aws s3api put-bucket-policy \
        --bucket "$BUCKET_NAME" \
        --policy file:///tmp/bucket-policy.json
    
    success "Created and configured S3 bucket: $BUCKET_NAME"
    
    # Add HIPAA compliance tags
    aws s3api put-bucket-tagging \
        --bucket "$BUCKET_NAME" \
        --tagging 'TagSet=[
            {Key=Purpose,Value=HIPAA-Compliance},
            {Key=DataClassification,Value=Sensitive},
            {Key=Retention,Value=7-years},
            {Key=Environment,Value=Production}
        ]'
    
    # Clean up
    rm -f /tmp/bucket-policy.json
}

# Create CloudWatch Log Group for CloudTrail
create_cloudwatch_log_group() {
    log "Creating CloudWatch Log Group for CloudTrail: $LOG_GROUP_NAME"
    
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
        
        success "Created log group with $RETENTION_DAYS days retention"
    fi
}

# Create IAM role for CloudTrail CloudWatch Logs
create_cloudtrail_logs_role() {
    local role_name="CloudTrailLogsRole"
    
    log "Creating IAM role for CloudTrail CloudWatch Logs..."
    
    # Trust policy
    cat > /tmp/cloudtrail-trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudtrail.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

    # Create role if it doesn't exist
    if aws iam get-role --role-name "$role_name" >/dev/null 2>&1; then
        warning "IAM role $role_name already exists"
    else
        aws iam create-role \
            --role-name "$role_name" \
            --assume-role-policy-document file:///tmp/cloudtrail-trust-policy.json \
            --description "Role for CloudTrail to deliver logs to CloudWatch - HIPAA Compliance"
        
        success "Created IAM role: $role_name"
    fi

    # Policy for CloudWatch Logs
    cat > /tmp/cloudtrail-logs-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:PutLogEvents",
        "logs:CreateLogGroup",
        "logs:CreateLogStream"
      ],
      "Resource": "arn:aws:logs:$REGION:$ACCOUNT_ID:log-group:$LOG_GROUP_NAME:*"
    }
  ]
}
EOF

    # Attach policy
    aws iam put-role-policy \
        --role-name "$role_name" \
        --policy-name "CloudTrailLogsPolicy" \
        --policy-document file:///tmp/cloudtrail-logs-policy.json
    
    # Clean up
    rm -f /tmp/cloudtrail-trust-policy.json /tmp/cloudtrail-logs-policy.json
    
    echo "$role_name"
}

# Create CloudTrail
create_cloudtrail() {
    log "Creating CloudTrail: $TRAIL_NAME"
    
    # Check if trail already exists
    if aws cloudtrail describe-trails --trail-name-list "$TRAIL_NAME" --region "$REGION" | grep -q "$TRAIL_NAME"; then
        warning "CloudTrail $TRAIL_NAME already exists"
        return 0
    fi
    
    # Create CloudTrail logs role
    cloudtrail_role=$(create_cloudtrail_logs_role)
    cloudtrail_role_arn="arn:aws:iam::$ACCOUNT_ID:role/$cloudtrail_role"
    
    # Wait for role to be available
    log "Waiting for IAM role to be available..."
    sleep 15
    
    # Create CloudTrail with comprehensive logging
    aws cloudtrail create-trail \
        --name "$TRAIL_NAME" \
        --s3-bucket-name "$BUCKET_NAME" \
        --s3-key-prefix "AWSLogs" \
        --include-global-service-events \
        --is-multi-region-trail \
        --enable-log-file-validation \
        --kms-key-id "$KMS_KEY_ALIAS" \
        --cloud-watch-logs-log-group-arn "arn:aws:logs:$REGION:$ACCOUNT_ID:log-group:$LOG_GROUP_NAME:*" \
        --cloud-watch-logs-role-arn "$cloudtrail_role_arn" \
        --region "$REGION"
    
    # Enable logging
    aws cloudtrail start-logging \
        --name "$TRAIL_NAME" \
        --region "$REGION"
    
    success "Created and started CloudTrail: $TRAIL_NAME"
    
    # Add event selectors for comprehensive data event logging
    aws cloudtrail put-event-selectors \
        --trail-name "$TRAIL_NAME" \
        --event-selectors '[
            {
                "ReadWriteType": "All",
                "IncludeManagementEvents": true,
                "DataResources": [
                    {
                        "Type": "AWS::S3::Object",
                        "Values": ["arn:aws:s3:::*/"]
                    }
                ]
            }
        ]' \
        --region "$REGION"
    
    success "Configured comprehensive event logging"
}

# Main execution
main() {
    log "Starting CloudTrail setup for HIPAA compliance..."
    
    check_aws_cli
    create_kms_key
    create_s3_bucket
    create_cloudwatch_log_group
    create_cloudtrail
    
    success "CloudTrail setup completed successfully!"
    
    log "HIPAA Compliance Status:"
    log "✅ CloudTrail enabled with encryption"
    log "✅ Multi-region trail configured"
    log "✅ Log file validation enabled"
    log "✅ CloudWatch Logs integration active"
    log "✅ 7-year retention policy set"
    log "✅ S3 bucket encrypted and secured"
    
    log "CloudTrail Details:"
    log "Trail Name: $TRAIL_NAME"
    log "S3 Bucket: $BUCKET_NAME"
    log "KMS Key: $KMS_KEY_ALIAS"
    log "CloudWatch Log Group: $LOG_GROUP_NAME"
    
    log "Next steps:"
    log "1. Set up security monitoring alerts"
    log "2. Configure automated threat detection"
    log "3. Test log collection and integrity"
    log "4. Review access patterns regularly"
}

# Execute main function
main "$@"