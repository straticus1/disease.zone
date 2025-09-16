/**
 * Enhanced Security Middleware for DiseaseZone Platform
 * Comprehensive security validation and protection
 */

const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const validator = require('validator');
const crypto = require('crypto');
const { ipKeyGenerator } = require('express-rate-limit');

class SecurityValidator {
    constructor() {
        this.ipWhitelist = new Set();
        this.suspiciousPatterns = [
            /(<script[^>]*>.*?<\/script>)/gi,
            /(javascript:|vbscript:|onload=|onerror=)/gi,
            /(union.*select|insert.*into|drop.*table)/gi,
            /(\.\.\/|\.\.\\|\/etc\/passwd|\/proc\/)/gi
        ];
        this.failedAttempts = new Map();
        this.maxFailedAttempts = 5;
        this.blockDuration = 15 * 60 * 1000; // 15 minutes
    }

    // Enhanced input validation
    validateInput(input, type = 'general') {
        if (!input || typeof input !== 'string') {
            throw new Error('Invalid input type');
        }

        // Check for malicious patterns
        for (const pattern of this.suspiciousPatterns) {
            if (pattern.test(input)) {
                throw new Error('Potentially malicious input detected');
            }
        }

        switch (type) {
            case 'email':
                if (!validator.isEmail(input)) {
                    throw new Error('Invalid email format');
                }
                break;
            case 'walletAddress':
                if (!/^0x[a-fA-F0-9]{40}$/.test(input)) {
                    throw new Error('Invalid wallet address format');
                }
                break;
            case 'coordinates':
                const coords = input.split(',');
                if (coords.length !== 2 || 
                    !validator.isFloat(coords[0], {min: -90, max: 90}) ||
                    !validator.isFloat(coords[1], {min: -180, max: 180})) {
                    throw new Error('Invalid coordinate format');
                }
                break;
            case 'amount':
                if (!validator.isFloat(input, {min: 0})) {
                    throw new Error('Invalid amount format');
                }
                break;
        }

        return validator.escape(input);
    }

    // Rate limiting configurations
    createRateLimit(windowMs = 15 * 60 * 1000, max = 100, message = 'Too many requests') {
        return rateLimit({
            windowMs,
            max,
            message: { error: message },
            standardHeaders: true,
            legacyHeaders: false,
            keyGenerator: (req) => {
                const ip = ipKeyGenerator(req);
                return ip + ':' + (req.user?.id || 'anonymous');
            }
        });
    }

    // Enhanced geolocation security
    secureGeolocation() {
        return (req, res, next) => {
            if (req.body.latitude && req.body.longitude) {
                try {
                    // Validate coordinates
                    this.validateInput(`${req.body.latitude},${req.body.longitude}`, 'coordinates');
                    
                    // Encrypt sensitive location data
                    const locationHash = crypto.createHash('sha256')
                        .update(`${req.body.latitude},${req.body.longitude}`)
                        .digest('hex');
                    
                    req.locationHash = locationHash;
                    
                    // Remove exact coordinates from logs
                    req.body._originalCoords = {
                        lat: req.body.latitude,
                        lng: req.body.longitude
                    };
                    
                    // Obfuscate coordinates (reduce precision)
                    req.body.latitude = parseFloat(req.body.latitude).toFixed(1);
                    req.body.longitude = parseFloat(req.body.longitude).toFixed(1);
                    
                } catch (error) {
                    return res.status(400).json({
                        error: 'Invalid location data',
                        code: 'INVALID_COORDINATES'
                    });
                }
            }
            next();
        };
    }

    // Wallet security validation
    validateWalletOperation() {
        return (req, res, next) => {
            const { address, amount, operation } = req.body;

            try {
                if (address) {
                    this.validateInput(address, 'walletAddress');
                }

                if (amount) {
                    this.validateInput(amount.toString(), 'amount');
                    
                    // Additional amount validation
                    const numAmount = parseFloat(amount);
                    if (numAmount > 1000000) { // Reasonable upper limit
                        throw new Error('Amount exceeds maximum allowed');
                    }
                }

                // Log wallet operations for audit
                console.log(`Wallet operation: ${operation || 'unknown'} - ${address} - ${amount}`);
                
            } catch (error) {
                return res.status(400).json({
                    error: error.message,
                    code: 'INVALID_WALLET_DATA'
                });
            }

            next();
        };
    }

