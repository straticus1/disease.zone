#!/bin/bash

# HIPAA Compliance: Migrate Production Workloads from Default VPC
# This script creates a secure, dedicated VPC and migrates NiteText instances
# from the default VPC to ensure HIPAA network security requirements

set -euo pipefail

# Configuration
REGION="${AWS_REGION:-us-east-1}"
VPC_NAME="nitetext-hipaa-vpc"
VPC_CIDR="10.0.0.0/16"
DEFAULT_VPC_ID="vpc-062b4d9462879a884"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Check AWS CLI and credentials
check_prerequisites() {
    log "Checking prerequisites..."
    
    if ! command -v aws &> /dev/null; then
        error "AWS CLI is not installed"
        exit 1
    fi
    
    if ! aws sts get-caller-identity &> /dev/null; then
        error "AWS credentials not configured"
        exit 1
    fi
    
    log "Prerequisites check passed"
}

# Get current instances in default VPC
get_default_vpc_instances() {
    log "Retrieving instances in default VPC ($DEFAULT_VPC_ID)..."
    
    INSTANCES=$(aws ec2 describe-instances \
        --region "$REGION" \
        --filters "Name=vpc-id,Values=$DEFAULT_VPC_ID" "Name=instance-state-name,Values=running,stopped" \
        --query 'Reservations[].Instances[].[InstanceId,InstanceType,State.Name,Tags[?Key==`Name`].Value|[0],SubnetId]' \
        --output table)
    
    if [ -z "$INSTANCES" ]; then
        warn "No instances found in default VPC"
        return 1
    fi
    
    info "Found instances in default VPC:"
    echo "$INSTANCES"
    return 0
}

