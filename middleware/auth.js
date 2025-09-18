const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');

class AuthMiddleware {
  constructor(databaseService) {
    this.db = databaseService;
    
    // Security Release 1: Enforce JWT secret requirement
    if (!process.env.JWT_SECRET) {
      console.error('CRITICAL: JWT_SECRET environment variable is required for security');
      throw new Error('JWT_SECRET environment variable is required. Please configure a secure secret.');
    }
    
    // Validate JWT secret strength
    if (process.env.JWT_SECRET.length < 32) {
      console.warn('WARNING: JWT_SECRET should be at least 32 characters for optimal security');
    }
    
    this.jwtSecret = process.env.JWT_SECRET;
  }

  // Security Release 1: Enhanced rate limiting for authentication endpoints
  getAuthRateLimit() {
    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // 5 attempts per window
      message: {
        error: 'Too many authentication attempts, please try again later',
        retryAfter: '15 minutes'
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => {
        // More granular rate limiting by IP + user agent for better security
        const userAgent = req.get('User-Agent') ? req.get('User-Agent').substring(0, 50) : 'unknown';
        return `${req.ip}:${userAgent}`;
      },
      onLimitReached: (req, res, options) => {
        // Log security event when rate limit is reached
        console.warn(`Authentication rate limit exceeded for IP: ${req.ip}, User-Agent: ${req.get('User-Agent')}`);
      }
    });
  }

  // Security Release 1: Stricter rate limiting for failed authentication attempts
  getFailedAuthRateLimit() {
    return rateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 10, // 10 failed attempts per hour
      message: {
        error: 'Too many failed authentication attempts',
        retryAfter: '1 hour'
      },
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: true, // Only count failed requests
      keyGenerator: (req) => `failed_auth:${req.ip}`
    });
  }

  // Rate limiting for API endpoints
  getApiRateLimit() {
    return rateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 1000, // 1000 requests per hour for regular users
      message: {
        error: 'Rate limit exceeded',
        retryAfter: '1 hour'
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => {
        // Use API key or IP address for rate limiting
        return req.apiKey?.key_id || req.ip;
      },
      skip: (req) => {
        // Skip rate limiting for medical professionals with higher limits
        return req.user?.role === 'medical_professional' && req.apiKey?.rate_limit > 1000;
      }
    });
  }

  // API Key authentication middleware
  async authenticateApiKey(req, res, next) {
    try {
      const authHeader = req.header('Authorization');

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(); // Continue without API key authentication
      }

      const token = authHeader.substring(7);
      const [keyId, keySecret] = token.split(':');

      if (!keyId || !keySecret) {
        return res.status(401).json({
          error: 'Invalid API key format',
          message: 'API key should be in format: keyId:keySecret'
        });
      }

      const apiKey = await this.db.getApiKey(keyId);

      if (!apiKey) {
        return res.status(401).json({
          error: 'Invalid API key',
          message: 'API key not found'
        });
      }

      if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
        return res.status(401).json({
          error: 'API key expired',
          message: 'Please request a new API key'
        });
      }

      const isValidKey = await bcrypt.compare(keySecret, apiKey.api_key_hash);

      if (!isValidKey) {
        return res.status(401).json({
          error: 'Invalid API key',
          message: 'API key authentication failed'
        });
      }

      // Update last used timestamp
      await this.db.updateApiKeyLastUsed(keyId);

      // Get associated user
      if (apiKey.user_id) {
        const user = await this.db.getUserById(apiKey.user_id);
        req.user = user;
      }

      req.apiKey = apiKey;
      req.apiPermissions = apiKey.permissions;

      // Log API usage
      await this.db.logAudit({
        user_id: apiKey.user_id,
        action: 'api_key_used',
        resource_type: 'api_key',
        resource_id: keyId,
        details: {
          endpoint: req.path,
          method: req.method
        },
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });

      next();
    } catch (error) {
      console.error('API key authentication error:', error);
      return res.status(500).json({
        error: 'Authentication server error',
        message: 'Please try again later'
      });
    }
  }

  // JWT token authentication middleware
  async authenticateToken(req, res, next) {
    try {
      const authHeader = req.header('Authorization');
      const token = authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.substring(7)
        : req.cookies?.session_token;

      if (!token && !req.apiKey) {
        return res.status(401).json({
          error: 'Access denied',
          message: 'Authentication required'
        });
      }

      if (token) {
        // Security Release 1: Enhanced JWT verification with audience and issuer validation
        const verifyOptions = {
          issuer: 'disease.zone',
          audience: 'disease.zone-users',
          algorithms: ['HS256']
        };
        
        const decoded = jwt.verify(token, this.jwtSecret, verifyOptions);
        const user = await this.db.getUserById(decoded.userId);

        if (!user) {
          return res.status(401).json({
            error: 'Invalid token',
            message: 'User not found'
          });
        }

        req.user = user;
      }

      next();
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          error: 'Invalid token',
          message: 'Please log in again'
        });
      } else if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: 'Token expired',
          message: 'Please log in again'
        });
      }

      console.error('Token authentication error:', error);
      return res.status(500).json({
        error: 'Authentication server error',
        message: 'Please try again later'
      });
    }
  }

  // Optional authentication - allows both authenticated and unauthenticated access
  async optionalAuth(req, res, next) {
    try {
      // Try API key first
      await this.authenticateApiKey(req, res, () => {});

      // Then try JWT token if no API key
      if (!req.apiKey) {
        const authHeader = req.header('Authorization');
        const token = authHeader && authHeader.startsWith('Bearer ')
          ? authHeader.substring(7)
          : req.cookies?.session_token;

        if (token) {
          try {
            // Security Release 1: Consistent JWT verification with enhanced options
            const verifyOptions = {
              issuer: 'disease.zone',
              audience: 'disease.zone-users',
              algorithms: ['HS256']
            };
            
            const decoded = jwt.verify(token, this.jwtSecret, verifyOptions);
            const user = await this.db.getUserById(decoded.userId);
            if (user) {
              req.user = user;
            }
          } catch (error) {
            // Ignore authentication errors for optional auth
          }
        }
      }

      next();
    } catch (error) {
      // For optional auth, continue even if authentication fails
      next();
    }
  }

  // Role-based authorization middleware
  requireRole(roles) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'Please log in to access this resource'
        });
      }

      const userRoles = Array.isArray(roles) ? roles : [roles];

      if (!userRoles.includes(req.user.role)) {
        return res.status(403).json({
          error: 'Access forbidden',
          message: `${req.user.role} role does not have permission to access this resource`
        });
      }

      next();
    };
  }

  // Permission-based authorization for API keys
  requirePermission(permission) {
    return (req, res, next) => {
      if (req.user && (req.user.role === 'admin' || req.user.role === 'medical_professional')) {
        return next(); // Admins and medical professionals have all permissions
      }

      if (!req.apiPermissions || !req.apiPermissions.includes(permission)) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: `This operation requires '${permission}' permission`
        });
      }

      next();
    };
  }

  // Utility functions
  async hashPassword(password) {
    return await bcrypt.hash(password, 12);
  }

  async comparePassword(password, hash) {
    return await bcrypt.compare(password, hash);
  }

  // Security Release 1: Enhanced JWT token generation with security improvements
  generateToken(userId, expiresIn = '7d') {
    const payload = {
      userId,
      iat: Math.floor(Date.now() / 1000), // Issued at timestamp
      jti: uuidv4() // Unique JWT ID for tracking
    };
    
    const options = {
      expiresIn,
      issuer: 'disease.zone',
      audience: 'disease.zone-users',
      algorithm: 'HS256'
    };
    
    return jwt.sign(payload, this.jwtSecret, options);
  }

  // Security Release 1: Validate security configuration
  validateSecurityConfig() {
    const issues = [];
    
    // Check JWT secret configuration
    if (!process.env.JWT_SECRET) {
      issues.push('JWT_SECRET environment variable is not set');
    } else if (process.env.JWT_SECRET.length < 32) {
      issues.push('JWT_SECRET should be at least 32 characters long');
    }
    
    // Check session secret
    if (!process.env.SESSION_SECRET) {
      issues.push('SESSION_SECRET environment variable is not set');
    }
    
    // Check bcrypt configuration
    const bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    if (bcryptRounds < 10) {
      issues.push('BCRYPT_ROUNDS should be at least 10 for adequate security');
    }
    
    return {
      isValid: issues.length === 0,
      issues
    };
  }

  async generateApiKey(userId, name, permissions, rateLimit = 1000, expiresInDays = null) {
    const keyId = uuidv4();
    const keySecret = uuidv4();
    const keyHash = await bcrypt.hash(keySecret, 12);

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    await this.db.createApiKey({
      key_id: keyId,
      api_key_hash: keyHash,
      user_id: userId,
      name,
      permissions,
      rate_limit: rateLimit,
      expires_at: expiresAt
    });

    return {
      key_id: keyId,
      key_secret: keySecret,
      full_key: `${keyId}:${keySecret}`,
      expires_at: expiresAt
    };
  }

  // Middleware to log API usage for analytics
  logApiUsage() {
    return async (req, res, next) => {
      const originalSend = res.send;

      res.send = function(data) {
        // Log successful API calls
        if (res.statusCode < 400 && (req.user || req.apiKey)) {
          setImmediate(async () => {
            try {
              await req.app.locals.db.logAudit({
                user_id: req.user?.id,
                action: 'api_call',
                resource_type: 'endpoint',
                resource_id: req.path,
                details: {
                  method: req.method,
                  status_code: res.statusCode,
                  user_agent: req.get('User-Agent'),
                  api_key_used: !!req.apiKey
                },
                ip_address: req.ip,
                user_agent: req.get('User-Agent')
              });
            } catch (error) {
              console.error('Error logging API usage:', error);
            }
          });
        }

        return originalSend.call(this, data);
      };

      next();
    };
  }

  // Security headers middleware
  securityHeaders() {
    return (req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

      if (req.secure) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      }

      next();
    };
  }
}

module.exports = AuthMiddleware;