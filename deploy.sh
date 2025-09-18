#!/bin/bash

# Disease Zone Deployment Script
# This script builds, pushes, and deploys the disease.zone application to AWS ECS

set -e  # Exit on any error

# Start timing
START_TIME=$(date +%s)
START_TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
echo "🕐 Deploy started at: $START_TIMESTAMP"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/Users/ryan/development/disease.zone"
AWS_REGION="us-east-1"
ECR_REPOSITORY="515966511618.dkr.ecr.us-east-1.amazonaws.com/diseasezone-prod"
IMAGE_TAG="latest"
DOCKER_IMAGE_NAME="disease.zone"

# Function to print colored output with timing
STEP_START_TIME=$(date +%s)
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Function to start timing a step
start_step() {
    CURRENT_STEP="$1"
    STEP_START_TIME=$(date +%s)
    STEP_START_TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${YELLOW}⏱️  Starting: $1 at $STEP_START_TIMESTAMP${NC}"
}

# Function to end timing a step
end_step() {
    STEP_END_TIME=$(date +%s)
    STEP_DURATION=$((STEP_END_TIME - STEP_START_TIME))
    STEP_END_TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${GREEN}✅ Completed: $CURRENT_STEP at $STEP_END_TIMESTAMP (${STEP_DURATION}s)${NC}"
    CURRENT_STEP=""
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "\n${BLUE}================================${NC}"
    echo -e "${BLUE} $1${NC}"
    echo -e "${BLUE}================================${NC}\n"
}

# Function to check prerequisites
check_prerequisites() {
    start_step "Prerequisites Check"
    print_header "Checking Prerequisites"
    
    # Check if we're in the right directory
    if [ ! -f "$PROJECT_DIR/Dockerfile" ]; then
        print_error "Dockerfile not found in $PROJECT_DIR"
        exit 1
    fi
    
    # Check if AWS CLI is installed and configured
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed"
        exit 1
    fi
    
    # Check if Docker is installed and running
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        print_error "Docker is not running. Please start Docker Desktop."
        exit 1
    fi
    
    # Check if Ansible is installed
    if ! command -v ansible-playbook &> /dev/null; then
        print_error "Ansible is not installed. Install with: pip install ansible"
        exit 1
    fi
    
    # Check if Terraform is installed
    if ! command -v terraform &> /dev/null; then
        print_error "Terraform is not installed. Install from: https://terraform.io/downloads"
        exit 1
    fi
    
    # Verify AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS credentials not configured or expired"
        exit 1
    fi
    
    print_success "All prerequisites met"
    end_step "Prerequisites Check"
}

# Function to deploy infrastructure if needed
deploy_infrastructure() {
    start_step "Infrastructure Deployment Check"
    print_header "Checking Infrastructure Status"
    
    cd "$PROJECT_DIR/terraform"
    
    # Check if terraform.tfstate exists
    if [ ! -f "terraform.tfstate" ]; then
        print_warning "No Terraform state found. Deploying infrastructure..."
        
        # Check if terraform.tfvars exists
        if [ ! -f "terraform.tfvars" ]; then
            print_status "Creating terraform.tfvars from example..."
            cp "terraform.tfvars.example" "terraform.tfvars"
            print_warning "Please edit terraform/terraform.tfvars with your configuration"
            print_status "Required variables: domain_name, environment, project_name, alert_email"
            echo
            read -p "Press Enter when terraform.tfvars is configured..."
        fi
        
        # Initialize and apply Terraform
        print_status "Initializing Terraform..."
        terraform init
        
        print_status "Planning infrastructure deployment..."
        terraform plan -out=tfplan
        
        print_status "Applying infrastructure deployment..."
        terraform apply tfplan
        
        print_success "Infrastructure deployment completed"
    else
        print_success "Infrastructure already exists"
    fi
    
    cd "$PROJECT_DIR"
    end_step "Infrastructure Deployment Check"
}

# Function to get Terraform outputs
get_terraform_outputs() {
    start_step "Getting Terraform Outputs"
    print_header "Getting Terraform Outputs"
    
    cd "$PROJECT_DIR/terraform"
    
    ECR_REPOSITORY_URL=$(terraform output -raw ecr_repository_url)
    ECS_CLUSTER_NAME=$(terraform output -raw ecs_cluster_name)
    ECS_SERVICE_NAME=$(terraform output -raw ecs_service_name)
    LOAD_BALANCER_DNS=$(terraform output -raw load_balancer_dns)
    
    print_status "ECR Repository: $ECR_REPOSITORY_URL"
    print_status "ECS Cluster: $ECS_CLUSTER_NAME"
    print_status "ECS Service: $ECS_SERVICE_NAME"
    print_status "Load Balancer: $LOAD_BALANCER_DNS"
    
    cd "$PROJECT_DIR"
    end_step "Getting Terraform Outputs"
}

