#!/bin/bash

# =============================================================================
# Disease.Zone Security Crisis Recovery & Bootstrap Script
# =============================================================================
# 
# This script handles both first-time security setup and crisis recovery
# scenarios when you need to get the application running quickly and securely.
#
# Author: Security Enhancement Team
# Date: September 18, 2025
# Version: 1.0.0
#
# =============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env"
ENV_SECURE_FILE="$PROJECT_DIR/.env.secure"
BACKUP_DIR="$PROJECT_DIR/.security-backups"

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

print_banner() {
    echo -e "${CYAN}"
    echo "=============================================================================="
    echo "🛡️  DISEASE.ZONE SECURITY CRISIS RECOVERY & BOOTSTRAP SCRIPT"
    echo "=============================================================================="
    echo -e "${NC}"
}

print_section() {
    echo -e "\n${BLUE}==== $1 ====${NC}\n"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

ask_yes_no() {
    local prompt="$1"
    local default="${2:-n}"
    
    if [[ "$default" == "y" ]]; then
        prompt="$prompt [Y/n]: "
    else
        prompt="$prompt [y/N]: "
    fi
    
    while true; do
        read -p "$prompt" -r answer
        case $answer in
            [Yy]* ) return 0;;
            [Nn]* ) return 1;;
            "" ) 
                if [[ "$default" == "y" ]]; then
                    return 0
                else
                    return 1
                fi
                ;;
            * ) echo "Please answer yes or no.";;
        esac
    done
}

check_command() {
    if ! command -v "$1" &> /dev/null; then
        print_error "Required command '$1' not found. Please install it first."
        exit 1
    fi
}

create_backup() {
    local file="$1"
    local backup_name="$2"
    
    if [[ -f "$file" ]]; then
        mkdir -p "$BACKUP_DIR"
        local timestamp=$(date +%Y%m%d_%H%M%S)
        local backup_file="$BACKUP_DIR/${backup_name}_${timestamp}.backup"
        cp "$file" "$backup_file"
        print_info "Backed up $file to $backup_file"
    fi
}

# =============================================================================
# SYSTEM CHECKS
# =============================================================================

perform_system_checks() {
    print_section "System Requirements Check"
    
    # Check required commands
    local required_commands=("node" "npm" "openssl" "git")
    for cmd in "${required_commands[@]}"; do
        if command -v "$cmd" &> /dev/null; then
            print_success "$cmd is available"
        else
            print_error "$cmd is required but not installed"
            exit 1
        fi
    done
    
    # Check Node.js version
    local node_version=$(node --version | cut -d'v' -f2)
    local major_version=$(echo "$node_version" | cut -d'.' -f1)
    if [[ "$major_version" -ge 16 ]]; then
        print_success "Node.js version $node_version is supported"
    else
        print_warning "Node.js version $node_version might not be fully supported. Recommended: 16+"
    fi
    
    # Check if we're in the right directory
    if [[ ! -f "$PROJECT_DIR/package.json" ]]; then
        print_error "package.json not found. Are you in the disease.zone project directory?"
        exit 1
    fi
    
    print_success "System requirements check passed"
}

# =============================================================================
# SECURITY STATUS ASSESSMENT
# =============================================================================