# Create secure VPC with private subnets
create_secure_vpc() {
    log "Creating secure VPC for HIPAA compliance..."
    
    # Create VPC
    VPC_ID=$(aws ec2 create-vpc \
        --region "$REGION" \
        --cidr-block "$VPC_CIDR" \
        --query 'Vpc.VpcId' \
        --output text)
    
    log "Created VPC: $VPC_ID"
    
    # Tag VPC
    aws ec2 create-tags \
        --region "$REGION" \
        --resources "$VPC_ID" \
        --tags "Key=Name,Value=$VPC_NAME" "Key=Purpose,Value=HIPAA-Production" "Key=Environment,Value=Production"
    
    # Enable DNS hostnames and DNS resolution
    aws ec2 modify-vpc-attribute --region "$REGION" --vpc-id "$VPC_ID" --enable-dns-hostnames
    aws ec2 modify-vpc-attribute --region "$REGION" --vpc-id "$VPC_ID" --enable-dns-support
    
    # Get availability zones
    AZS=($(aws ec2 describe-availability-zones \
        --region "$REGION" \
        --query 'AvailabilityZones[].ZoneName' \
        --output text | head -3))
    
    # Create public subnets for load balancers/NAT gateways
    PUBLIC_SUBNETS=()
    for i in "${!AZS[@]}"; do
        SUBNET_CIDR="10.0.$((i + 1)).0/24"
        SUBNET_ID=$(aws ec2 create-subnet \
            --region "$REGION" \
            --vpc-id "$VPC_ID" \
            --cidr-block "$SUBNET_CIDR" \
            --availability-zone "${AZS[$i]}" \
            --query 'Subnet.SubnetId' \
            --output text)
        
        aws ec2 create-tags \
            --region "$REGION" \
            --resources "$SUBNET_ID" \
            --tags "Key=Name,Value=$VPC_NAME-public-${AZS[$i]}" "Key=Type,Value=Public"
        
        PUBLIC_SUBNETS+=("$SUBNET_ID")
        log "Created public subnet: $SUBNET_ID in ${AZS[$i]}"
    done
    
    # Create private subnets for application servers (HIPAA requirement)
    PRIVATE_SUBNETS=()
    for i in "${!AZS[@]}"; do
        SUBNET_CIDR="10.0.$((i + 10)).0/24"
        SUBNET_ID=$(aws ec2 create-subnet \
            --region "$REGION" \
            --vpc-id "$VPC_ID" \
            --cidr-block "$SUBNET_CIDR" \
            --availability-zone "${AZS[$i]}" \
            --query 'Subnet.SubnetId' \
            --output text)
        
        aws ec2 create-tags \
            --region "$REGION" \
            --resources "$SUBNET_ID" \
            --tags "Key=Name,Value=$VPC_NAME-private-${AZS[$i]}" "Key=Type,Value=Private"
        
        PRIVATE_SUBNETS+=("$SUBNET_ID")
        log "Created private subnet: $SUBNET_ID in ${AZS[$i]}"
    done
    
    # Create Internet Gateway
    IGW_ID=$(aws ec2 create-internet-gateway \
        --region "$REGION" \
        --query 'InternetGateway.InternetGatewayId' \
        --output text)
    
    aws ec2 attach-internet-gateway \
        --region "$REGION" \
        --vpc-id "$VPC_ID" \
        --internet-gateway-id "$IGW_ID"
    
    aws ec2 create-tags \
        --region "$REGION" \
        --resources "$IGW_ID" \
        --tags "Key=Name,Value=$VPC_NAME-igw"
    
    log "Created and attached Internet Gateway: $IGW_ID"
    
    # Create NAT Gateway for private subnet internet access
    # Allocate Elastic IP
    EIP_ALLOC_ID=$(aws ec2 allocate-address \
        --region "$REGION" \
        --domain vpc \
        --query 'AllocationId' \
        --output text)
    
    # Create NAT Gateway in first public subnet
    NAT_GW_ID=$(aws ec2 create-nat-gateway \
        --region "$REGION" \
        --subnet-id "${PUBLIC_SUBNETS[0]}" \
        --allocation-id "$EIP_ALLOC_ID" \
        --query 'NatGateway.NatGatewayId' \
        --output text)
    
    aws ec2 create-tags \
        --region "$REGION" \
        --resources "$NAT_GW_ID" \
        --tags "Key=Name,Value=$VPC_NAME-nat-gw"
    
    log "Created NAT Gateway: $NAT_GW_ID"
    
    # Wait for NAT Gateway to be available
    log "Waiting for NAT Gateway to be available..."
    aws ec2 wait nat-gateway-available --region "$REGION" --nat-gateway-ids "$NAT_GW_ID"
    
    # Create route table for public subnets
    PUBLIC_RT_ID=$(aws ec2 create-route-table \
        --region "$REGION" \
        --vpc-id "$VPC_ID" \
        --query 'RouteTable.RouteTableId' \
        --output text)
    
    aws ec2 create-tags \
        --region "$REGION" \
        --resources "$PUBLIC_RT_ID" \
        --tags "Key=Name,Value=$VPC_NAME-public-rt"
    
    # Add route to Internet Gateway
    aws ec2 create-route \
        --region "$REGION" \
        --route-table-id "$PUBLIC_RT_ID" \
        --destination-cidr-block "0.0.0.0/0" \
        --gateway-id "$IGW_ID"
    
    # Associate public subnets with public route table
    for subnet in "${PUBLIC_SUBNETS[@]}"; do
        aws ec2 associate-route-table \
            --region "$REGION" \
            --subnet-id "$subnet" \
            --route-table-id "$PUBLIC_RT_ID"
    done
    
    log "Created public route table and associated subnets"
    
    # Create route table for private subnets
    PRIVATE_RT_ID=$(aws ec2 create-route-table \
        --region "$REGION" \
        --vpc-id "$VPC_ID" \
        --query 'RouteTable.RouteTableId' \
        --output text)
    
    aws ec2 create-tags \
        --region "$REGION" \
        --resources "$PRIVATE_RT_ID" \
        --tags "Key=Name,Value=$VPC_NAME-private-rt"
    
    # Add route to NAT Gateway
    aws ec2 create-route \
        --region "$REGION" \
        --route-table-id "$PRIVATE_RT_ID" \
        --destination-cidr-block "0.0.0.0/0" \
        --nat-gateway-id "$NAT_GW_ID"
    
    # Associate private subnets with private route table
    for subnet in "${PRIVATE_SUBNETS[@]}"; do
        aws ec2 associate-route-table \
            --region "$REGION" \
            --subnet-id "$subnet" \
            --route-table-id "$PRIVATE_RT_ID"
    done
    
    log "Created private route table and associated subnets"
    
    # Store VPC information for migration
    echo "VPC_ID=$VPC_ID" > /tmp/vpc-migration-vars.env
    echo "PRIVATE_SUBNETS=(${PRIVATE_SUBNETS[*]})" >> /tmp/vpc-migration-vars.env
    echo "PUBLIC_SUBNETS=(${PUBLIC_SUBNETS[*]})" >> /tmp/vpc-migration-vars.env
    
    log "Secure VPC infrastructure created successfully!"
    info "VPC ID: $VPC_ID"
    info "Private Subnets: ${PRIVATE_SUBNETS[*]}"
    info "Public Subnets: ${PUBLIC_SUBNETS[*]}"
}