    // Enhanced CORS configuration
    configureCORS() {
        return (req, res, next) => {
            const allowedOrigins = [
                'https://www.disease.zone',
                'https://api.disease.zone',
                process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null
            ].filter(Boolean);

            const origin = req.headers.origin;
            if (allowedOrigins.includes(origin)) {
                res.setHeader('Access-Control-Allow-Origin', origin);
            }

            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
            res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours

            if (req.method === 'OPTIONS') {
                return res.sendStatus(200);
            }

            next();
        };
    }

    // Enhanced CSP for blockchain integration
    enhancedCSP() {
        return helmet.contentSecurityPolicy({
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: [
                    "'self'", 
                    "'unsafe-inline'", 
                    "https://unpkg.com", 
                    "https://api.mapbox.com",
                    "https://fonts.googleapis.com"
                ],
                scriptSrc: [
                    "'self'", 
                    "'unsafe-inline'", 
                    "https://unpkg.com", 
                    "https://api.mapbox.com",
                    "https://cdn.ethers.io",
                    "https://cdn.jsdelivr.net"
                ],
                connectSrc: [
                    "'self'", 
                    "https:", 
                    "wss:",
                    "https://polygon-rpc.com",
                    "https://rpc-mumbai.matic.today",
                    "https://api.polygonscan.com"
                ],
                imgSrc: ["'self'", "data:", "https:", "blob:"],
                fontSrc: ["'self'", "https:", "data:"],
                objectSrc: ["'none'"],
                baseUri: ["'self'"],
                formAction: ["'self'"],
                frameAncestors: ["'self'"]
            },
        });
    }

    // Request sanitization
    sanitizeRequest() {
        return (req, res, next) => {
            // Recursively sanitize all string inputs
            const sanitizeObject = (obj) => {
                if (typeof obj === 'string') {
                    return validator.escape(obj);
                } else if (Array.isArray(obj)) {
                    return obj.map(sanitizeObject);
                } else if (typeof obj === 'object' && obj !== null) {
                    const sanitized = {};
                    for (const key in obj) {
                        sanitized[key] = sanitizeObject(obj[key]);
                    }
                    return sanitized;
                }
                return obj;
            };

            if (req.body) {
                req.body = sanitizeObject(req.body);
            }
            if (req.query) {
                req.query = sanitizeObject(req.query);
            }
            if (req.params) {
                req.params = sanitizeObject(req.params);
            }

            next();
        };
    }

    // IP-based security
    ipSecurity() {
        return (req, res, next) => {
            const clientIP = req.ip || req.connection.remoteAddress;
            const now = Date.now();

            // Check if IP is blocked
            const failures = this.failedAttempts.get(clientIP);
            if (failures && failures.count >= this.maxFailedAttempts) {
                if (now - failures.lastAttempt < this.blockDuration) {
                    return res.status(429).json({
                        error: 'IP temporarily blocked due to suspicious activity',
                        code: 'IP_BLOCKED',
                        retryAfter: Math.ceil((this.blockDuration - (now - failures.lastAttempt)) / 1000)
                    });
                } else {
                    // Reset after block duration
                    this.failedAttempts.delete(clientIP);
                }
            }

            req.clientIP = clientIP;
            next();
        };
    }

    // Log security events
    logSecurityEvent(event, req, additional = {}) {
        const logData = {
            timestamp: new Date().toISOString(),
            event,
            ip: req.clientIP || req.ip,
            userAgent: req.headers['user-agent'],
            url: req.url,
            method: req.method,
            ...additional
        };

        console.log('SECURITY EVENT:', JSON.stringify(logData));
        
        // In production, send to security monitoring service
        if (process.env.NODE_ENV === 'production') {
            // TODO: Integrate with security monitoring service
        }
    }
}

module.exports = SecurityValidator;