# Function to build Docker image
build_docker_image() {
    start_step "Docker Image Build"
    print_header "Building Docker Image"
    
    cd "$PROJECT_DIR"
    
    print_status "Building Docker image: $DOCKER_IMAGE_NAME:$IMAGE_TAG"
    docker build -t "$DOCKER_IMAGE_NAME:$IMAGE_TAG" .
    
    print_success "Docker image built successfully"
    end_step "Docker Image Build"
}

# Function to authenticate with ECR
authenticate_ecr() {
    start_step "ECR Authentication"
    print_header "Authenticating with ECR"
    
    print_status "Getting ECR login token..."
    aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$ECR_REPOSITORY_URL"
    
    print_success "ECR authentication successful"
    end_step "ECR Authentication"
}

# Function to push Docker image to ECR
push_to_ecr() {
    start_step "Push to ECR"
    print_header "Pushing Docker Image to ECR"
    
    # Tag image for ECR
    print_status "Tagging image for ECR..."
    docker tag "$DOCKER_IMAGE_NAME:$IMAGE_TAG" "$ECR_REPOSITORY_URL:$IMAGE_TAG"
    
    # Push to ECR
    print_status "Pushing image to ECR..."
    docker push "$ECR_REPOSITORY_URL:$IMAGE_TAG"
    
    print_success "Docker image pushed to ECR successfully"
    end_step "Push to ECR"
}

# Function to run security setup
security_setup() {
    start_step "Security Setup"
    print_header "Configuring Security Stack"
    
    print_status "Running security configuration setup..."
    
    # Check if security script exists
    if [ ! -f "$PROJECT_DIR/scripts/security-crisis-recovery.sh" ]; then
        print_error "Security crisis recovery script not found"
        exit 1
    fi
    
    # Make security script executable
    chmod +x "$PROJECT_DIR/scripts/security-crisis-recovery.sh"
    
    # Run automated security setup for deployment
    cd "$PROJECT_DIR"
    
    # Generate secure secrets if they don't exist
    if [ ! -f ".env" ] || ! grep -q "JWT_SECRET=" .env || grep -q "your-jwt-secret" .env; then
        print_status "Generating secure JWT secret..."
        JWT_SECRET=$(openssl rand -hex 32)
        
        print_status "Generating encryption keys..."
        ENCRYPTION_KEY=$(openssl rand -hex 32)
        AUDIT_ENCRYPTION_KEY=$(openssl rand -hex 32)
        
        # Run security setup with generated secrets
        JWT_SECRET="$JWT_SECRET" \
        ENCRYPTION_KEY="$ENCRYPTION_KEY" \
        AUDIT_ENCRYPTION_KEY="$AUDIT_ENCRYPTION_KEY" \
        RATE_LIMIT_ENABLED="true" \
        SESSION_TIMEOUT="3600" \
        SECURITY_AUDIT_ENABLED="true" \
        ./scripts/security-crisis-recovery.sh --setup --non-interactive --deployment
        
        print_success "Security stack configured with generated secrets"
    else
        print_status "Validating existing security configuration..."
        ./scripts/security-crisis-recovery.sh --validate --quiet
        print_success "Security configuration validated"
    fi
    
    end_step "Security Setup"
}

# Function to check if API keys are configured
check_api_keys() {
    start_step "API Keys Check"
    print_header "Checking API Keys Configuration"
    
    # Check if Mapbox token is set
    MAPBOX_VALUE=$(aws ssm get-parameter --name "/diseasezone/prod/mapbox-token" --with-decryption --query "Parameter.Value" --output text 2>/dev/null || echo "placeholder")
    if [ "$MAPBOX_VALUE" = "placeholder" ]; then
        print_warning "Mapbox API token is not configured"
        print_status "To set it, run: aws ssm put-parameter --name '/diseasezone/prod/mapbox-token' --value 'your-mapbox-token' --type 'SecureString' --overwrite"
    else
        print_success "Mapbox API token is configured"
    fi
    
    # Check if Google Maps key is set
    GMAPS_VALUE=$(aws ssm get-parameter --name "/diseasezone/prod/google-maps-key" --with-decryption --query "Parameter.Value" --output text 2>/dev/null || echo "placeholder")
    if [ "$GMAPS_VALUE" = "placeholder" ]; then
        print_warning "Google Maps API key is not configured"
        print_status "To set it, run: aws ssm put-parameter --name '/diseasezone/prod/google-maps-key' --value 'your-google-maps-key' --type 'SecureString' --overwrite"
    else
        print_success "Google Maps API key is configured"
    fi
    end_step "API Keys Check"
}