# Create HIPAA-compliant security groups
create_security_groups() {
    source /tmp/vpc-migration-vars.env
    
    log "Creating HIPAA-compliant security groups..."
    
    # Application Load Balancer Security Group
    ALB_SG_ID=$(aws ec2 create-security-group \
        --region "$REGION" \
        --group-name "nitetext-alb-sg" \
        --description "NiteText ALB Security Group - HIPAA Compliant" \
        --vpc-id "$VPC_ID" \
        --query 'GroupId' \
        --output text)
    
    # Allow HTTP and HTTPS from internet (ALB only)
    aws ec2 authorize-security-group-ingress \
        --region "$REGION" \
        --group-id "$ALB_SG_ID" \
        --protocol tcp \
        --port 80 \
        --cidr "0.0.0.0/0"
    
    aws ec2 authorize-security-group-ingress \
        --region "$REGION" \
        --group-id "$ALB_SG_ID" \
        --protocol tcp \
        --port 443 \
        --cidr "0.0.0.0/0"
    
    aws ec2 create-tags \
        --region "$REGION" \
        --resources "$ALB_SG_ID" \
        --tags "Key=Name,Value=nitetext-alb-sg" "Key=Purpose,Value=HIPAA-LoadBalancer"
    
    log "Created ALB security group: $ALB_SG_ID"
    
    # Application Server Security Group (private instances)
    APP_SG_ID=$(aws ec2 create-security-group \
        --region "$REGION" \
        --group-name "nitetext-app-sg" \
        --description "NiteText App Servers - HIPAA Compliant" \
        --vpc-id "$VPC_ID" \
        --query 'GroupId' \
        --output text)
    
    # Allow HTTP only from ALB security group
    aws ec2 authorize-security-group-ingress \
        --region "$REGION" \
        --group-id "$APP_SG_ID" \
        --protocol tcp \
        --port 80 \
        --source-group "$ALB_SG_ID"
    
    # Allow SSH from bastion/management subnet only (restricted)
    aws ec2 authorize-security-group-ingress \
        --region "$REGION" \
        --group-id "$APP_SG_ID" \
        --protocol tcp \
        --port 22 \
        --cidr "10.0.1.0/24"
    
    aws ec2 create-tags \
        --region "$REGION" \
        --resources "$APP_SG_ID" \
        --tags "Key=Name,Value=nitetext-app-sg" "Key=Purpose,Value=HIPAA-Application"
    
    log "Created application security group: $APP_SG_ID"
    
    # Update environment variables
    echo "ALB_SG_ID=$ALB_SG_ID" >> /tmp/vpc-migration-vars.env
    echo "APP_SG_ID=$APP_SG_ID" >> /tmp/vpc-migration-vars.env
    
    log "HIPAA-compliant security groups created successfully!"
}

