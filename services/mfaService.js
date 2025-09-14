const crypto = require('crypto');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');

class MFAService {
    constructor(databaseService) {
        this.db = databaseService;
    }

    /**
     * Setup TOTP (Time-based One-Time Password) for a user
     * @param {number} userId - User ID
     * @param {string} userEmail - User email for QR code label
     * @returns {object} - Secret and QR code for setup
     */
    async setupTOTP(userId, userEmail) {
        // Generate secret for TOTP
        const secret = speakeasy.generateSecret({
            name: `diseaseZone (${userEmail})`,
            issuer: 'diseaseZone Medical Platform',
            length: 32
        });

        // Save encrypted secret to database
        const encryptedSecret = this.encryptSecret(secret.base32);
        await this.db.saveMFASecret(userId, encryptedSecret, 'totp');

        // Generate QR code for easy setup
        const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

        return {
            secret: secret.base32,
            qrCode: qrCodeUrl,
            manualEntryKey: secret.base32,
            setupInstructions: {
                step1: 'Install an authenticator app (Google Authenticator, Authy, etc.)',
                step2: 'Scan the QR code OR manually enter the key',
                step3: 'Enter the 6-digit code from your app to verify setup',
                apps: ['Google Authenticator', 'Authy', 'Microsoft Authenticator', '1Password']
            }
        };
    }

    /**
     * Verify TOTP token
     * @param {number} userId - User ID
     * @param {string} token - 6-digit TOTP token
     * @param {number} window - Time window for validation (default: 1)
     * @returns {boolean} - Whether token is valid
     */
    async verifyTOTP(userId, token, window = 1) {
        try {
            // Get encrypted secret from database
            const mfaData = await this.db.getMFASecret(userId);
            if (!mfaData || mfaData.method !== 'totp') {
                return false;
            }

            // Decrypt secret
            const secret = this.decryptSecret(mfaData.encrypted_secret);

            // Verify token
            const verified = speakeasy.totp.verify({
                secret: secret,
                encoding: 'base32',
                token: token,
                window: window
            });

            // Log verification attempt
            await this.logMFAAttempt(userId, 'totp', verified, token);

            return verified;
        } catch (error) {
            console.error('TOTP verification failed:', error);
            await this.logMFAAttempt(userId, 'totp', false, token, error.message);
            return false;
        }
    }

    /**
     * Generate backup recovery codes
     * @param {number} userId - User ID
     * @returns {array} - Array of recovery codes
     */
    async generateRecoveryCodes(userId) {
        const codes = [];
        const hashedCodes = [];

        // Generate 8 recovery codes
        for (let i = 0; i < 8; i++) {
            const code = this.generateRecoveryCode();
            codes.push(code);
            hashedCodes.push(this.hashRecoveryCode(code));
        }

        // Save hashed codes to database
        await this.db.saveRecoveryCodes(userId, hashedCodes);

        return {
            codes,
            instructions: {
                warning: 'Store these recovery codes in a safe place',
                usage: 'Each code can only be used once',
                recommendation: 'Print or write them down and store securely',
                expiration: 'Codes expire after 1 year or when new codes are generated'
            }
        };
    }

    /**
     * Verify recovery code
     * @param {number} userId - User ID
     * @param {string} code - Recovery code
     * @returns {boolean} - Whether code is valid
     */
    async verifyRecoveryCode(userId, code) {
        try {
            const hashedCode = this.hashRecoveryCode(code);
            const isValid = await this.db.verifyAndConsumeRecoveryCode(userId, hashedCode);

            await this.logMFAAttempt(userId, 'recovery_code', isValid, '****');

            return isValid;
        } catch (error) {
            console.error('Recovery code verification failed:', error);
            await this.logMFAAttempt(userId, 'recovery_code', false, '****', error.message);
            return false;
        }
    }

    /**
     * Setup SMS-based MFA (for additional security)
     * @param {number} userId - User ID
     * @param {string} phoneNumber - Phone number for SMS
     * @returns {object} - Setup result
     */
    async setupSMS(userId, phoneNumber) {
        // Validate phone number format
        if (!this.isValidPhoneNumber(phoneNumber)) {
            throw new Error('Invalid phone number format');
        }

        // Generate and send verification code
        const verificationCode = this.generateSMSCode();

        // In production, integrate with SMS service (Twilio, AWS SNS, etc.)
        // For now, we'll just save it for verification
        await this.db.saveSMSVerificationCode(userId, phoneNumber, verificationCode);

        return {
            success: true,
            message: `Verification code sent to ${this.maskPhoneNumber(phoneNumber)}`,
            expiresIn: '10 minutes'
        };
    }