# Function to deploy using Ansible
deploy_with_ansible() {
    start_step "Ansible Deployment"
    print_header "Deploying Application with Ansible"
    
    cd "$PROJECT_DIR"
    
    # Run Ansible playbook with the deploy script
    print_status "Running Ansible deployment..."
    ansible-playbook -i ansible/inventory.yml ansible/deploy.yml \
        -e "docker_image_tag=$IMAGE_TAG" \
        -e "ecr_repository_url=$ECR_REPOSITORY_URL" \
        -e "ecs_cluster_name=$ECS_CLUSTER_NAME" \
        -e "ecs_service_name=$ECS_SERVICE_NAME" \
        -e "aws_region=$AWS_REGION" \
        -e "docker_build_path=$PROJECT_DIR" \
        -e "project_name=$DOCKER_IMAGE_NAME" \
        -e "domain_name=disease.zone" \
        -e "secondary_domain=disease.app"
    
    print_success "Ansible deployment completed"
    end_step "Ansible Deployment"
}

# Function to wait for deployment and check health
check_deployment_health() {
    start_step "Deployment Health Check"
    print_header "Checking Deployment Health"
    
    print_status "Waiting for ECS service to stabilize..."
    aws ecs wait services-stable \
        --cluster "$ECS_CLUSTER_NAME" \
        --services "$ECS_SERVICE_NAME" \
        --region "$AWS_REGION"
    
    print_status "Checking service status..."
    SERVICE_STATUS=$(aws ecs describe-services \
        --cluster "$ECS_CLUSTER_NAME" \
        --services "$ECS_SERVICE_NAME" \
        --region "$AWS_REGION" \
        --query "services[0].status" \
        --output text)
    
    RUNNING_COUNT=$(aws ecs describe-services \
        --cluster "$ECS_CLUSTER_NAME" \
        --services "$ECS_SERVICE_NAME" \
        --region "$AWS_REGION" \
        --query "services[0].runningCount" \
        --output text)
    
    DESIRED_COUNT=$(aws ecs describe-services \
        --cluster "$ECS_CLUSTER_NAME" \
        --services "$ECS_SERVICE_NAME" \
        --region "$AWS_REGION" \
        --query "services[0].desiredCount" \
        --output text)
    
    print_status "Service Status: $SERVICE_STATUS"
    print_status "Running Tasks: $RUNNING_COUNT/$DESIRED_COUNT"
    
    if [ "$SERVICE_STATUS" = "ACTIVE" ] && [ "$RUNNING_COUNT" = "$DESIRED_COUNT" ]; then
        print_success "Deployment is healthy!"
    else
        print_warning "Deployment may still be starting up. Check ECS console for details."
    fi
    end_step "Deployment Health Check"
}

# Function to display final status and URLs
display_final_status() {
    print_header "Deployment Summary"
    
    echo -e "${GREEN}🎉 Deployment completed successfully!${NC}\n"
    
    echo -e "${BLUE}📊 Application URLs:${NC}"
    echo -e "   • Load Balancer: http://$LOAD_BALANCER_DNS"
    echo -e "   • Health Check: http://$LOAD_BALANCER_DNS/api/health"
    echo -e ""
    echo -e "${GREEN}🌍 Primary Domain (disease.zone):${NC}"
    echo -e "   • Root: https://disease.zone"
    echo -e "   • WWW: https://www.disease.zone"
    echo -e "   • API: https://api.disease.zone"
    echo -e "   • Ledger: https://ledger.disease.zone"
    echo -e ""
    echo -e "${GREEN}🌎 Secondary Domain (disease.app):${NC}"
    echo -e "   • Root: https://disease.app"
    echo -e "   • WWW: https://www.disease.app"
    echo -e "   • API: https://api.disease.app"
    echo -e "   • Ledger: https://ledger.disease.app"
    
    echo -e "\n${BLUE}📈 Monitoring & Management:${NC}"
    echo -e "   • CloudWatch Dashboard: https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=diseasezone-prod"
    echo -e "   • ECS Service: https://us-east-1.console.aws.amazon.com/ecs/v2/clusters/$ECS_CLUSTER_NAME/services/$ECS_SERVICE_NAME"
    echo -e "   • ECR Repository: https://us-east-1.console.aws.amazon.com/ecr/repositories/private/515966511618/diseasezone-prod"
    
    echo -e "\n${BLUE}🔧 Next Steps:${NC}"
    if [ "$MAPBOX_VALUE" = "placeholder" ] || [ "$GMAPS_VALUE" = "placeholder" ]; then
        echo -e "   • Configure API keys (see warnings above)"
    fi
    echo -e "   • Monitor application logs in CloudWatch"
    echo -e "   • Test application functionality"
    echo -e "   • Verify security endpoints: https://disease.zone/security/status"
    echo -e "   • Set up custom domain after DNS propagation"
    
    echo -e "\n${GREEN}✅ Your applications are now live on both domains!${NC}"
    echo -e "${GREEN}   🌐 disease.zone & disease.app are ready to serve users${NC}\n"
}

