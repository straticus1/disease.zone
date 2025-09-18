/**
 * Security Release 3: Configuration Validation Service
 * Validates environment configuration for security compliance
 */

class ConfigurationValidationService {
    constructor() {
        this.requiredSecrets = [
            'JWT_SECRET',
            'SESSION_SECRET'
        ];
        
        this.recommendedSecrets = [
            'MFA_SECRET',
            'RECOVERY_CODE_SALT'
        ];
        
        this.dangerousDefaults = [
            { key: 'SESSION_SECRET', values: ['your-session-secret-change-in-production', 'sessionSecret'] },
            { key: 'JWT_SECRET', values: ['your-jwt-secret-change-in-production', 'diseaseZone_dev_secret_change_in_production'] },
            { key: 'POSTGRES_PASSWORD', values: ['changeme', 'password', 'admin'] },
            { key: 'GRAFANA_PASSWORD', values: ['admin', 'password'] },
            { key: 'MFA_SECRET', values: ['diseaseZoneMFA2023!'] }
        ];
    }

    /**
     * Perform comprehensive configuration validation
     */
    validateConfiguration() {
        const results = {
            isValid: true,
            criticalIssues: [],
            warnings: [],
            recommendations: [],
            securityScore: 100
        };

        // Check required secrets
        this.validateRequiredSecrets(results);
        
        // Check for dangerous defaults
        this.validateAgainstDefaults(results);
        
        // Validate secret strength
        this.validateSecretStrength(results);
        
        // Validate security settings
        this.validateSecuritySettings(results);
        
        // Validate database configuration
        this.validateDatabaseConfig(results);
        
        // Check environment setup
        this.validateEnvironment(results);

        // Calculate final security score
        results.securityScore = this.calculateSecurityScore(results);
        results.isValid = results.criticalIssues.length === 0;

        return results;
    }

    validateRequiredSecrets(results) {
        for (const secret of this.requiredSecrets) {
            if (!process.env[secret]) {
                results.criticalIssues.push({
                    type: 'MISSING_REQUIRED_SECRET',
                    message: `${secret} environment variable is required`,
                    severity: 'CRITICAL',
                    fix: `Set ${secret} to a cryptographically secure random value`
                });
            }
        }

        for (const secret of this.recommendedSecrets) {
            if (!process.env[secret]) {
                results.warnings.push({
                    type: 'MISSING_RECOMMENDED_SECRET',
                    message: `${secret} environment variable is recommended for enhanced security`,
                    severity: 'MEDIUM',
                    fix: `Set ${secret} to a cryptographically secure random value`
                });
            }
        }
    }

    validateAgainstDefaults(results) {
        for (const dangerous of this.dangerousDefaults) {
            const value = process.env[dangerous.key];
            if (value && dangerous.values.includes(value)) {
                results.criticalIssues.push({
                    type: 'DANGEROUS_DEFAULT_VALUE',
                    message: `${dangerous.key} is using a default/insecure value`,
                    severity: 'CRITICAL',
                    fix: `Replace ${dangerous.key} with a secure randomly generated value`
                });
            }
        }
    }

    validateSecretStrength(results) {
        const secretsToCheck = ['JWT_SECRET', 'SESSION_SECRET', 'MFA_SECRET'];
        
        for (const secretKey of secretsToCheck) {
            const secret = process.env[secretKey];
            if (secret) {
                if (secret.length < 32) {
                    results.warnings.push({
                        type: 'WEAK_SECRET',
                        message: `${secretKey} should be at least 32 characters long`,
                        severity: 'MEDIUM',
                        fix: `Generate a longer secret using: openssl rand -hex 32`
                    });
                }
                
                if (secret.length < 16) {
                    results.criticalIssues.push({
                        type: 'CRITICALLY_WEAK_SECRET',
                        message: `${secretKey} is dangerously short (${secret.length} characters)`,
                        severity: 'CRITICAL',
                        fix: `Generate a secure secret using: openssl rand -hex 32`
                    });
                }
                
                // Check for obvious patterns
                if (this.hasObviousPatterns(secret)) {
                    results.warnings.push({
                        type: 'PREDICTABLE_SECRET',
                        message: `${secretKey} appears to have predictable patterns`,
                        severity: 'MEDIUM',
                        fix: 'Use a cryptographically secure random generator'
                    });
                }
            }
        }
    }

    validateSecuritySettings(results) {
        // Check bcrypt rounds
        const bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
        if (bcryptRounds < 10) {
            results.warnings.push({
                type: 'WEAK_BCRYPT_ROUNDS',
                message: `BCRYPT_ROUNDS (${bcryptRounds}) should be at least 10`,
                severity: 'MEDIUM',
                fix: 'Set BCRYPT_ROUNDS to at least 12'
            });
        }

        // Check rate limiting
        if (process.env.API_RATE_LIMIT_ENABLED !== 'true') {
            results.warnings.push({
                type: 'RATE_LIMITING_DISABLED',
                message: 'API rate limiting is disabled',
                severity: 'MEDIUM',
                fix: 'Set API_RATE_LIMIT_ENABLED=true'
            });
        }

        // Check CORS configuration
        const allowedOrigins = process.env.ALLOWED_ORIGINS;
        if (!allowedOrigins || allowedOrigins.includes('*')) {
            results.warnings.push({
                type: 'PERMISSIVE_CORS',
                message: 'CORS configuration may be too permissive',
                severity: 'MEDIUM',
                fix: 'Configure specific allowed origins in ALLOWED_ORIGINS'
            });
        }
    }

