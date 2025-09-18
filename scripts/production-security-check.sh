#!/bin/bash

# =============================================================================
# Disease.Zone Production Security Validation Script
# =============================================================================
# 
# This script validates security configuration in production environments
# and can be run as a health check or initialization script in containers.
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
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="${PROJECT_DIR:-/usr/src/app}"
ENV_FILE="${PROJECT_DIR}/.env"
LOG_FILE="${PROJECT_DIR}/logs/security-check.log"

print_success() {
    echo -e "${GREEN}✅ $1${NC}" | tee -a "$LOG_FILE"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}" | tee -a "$LOG_FILE"
}

print_error() {
    echo -e "${RED}❌ $1${NC}" | tee -a "$LOG_FILE"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}" | tee -a "$LOG_FILE"
}

# Initialize logging
mkdir -p "$(dirname "$LOG_FILE")"
echo "=== Security Check Started at $(date) ===" > "$LOG_FILE"

validate_environment_variables() {
    print_info "Validating security environment variables..."
    
    local required_vars=(
        "JWT_SECRET"
        "ENCRYPTION_KEY" 
        "AUDIT_ENCRYPTION_KEY"
        "SESSION_SECRET"
    )
    
    local optional_vars=(
        "RATE_LIMIT_ENABLED"
        "SESSION_TIMEOUT"
        "SECURITY_AUDIT_ENABLED"
        "BCRYPT_SALT_ROUNDS"
    )
    
    local missing_vars=()
    local weak_vars=()
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            missing_vars+=("$var")
        else
            # Check if secret is long enough (minimum 32 characters)
            if [[ ${#!var} -lt 32 ]]; then
                weak_vars+=("$var (${#!var} chars)")
            else
                print_success "$var is properly configured"
            fi
        fi
    done
    
    for var in "${optional_vars[@]}"; do
        if [[ -n "${!var}" ]]; then
            print_success "$var is configured: ${!var}"
        else
            print_warning "$var is not set (using defaults)"
        fi
    done
    
    # Report issues
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        print_error "Missing required variables: ${missing_vars[*]}"
        return 1
    fi
    
    if [[ ${#weak_vars[@]} -gt 0 ]]; then
        print_warning "Weak secrets detected: ${weak_vars[*]}"
        print_warning "Consider regenerating these with stronger values"
    fi
    
    print_success "Environment variables validation passed"
    return 0
}

validate_file_permissions() {
    print_info "Validating file permissions..."
    
    # Check .env file permissions
    if [[ -f "$ENV_FILE" ]]; then
        local env_perms=$(stat -c "%a" "$ENV_FILE" 2>/dev/null || stat -f "%A" "$ENV_FILE" 2>/dev/null || echo "unknown")
        if [[ "$env_perms" = "600" ]]; then
            print_success ".env file has secure permissions (600)"
        else
            print_warning ".env file permissions are $env_perms (should be 600)"
            if [[ -w "$ENV_FILE" ]]; then
                chmod 600 "$ENV_FILE"
                print_success "Fixed .env file permissions to 600"
            fi
        fi
    fi
    
    # Check log directory permissions
    local log_dir="$(dirname "$LOG_FILE")"
    if [[ -d "$log_dir" ]]; then
        local log_perms=$(stat -c "%a" "$log_dir" 2>/dev/null || stat -f "%A" "$log_dir" 2>/dev/null || echo "unknown")
        if [[ "$log_perms" =~ ^7[0-9][0-9]$ ]]; then
            print_success "Log directory has appropriate permissions ($log_perms)"
        else
            print_warning "Log directory permissions are $log_perms"
        fi
    fi
    
    return 0
}

check_security_components() {
    print_info "Checking security component availability..."
    
    # Check if security middleware files exist
    local security_files=(
        "middleware/security.js"
        "middleware/rateLimiter.js" 
        "middleware/sessionManager.js"
        "routes/securityRoutes.js"
    )
    
    for file in "${security_files[@]}"; do
        if [[ -f "$PROJECT_DIR/$file" ]]; then
            print_success "Security component found: $file"
        else
            print_error "Security component missing: $file"
            return 1
        fi
    done
    
    return 0
}

test_security_endpoints() {
    print_info "Testing security endpoints (if server is running)..."
    
    # Check if the server is running locally
    local server_url="http://localhost:${PORT:-3000}"
    
    if curl -s -f "$server_url/api/health" >/dev/null 2>&1; then
        print_info "Server is running, testing security endpoints..."
        
        # Test security status endpoint
        if curl -s -f "$server_url/security/status" >/dev/null 2>&1; then
            print_success "Security status endpoint is accessible"
        else
            print_warning "Security status endpoint may not be available"
        fi
    else
        print_info "Server is not running locally, skipping endpoint tests"
    fi
    
    return 0
}

generate_security_report() {
    local report_file="$PROJECT_DIR/security-report.json"
    
    print_info "Generating security validation report..."
    
    cat > "$report_file" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "environment": "${NODE_ENV:-development}",
  "validation_status": "completed",
  "security_features": {
    "jwt_authentication": $(test -n "$JWT_SECRET" && echo "true" || echo "false"),
    "encryption_enabled": $(test -n "$ENCRYPTION_KEY" && echo "true" || echo "false"),
    "audit_logging": $(test -n "$AUDIT_ENCRYPTION_KEY" && echo "true" || echo "false"),
    "rate_limiting": $(test "$RATE_LIMIT_ENABLED" = "true" && echo "true" || echo "false"),
    "session_management": $(test -n "$SESSION_SECRET" && echo "true" || echo "false")
  },
  "recommendations": []
}
EOF
    
    print_success "Security report generated: $report_file"
}

main() {
    echo -e "${BLUE}🛡️  Production Security Validation${NC}"
    echo -e "${BLUE}=====================================${NC}\n"
    
    local exit_code=0
    
    # Run validation checks
    validate_environment_variables || exit_code=1
    validate_file_permissions || exit_code=1
    check_security_components || exit_code=1
    test_security_endpoints || exit_code=1
    
    # Generate report
    generate_security_report
    
    echo ""
    if [[ $exit_code -eq 0 ]]; then
        print_success "🎉 All security validations passed!"
        print_info "Security stack is properly configured for production"
    else
        print_error "❌ Some security validations failed"
        print_error "Please review the issues above before deploying to production"
    fi
    
    echo "=== Security Check Completed at $(date) ===" >> "$LOG_FILE"
    
    exit $exit_code
}

# Handle different run modes
case "${1:-validate}" in
    validate|check)
        main
        ;;
    report)
        generate_security_report
        ;;
    help|--help|-h)
        echo "Production Security Validation Script"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  validate     Run full security validation (default)"
        echo "  check        Alias for validate"
        echo "  report       Generate security report only"
        echo "  help         Show this help message"
        echo ""
        echo "Environment Variables:"
        echo "  PROJECT_DIR  Project directory (default: /usr/src/app)"
        echo "  PORT         Server port (default: 3000)"
        echo ""
        exit 0
        ;;
    *)
        print_error "Unknown command: $1"
        echo "Run '$0 help' for usage information."
        exit 1
        ;;
esac