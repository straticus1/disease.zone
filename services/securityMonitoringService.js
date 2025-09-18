/**
 * Security Release 4: Advanced Security Monitoring Service
 * Real-time security event detection and alerting
 */

const crypto = require('crypto');

class SecurityMonitoringService {
    constructor() {
        this.securityEvents = new Map();
        this.suspiciousIPs = new Set();
        this.alertThresholds = {
            failedLogins: 5,
            apiKeyAttempts: 10,
            rateLimitHits: 20,
            suspiciousPatterns: 3
        };
        this.monitoringEnabled = process.env.ENABLE_SECURITY_MONITORING !== 'false';
        this.alertingEnabled = process.env.ALERT_ON_SUSPICIOUS_ACTIVITY === 'true';
        
        // Initialize cleanup interval
        if (this.monitoringEnabled) {
            this.startPeriodicCleanup();
        }
    }

    /**
     * Log security event
     */
    logSecurityEvent(event) {
        if (!this.monitoringEnabled) return;

        const securityEvent = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            type: event.type,
            severity: event.severity || 'MEDIUM',
            ip: event.ip,
            userAgent: event.userAgent,
            userId: event.userId,
            details: event.details,
            location: event.location
        };

        // Store event
        const eventKey = `${event.ip}:${event.type}`;
        if (!this.securityEvents.has(eventKey)) {
            this.securityEvents.set(eventKey, []);
        }
        this.securityEvents.get(eventKey).push(securityEvent);

        // Check for suspicious patterns
        this.analyzeSecurityEvent(securityEvent);

        // Log to console (in production, send to security monitoring system)
        this.logToSecuritySystem(securityEvent);

