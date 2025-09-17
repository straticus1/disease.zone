const crypto = require('crypto');
const bcrypt = require('bcrypt');

class PasswordResetService {
    constructor(databaseService, emailService, config = {}) {
        this.db = databaseService;
        this.emailService = emailService;
        this.config = {
            tokenExpirationMinutes: config.tokenExpirationMinutes || 60,
            maxAttemptsPerHour: config.maxAttemptsPerHour || 5,
            ...config
        };

        // In-memory store for reset tokens (in production, use Redis or database)
        this.resetTokens = new Map();
        this.resetAttempts = new Map();
    }

    generateResetToken() {
        return crypto.randomBytes(32).toString('hex');
    }

    async initiatePasswordReset(email) {
        try {
            // Check rate limiting
            const now = Date.now();
            const hourAgo = now - 60 * 60 * 1000;

            const attempts = this.resetAttempts.get(email) || [];
            const recentAttempts = attempts.filter(time => time > hourAgo);

            if (recentAttempts.length >= this.config.maxAttemptsPerHour) {
                throw new Error('Too many password reset attempts. Please try again later.');
            }

            // Check if user exists
            const user = await this.db.getUserByEmail(email);
            if (!user) {
                // Don't reveal that user doesn't exist for security
                console.log(`Password reset requested for non-existent email: ${email}`);
                return {
                    success: true,
                    message: 'If an account with that email exists, a password reset link has been sent.'
                };
            }

            // Generate reset token
            const resetToken = this.generateResetToken();
            const expiresAt = new Date(now + this.config.tokenExpirationMinutes * 60 * 1000);

            // Store reset token
            this.resetTokens.set(resetToken, {
                userId: user.id,
                email: user.email,
                expiresAt,
                used: false
            });

            // Track attempt
            this.resetAttempts.set(email, [...recentAttempts, now]);

            // Send email
            await this.emailService.sendPasswordResetEmail(
                user.email,
                resetToken,
                user.first_name
            );

            console.log(`Password reset initiated for user: ${user.email}`);

            return {
                success: true,
                message: 'If an account with that email exists, a password reset link has been sent.',
                tokenId: resetToken // Only for development/testing
            };

        } catch (error) {
            console.error('Error initiating password reset:', error);
            throw error;
        }
    }

    async validateResetToken(token) {
        const tokenData = this.resetTokens.get(token);

        if (!tokenData) {
            throw new Error('Invalid or expired reset token');
        }

        if (tokenData.used) {
            throw new Error('Reset token has already been used');
        }

        if (new Date() > tokenData.expiresAt) {
            this.resetTokens.delete(token);
            throw new Error('Reset token has expired');
        }

        return tokenData;
    }

    async resetPassword(token, newPassword) {
        try {
            // Validate token
            const tokenData = await this.validateResetToken(token);

            // Validate password strength
            this.validatePasswordStrength(newPassword);

            // Hash new password
            const saltRounds = 12;
            const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

            // Update user password in database
            await this.db.updateUserPassword(tokenData.userId, hashedPassword);

            // Mark token as used
            tokenData.used = true;

            // Clean up old tokens for this user
            this.cleanupUserTokens(tokenData.userId);

            console.log(`Password successfully reset for user ID: ${tokenData.userId}`);

            return {
                success: true,
                message: 'Password has been successfully reset. You can now log in with your new password.'
            };

        } catch (error) {
            console.error('Error resetting password:', error);
            throw error;
        }
    }

    validatePasswordStrength(password) {
        if (!password || typeof password !== 'string') {
            throw new Error('Password is required');
        }

        if (password.length < 8) {
            throw new Error('Password must be at least 8 characters long');
        }

        if (!/[a-z]/.test(password)) {
            throw new Error('Password must contain at least one lowercase letter');
        }

        if (!/[A-Z]/.test(password)) {
            throw new Error('Password must contain at least one uppercase letter');
        }

        if (!/\d/.test(password)) {
            throw new Error('Password must contain at least one number');
        }

        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            throw new Error('Password must contain at least one special character');
        }

        // Check for common weak passwords
        const commonPasswords = [
            'password', 'password123', 'admin', 'admin123', 'qwerty', 'qwerty123',
            '123456', '12345678', 'password1', 'letmein', 'welcome', 'monkey'
        ];

        if (commonPasswords.includes(password.toLowerCase())) {
            throw new Error('Password is too common. Please choose a more secure password');
        }

        return true;
    }

    cleanupUserTokens(userId) {
        // Remove all tokens for this user
        for (const [token, data] of this.resetTokens.entries()) {
            if (data.userId === userId) {
                this.resetTokens.delete(token);
            }
        }
    }

    cleanupExpiredTokens() {
        const now = new Date();
        for (const [token, data] of this.resetTokens.entries()) {
            if (now > data.expiresAt) {
                this.resetTokens.delete(token);
            }
        }
    }

    getActiveTokenCount() {
        this.cleanupExpiredTokens();
        return this.resetTokens.size;
    }

    // Clean up old attempts (call periodically)
    cleanupOldAttempts() {
        const hourAgo = Date.now() - 60 * 60 * 1000;

        for (const [email, attempts] of this.resetAttempts.entries()) {
            const recentAttempts = attempts.filter(time => time > hourAgo);
            if (recentAttempts.length === 0) {
                this.resetAttempts.delete(email);
            } else {
                this.resetAttempts.set(email, recentAttempts);
            }
        }
    }

    // Start periodic cleanup
    startPeriodicCleanup() {
        // Clean up every 15 minutes
        setInterval(() => {
            this.cleanupExpiredTokens();
            this.cleanupOldAttempts();
        }, 15 * 60 * 1000);

        console.log('Password reset service periodic cleanup started');
    }
}

module.exports = PasswordResetService;