    /**
     * Verify SMS code
     * @param {number} userId - User ID
     * @param {string} code - SMS verification code
     * @returns {boolean} - Whether code is valid
     */
    async verifySMS(userId, code) {
        try {
            const isValid = await this.db.verifySMSCode(userId, code);
            await this.logMFAAttempt(userId, 'sms', isValid, code);
            return isValid;
        } catch (error) {
            console.error('SMS verification failed:', error);
            await this.logMFAAttempt(userId, 'sms', false, code, error.message);
            return false;
        }
    }

    /**
     * Check if user has MFA enabled
     * @param {number} userId - User ID
     * @returns {object} - MFA status
     */
    async getMFAStatus(userId) {
        const mfaData = await this.db.getMFASecret(userId);
        const recoveryCodes = await this.db.getRecoveryCodesCount(userId);

        return {
            enabled: !!mfaData,
            method: mfaData?.method || null,
            setupDate: mfaData?.created_at || null,
            recoveryCodes: recoveryCodes || 0,
            lastUsed: mfaData?.last_used || null
        };
    }

    /**
     * Disable MFA for a user (requires verification)
     * @param {number} userId - User ID
     * @param {string} token - Current MFA token for verification
     * @returns {boolean} - Whether MFA was disabled
     */
    async disableMFA(userId, token) {
        // Verify current MFA token before disabling
        const isValid = await this.verifyTOTP(userId, token);
        if (!isValid) {
            return false;
        }

        // Remove MFA data
        await this.db.removeMFASecret(userId);
        await this.db.removeRecoveryCodes(userId);

        await this.logMFAAttempt(userId, 'disable', true, 'mfa_disabled');

        return true;
    }

    /**
     * Generate secure session token after successful MFA
     * @param {number} userId - User ID
     * @param {object} sessionInfo - Session information
     * @returns {string} - Secure session token
     */
    generateMFASessionToken(userId, sessionInfo = {}) {
        const payload = {
            userId,
            mfaVerified: true,
            timestamp: Date.now(),
            ...sessionInfo
        };

        return this.encryptSessionData(payload);
    }

    /**
     * Verify MFA session token
     * @param {string} token - MFA session token
     * @returns {object|null} - Decrypted session data or null if invalid
     */
    verifyMFASessionToken(token) {
        try {
            const sessionData = this.decryptSessionData(token);

            // Check if session is expired (2 hours)
            const maxAge = 2 * 60 * 60 * 1000; // 2 hours
            if (Date.now() - sessionData.timestamp > maxAge) {
                return null;
            }

            return sessionData;
        } catch (error) {
            return null;
        }
    }

    // Private helper methods

    encryptSecret(secret) {
        const key = crypto.scryptSync(process.env.MFA_SECRET || 'diseaseZoneMFA2023!', 'salt', 32);
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipher('aes-256-cbc', key);

        let encrypted = cipher.update(secret, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        return {
            encrypted,
            iv: iv.toString('hex')
        };
    }

    decryptSecret(encryptedData) {
        const key = crypto.scryptSync(process.env.MFA_SECRET || 'diseaseZoneMFA2023!', 'salt', 32);
        const decipher = crypto.createDecipher('aes-256-cbc', key);

        let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }

    generateRecoveryCode() {
        // Generate 8-character alphanumeric code
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 8; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    hashRecoveryCode(code) {
        return crypto.createHash('sha256').update(code + (process.env.RECOVERY_CODE_SALT || 'recoveryCodeSalt')).digest('hex');
    }

    generateSMSCode() {
        // Generate 6-digit SMS code
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    isValidPhoneNumber(phone) {
        // Basic phone number validation (international format)
        const phoneRegex = /^\+[1-9]\d{1,14}$/;
        return phoneRegex.test(phone);
    }

    maskPhoneNumber(phone) {
        if (phone.length < 4) return phone;
        return phone.slice(0, -4).replace(/\d/g, '*') + phone.slice(-4);
    }

    encryptSessionData(data) {
        const key = crypto.scryptSync(process.env.SESSION_SECRET || 'sessionSecret', 'salt', 32);
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipher('aes-256-cbc', key);

        let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
        encrypted += cipher.final('hex');

        return Buffer.from(JSON.stringify({ encrypted, iv: iv.toString('hex') })).toString('base64');
    }

    decryptSessionData(token) {
        const { encrypted, iv } = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
        const key = crypto.scryptSync(process.env.SESSION_SECRET || 'sessionSecret', 'salt', 32);
        const decipher = crypto.createDecipher('aes-256-cbc', key);

        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return JSON.parse(decrypted);
    }

    async logMFAAttempt(userId, method, success, token, error = null) {
        const logEntry = {
            user_id: userId,
            mfa_method: method,
            success: success ? 1 : 0,
            token_used: token ? token.substring(0, 2) + '****' : null, // Partial token for logging
            error_message: error,
            attempt_timestamp: new Date().toISOString(),
            user_ip: null, // Will be filled by middleware
            user_agent: null // Will be filled by middleware
        };

        // This would be saved to an MFA audit log table
        console.log('MFA Attempt:', logEntry);
    }
}

module.exports = MFAService;