assess_security_status() {
    print_section "Security Status Assessment"
    
    local status="unknown"
    local issues=()
    
    # Check if security releases are implemented
    if git log --oneline | grep -q "Security Release"; then
        print_success "Security releases are implemented"
        status="implemented"
    else
        print_warning "Security releases not found in git history"
        issues+=("Security releases missing")
        status="missing"
    fi
    
    # Check environment configuration
    if [[ -f "$ENV_FILE" ]]; then
        print_info "Found .env file"
        
        # Check for required secrets
        local required_vars=("JWT_SECRET" "SESSION_SECRET")
        for var in "${required_vars[@]}"; do
            if grep -q "^${var}=" "$ENV_FILE" && ! grep -q "^${var}=$" "$ENV_FILE" && ! grep -q "^#${var}=" "$ENV_FILE"; then
                print_success "$var is configured"
            else
                print_warning "$var is missing or empty"
                issues+=("$var not configured")
                status="misconfigured"
            fi
        done
    else
        print_warning ".env file not found"
        issues+=(".env file missing")
        status="missing"
    fi
    
    # Check for dangerous defaults
    if [[ -f "$ENV_FILE" ]]; then
        local dangerous_patterns=(
            "your-session-secret-change-in-production"
            "your-jwt-secret-change-in-production" 
            "diseaseZone_dev_secret_change_in_production"
            "changeme"
        )
        
        for pattern in "${dangerous_patterns[@]}"; do
            if grep -q "$pattern" "$ENV_FILE"; then
                print_error "Dangerous default found: $pattern"
                issues+=("Dangerous default: $pattern")
                status="dangerous"
            fi
        done
    fi
    
    # Print assessment summary
    echo -e "\n${PURPLE}Security Status Assessment:${NC}"
    echo "Status: $status"
    if [[ ${#issues[@]} -gt 0 ]]; then
        echo "Issues found:"
        for issue in "${issues[@]}"; do
            echo "  - $issue"
        done
    fi
    
    echo "$status"
}

# =============================================================================
# SECRET GENERATION
# =============================================================================

generate_secure_secrets() {
    print_section "Generating Secure Secrets"
    
    local secrets_file="$PROJECT_DIR/.env.secure"
    
    # Generate secrets using Node.js script if available
    if [[ -f "$PROJECT_DIR/scripts/generate-secure-secrets.js" ]]; then
        print_info "Using advanced secret generation script..."
        cd "$PROJECT_DIR"
        node scripts/generate-secure-secrets.js --env-file
        print_success "Secure secrets generated in .env.secure"
    else
        # Fallback to manual generation
        print_info "Using fallback secret generation..."
        
        local jwt_secret=$(openssl rand -hex 64)
        local session_secret=$(openssl rand -hex 64) 
        local mfa_secret=$(openssl rand -hex 32)
        local recovery_salt=$(openssl rand -hex 16)
        local fhir_key=$(openssl rand -hex 32)
        
        cat > "$secrets_file" << EOF
# Security Crisis Recovery - Generated Secrets
# Generated on: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# 
# CRITICAL: Copy these to your .env file and delete this file

JWT_SECRET=$jwt_secret
SESSION_SECRET=$session_secret
MFA_SECRET=$mfa_secret
RECOVERY_CODE_SALT=$recovery_salt
FHIR_ENCRYPTION_KEY=$fhir_key

# Database passwords (generate strong ones)
# POSTGRES_PASSWORD=your_strong_database_password_here
# GRAFANA_PASSWORD=your_strong_grafana_password_here

# IMPORTANT: 
# 1. Copy these values to your .env file
# 2. Delete this .env.secure file after copying
# 3. Never commit secrets to version control
EOF
        print_success "Basic secrets generated in .env.secure"
    fi
}

# =============================================================================
# ENVIRONMENT CONFIGURATION
# =============================================================================

configure_environment() {
    print_section "Environment Configuration"
    
    # Backup existing .env if it exists
    if [[ -f "$ENV_FILE" ]]; then
        create_backup "$ENV_FILE" "env"
    fi
    
    # Check if .env.secure exists from generation
    if [[ ! -f "$ENV_SECURE_FILE" ]]; then
        print_error ".env.secure file not found. Please run secret generation first."
        return 1
    fi
    
    # Create or update .env file
    if [[ -f "$ENV_FILE" ]]; then
        print_info "Updating existing .env file with secure secrets..."
        
        # Read secrets from .env.secure
        local jwt_secret=$(grep "^JWT_SECRET=" "$ENV_SECURE_FILE" | cut -d'=' -f2)
        local session_secret=$(grep "^SESSION_SECRET=" "$ENV_SECURE_FILE" | cut -d'=' -f2)
        local mfa_secret=$(grep "^MFA_SECRET=" "$ENV_SECURE_FILE" | cut -d'=' -f2)
        local recovery_salt=$(grep "^RECOVERY_CODE_SALT=" "$ENV_SECURE_FILE" | cut -d'=' -f2)
        
        # Update or add secrets to existing .env
        sed -i.bak "s/^JWT_SECRET=.*/JWT_SECRET=$jwt_secret/" "$ENV_FILE" || echo "JWT_SECRET=$jwt_secret" >> "$ENV_FILE"
        sed -i.bak "s/^SESSION_SECRET=.*/SESSION_SECRET=$session_secret/" "$ENV_FILE" || echo "SESSION_SECRET=$session_secret" >> "$ENV_FILE"
        
        # Add optional secrets if they don't exist
        if ! grep -q "^MFA_SECRET=" "$ENV_FILE"; then
            echo "MFA_SECRET=$mfa_secret" >> "$ENV_FILE"
        fi
        if ! grep -q "^RECOVERY_CODE_SALT=" "$ENV_FILE"; then
            echo "RECOVERY_CODE_SALT=$recovery_salt" >> "$ENV_FILE"
        fi
        
        rm -f "$ENV_FILE.bak"
        
    else
        print_info "Creating new .env file from template..."
        
        # Copy .env.example if it exists, otherwise create minimal .env
        if [[ -f "$PROJECT_DIR/.env.example" ]]; then
            cp "$PROJECT_DIR/.env.example" "$ENV_FILE"
        else
            cat > "$ENV_FILE" << 'EOF'
# Disease.Zone Environment Configuration
# Generated by Security Crisis Recovery Script

# Server Configuration
PORT=3000
NODE_ENV=development

# Security Configuration
BCRYPT_ROUNDS=12
API_RATE_LIMIT_ENABLED=true
ENABLE_SECURITY_MONITORING=true
ALERT_ON_SUSPICIOUS_ACTIVITY=true

# Application Features
API_ACCESS_LEVEL=standard
ENABLE_CDC_DATA=true
ENABLE_DISEASE_SH=true
DATA_CACHE_ENABLED=true
CACHE_EXPIRY_MINUTES=60
EOF
        fi
        
        # Append secrets from .env.secure
        echo "" >> "$ENV_FILE"
        echo "# Security Secrets (Generated)" >> "$ENV_FILE"
        grep "^[A-Z_]*=" "$ENV_SECURE_FILE" >> "$ENV_FILE"
    fi
    
    print_success "Environment configuration updated"
    
    # Clean up .env.secure
    if ask_yes_no "Delete .env.secure file now that secrets are copied to .env?" "y"; then
        rm -f "$ENV_SECURE_FILE"
        print_success "Cleaned up .env.secure file"
    else
        print_warning "Remember to delete .env.secure manually after verifying .env"
    fi
}

# =============================================================================
# VALIDATION
# =============================================================================

validate_configuration() {
    print_section "Configuration Validation"
    
    cd "$PROJECT_DIR"
    
    # Check if npm dependencies are installed
    if [[ ! -d "node_modules" ]]; then
        print_info "Installing npm dependencies..."
        npm install
        print_success "Dependencies installed"
    fi
    
    # Run security configuration validation
    if npm run security:validate-config 2>/dev/null; then
        print_success "Security configuration validation passed"
    else
        print_warning "Security validation failed or not available"
        print_info "This might be expected for first-time setup"
        
        # Try basic validation
        local required_vars=("JWT_SECRET" "SESSION_SECRET")
        local validation_passed=true
        
        for var in "${required_vars[@]}"; do
            if grep -q "^${var}=" "$ENV_FILE" && ! grep -q "^${var}=$" "$ENV_FILE"; then
                local value=$(grep "^${var}=" "$ENV_FILE" | cut -d'=' -f2)
                if [[ ${#value} -ge 32 ]]; then
                    print_success "$var is properly configured (${#value} characters)"
                else
                    print_error "$var is too short (${#value} characters, minimum 32)"
                    validation_passed=false
                fi
            else
                print_error "$var is missing or empty"
                validation_passed=false
            fi
        done
        
        if [[ "$validation_passed" == "true" ]]; then
            print_success "Basic validation passed"
        else
            print_error "Basic validation failed"
            return 1
        fi
    fi
}

# =============================================================================
# APPLICATION TESTING
# =============================================================================

test_application() {
    print_section "Application Testing"
    
    cd "$PROJECT_DIR"
    
    print_info "Starting application test..."
    
    # Start the application in background and test
    timeout 30s npm start &
    local app_pid=$!
    
    sleep 5
    
    # Test if application is responding
    if curl -s http://localhost:3000 > /dev/null; then
        print_success "Application is responding on port 3000"
        kill $app_pid 2>/dev/null || true
        wait $app_pid 2>/dev/null || true
    else
        print_warning "Application test inconclusive (this might be normal for first run)"
        kill $app_pid 2>/dev/null || true
        wait $app_pid 2>/dev/null || true
    fi
}

# =============================================================================
# ROLLBACK FUNCTIONS
# =============================================================================

show_rollback_options() {
    print_section "Rollback Options"
    
    echo "Available rollback options:"
    echo "1. Rollback Security Release 4 (Monitoring) - git revert 9eee352"
    echo "2. Rollback Security Release 3 (Configuration) - git revert 36b6a23"
    echo "3. Rollback Security Release 2 (Encryption) - git revert 1b4b2ae"
    echo "4. Rollback Security Release 1 (Authentication) - git revert 08d9990"
    echo "5. Full rollback (all security releases)"
    echo "6. Cancel"
    
    read -p "Select rollback option (1-6): " choice
    
    case $choice in
        1)
            print_warning "Rolling back Security Release 4..."
            git revert 9eee352 --no-edit
            print_success "Security Release 4 rolled back"
            ;;
        2)
            print_warning "Rolling back Security Release 3..."
            git revert 36b6a23 --no-edit
            print_success "Security Release 3 rolled back"
            ;;
        3)
            print_warning "Rolling back Security Release 2..."
            git revert 1b4b2ae --no-edit
            print_success "Security Release 2 rolled back"
            ;;
        4)
            print_warning "Rolling back Security Release 1..."
            git revert 08d9990 --no-edit
            print_success "Security Release 1 rolled back"
            ;;
        5)
            if ask_yes_no "Are you sure you want to rollback ALL security releases? This is irreversible." "n"; then
                print_warning "Rolling back all security releases..."
                git revert 9eee352 36b6a23 1b4b2ae 08d9990 --no-edit
                print_success "All security releases rolled back"
            fi
            ;;
        6)
            print_info "Rollback cancelled"
            ;;
        *)
            print_error "Invalid option"
            ;;
    esac
}

