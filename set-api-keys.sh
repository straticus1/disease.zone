#!/bin/bash

# Disease Zone API Keys Setup Script
# This script helps you configure API keys for the disease.zone application

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

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

# Function to set Mapbox API token
set_mapbox_token() {
    echo -e "${BLUE}Enter your Mapbox Access Token:${NC}"
    echo -e "${YELLOW}(Get one at: https://account.mapbox.com/access-tokens/)${NC}"
    read -r -s MAPBOX_TOKEN
    echo
    
    if [ -z "$MAPBOX_TOKEN" ]; then
        print_error "Mapbox token cannot be empty"
        return 1
    fi
    
    print_status "Setting Mapbox API token..."
    aws ssm put-parameter \
        --name "/diseasezone/prod/mapbox-token" \
        --value "$MAPBOX_TOKEN" \
        --type "SecureString" \
        --overwrite \
        --region us-east-1
    
    print_success "Mapbox API token configured successfully"
}

# Function to set Google Maps API key
set_google_maps_key() {
    echo -e "${BLUE}Enter your Google Maps API Key:${NC}"
    echo -e "${YELLOW}(Get one at: https://developers.google.com/maps/gmp-get-started)${NC}"
    read -r -s GMAPS_KEY
    echo
    
    if [ -z "$GMAPS_KEY" ]; then
        print_error "Google Maps API key cannot be empty"
        return 1
    fi
    
    print_status "Setting Google Maps API key..."
    aws ssm put-parameter \
        --name "/diseasezone/prod/google-maps-key" \
        --value "$GMAPS_KEY" \
        --type "SecureString" \
        --overwrite \
        --region us-east-1
    
    print_success "Google Maps API key configured successfully"
}

# Function to check current API key status
check_api_keys() {
    print_header "Current API Keys Status"
    
    # Check Mapbox token
    MAPBOX_VALUE=$(aws ssm get-parameter --name "/diseasezone/prod/mapbox-token" --query "Parameter.Value" --output text 2>/dev/null || echo "not-set")
    if [ "$MAPBOX_VALUE" = "not-set" ] || [ "$MAPBOX_VALUE" = "placeholder" ]; then
        print_warning "Mapbox API token: Not configured"
    else
        print_success "Mapbox API token: Configured ✓"
    fi
    
    # Check Google Maps key
    GMAPS_VALUE=$(aws ssm get-parameter --name "/diseasezone/prod/google-maps-key" --query "Parameter.Value" --output text 2>/dev/null || echo "not-set")
    if [ "$GMAPS_VALUE" = "not-set" ] || [ "$GMAPS_VALUE" = "placeholder" ]; then
        print_warning "Google Maps API key: Not configured"
    else
        print_success "Google Maps API key: Configured ✓"
    fi
}

# Main function
main() {
    print_header "Disease Zone API Keys Configuration"
    
    # Check AWS CLI availability
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed"
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS credentials not configured or expired"
        exit 1
    fi
    
    case "${1:-interactive}" in
        mapbox)
            set_mapbox_token
            ;;
        google-maps)
            set_google_maps_key
            ;;
        both)
            set_mapbox_token
            echo
            set_google_maps_key
            ;;
        check)
            check_api_keys
            ;;
        help|--help|-h)
            echo "Disease Zone API Keys Setup Script"
            echo ""
            echo "Usage: $0 [command]"
            echo ""
            echo "Commands:"
            echo "  mapbox       Set Mapbox API token only"
            echo "  google-maps  Set Google Maps API key only"
            echo "  both         Set both API keys"
            echo "  check        Check current API keys status"
            echo "  help         Show this help message"
            echo ""
            echo "Interactive mode (default): Prompts for which keys to set"
            exit 0
            ;;
        interactive|*)
            check_api_keys
            echo
            echo -e "${BLUE}What would you like to do?${NC}"
            echo "1) Set Mapbox API token"
            echo "2) Set Google Maps API key"
            echo "3) Set both API keys"
            echo "4) Check status and exit"
            echo "5) Exit"
            
            read -r -p "Enter your choice (1-5): " choice
            
            case $choice in
                1)
                    set_mapbox_token
                    ;;
                2)
                    set_google_maps_key
                    ;;
                3)
                    set_mapbox_token
                    echo
                    set_google_maps_key
                    ;;
                4)
                    check_api_keys
                    ;;
                5)
                    print_status "Exiting..."
                    exit 0
                    ;;
                *)
                    print_error "Invalid choice"
                    exit 1
                    ;;
            esac
            ;;
    esac
    
    echo
    print_success "API key configuration completed!"
    print_status "You can now run ./deploy.sh to deploy your application"
}

main "$@"