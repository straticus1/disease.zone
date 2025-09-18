const crypto = require('crypto');
const bcrypt = require('bcrypt');

/**
 * Secondary Authentication Service for Permission Grants
 * Implements additional security layer for sensitive operations
 */
class SecondaryAuthService {
    constructor(databaseService, mfaService, auditLoggingService) {
        this.db = databaseService;
        this.mfa = mfaService;
        this.auditLogger = auditLoggingService;

        // Authentication methods
        this.AUTH_METHODS = {
            SECONDARY_PASSWORD: 'secondary_password',
            TOTP_2FA: 'totp_2fa',
            SMS_2FA: 'sms_2fa',
            BIOMETRIC: 'biometric',
            SECURITY_KEY: 'security_key'
        };

        // Challenge types
        this.CHALLENGE_TYPES = {
            PERMISSION_GRANT: 'permission_grant',
            DATA_ACCESS: 'data_access',
            ROLE_CHANGE: 'role_change',
            SENSITIVE_OPERATION: 'sensitive_operation'
        };

        this.initializeDatabase();
    }

    /**
     * Initialize database tables for secondary authentication
     */
    async initializeDatabase() {
        try {
            await this.db.run(`
                CREATE TABLE IF NOT EXISTS secondary_auth_methods (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    auth_method TEXT NOT NULL,
                    secret_hash TEXT,
                    backup_codes TEXT,
                    is_active BOOLEAN DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    last_used DATETIME,
                    FOREIGN KEY (user_id) REFERENCES users(id),
                    UNIQUE(user_id, auth_method)
                )
            `);

            await this.db.run(`
                CREATE TABLE IF NOT EXISTS auth_challenges (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    challenge_type TEXT NOT NULL,
                    context_data TEXT,
                    required_methods TEXT NOT NULL,
                    challenge_token TEXT NOT NULL,
                    expires_at DATETIME NOT NULL,
                    completed_at DATETIME,
                    is_completed BOOLEAN DEFAULT 0,
                    attempts INTEGER DEFAULT 0,
                    max_attempts INTEGER DEFAULT 3,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            `);

            await this.db.run(`
                CREATE TABLE IF NOT EXISTS auth_challenge_responses (
                    id TEXT PRIMARY KEY,
                    challenge_id TEXT NOT NULL,
                    auth_method TEXT NOT NULL,
                    response_status TEXT NOT NULL,
                    attempted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    ip_address TEXT,
                    user_agent TEXT,
                    FOREIGN KEY (challenge_id) REFERENCES auth_challenges(id)
                )
            `);

            console.log('✅ Secondary authentication database tables initialized');
        } catch (error) {
            console.error('❌ Error initializing secondary auth database:', error);
            throw error;
        }
    }

    /**
     * Set up secondary password for user
     */
    async setupSecondaryPassword(userId, secondaryPassword, adminId) {
        try {
            await this.auditLogger.logOperation(adminId || userId, 'secondary_password_setup', {
                target_user: userId,
                setup_by: adminId || 'self'
            });

            // Hash the secondary password
            const saltRounds = 12;
            const hashedPassword = await bcrypt.hash(secondaryPassword, saltRounds);

            // Generate backup codes
            const backupCodes = this.generateBackupCodes(8);
            const hashedBackupCodes = backupCodes.map(code => bcrypt.hashSync(code, saltRounds));

            const authMethodId = crypto.randomUUID();

            await this.db.run(`
                INSERT OR REPLACE INTO secondary_auth_methods (
                    id, user_id, auth_method, secret_hash, backup_codes
                ) VALUES (?, ?, ?, ?, ?)
            `, [
                authMethodId,
                userId,
                this.AUTH_METHODS.SECONDARY_PASSWORD,
                hashedPassword,
                JSON.stringify(hashedBackupCodes)
            ]);

            return {
                success: true,
                backupCodes: backupCodes, // Return unhashed codes for user to save
                message: 'Secondary password set up successfully'
            };

        } catch (error) {
            console.error('Error setting up secondary password:', error);
            throw error;
        }
    }