    validateDatabaseConfig(results) {
        const dbPassword = process.env.POSTGRES_PASSWORD;
        if (dbPassword && (dbPassword.length < 12 || dbPassword === 'changeme')) {
            results.warnings.push({
                type: 'WEAK_DATABASE_PASSWORD',
                message: 'Database password appears weak',
                severity: 'MEDIUM',
                fix: 'Use a strong database password (12+ characters)'
            });
        }
    }

    validateEnvironment(results) {
        // Check NODE_ENV
        if (process.env.NODE_ENV === 'production') {
            // Production-specific checks
            if (!process.env.REDIS_URL) {
                results.recommendations.push({
                    type: 'MISSING_REDIS',
                    message: 'Redis is recommended for production deployments',
                    severity: 'LOW',
                    fix: 'Configure Redis for session storage and caching'
                });
            }

            if (process.env.ENABLE_ADVANCED_LOGGING !== 'true') {
                results.recommendations.push({
                    type: 'BASIC_LOGGING',
                    message: 'Advanced logging is recommended for production',
                    severity: 'LOW',
                    fix: 'Set ENABLE_ADVANCED_LOGGING=true'
                });
            }
        } else if (!process.env.NODE_ENV) {
            results.warnings.push({
                type: 'MISSING_NODE_ENV',
                message: 'NODE_ENV is not set',
                severity: 'LOW',
                fix: 'Set NODE_ENV to production, development, or test'
            });
        }
    }

    hasObviousPatterns(secret) {
        // Check for common patterns that indicate weak secrets
        const patterns = [
            /^123/,           // Starts with 123
            /password/i,      // Contains "password"
            /secret/i,        // Contains "secret" 
            /admin/i,         // Contains "admin"
            /test/i,          // Contains "test"
            /^(.)\1{3,}/,     // Repeating characters
            /^[a-zA-Z]+$/,    // Only letters
            /^[0-9]+$/        // Only numbers
        ];

        return patterns.some(pattern => pattern.test(secret));
    }

    calculateSecurityScore(results) {
        let score = 100;
        
        // Deduct points for issues
        score -= results.criticalIssues.length * 20;
        score -= results.warnings.length * 5;
        score -= results.recommendations.length * 2;
        
        return Math.max(0, score);
    }

    /**
     * Generate a security report
     */
    generateSecurityReport() {
        const validation = this.validateConfiguration();
        
        let report = '\\n========================================\\n';
        report += 'SECURITY CONFIGURATION REPORT\\n';
        report += '========================================\\n';
        report += `Security Score: ${validation.securityScore}/100\\n\\n`;

        if (validation.criticalIssues.length > 0) {
            report += '❌ CRITICAL ISSUES:\\n';
            validation.criticalIssues.forEach(issue => {
                report += `  • ${issue.message}\\n`;
                report += `    Fix: ${issue.fix}\\n\\n`;
            });
        }

        if (validation.warnings.length > 0) {
            report += '⚠️  WARNINGS:\\n';
            validation.warnings.forEach(warning => {
                report += `  • ${warning.message}\\n`;
                report += `    Fix: ${warning.fix}\\n\\n`;
            });
        }

        if (validation.recommendations.length > 0) {
            report += '💡 RECOMMENDATIONS:\\n';
            validation.recommendations.forEach(rec => {
                report += `  • ${rec.message}\\n`;
                report += `    Fix: ${rec.fix}\\n\\n`;
            });
        }

        if (validation.isValid) {
            report += '✅ Configuration validation passed!\\n';
        } else {
            report += '❌ Configuration validation failed! Please address critical issues.\\n';
        }

        report += '========================================\\n';
        
        return report;
    }

    /**
     * Generate secure secrets
     */
    static generateSecureSecrets() {
        const crypto = require('crypto');
        
        return {
            JWT_SECRET: crypto.randomBytes(32).toString('hex'),
            SESSION_SECRET: crypto.randomBytes(32).toString('hex'),
            MFA_SECRET: crypto.randomBytes(32).toString('hex'),
            RECOVERY_CODE_SALT: crypto.randomBytes(16).toString('hex')
        };
    }

    /**
     * Print configuration validation on startup
     */
    static validateOnStartup() {
        const validator = new ConfigurationValidationService();
        const report = validator.generateSecurityReport();
        
        console.log(report);
        
        const validation = validator.validateConfiguration();
        if (!validation.isValid) {
            console.error('🚨 CRITICAL: Security configuration issues detected!');
            if (process.env.NODE_ENV === 'production') {
                throw new Error('Production deployment blocked due to security configuration issues');
            }
        }
        
        return validation;
    }
}

module.exports = ConfigurationValidationService;