# Create Application Load Balancer
create_load_balancer() {
    source /tmp/vpc-migration-vars.env
    
    log "Creating Application Load Balancer..."
    
    # Create ALB in public subnets
    ALB_ARN=$(aws elbv2 create-load-balancer \
        --region "$REGION" \
        --name "nitetext-hipaa-alb" \
        --subnets ${PUBLIC_SUBNETS[@]} \
        --security-groups "$ALB_SG_ID" \
        --scheme internet-facing \
        --type application \
        --ip-address-type ipv4 \
        --query 'LoadBalancers[0].LoadBalancerArn' \
        --output text)
    
    aws elbv2 add-tags \
        --region "$REGION" \
        --resource-arns "$ALB_ARN" \
        --tags "Key=Name,Value=nitetext-hipaa-alb" "Key=Purpose,Value=HIPAA-Production"
    
    log "Created Application Load Balancer: $ALB_ARN"
    
    # Get VPC ID for target group
    TG_ARN=$(aws elbv2 create-target-group \
        --region "$REGION" \
        --name "nitetext-app-tg" \
        --protocol HTTP \
        --port 80 \
        --vpc-id "$VPC_ID" \
        --health-check-enabled \
        --health-check-path "/" \
        --health-check-interval-seconds 30 \
        --health-check-timeout-seconds 5 \
        --healthy-threshold-count 2 \
        --unhealthy-threshold-count 3 \
        --query 'TargetGroups[0].TargetGroupArn' \
        --output text)
    
    log "Created target group: $TG_ARN"
    
    # Create ALB listener
    LISTENER_ARN=$(aws elbv2 create-listener \
        --region "$REGION" \
        --load-balancer-arn "$ALB_ARN" \
        --protocol HTTP \
        --port 80 \
        --default-actions "Type=forward,TargetGroupArn=$TG_ARN" \
        --query 'Listeners[0].ListenerArn' \
        --output text)
    
    log "Created ALB listener: $LISTENER_ARN"
    
    # Update environment variables
    echo "ALB_ARN=$ALB_ARN" >> /tmp/vpc-migration-vars.env
    echo "TG_ARN=$TG_ARN" >> /tmp/vpc-migration-vars.env
    
    # Get ALB DNS name
    ALB_DNS=$(aws elbv2 describe-load-balancers \
        --region "$REGION" \
        --load-balancer-arns "$ALB_ARN" \
        --query 'LoadBalancers[0].DNSName' \
        --output text)
    
    info "Application Load Balancer DNS: $ALB_DNS"
    echo "ALB_DNS=$ALB_DNS" >> /tmp/vpc-migration-vars.env
}

# Provide migration plan summary
show_migration_plan() {
    log "HIPAA VPC Migration Infrastructure Ready!"
    echo
    info "=== INFRASTRUCTURE CREATED ==="
    source /tmp/vpc-migration-vars.env
    echo "VPC ID: $VPC_ID"
    echo "Private Subnets: ${PRIVATE_SUBNETS[*]}"
    echo "Load Balancer DNS: $ALB_DNS"
    echo
    warn "=== NEXT STEPS FOR INSTANCE MIGRATION ==="
    echo "1. Create AMI snapshots of current instances"
    echo "2. Launch new instances in private subnets"
    echo "3. Register instances with target group"
    echo "4. Test application functionality"
    echo "5. Update DNS records to point to new ALB"
    echo "6. Terminate old instances in default VPC"
    echo
    info "Use the companion script 'complete-instance-migration.sh' to finish the migration"
    echo "Environment variables saved to: /tmp/vpc-migration-vars.env"
}

# Main execution
main() {
    log "Starting HIPAA-compliant VPC migration..."
    echo "This will create a secure VPC infrastructure for NiteText production workloads"
    echo
    
    check_prerequisites
    
    # Check if instances exist in default VPC
    if ! get_default_vpc_instances; then
        warn "No instances found in default VPC. Creating infrastructure anyway..."
    fi
    
    # Confirm before proceeding
    echo
    read -p "Proceed with creating secure VPC infrastructure? (y/N): " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        log "Operation cancelled"
        exit 0
    fi
    
    create_secure_vpc
    create_security_groups
    create_load_balancer
    show_migration_plan
    
    log "HIPAA VPC migration infrastructure setup completed successfully!"
    log "Total estimated AWS costs: ~$50-100/month (NAT Gateway, ALB, EIP)"
}

# Run main function
main "$@"