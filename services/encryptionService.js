const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class EncryptionService {
    constructor() {
        this.algorithm = 'aes-256-gcm';
        this.keyLength = 32; // 256 bits
        this.ivLength = 16; // 128 bits
        this.tagLength = 16; // 128 bits

        // Initialize encryption key
        this.initializeKey();
    }

    initializeKey() {
        const keyPath = path.join(process.cwd(), 'config', 'encryption.key');
        const keyDir = path.dirname(keyPath);

        // Ensure config directory exists
        if (!fs.existsSync(keyDir)) {
            fs.mkdirSync(keyDir, { recursive: true });
        }

        // Generate or load encryption key
        if (fs.existsSync(keyPath)) {
            this.key = fs.readFileSync(keyPath);
            console.log('🔐 Encryption key loaded from file');
        } else {
            this.key = crypto.randomBytes(this.keyLength);
            fs.writeFileSync(keyPath, this.key, { mode: 0o600 }); // Restricted permissions
            console.log('🔐 New encryption key generated and saved');
        }
    }

    /**
     * Encrypt sensitive data (PHI)
     * @param {string} plaintext - Data to encrypt
     * @returns {object} - Encrypted data with IV and auth tag
     */
    encrypt(plaintext) {
        if (!plaintext) return null;

        const iv = crypto.randomBytes(this.ivLength);
        const cipher = crypto.createCipher(this.algorithm, this.key, { iv });

        let encrypted = cipher.update(plaintext, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const authTag = cipher.getAuthTag();

        return {
            encrypted,
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex')
        };
    }

    /**
     * Decrypt sensitive data (PHI)
     * @param {object} encryptedData - Object with encrypted, iv, and authTag
     * @returns {string} - Decrypted plaintext
     */
    decrypt(encryptedData) {
        if (!encryptedData || !encryptedData.encrypted) return null;

        try {
            const iv = Buffer.from(encryptedData.iv, 'hex');
            const authTag = Buffer.from(encryptedData.authTag, 'hex');

            const decipher = crypto.createDecipher(this.algorithm, this.key, { iv });
            decipher.setAuthTag(authTag);

            let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');

            return decrypted;
        } catch (error) {
            console.error('Decryption failed:', error.message);
            throw new Error('Failed to decrypt data');
        }
    }

    /**
     * Hash sensitive data for indexing (one-way)
     * @param {string} data - Data to hash
     * @returns {string} - SHA-256 hash
     */
    hash(data) {
        if (!data) return null;
        return crypto.createHash('sha256').update(data).digest('hex');
    }

    /**
     * Generate secure random token
     * @param {number} length - Token length in bytes
     * @returns {string} - Hex-encoded random token
     */
    generateSecureToken(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }

    /**
     * Encrypt PHI fields in an object
     * @param {object} data - Object containing PHI fields
     * @param {array} phiFields - Array of field names to encrypt
     * @returns {object} - Object with encrypted PHI fields
     */
    encryptPHI(data, phiFields = []) {
        const encrypted = { ...data };

        phiFields.forEach(field => {
            if (data[field] && typeof data[field] === 'string') {
                encrypted[field] = this.encrypt(data[field]);
                encrypted[`${field}_hash`] = this.hash(data[field]); // For indexing
            }
        });

        return encrypted;
    }

    /**
     * Decrypt PHI fields in an object
     * @param {object} data - Object with encrypted PHI fields
     * @param {array} phiFields - Array of field names to decrypt
     * @returns {object} - Object with decrypted PHI fields
     */
    decryptPHI(data, phiFields = []) {
        const decrypted = { ...data };

        phiFields.forEach(field => {
            if (data[field] && typeof data[field] === 'object') {
                decrypted[field] = this.decrypt(data[field]);
                // Remove hash field from output
                delete decrypted[`${field}_hash`];
            }
        });

        return decrypted;
    }

    /**
     * Sanitize data for logging (remove PHI)
     * @param {object} data - Data object
     * @param {array} phiFields - Array of PHI field names to remove
     * @returns {object} - Sanitized object safe for logging
     */
    sanitizeForLogging(data, phiFields = []) {
        const sanitized = { ...data };

        phiFields.forEach(field => {
            if (sanitized[field]) {
                sanitized[field] = '[ENCRYPTED]';
            }
            // Remove hash fields too
            if (sanitized[`${field}_hash`]) {
                delete sanitized[`${field}_hash`];
            }
        });

        return sanitized;
    }

    /**
     * Key rotation - generate new key and re-encrypt data
     * This should be called periodically for security
     */
    rotateKey() {
        const oldKey = this.key;
        this.key = crypto.randomBytes(this.keyLength);

        // Save new key
        const keyPath = path.join(process.cwd(), 'config', 'encryption.key');
        fs.writeFileSync(keyPath, this.key, { mode: 0o600 });

        console.log('🔄 Encryption key rotated - database re-encryption required');

        // Note: In production, this would trigger a background job to re-encrypt all data
        return { oldKey, newKey: this.key };
    }
}

// PHI field definitions by table
const PHI_FIELDS = {
    users: [
        'first_name',
        'last_name',
        'email',
        'medical_license_number'
    ],
    family_diseases: [
        'family_member_name',
        'family_member_disease_notes'
    ],
    audit_log: [
        'user_ip',
        'user_agent'
    ]
};

module.exports = { EncryptionService, PHI_FIELDS };