# Function to handle script interruption
cleanup() {
    INTERRUPT_TIME=$(date +%s)
    INTERRUPT_TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    TOTAL_DURATION=$((INTERRUPT_TIME - START_TIME))
    
    echo -e "\n${RED}🛑 INTERRUPTED at $INTERRUPT_TIMESTAMP${NC}"
    echo -e "${YELLOW}⏱️  Total runtime before interruption: ${TOTAL_DURATION}s${NC}"
    
    if [ -n "${CURRENT_STEP:-}" ]; then
        STEP_DURATION=$((INTERRUPT_TIME - STEP_START_TIME))
        echo -e "${YELLOW}📍 Was stuck on step: '$CURRENT_STEP' for ${STEP_DURATION}s${NC}"
    fi
    
    print_warning "Deployment interrupted. Cleaning up..."
    exit 1
}

# Main deployment function
main() {
    # Set up signal handlers
    trap cleanup INT TERM
    
    echo -e "${GREEN}🚀 Disease Zone Deployment Script${NC}"
    echo -e "${BLUE}====================================${NC}\n"
    
    # Run deployment steps
    check_prerequisites
    deploy_infrastructure
    get_terraform_outputs
    security_setup
    build_docker_image
    authenticate_ecr
    push_to_ecr
    check_api_keys
    deploy_with_ansible
    check_deployment_health
    display_final_status
    
    # Final timing
    END_TIME=$(date +%s)
    END_TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    TOTAL_DURATION=$((END_TIME - START_TIME))
    
    echo -e "\n${GREEN}🏁 DEPLOYMENT COMPLETED at $END_TIMESTAMP${NC}"
    echo -e "${BLUE}⏱️  Total deployment time: ${TOTAL_DURATION}s ($(($TOTAL_DURATION / 60))m $(($TOTAL_DURATION % 60))s)${NC}"
}

# Handle command line arguments
case "${1:-deploy}" in
    deploy)
        main
        ;;
    infra-only)
        check_prerequisites
        deploy_infrastructure
        get_terraform_outputs
        print_success "Infrastructure deployment completed"
        ;;
    app-only)
        check_prerequisites
        get_terraform_outputs
        security_setup
        build_docker_image
        authenticate_ecr
        push_to_ecr
        deploy_with_ansible
        check_deployment_health
        print_success "Application deployment completed"
        ;;
    build-only)
        check_prerequisites
        build_docker_image
        print_success "Build completed. Docker image: $DOCKER_IMAGE_NAME:$IMAGE_TAG"
        ;;
    push-only)
        check_prerequisites
        get_terraform_outputs
        authenticate_ecr
        docker tag "$DOCKER_IMAGE_NAME:$IMAGE_TAG" "$ECR_REPOSITORY_URL:$IMAGE_TAG" 2>/dev/null || true
        push_to_ecr
        print_success "Push completed."
        ;;
    status)
        get_terraform_outputs
        check_deployment_health
        ;;
    help|--help|-h)
        echo "Disease Zone Deployment Script"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  deploy       Full deployment - infrastructure + application (default)"
        echo "  infra-only   Deploy infrastructure only (Terraform)"
        echo "  app-only     Deploy application only (assumes infrastructure exists)"
        echo "  build-only   Build Docker image only"
        echo "  push-only    Push existing image to ECR"
        echo "  status       Check deployment status"
        echo "  help         Show this help message"
        echo ""
        echo "Infrastructure includes:"
        echo "  - Route53 DNS configuration"
        echo "  - Application Load Balancer"
        echo "  - ECS Cluster and Service"
        echo "  - ECR Repository"
        echo "  - CloudWatch monitoring"
        echo "  - SSL certificates"
        echo ""
        exit 0
        ;;
    *)
        print_error "Unknown command: $1"
        echo "Run '$0 help' for usage information."
        exit 1
        ;;
esac