/**
 * Security Release 4: Security Dashboard and Monitoring Routes
 * Provides security monitoring and statistics endpoints
 */

const express = require('express');
const router = express.Router();

// Security dashboard (admin only)
router.get('/dashboard', (req, res) => {
    try {
        // Check admin authentication
        if (!req.user || req.user.role !== 'admin') {
            req.app.locals.securityMonitor?.logSecurityEvent({
                type: 'UNAUTHORIZED_SECURITY_ACCESS',
                severity: 'HIGH',
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                userId: req.user?.id,
                details: { path: req.path, method: req.method }
            });
            
            return res.status(403).json({
                success: false,
                error: 'Admin access required'
            });
        }

        const securityStats = req.app.locals.securityMonitor?.getSecurityStats() || {
            error: 'Security monitoring not available'
        };

        res.json({
            success: true,
            data: {
                timestamp: new Date().toISOString(),
                ...securityStats
            }
        });
    } catch (error) {
        console.error('Security dashboard error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get security events for specific IP (admin only)
router.get('/events/:ip', (req, res) => {
    try {
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Admin access required'
            });
        }

        const { ip } = req.params;
        const minutesBack = parseInt(req.query.minutes) || 60;

        if (!/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ip)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid IP address format'
            });
        }

        const events = req.app.locals.securityMonitor?.getRelatedEvents(ip, minutesBack) || [];

        res.json({
            success: true,
            data: {
                ip,
                timeRange: `${minutesBack} minutes`,
                eventCount: events.length,
                events: events.map(event => ({
                    id: event.id,
                    timestamp: event.timestamp,
                    type: event.type,
                    severity: event.severity,
                    details: event.details
                }))
            }
        });
    } catch (error) {
        console.error('Security events error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Check if IP is suspicious
router.get('/check/:ip', (req, res) => {
    try {
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Admin access required'
            });
        }

        const { ip } = req.params;

        if (!/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ip)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid IP address format'
            });
        }

        const isSuspicious = req.app.locals.securityMonitor?.isSuspiciousIP(ip) || false;

        res.json({
            success: true,
            data: {
                ip,
                suspicious: isSuspicious,
                checkedAt: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Security check error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Security health check endpoint
router.get('/health', (req, res) => {
    try {
        const securityMonitor = req.app.locals.securityMonitor;
        
        res.json({
            success: true,
            data: {
                securityMonitoring: {
                    enabled: securityMonitor?.monitoringEnabled || false,
                    alertingEnabled: securityMonitor?.alertingEnabled || false,
                    version: '4.0.0'
                },
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Security health check error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

module.exports = router;