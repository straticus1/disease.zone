#!/bin/bash

# Deploy diseaseZone to AWS ECS
# Usage: ./deploy.sh [environment]

set -e

ENVIRONMENT=${1:-prod}
PROJECT_NAME="diseasezone"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "🚀 Starting deployment of diseaseZone to AWS ECS"
echo "Environment: ${ENVIRONMENT}"
echo "Project: ${PROJECT_NAME}"
echo ""

# Check prerequisites
echo "🔍 Checking prerequisites..."
command -v terraform >/dev/null 2>&1 || { echo "❌ Terraform is required but not installed. Aborting." >&2; exit 1; }
command -v ansible-playbook >/dev/null 2>&1 || { echo "❌ Ansible is required but not installed. Aborting." >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required but not installed. Aborting." >&2; exit 1; }
command -v aws >/dev/null 2>&1 || { echo "❌ AWS CLI is required but not installed. Aborting." >&2; exit 1; }

# Check AWS credentials
aws sts get-caller-identity >/dev/null 2>&1 || {
    echo "❌ AWS credentials not configured. Run 'aws configure' first. Aborting." >&2;
    exit 1;
}

echo "✅ All prerequisites met"
echo ""

# Install Ansible collections
echo "📦 Installing Ansible collections..."
cd "${PROJECT_ROOT}/ansible"
ansible-galaxy collection install -r requirements.yml
echo "✅ Ansible collections installed"
echo ""

# Check if terraform.tfvars exists
TFVARS_FILE="${PROJECT_ROOT}/terraform/terraform.tfvars"
if [ ! -f "${TFVARS_FILE}" ]; then
    echo "⚠️  terraform.tfvars not found. Creating from example..."
    cp "${PROJECT_ROOT}/terraform/terraform.tfvars.example" "${TFVARS_FILE}"
    echo "📝 Please edit terraform.tfvars with your configuration before proceeding"
    echo "File location: ${TFVARS_FILE}"
    read -p "Press Enter when ready to continue..."
fi

# Deploy infrastructure and application
echo "🏗️  Deploying infrastructure and application..."
ansible-playbook \
    -i inventory.yml \
    playbook.yml \
    -e environment="${ENVIRONMENT}" \
    -e project_name="${PROJECT_NAME}"

echo ""
echo "🎉 Deployment completed successfully!"
echo ""
echo "📋 Post-deployment checklist:"
echo "1. Update your domain's nameservers (displayed in the output above)"
echo "2. Configure API keys in AWS Systems Manager Parameter Store:"
echo "   - /${PROJECT_NAME}/${ENVIRONMENT}/mapbox-token"
echo "   - /${PROJECT_NAME}/${ENVIRONMENT}/google-maps-key"
echo "3. Wait for DNS propagation (up to 48 hours)"
echo "4. Monitor the application in CloudWatch Dashboard"
echo ""
echo "🔗 Useful commands:"
echo "  - View logs: aws logs tail /ecs/${PROJECT_NAME}-${ENVIRONMENT} --follow"
echo "  - Scale service: aws ecs update-service --cluster ${PROJECT_NAME}-cluster-${ENVIRONMENT} --service ${PROJECT_NAME}-service-${ENVIRONMENT} --desired-count 3"
echo "  - Deploy updates: cd ansible && ansible-playbook -i inventory.yml deploy.yml"