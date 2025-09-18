#!/usr/bin/env node
/**
 * Security Release 4: Secure Secrets Generator
 * Generates cryptographically secure secrets for environment configuration
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class SecureSecretsGenerator {
    generateSecrets() {
        return {
            JWT_SECRET: this.generateSecret(64),
            SESSION_SECRET: this.generateSecret(64),
            MFA_SECRET: this.generateSecret(32),
            RECOVERY_CODE_SALT: this.generateSecret(16),
            FHIR_ENCRYPTION_KEY: this.generateSecret(32),
            POSTGRES_PASSWORD: this.generatePassword(24),
            GRAFANA_PASSWORD: this.generatePassword(16)
        };
    }

    generateSecret(length) {
        return crypto.randomBytes(length).toString('hex');
    }

    generatePassword(length) {
        // Generate a secure password with mixed characters
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let password = '';
        
        for (let i = 0; i < length; i++) {
            const randomIndex = crypto.randomInt(0, charset.length);
            password += charset[randomIndex];
        }
        
        return password;
    }

    createSecureEnvFile(secrets, outputPath = '.env.secure') {
        const envContent = `# Security Release 4: Generated Secure Configuration
# Generated on: ${new Date().toISOString()}
# 
# IMPORTANT: Keep these secrets secure and never commit to version control
# Copy values to your .env file as needed

# ========================================
# CRITICAL SECURITY SECRETS
# ========================================

# JWT and Session Secrets (REQUIRED)
JWT_SECRET=${secrets.JWT_SECRET}
SESSION_SECRET=${secrets.SESSION_SECRET}

# MFA and Recovery Secrets
MFA_SECRET=${secrets.MFA_SECRET}
RECOVERY_CODE_SALT=${secrets.RECOVERY_CODE_SALT}

# FHIR Integration
FHIR_ENCRYPTION_KEY=${secrets.FHIR_ENCRYPTION_KEY}

# ========================================
# DATABASE PASSWORDS
# ========================================

# PostgreSQL Database
POSTGRES_PASSWORD=${secrets.POSTGRES_PASSWORD}

# ========================================
# MONITORING PASSWORDS
# ========================================

# Grafana Admin
GRAFANA_PASSWORD=${secrets.GRAFANA_PASSWORD}

# ========================================
# SECURITY NOTES
# ========================================
#
# 1. Copy these values to your .env file
# 2. Delete this file after copying values
# 3. Never commit secrets to version control
# 4. Rotate secrets regularly in production
# 5. Use different secrets for different environments
#
# Generation Commands:
# JWT_SECRET: openssl rand -hex 64
# SESSION_SECRET: openssl rand -hex 64
# MFA_SECRET: openssl rand -hex 32
# RECOVERY_CODE_SALT: openssl rand -hex 16
# FHIR_ENCRYPTION_KEY: openssl rand -hex 32
#
`;

        return envContent;
    }

    generateBlockchainKeys() {
        // Generate secure private keys for blockchain
        const validatorKey = '0x' + crypto.randomBytes(32).toString('hex');
        const bootnodeKey = '0x' + crypto.randomBytes(32).toString('hex');
        
        return {
            VALIDATOR_PRIVATE_KEY: validatorKey,
            BOOTNODE_PRIVATE_KEY: bootnodeKey
        };
    }

    validateSecretStrength(secret, minLength = 32) {
        const issues = [];
        
        if (secret.length < minLength) {
            issues.push(`Secret too short (${secret.length} chars, minimum: ${minLength})`);
        }
        
        if (!/[a-z]/.test(secret)) {
            issues.push('Missing lowercase letters');
        }
        
        if (!/[A-Z]/.test(secret)) {
            issues.push('Missing uppercase letters');
        }
        
        if (!/[0-9]/.test(secret)) {
            issues.push('Missing numbers');
        }
        
        if (!/[^a-zA-Z0-9]/.test(secret)) {
            issues.push('Missing special characters');
        }
        
        return {
            isStrong: issues.length === 0,
            issues
        };
    }

    printSecrets(secrets) {
        console.log('\n🔐 Security Release 4: Generated Secure Secrets');
        console.log('================================================\n');
        
        Object.entries(secrets).forEach(([key, value]) => {
            const strength = this.validateSecretStrength(value);
            const status = strength.isStrong ? '✅' : '⚠️';
            console.log(`${status} ${key}=${value}`);
            if (!strength.isStrong) {
                console.log(`   Issues: ${strength.issues.join(', ')}`);
            }
        });
        
        console.log('\n================================================');
        console.log('🔒 SECURITY REMINDERS:');
        console.log('• Copy these values to your .env file');
        console.log('• Never commit secrets to version control');
        console.log('• Use different secrets for each environment');
        console.log('• Rotate secrets regularly in production');
        console.log('• Store production secrets in secure vaults');
        console.log('================================================\n');
    }
}

// CLI Interface
if (require.main === module) {
    const args = process.argv.slice(2);
    const generator = new SecureSecretsGenerator();
    
    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
Security Release 4: Secure Secrets Generator

Usage:
  node generate-secure-secrets.js [options]

Options:
  --help, -h          Show this help message
  --output, -o        Output to file instead of console
  --blockchain        Include blockchain private keys
  --env-file          Create .env.secure file with all secrets
  --validate <secret> Validate an existing secret

Examples:
  # Generate and display secrets
  node generate-secure-secrets.js
  
  # Generate secrets and save to file
  node generate-secure-secrets.js --env-file
  
  # Generate with blockchain keys
  node generate-secure-secrets.js --blockchain
  
  # Validate existing secret
  node generate-secure-secrets.js --validate "mysecret123"
        `);
        process.exit(0);
    }
    
    if (args.includes('--validate')) {
        const secretIndex = args.indexOf('--validate') + 1;
        const secret = args[secretIndex];
        
        if (!secret) {
            console.error('❌ Please provide a secret to validate');
            process.exit(1);
        }
        
        const validation = generator.validateSecretStrength(secret);
        console.log(`\n🔍 Secret Validation Result:`);
        console.log(`Secret: ${secret.substring(0, 8)}...`);
        console.log(`Length: ${secret.length} characters`);
        console.log(`Strong: ${validation.isStrong ? '✅ Yes' : '❌ No'}`);
        
        if (!validation.isStrong) {
            console.log(`Issues: ${validation.issues.join(', ')}`);
            console.log('\n💡 Recommendations:');
            console.log('• Use at least 32 characters for production');
            console.log('• Include uppercase, lowercase, numbers, and symbols');
            console.log('• Generate with: openssl rand -hex 32');
        }
        
        process.exit(validation.isStrong ? 0 : 1);
    }
    
    const secrets = generator.generateSecrets();
    
    if (args.includes('--blockchain')) {
        const blockchainKeys = generator.generateBlockchainKeys();
        Object.assign(secrets, blockchainKeys);
    }
    
    if (args.includes('--env-file')) {
        const envContent = generator.createSecureEnvFile(secrets);
        const outputPath = '.env.secure';
        
        fs.writeFileSync(outputPath, envContent);
        console.log(`✅ Secure environment file created: ${outputPath}`);
        console.log('📋 Copy the values from this file to your .env file');
        console.log('🗑️  Delete .env.secure after copying values');
        console.log('\n⚠️  NEVER commit .env.secure to version control!');
    } else {
        generator.printSecrets(secrets);
    }
}

module.exports = SecureSecretsGenerator;