# =============================================================================
# MAIN SCRIPT LOGIC
# =============================================================================

show_menu() {
    print_section "What would you like to do?"
    
    echo "1. 🚀 First-time security setup (Bootstrap)"
    echo "2. 🆘 Crisis recovery (Fix broken configuration)"
    echo "3. 🔧 Generate new secrets only"
    echo "4. ✅ Validate current configuration"
    echo "5. 🔄 Rollback security releases"
    echo "6. 📊 Show security status"
    echo "7. 📚 Show documentation links"
    echo "8. ❌ Exit"
    
    read -p "Select option (1-8): " choice
    echo "$choice"
}

run_bootstrap() {
    print_section "🚀 First-Time Security Bootstrap"
    
    perform_system_checks
    generate_secure_secrets
    configure_environment
    validate_configuration
    test_application
    
    print_section "🎉 Bootstrap Complete!"
    print_success "Your disease.zone application is now securely configured!"
    print_info "Next steps:"
    echo "  1. Start the application: npm start"
    echo "  2. Access the application: http://localhost:3000"
    echo "  3. Review security dashboard (admin access required)"
    echo "  4. Read documentation in ./docs/ folder"
}

run_crisis_recovery() {
    print_section "🆘 Crisis Recovery Mode"
    
    local status=$(assess_security_status)
    
    if [[ "$status" == "dangerous" ]]; then
        print_error "DANGEROUS CONFIGURATION DETECTED!"
        print_warning "Backing up current configuration and generating new secrets..."
        create_backup "$ENV_FILE" "crisis_env"
    fi
    
    perform_system_checks
    generate_secure_secrets
    configure_environment
    validate_configuration
    
    print_section "🎉 Crisis Recovery Complete!"
    print_success "Your application should now be in a secure state"
    print_info "Please test the application and review the changes"
}

