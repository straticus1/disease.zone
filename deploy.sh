#!/bin/bash

# Disease Zone Deployment Script
# This script builds, pushes, and deploys the disease.zone application to AWS ECS

set -e  # Exit on any error

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

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
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
    
    # Check if Terraform outputs are available
    if [ ! -f "$PROJECT_DIR/terraform/terraform.tfstate" ]; then
        print_error "Terraform state not found. Please run terraform apply first."
        exit 1
    fi
    
    # Verify AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS credentials not configured or expired"
        exit 1
    fi
    
    print_success "All prerequisites met"
}

# Function to get Terraform outputs
get_terraform_outputs() {
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
}

# Function to build Docker image
build_docker_image() {
    print_header "Building Docker Image"
    
    cd "$PROJECT_DIR"
    
    print_status "Building Docker image: $DOCKER_IMAGE_NAME:$IMAGE_TAG"
    docker build -t "$DOCKER_IMAGE_NAME:$IMAGE_TAG" .
    
    print_success "Docker image built successfully"
}

# Function to authenticate with ECR
authenticate_ecr() {
    print_header "Authenticating with ECR"
    
    print_status "Getting ECR login token..."
    aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$ECR_REPOSITORY_URL"
    
    print_success "ECR authentication successful"
}

# Function to push Docker image to ECR
push_to_ecr() {
    print_header "Pushing Docker Image to ECR"
    
    # Tag image for ECR
    print_status "Tagging image for ECR..."
    docker tag "$DOCKER_IMAGE_NAME:$IMAGE_TAG" "$ECR_REPOSITORY_URL:$IMAGE_TAG"
    
    # Push to ECR
    print_status "Pushing image to ECR..."
    docker push "$ECR_REPOSITORY_URL:$IMAGE_TAG"
    
    print_success "Docker image pushed to ECR successfully"
}

# Function to check if API keys are configured
check_api_keys() {
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
}

# Function to deploy using Ansible
deploy_with_ansible() {
    print_header "Deploying Application with Ansible"
    
    cd "$PROJECT_DIR"
    
    # Create a temporary variables file with the current image tag
    cat > ansible/vars/deploy_vars.yml << EOF
---
docker_image_tag: $IMAGE_TAG
ecr_repository_url: $ECR_REPOSITORY_URL
ecs_cluster_name: $ECS_CLUSTER_NAME
ecs_service_name: $ECS_SERVICE_NAME
aws_region: $AWS_REGION
EOF
    
    # Run Ansible playbook with the deploy script
    print_status "Running Ansible deployment..."
    ansible-playbook -i ansible/inventory.yml ansible/deploy.yml -e "@ansible/vars/deploy_vars.yml"
    
    # Clean up temporary file
    rm -f ansible/vars/deploy_vars.yml
    
    print_success "Ansible deployment completed"
}

# Function to wait for deployment and check health
check_deployment_health() {
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
}

# Function to display final status and URLs
display_final_status() {
    print_header "Deployment Summary"
    
    echo -e "${GREEN}🎉 Deployment completed successfully!${NC}\n"
    
    echo -e "${BLUE}📊 Application URLs:${NC}"
    echo -e "   • Load Balancer: http://$LOAD_BALANCER_DNS"
    echo -e "   • Domain (after DNS propagation): https://disease.zone"
    echo -e "   • Health Check: http://$LOAD_BALANCER_DNS/api/health"
    
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
    echo -e "   • Set up custom domain after DNS propagation"
    
    echo -e "\n${GREEN}✅ Your disease.zone application is now live!${NC}\n"
}

# Function to handle script interruption
cleanup() {
    print_warning "Deployment interrupted. Cleaning up..."
    rm -f ansible/vars/deploy_vars.yml 2>/dev/null || true
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
    get_terraform_outputs
    build_docker_image
    authenticate_ecr
    push_to_ecr
    check_api_keys
    deploy_with_ansible
    check_deployment_health
    display_final_status
}

# Handle command line arguments
case "${1:-deploy}" in
    deploy)
        main
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
        echo "  deploy     Full deployment (default)"
        echo "  build-only Build Docker image only"
        echo "  push-only  Push existing image to ECR"
        echo "  status     Check deployment status"
        echo "  help       Show this help message"
        echo ""
        exit 0
        ;;
    *)
        print_error "Unknown command: $1"
        echo "Run '$0 help' for usage information."
        exit 1
        ;;
esac