        return securityEvent.id;
    }

    /**
     * Analyze security event for suspicious patterns
     */
    analyzeSecurityEvent(event) {
        const eventKey = `${event.ip}:${event.type}`;
        const events = this.securityEvents.get(eventKey) || [];
        
        // Check frequency-based alerts
        switch (event.type) {
            case 'FAILED_LOGIN':
                if (events.length >= this.alertThresholds.failedLogins) {
                    this.triggerAlert('BRUTE_FORCE_LOGIN', event);
                }
                break;
                
            case 'INVALID_API_KEY':
                if (events.length >= this.alertThresholds.apiKeyAttempts) {
                    this.triggerAlert('API_KEY_SCANNING', event);
                }
                break;
                
            case 'RATE_LIMIT_HIT':
                if (events.length >= this.alertThresholds.rateLimitHits) {
                    this.triggerAlert('EXCESSIVE_REQUESTS', event);
                }
                break;
        }

        // Pattern-based analysis
        this.checkForSuspiciousPatterns(event);
    }

    /**
     * Check for suspicious patterns across different event types
     */
    checkForSuspiciousPatterns(event) {
        // Cross-event pattern detection
        const allEventsFromIP = [];
        for (const [key, events] of this.securityEvents.entries()) {
            if (key.startsWith(event.ip + ':')) {
                allEventsFromIP.push(...events);
            }
        }

        // Time-based clustering analysis
        const recentEvents = allEventsFromIP.filter(e => {
            const eventTime = new Date(e.timestamp);
            const now = new Date();
            return (now - eventTime) < (15 * 60 * 1000); // Last 15 minutes
        });

        if (recentEvents.length >= this.alertThresholds.suspiciousPatterns) {
            const eventTypes = [...new Set(recentEvents.map(e => e.type))];
            if (eventTypes.length >= 3) {
                this.triggerAlert('MULTI_VECTOR_ATTACK', {
                    ...event,
                    details: {
                        ...event.details,
                        eventTypes,
                        eventCount: recentEvents.length
                    }
                });
            }
        }

        // User agent analysis
        if (event.userAgent) {
            if (this.isSuspiciousUserAgent(event.userAgent)) {
                this.triggerAlert('SUSPICIOUS_USER_AGENT', event);
            }
        }
    }

    /**
     * Check if user agent is suspicious
     */
    isSuspiciousUserAgent(userAgent) {
        const suspiciousPatterns = [
            /bot/i,
            /crawler/i,
            /scanner/i,
            /nikto/i,
            /sqlmap/i,
            /nmap/i,
            /masscan/i,
            /curl/i,
            /wget/i,
            /python/i,
            /^-$/
        ];

        return suspiciousPatterns.some(pattern => pattern.test(userAgent));
    }

    /**
     * Trigger security alert
     */
    triggerAlert(alertType, event) {
        if (!this.alertingEnabled) return;

        const alert = {
            id: crypto.randomUUID(),
            type: alertType,
            severity: this.getAlertSeverity(alertType),
            timestamp: new Date().toISOString(),
            ip: event.ip,
            details: event.details,
            events: this.getRelatedEvents(event.ip, 30) // Last 30 minutes
        };

        // Add IP to suspicious list
        this.suspiciousIPs.add(event.ip);

        // Log alert
        this.logAlert(alert);

        // In production, send to alerting system (Slack, PagerDuty, etc.)
        this.sendAlert(alert);

        return alert.id;
    }

    /**
     * Get alert severity level
     */
    getAlertSeverity(alertType) {
        const severityMap = {
            'BRUTE_FORCE_LOGIN': 'HIGH',
            'API_KEY_SCANNING': 'HIGH',
            'EXCESSIVE_REQUESTS': 'MEDIUM',
            'MULTI_VECTOR_ATTACK': 'CRITICAL',
            'SUSPICIOUS_USER_AGENT': 'LOW',
            'SQL_INJECTION_ATTEMPT': 'CRITICAL',
            'XSS_ATTEMPT': 'HIGH',
            'DIRECTORY_TRAVERSAL': 'HIGH'
        };

        return severityMap[alertType] || 'MEDIUM';
    }

    /**
     * Get related security events for an IP
     */
    getRelatedEvents(ip, minutesBack = 30) {
        const cutoffTime = new Date(Date.now() - (minutesBack * 60 * 1000));
        const relatedEvents = [];

        for (const [key, events] of this.securityEvents.entries()) {
            if (key.startsWith(ip + ':')) {
                const recentEvents = events.filter(e => new Date(e.timestamp) > cutoffTime);
                relatedEvents.push(...recentEvents);
            }
        }

        return relatedEvents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    /**
     * Check if IP is currently flagged as suspicious
     */
    isSuspiciousIP(ip) {
        return this.suspiciousIPs.has(ip);
    }

    /**
     * Get security statistics
     */
    getSecurityStats() {
        const now = new Date();
        const last24Hours = new Date(now.getTime() - (24 * 60 * 60 * 1000));
        
        let totalEvents = 0;
        let eventsByType = {};
        let uniqueIPs = new Set();

        for (const [key, events] of this.securityEvents.entries()) {
            const recentEvents = events.filter(e => new Date(e.timestamp) > last24Hours);
            totalEvents += recentEvents.length;
            
            recentEvents.forEach(event => {
                eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
                uniqueIPs.add(event.ip);
            });
        }

        return {
            last24Hours: {
                totalEvents,
                eventsByType,
                uniqueIPs: uniqueIPs.size,
                suspiciousIPs: this.suspiciousIPs.size
            },
            monitoring: {
                enabled: this.monitoringEnabled,
                alertingEnabled: this.alertingEnabled,
                thresholds: this.alertThresholds
            }
        };
    }

    /**
     * Log security event to security system
     */
    logToSecuritySystem(event) {
        // In development, log to console
        if (process.env.NODE_ENV !== 'production') {
            console.log(`🔒 [SECURITY] ${event.severity}: ${event.type} from ${event.ip}`);
            return;
        }

        // In production, send to centralized logging system
        // Example: Send to ELK stack, Splunk, CloudWatch, etc.
        const logEntry = {
            '@timestamp': event.timestamp,
            level: 'SECURITY',
            severity: event.severity,
            type: event.type,
            source_ip: event.ip,
            user_agent: event.userAgent,
            user_id: event.userId,
            details: event.details,
            service: 'disease.zone'
        };

        // Would send to logging system here
        console.log(`SECURITY_LOG: ${JSON.stringify(logEntry)}`);
    }

    /**
     * Log security alert
     */
    logAlert(alert) {
        console.warn(`🚨 [SECURITY ALERT] ${alert.severity}: ${alert.type} from ${alert.ip}`);
        console.warn(`   Events in last 30 min: ${alert.events.length}`);
    }

    /**
     * Send alert to external systems
     */
    sendAlert(alert) {
        // In production, integrate with:
        // - Slack webhooks
        // - PagerDuty
        // - Email alerts
        // - SMS notifications
        // - Security incident management systems

        if (process.env.NODE_ENV === 'production' && process.env.SLACK_WEBHOOK_URL) {
            // Example Slack integration (would need actual implementation)
            const slackMessage = {
                text: `🚨 Security Alert: ${alert.type}`,
                attachments: [{
                    color: alert.severity === 'CRITICAL' ? 'danger' : 'warning',
                    fields: [
                        { title: 'IP Address', value: alert.ip, short: true },
                        { title: 'Severity', value: alert.severity, short: true },
                        { title: 'Event Count', value: alert.events.length, short: true },
                        { title: 'Time', value: alert.timestamp, short: true }
                    ]
                }]
            };
            
            // Would send to Slack webhook here
            console.log(`SLACK_ALERT: ${JSON.stringify(slackMessage)}`);
        }
    }

    /**
     * Start periodic cleanup of old events
     */
    startPeriodicCleanup() {
        // Clean up every hour
        setInterval(() => {
            this.cleanupOldEvents();
        }, 60 * 60 * 1000);
    }

    /**
     * Clean up events older than retention period
     */
    cleanupOldEvents() {
        const retentionDays = parseInt(process.env.LOG_RETENTION_DAYS) || 7;
        const cutoffTime = new Date(Date.now() - (retentionDays * 24 * 60 * 60 * 1000));

        for (const [key, events] of this.securityEvents.entries()) {
            const recentEvents = events.filter(e => new Date(e.timestamp) > cutoffTime);
            
            if (recentEvents.length === 0) {
                this.securityEvents.delete(key);
            } else if (recentEvents.length < events.length) {
                this.securityEvents.set(key, recentEvents);
            }
        }

        console.log(`🧹 Cleaned up old security events. Active events: ${this.securityEvents.size}`);
    }

    /**
     * Create middleware for automatic security monitoring
     */
    createSecurityMiddleware() {
        return (req, res, next) => {
            const originalSend = res.send;
            
            res.send = function(data) {
                // Log security events based on response status
                if (res.statusCode === 401) {
                    // Unauthorized access attempt
                    req.app.locals.securityMonitor?.logSecurityEvent({
                        type: 'UNAUTHORIZED_ACCESS',
                        severity: 'MEDIUM',
                        ip: req.ip,
                        userAgent: req.get('User-Agent'),
                        details: {
                            path: req.path,
                            method: req.method,
                            statusCode: res.statusCode
                        }
                    });
                } else if (res.statusCode === 403) {
                    // Forbidden access
                    req.app.locals.securityMonitor?.logSecurityEvent({
                        type: 'FORBIDDEN_ACCESS',
                        severity: 'MEDIUM',
                        ip: req.ip,
                        userAgent: req.get('User-Agent'),
                        details: {
                            path: req.path,
                            method: req.method,
                            statusCode: res.statusCode
                        }
                    });
                } else if (res.statusCode === 429) {
                    // Rate limit exceeded
                    req.app.locals.securityMonitor?.logSecurityEvent({
                        type: 'RATE_LIMIT_HIT',
                        severity: 'LOW',
                        ip: req.ip,
                        userAgent: req.get('User-Agent'),
                        details: {
                            path: req.path,
                            method: req.method,
                            statusCode: res.statusCode
                        }
                    });
                }

                return originalSend.call(this, data);
            };

            next();
        };
    }
}

module.exports = SecurityMonitoringService;