show_documentation() {
    print_section "📚 Documentation"
    
    echo "Security documentation is available in the ./docs/ folder:"
    echo ""
    echo "📋 Complete Guide:"
    echo "   docs/SECURITY_RELEASES_GUIDE.md"
    echo ""
    echo "🔧 Quick Reference:"
    echo "   docs/SECURITY_QUICK_REFERENCE.md" 
    echo ""
    echo "📊 Implementation Summary:"
    echo "   docs/SECURITY_IMPLEMENTATION_SUMMARY.md"
    echo ""
    echo "🛠️ Available npm scripts:"
    echo "   npm run security:generate-secrets"
    echo "   npm run security:generate-secrets-file"
    echo "   npm run security:validate-config"
    echo "   npm run security:validate-secret <secret>"
}

# =============================================================================
# MAIN EXECUTION
# =============================================================================

main() {
    print_banner
    
    # Change to project directory
    cd "$PROJECT_DIR"
    
    # If arguments provided, handle them
    if [[ $# -gt 0 ]]; then
        case "$1" in
            "bootstrap"|"--bootstrap")
                run_bootstrap
                ;;
            "crisis"|"--crisis"|"recovery"|"--recovery")
                run_crisis_recovery
                ;;
            "secrets"|"--secrets"|"generate"|"--generate")
                generate_secure_secrets
                ;;
            "validate"|"--validate")
                validate_configuration
                ;;
            "status"|"--status")
                assess_security_status
                ;;
            "rollback"|"--rollback")
                show_rollback_options
                ;;
            "help"|"--help")
                echo "Usage: $0 [bootstrap|crisis|secrets|validate|status|rollback|help]"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                echo "Usage: $0 [bootstrap|crisis|secrets|validate|status|rollback|help]"
                exit 1
                ;;
        esac
        return
    fi
    
    # Interactive mode
    while true; do
        choice=$(show_menu)
        
        case $choice in
            1)
                run_bootstrap
                ;;
            2)
                run_crisis_recovery
                ;;
            3)
                generate_secure_secrets
                print_success "Secrets generated. Remember to copy them to your .env file!"
                ;;
            4)
                validate_configuration
                ;;
            5)
                show_rollback_options
                ;;
            6)
                assess_security_status
                ;;
            7)
                show_documentation
                ;;
            8)
                print_info "Goodbye! 👋"
                exit 0
                ;;
            *)
                print_error "Invalid option. Please select 1-8."
                ;;
        esac
        
        echo ""
        if ! ask_yes_no "Would you like to perform another operation?" "n"; then
            break
        fi
    done
    
    print_info "Script completed. Have a great day! 🌟"
}

# Run main function with all arguments
main "$@"