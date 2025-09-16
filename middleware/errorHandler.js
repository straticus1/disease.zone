/**
 * Enhanced Error Handling Middleware
 * Secure error handling with proper logging and no sensitive data exposure
 */

class ErrorHandler {
    constructor(securityValidator = null) {
        this.securityValidator = securityValidator;
    }

    // Handle validation errors
    handleValidationError(err, req, res, next) {
        if (err.name === 'ValidationError') {
            const errors = Object.values(err.errors).map(e => ({
                field: e.path,
                message: e.message.replace(/[<>]/g, '') // Sanitize error messages
            }));

            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors,
                code: 'VALIDATION_ERROR'
            });
        }

        next(err);
    }

    // Handle authentication errors
    handleAuthError(err, req, res, next) {
        if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
            // Log authentication failure
            if (this.securityValidator) {
                this.securityValidator.logSecurityEvent('AUTH_FAILURE', req, {
                    errorType: err.name,
                    tokenPresent: !!req.headers.authorization
                });
            }

            return res.status(401).json({
                success: false,
                error: 'Authentication failed',
                code: 'AUTH_ERROR'
            });
        }

        next(err);
    }

    // Handle rate limit errors
    handleRateLimitError(err, req, res, next) {
        if (err.name === 'TooManyRequestsError') {
            if (this.securityValidator) {
                this.securityValidator.logSecurityEvent('RATE_LIMIT_EXCEEDED', req, {
                    endpoint: req.path,
                    retryAfter: err.retryAfter
                });
            }

            return res.status(429).json({
                success: false,
                error: 'Too many requests',
                retryAfter: err.retryAfter || 60,
                code: 'RATE_LIMIT_ERROR'
            });
        }

        next(err);
    }

    // Handle database errors
    handleDatabaseError(err, req, res, next) {
        if (err.code === 'SQLITE_ERROR' || err.code?.startsWith('SQLITE_')) {
            // Log database error without exposing sensitive details
            console.error('Database error:', {
                code: err.code,
                path: req.path,
                method: req.method,
                timestamp: new Date().toISOString()
            });

            return res.status(500).json({
                success: false,
                error: 'Database operation failed',
                code: 'DATABASE_ERROR'
            });
        }

        next(err);
    }

    // Handle blockchain/wallet errors
    handleBlockchainError(err, req, res, next) {
        if (err.message?.includes('wallet') || err.message?.includes('blockchain') || 
            err.message?.includes('ethers') || err.message?.includes('transaction')) {
            
            if (this.securityValidator) {
                this.securityValidator.logSecurityEvent('BLOCKCHAIN_ERROR', req, {
                    errorMessage: err.message.substring(0, 100), // Truncate for security
                    endpoint: req.path
                });
            }

            return res.status(400).json({
                success: false,
                error: 'Blockchain operation failed',
                code: 'BLOCKCHAIN_ERROR',
                isSimulated: true
            });
        }

        next(err);
    }

    // Handle CORS errors
    handleCorsError(err, req, res, next) {
        if (err.message?.includes('CORS') || err.message?.includes('origin')) {
            if (this.securityValidator) {
                this.securityValidator.logSecurityEvent('CORS_VIOLATION', req, {
                    origin: req.headers.origin,
                    referer: req.headers.referer
                });
            }

            return res.status(403).json({
                success: false,
                error: 'Cross-origin request not allowed',
                code: 'CORS_ERROR'
            });
        }

        next(err);
    }

    // Main error handler (should be last)
    handleGenericError(err, req, res, next) {
        // Don't log 404 errors as they're not real errors
        if (res.statusCode !== 404) {
            console.error('Unhandled error:', {
                error: err.message,
                stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
                path: req.path,
                method: req.method,
                ip: req.ip,
                timestamp: new Date().toISOString()
            });

            // Log security event for suspicious errors
            if (this.securityValidator && this.isSuspiciousError(err)) {
                this.securityValidator.logSecurityEvent('SUSPICIOUS_ERROR', req, {
                    errorMessage: err.message.substring(0, 100),
                    errorType: err.name,
                    statusCode: res.statusCode
                });
            }
        }

        // Don't expose error details in production
        const isDevelopment = process.env.NODE_ENV === 'development';
        
        res.status(err.status || 500).json({
            success: false,
            error: isDevelopment ? err.message : 'Internal server error',
            code: 'INTERNAL_ERROR',
            ...(isDevelopment && { stack: err.stack })
        });
    }

    // Check if error is suspicious (could indicate attack)
    isSuspiciousError(err) {
        const suspiciousPatterns = [
            /script/i,
            /select.*from/i,
            /union.*select/i,
            /drop.*table/i,
            /insert.*into/i,
            /delete.*from/i,
            /<script/i,
            /javascript:/i,
            /eval\(/i,
            /\.\.\//,
            /etc\/passwd/,
            /proc\//
        ];

        return suspiciousPatterns.some(pattern => 
            pattern.test(err.message) || pattern.test(err.stack || '')
        );
    }

    // Get all error handling middleware
    getMiddleware() {
        return [
            this.handleValidationError.bind(this),
            this.handleAuthError.bind(this),
            this.handleRateLimitError.bind(this),
            this.handleDatabaseError.bind(this),
            this.handleBlockchainError.bind(this),
            this.handleCorsError.bind(this),
            this.handleGenericError.bind(this)
        ];
    }

    // Express error handler for 404s
    handle404(req, res) {
        // Log potential path traversal attempts
        if (this.securityValidator && (req.path.includes('../') || req.path.includes('..\\') || req.path.includes('/etc/'))) {
            this.securityValidator.logSecurityEvent('PATH_TRAVERSAL_ATTEMPT', req, {
                suspiciousPath: req.path
            });
        }

        res.status(404).json({
            success: false,
            error: 'Endpoint not found',
            path: req.path,
            code: 'NOT_FOUND'
        });
    }

    // Async error wrapper
    asyncHandler(fn) {
        return (req, res, next) => {
            Promise.resolve(fn(req, res, next)).catch(next);
        };
    }
}

module.exports = ErrorHandler;