    /**
     * Create authentication challenge for sensitive operation
     */
    async createAuthChallenge(userId, challengeType, contextData, requiredMethods = null) {
        try {
            // Determine required authentication methods based on user settings and context
            if (!requiredMethods) {
                requiredMethods = await this.determineRequiredMethods(userId, challengeType);
            }

            const challengeId = crypto.randomUUID();
            const challengeToken = this.generateChallengeToken();
            const expiresAt = new Date(Date.now() + (5 * 60 * 1000)); // 5 minutes

            await this.db.run(`
                INSERT INTO auth_challenges (
                    id, user_id, challenge_type, context_data, 
                    required_methods, challenge_token, expires_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                challengeId,
                userId,
                challengeType,
                JSON.stringify(contextData),
                JSON.stringify(requiredMethods),
                challengeToken,
                expiresAt.toISOString()
            ]);

            await this.auditLogger.logOperation(userId, 'auth_challenge_created', {
                challenge_type: challengeType,
                challenge_id: challengeId,
                required_methods: requiredMethods
            });

            return {
                challengeId,
                challengeToken,
                requiredMethods,
                expiresAt: expiresAt.toISOString(),
                message: 'Authentication challenge created'
            };

        } catch (error) {
            console.error('Error creating auth challenge:', error);
            throw error;
        }
    }

    /**
     * Respond to authentication challenge
     */
    async respondToChallenge(challengeId, authMethod, response, userContext = {}) {
        try {
            // Get challenge details
            const challenge = await this.db.get(`
                SELECT * FROM auth_challenges 
                WHERE id = ? AND expires_at > datetime('now') AND is_completed = 0
            `, [challengeId]);

            if (!challenge) {
                throw new Error('Challenge not found or expired');
            }

            // Check if max attempts exceeded
            if (challenge.attempts >= challenge.max_attempts) {
                await this.auditLogger.logOperation(challenge.user_id, 'auth_challenge_max_attempts', {
                    challenge_id: challengeId
                });
                throw new Error('Maximum authentication attempts exceeded');
            }

            // Verify the authentication method
            let isValid = false;
            const requiredMethods = JSON.parse(challenge.required_methods);

            if (!requiredMethods.includes(authMethod)) {
                throw new Error('Authentication method not required for this challenge');
            }

            switch (authMethod) {
                case this.AUTH_METHODS.SECONDARY_PASSWORD:
                    isValid = await this.verifySecondaryPassword(challenge.user_id, response);
                    break;
                case this.AUTH_METHODS.TOTP_2FA:
                    isValid = await this.mfa.verifyTOTP(challenge.user_id, response);
                    break;
                default:
                    throw new Error('Unsupported authentication method');
            }

            // Record the response
            await this.db.run(`
                INSERT INTO auth_challenge_responses (
                    id, challenge_id, auth_method, response_status, 
                    ip_address, user_agent
                ) VALUES (?, ?, ?, ?, ?, ?)
            `, [
                crypto.randomUUID(),
                challengeId,
                authMethod,
                isValid ? 'SUCCESS' : 'FAILED',
                userContext.ipAddress,
                userContext.userAgent
            ]);

            // Update challenge attempts
            await this.db.run(`
                UPDATE auth_challenges 
                SET attempts = attempts + 1 
                WHERE id = ?
            `, [challengeId]);

            if (isValid) {
                // Check if all required methods have been satisfied
                const completedMethods = await this.getCompletedAuthMethods(challengeId);
                const allMethodsSatisfied = requiredMethods.every(method => 
                    completedMethods.includes(method)
                );

                if (allMethodsSatisfied) {
                    // Mark challenge as completed
                    await this.db.run(`
                        UPDATE auth_challenges 
                        SET is_completed = 1, completed_at = datetime('now') 
                        WHERE id = ?
                    `, [challengeId]);

                    await this.auditLogger.logOperation(challenge.user_id, 'auth_challenge_completed', {
                        challenge_id: challengeId,
                        challenge_type: challenge.challenge_type
                    });

                    return {
                        success: true,
                        challengeCompleted: true,
                        message: 'Authentication challenge completed successfully'
                    };
                } else {
                    return {
                        success: true,
                        challengeCompleted: false,
                        remainingMethods: requiredMethods.filter(method => 
                            !completedMethods.includes(method)
                        ),
                        message: 'Authentication method verified, additional methods required'
                    };
                }
            } else {
                await this.auditLogger.logOperation(challenge.user_id, 'auth_challenge_failed', {
                    challenge_id: challengeId,
                    auth_method: authMethod,
                    attempts: challenge.attempts + 1
                });

                return {
                    success: false,
                    challengeCompleted: false,
                    attemptsRemaining: challenge.max_attempts - (challenge.attempts + 1),
                    message: 'Authentication failed'
                };
            }

        } catch (error) {
            console.error('Error responding to auth challenge:', error);
            throw error;
        }
    }

    /**
     * Verify secondary password
     */
    async verifySecondaryPassword(userId, password) {
        try {
            const authMethod = await this.db.get(`
                SELECT * FROM secondary_auth_methods 
                WHERE user_id = ? AND auth_method = ? AND is_active = 1
            `, [userId, this.AUTH_METHODS.SECONDARY_PASSWORD]);

            if (!authMethod) {
                return false;
            }

            const isValid = await bcrypt.compare(password, authMethod.secret_hash);

            if (isValid) {
                // Update last used timestamp
                await this.db.run(`
                    UPDATE secondary_auth_methods 
                    SET last_used = datetime('now') 
                    WHERE id = ?
                `, [authMethod.id]);
            }

            return isValid;

        } catch (error) {
            console.error('Error verifying secondary password:', error);
            return false;
        }
    }

    /**
     * Verify backup code
     */
    async verifyBackupCode(userId, backupCode) {
        try {
            const authMethod = await this.db.get(`
                SELECT * FROM secondary_auth_methods 
                WHERE user_id = ? AND auth_method = ? AND is_active = 1
            `, [userId, this.AUTH_METHODS.SECONDARY_PASSWORD]);

            if (!authMethod || !authMethod.backup_codes) {
                return false;
            }

            const backupCodes = JSON.parse(authMethod.backup_codes);
            
            for (let i = 0; i < backupCodes.length; i++) {
                if (await bcrypt.compare(backupCode, backupCodes[i])) {
                    // Remove used backup code
                    backupCodes.splice(i, 1);
                    
                    await this.db.run(`
                        UPDATE secondary_auth_methods 
                        SET backup_codes = ?, last_used = datetime('now') 
                        WHERE id = ?
                    `, [JSON.stringify(backupCodes), authMethod.id]);

                    await this.auditLogger.logOperation(userId, 'backup_code_used', {
                        remaining_codes: backupCodes.length
                    });

                    return true;
                }
            }

            return false;

        } catch (error) {
            console.error('Error verifying backup code:', error);
            return false;
        }
    }

    /**
     * Check if challenge is completed and valid
     */
    async isChallengeCompleted(challengeId, challengeToken) {
        try {
            const challenge = await this.db.get(`
                SELECT * FROM auth_challenges 
                WHERE id = ? AND challenge_token = ? 
                AND is_completed = 1 AND expires_at > datetime('now')
            `, [challengeId, challengeToken]);

            return !!challenge;

        } catch (error) {
            console.error('Error checking challenge completion:', error);
            return false;
        }
    }

    /**
     * Get user's available authentication methods
     */
    async getUserAuthMethods(userId) {
        try {
            const methods = await this.db.all(`
                SELECT auth_method, is_active, last_used 
                FROM secondary_auth_methods 
                WHERE user_id = ?
            `, [userId]);

            return methods.map(method => ({
                method: method.auth_method,
                isActive: method.is_active,
                lastUsed: method.last_used,
                displayName: this.getAuthMethodDisplayName(method.auth_method)
            }));

        } catch (error) {
            console.error('Error getting user auth methods:', error);
            return [];
        }
    }

    // Private helper methods

    /**
     * Determine required authentication methods based on context
     */
    async determineRequiredMethods(userId, challengeType) {
        // Get user's available methods
        const userMethods = await this.getUserAuthMethods(userId);
        const activeMethods = userMethods
            .filter(m => m.isActive)
            .map(m => m.method);

        // Default method is secondary password
        if (activeMethods.length === 0) {
            return [this.AUTH_METHODS.SECONDARY_PASSWORD];
        }

        // For high-security operations, require multiple methods if available
        if (challengeType === this.CHALLENGE_TYPES.PERMISSION_GRANT ||
            challengeType === this.CHALLENGE_TYPES.ROLE_CHANGE) {
            
            if (activeMethods.length >= 2) {
                return activeMethods.slice(0, 2); // Require first two available methods
            }
        }

        return [activeMethods[0]]; // Default to first available method
    }

    /**
     * Get completed authentication methods for a challenge
     */
    async getCompletedAuthMethods(challengeId) {
        try {
            const responses = await this.db.all(`
                SELECT DISTINCT auth_method 
                FROM auth_challenge_responses 
                WHERE challenge_id = ? AND response_status = 'SUCCESS'
            `, [challengeId]);

            return responses.map(r => r.auth_method);

        } catch (error) {
            console.error('Error getting completed auth methods:', error);
            return [];
        }
    }

    /**
     * Generate secure backup codes
     */
    generateBackupCodes(count = 8) {
        const codes = [];
        for (let i = 0; i < count; i++) {
            // Generate 8-character alphanumeric backup codes
            const code = crypto.randomBytes(4).toString('hex').toUpperCase();
            codes.push(code);
        }
        return codes;
    }

    /**
     * Generate challenge token
     */
    generateChallengeToken() {
        return crypto.randomBytes(32).toString('hex');
    }

    /**
     * Get display name for authentication method
     */
    getAuthMethodDisplayName(method) {
        const displayNames = {
            [this.AUTH_METHODS.SECONDARY_PASSWORD]: 'Secondary Password',
            [this.AUTH_METHODS.TOTP_2FA]: 'Authenticator App (2FA)',
            [this.AUTH_METHODS.SMS_2FA]: 'SMS Verification',
            [this.AUTH_METHODS.BIOMETRIC]: 'Biometric Authentication',
            [this.AUTH_METHODS.SECURITY_KEY]: 'Security Key'
        };

        return displayNames[method] || method;
    }
}

module.exports = SecondaryAuthService;