/**
 * Webhook Service
 * Real-time notifications for platform events
 */

const axios = require('axios');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const platformConfig = require('../config/platformConfig');

class WebhookService {
    constructor() {
        this.dbPath = path.join(__dirname, '../data/webhooks.db');
        this.webhookConfig = platformConfig.getWebhookConfig();
        this.initializeDatabase();
        this.eventQueue = [];
        this.isProcessing = false;
    }

    /**
     * Initialize database for webhook management
     */
    initializeDatabase() {
        const dataDir = path.dirname(this.dbPath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        this.db = new sqlite3.Database(this.dbPath);
        
        this.db.serialize(() => {
            // Webhook endpoints table
            this.db.run(`
                CREATE TABLE IF NOT EXISTS webhook_endpoints (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    url TEXT NOT NULL,
                    secret TEXT NOT NULL,
                    event_types TEXT NOT NULL,
                    is_active BOOLEAN DEFAULT true,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL,
                    last_triggered INTEGER,
                    success_count INTEGER DEFAULT 0,
                    failure_count INTEGER DEFAULT 0
                )
            `);

            // Webhook delivery log
            this.db.run(`
                CREATE TABLE IF NOT EXISTS webhook_deliveries (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    webhook_id INTEGER NOT NULL,
                    event_type TEXT NOT NULL,
                    event_data TEXT NOT NULL,
                    status TEXT NOT NULL,
                    response_code INTEGER,
                    response_body TEXT,
                    attempt_count INTEGER DEFAULT 1,
                    delivered_at INTEGER NOT NULL,
                    next_retry_at INTEGER,
                    FOREIGN KEY(webhook_id) REFERENCES webhook_endpoints(id)
                )
            `);

            // Event templates
            this.db.run(`
                CREATE TABLE IF NOT EXISTS event_templates (
                    event_type TEXT PRIMARY KEY,
                    template TEXT NOT NULL,
                    description TEXT,
                    required_fields TEXT NOT NULL,
                    created_at INTEGER NOT NULL
                )
            `);

            // Initialize default event templates
            this.initializeEventTemplates();
        });
    }

    /**
     * Initialize default event templates
     */
    initializeEventTemplates() {
        const templates = {
            license_status_change: {
                template: JSON.stringify({
                    event: 'license_status_change',
                    timestamp: '{{timestamp}}',
                    data: {
                        providerId: '{{providerId}}',
                        licenseNumber: '{{licenseNumber}}',
                        state: '{{state}}',
                        oldStatus: '{{oldStatus}}',
                        newStatus: '{{newStatus}}',
                        changeReason: '{{changeReason}}'
                    }
                }),
                description: 'Triggered when a healthcare provider license status changes',
                requiredFields: ['providerId', 'licenseNumber', 'state', 'oldStatus', 'newStatus']
            },
            
            violation_detected: {
                template: JSON.stringify({
                    event: 'violation_detected',
                    timestamp: '{{timestamp}}',
                    data: {
                        providerId: '{{providerId}}',
                        licenseNumber: '{{licenseNumber}}',
                        violationType: '{{violationType}}',
                        severity: '{{severity}}',
                        description: '{{description}}',
                        boardAction: '{{boardAction}}',
                        effectiveDate: '{{effectiveDate}}'
                    }
                }),
                description: 'Triggered when a new violation is detected for a provider',
                requiredFields: ['providerId', 'licenseNumber', 'violationType', 'severity']
            },
            
            credential_expiring: {
                template: JSON.stringify({
                    event: 'credential_expiring',
                    timestamp: '{{timestamp}}',
                    data: {
                        providerId: '{{providerId}}',
                        licenseNumber: '{{licenseNumber}}',
                        credentialType: '{{credentialType}}',
                        expirationDate: '{{expirationDate}}',
                        daysUntilExpiration: '{{daysUntilExpiration}}',
                        renewalRequired: '{{renewalRequired}}'
                    }
                }),
                description: 'Triggered when credentials are approaching expiration',
                requiredFields: ['providerId', 'licenseNumber', 'credentialType', 'expirationDate']
            },
            
            outbreak_alert: {
                template: JSON.stringify({
                    event: 'outbreak_alert',
                    timestamp: '{{timestamp}}',
                    data: {
                        alertId: '{{alertId}}',
                        disease: '{{disease}}',
                        region: '{{region}}',
                        severity: '{{severity}}',
                        description: '{{description}}',
                        affectedPopulation: '{{affectedPopulation}}',
                        recommendations: '{{recommendations}}'
                    }
                }),
                description: 'Triggered when a disease outbreak alert is issued',
                requiredFields: ['alertId', 'disease', 'region', 'severity']
            },
            
            health_assessment_complete: {
                template: JSON.stringify({
                    event: 'health_assessment_complete',
                    timestamp: '{{timestamp}}',
                    data: {
                        assessmentId: '{{assessmentId}}',
                        userId: '{{userId}}',
                        riskScore: '{{riskScore}}',
                        riskLevel: '{{riskLevel}}',
                        recommendations: '{{recommendations}}',
                        followUpRequired: '{{followUpRequired}}'
                    }
                }),
                description: 'Triggered when a health assessment is completed',
                requiredFields: ['assessmentId', 'userId', 'riskScore']
            },
            
            api_limit_reached: {
                template: JSON.stringify({
                    event: 'api_limit_reached',
                    timestamp: '{{timestamp}}',
                    data: {
                        userId: '{{userId}}',
                        tier: '{{tier}}',
                        limitType: '{{limitType}}',
                        currentUsage: '{{currentUsage}}',
                        limit: '{{limit}}',
                        resetTime: '{{resetTime}}'
                    }
                }),
                description: 'Triggered when API usage limits are reached',
                requiredFields: ['userId', 'tier', 'limitType', 'currentUsage']
            },
            
            payment_processed: {
                template: JSON.stringify({
                    event: 'payment_processed',
                    timestamp: '{{timestamp}}',
                    data: {
                        userId: '{{userId}}',
                        paymentId: '{{paymentId}}',
                        amount: '{{amount}}',
                        currency: '{{currency}}',
                        status: '{{status}}',
                        tier: '{{tier}}',
                        billingPeriod: '{{billingPeriod}}'
                    }
                }),
                description: 'Triggered when a payment is processed',
                requiredFields: ['userId', 'paymentId', 'amount', 'status']
            },
            
            subscription_changed: {
                template: JSON.stringify({
                    event: 'subscription_changed',
                    timestamp: '{{timestamp}}',
                    data: {
                        userId: '{{userId}}',
                        oldTier: '{{oldTier}}',
                        newTier: '{{newTier}}',
                        changeType: '{{changeType}}',
                        effectiveDate: '{{effectiveDate}}',
                        prorationAmount: '{{prorationAmount}}'
                    }
                }),
                description: 'Triggered when subscription tier changes',
                requiredFields: ['userId', 'oldTier', 'newTier', 'changeType']
            }
        };

        const now = Date.now();
        for (const [eventType, config] of Object.entries(templates)) {
            this.db.run(
                'INSERT OR IGNORE INTO event_templates (event_type, template, description, required_fields, created_at) VALUES (?, ?, ?, ?, ?)',
                [eventType, config.template, config.description, JSON.stringify(config.requiredFields), now]
            );
        }
    }

    /**
     * Register a webhook endpoint for a user
     */
    async registerWebhook(userId, url, eventTypes, secret = null) {
        // Check user's webhook limits
        const userTier = await this.getUserTier(userId);
        const maxWebhooks = this.webhookConfig.maxWebhooksPerTier[userTier] || 0;
        
        if (maxWebhooks === 0) {
            throw new Error('Webhooks not available in your tier');
        }

        if (maxWebhooks !== 'unlimited') {
            const currentCount = await this.getUserWebhookCount(userId);
            if (currentCount >= maxWebhooks) {
                throw new Error(`Maximum webhook limit reached (${maxWebhooks})`);
            }
        }

        // Validate event types
        const validEventTypes = this.webhookConfig.eventTypes;
        const invalidEvents = eventTypes.filter(event => !validEventTypes.includes(event));
        if (invalidEvents.length > 0) {
            throw new Error(`Invalid event types: ${invalidEvents.join(', ')}`);
        }

        // Generate secret if not provided
        if (!secret) {
            secret = crypto.randomBytes(32).toString('hex');
        }

        const now = Date.now();
        
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO webhook_endpoints (user_id, url, secret, event_types, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [userId, url, secret, JSON.stringify(eventTypes), true, now, now],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({
                            id: this.lastID,
                            userId: userId,
                            url: url,
                            secret: secret,
                            eventTypes: eventTypes,
                            isActive: true,
                            createdAt: now
                        });
                    }
                }
            );
        });
    }

    /**
     * Get user's webhook endpoints
     */
    async getUserWebhooks(userId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM webhook_endpoints WHERE user_id = ? ORDER BY created_at DESC',
                [userId],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        const webhooks = rows.map(row => ({
                            ...row,
                            eventTypes: JSON.parse(row.event_types),
                            isActive: Boolean(row.is_active)
                        }));
                        resolve(webhooks);
                    }
                }
            );
        });
    }

    /**
     * Update webhook endpoint
     */
    async updateWebhook(webhookId, userId, updates) {
        const allowedUpdates = ['url', 'event_types', 'is_active'];
        const updateFields = [];
        const updateValues = [];
        
        for (const [key, value] of Object.entries(updates)) {
            if (allowedUpdates.includes(key)) {
                updateFields.push(`${key} = ?`);
                updateValues.push(key === 'event_types' ? JSON.stringify(value) : value);
            }
        }
        
        if (updateFields.length === 0) {
            throw new Error('No valid update fields provided');
        }
        
        updateFields.push('updated_at = ?');
        updateValues.push(Date.now(), webhookId, userId);
        
        return new Promise((resolve, reject) => {
            this.db.run(
                `UPDATE webhook_endpoints SET ${updateFields.join(', ')} WHERE id = ? AND user_id = ?`,
                updateValues,
                function(err) {
                    if (err) {
                        reject(err);
                    } else if (this.changes === 0) {
                        reject(new Error('Webhook not found or permission denied'));
                    } else {
                        resolve({ updated: true });
                    }
                }
            );
        });
    }

    /**
     * Delete webhook endpoint
     */
    async deleteWebhook(webhookId, userId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'DELETE FROM webhook_endpoints WHERE id = ? AND user_id = ?',
                [webhookId, userId],
                function(err) {
                    if (err) {
                        reject(err);
                    } else if (this.changes === 0) {
                        reject(new Error('Webhook not found or permission denied'));
                    } else {
                        resolve({ deleted: true });
                    }
                }
            );
        });
    }

    /**
     * Trigger webhook event
     */
    async triggerEvent(eventType, eventData) {
        if (!this.webhookConfig.enabled) {
            return;
        }

        // Add event to queue for processing
        this.eventQueue.push({
            eventType: eventType,
            eventData: eventData,
            timestamp: Date.now()
        });

        // Process queue if not already processing
        if (!this.isProcessing) {
            this.processEventQueue();
        }
    }

    /**
     * Process event queue
     */
    async processEventQueue() {
        this.isProcessing = true;
        
        while (this.eventQueue.length > 0) {
            const event = this.eventQueue.shift();
            await this.processEvent(event);
        }
        
        this.isProcessing = false;
    }

    /**
     * Process individual event
     */
    async processEvent(event) {
        try {
            // Get all webhooks subscribed to this event type
            const webhooks = await this.getWebhooksForEvent(event.eventType);
            
            // Send webhook to each endpoint
            for (const webhook of webhooks) {
                await this.sendWebhook(webhook, event);
            }
            
        } catch (error) {
            console.error('Error processing webhook event:', error);
        }
    }

    /**
     * Get webhooks subscribed to specific event type
     */
    async getWebhooksForEvent(eventType) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM webhook_endpoints 
                 WHERE is_active = true 
                 AND json_extract(event_types, '$') LIKE '%"${eventType}"%'`,
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        const webhooks = rows.map(row => ({
                            ...row,
                            eventTypes: JSON.parse(row.event_types)
                        }));
                        resolve(webhooks);
                    }
                }
            );
        });
    }

    /**
     * Send webhook to endpoint
     */
    async sendWebhook(webhook, event) {
        try {
            // Get event template
            const template = await this.getEventTemplate(event.eventType);
            
            // Build payload
            const payload = this.buildPayload(template, event);
            
            // Generate signature
            const signature = this.generateSignature(payload, webhook.secret);
            
            // Send webhook with retry logic
            await this.sendWithRetry(webhook, payload, signature, event);
            
        } catch (error) {
            console.error(`Error sending webhook to ${webhook.url}:`, error);
            await this.logDelivery(webhook.id, event.eventType, event.eventData, 'failed', 0, error.message);
        }
    }

    /**
     * Build webhook payload from template
     */
    buildPayload(template, event) {
        let payload = template;
        
        // Replace template variables
        payload = payload.replace(/\{\{timestamp\}\}/g, event.timestamp);
        
        for (const [key, value] of Object.entries(event.eventData)) {
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
            payload = payload.replace(regex, value);
        }
        
        return JSON.parse(payload);
    }

    /**
     * Generate webhook signature
     */
    generateSignature(payload, secret) {
        const payloadString = JSON.stringify(payload);
        return crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
    }

    /**
     * Send webhook with retry logic
     */
    async sendWithRetry(webhook, payload, signature, event, attempt = 1) {
        const maxRetries = this.webhookConfig.retryPolicy.maxRetries;
        
        try {
            const response = await axios.post(webhook.url, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Disease-Zone-Signature': `sha256=${signature}`,
                    'X-Disease-Zone-Event': event.eventType,
                    'X-Disease-Zone-Delivery': crypto.randomUUID()
                },
                timeout: 30000 // 30 second timeout
            });
            
            // Log successful delivery
            await this.logDelivery(webhook.id, event.eventType, event.eventData, 'delivered', response.status, response.data);
            await this.updateWebhookStats(webhook.id, true);
            
        } catch (error) {
            if (attempt <= maxRetries) {
                // Calculate backoff delay
                const delay = this.webhookConfig.retryPolicy.initialDelay * 
                            Math.pow(this.webhookConfig.retryPolicy.backoffMultiplier, attempt - 1);
                
                setTimeout(() => {
                    this.sendWithRetry(webhook, payload, signature, event, attempt + 1);
                }, delay);
                
                // Log retry attempt
                await this.logDelivery(webhook.id, event.eventType, event.eventData, 'retry', 
                                     error.response?.status || 0, error.message, attempt);
            } else {
                // Log final failure
                await this.logDelivery(webhook.id, event.eventType, event.eventData, 'failed', 
                                     error.response?.status || 0, error.message, attempt);
                await this.updateWebhookStats(webhook.id, false);
            }
        }
    }

    /**
     * Get event template
     */
    async getEventTemplate(eventType) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT template FROM event_templates WHERE event_type = ?',
                [eventType],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else if (row) {
                        resolve(row.template);
                    } else {
                        // Default template if not found
                        resolve(JSON.stringify({
                            event: eventType,
                            timestamp: '{{timestamp}}',
                            data: '{{data}}'
                        }));
                    }
                }
            );
        });
    }

    /**
     * Log webhook delivery
     */
    async logDelivery(webhookId, eventType, eventData, status, responseCode, responseBody, attemptCount = 1) {
        return new Promise((resolve) => {
            this.db.run(
                'INSERT INTO webhook_deliveries (webhook_id, event_type, event_data, status, response_code, response_body, attempt_count, delivered_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [webhookId, eventType, JSON.stringify(eventData), status, responseCode, JSON.stringify(responseBody), attemptCount, Date.now()],
                resolve
            );
        });
    }

    /**
     * Update webhook statistics
     */
    async updateWebhookStats(webhookId, success) {
        const field = success ? 'success_count' : 'failure_count';
        
        return new Promise((resolve) => {
            this.db.run(
                `UPDATE webhook_endpoints SET ${field} = ${field} + 1, last_triggered = ?, updated_at = ? WHERE id = ?`,
                [Date.now(), Date.now(), webhookId],
                resolve
            );
        });
    }

    /**
     * Get webhook delivery history
     */
    async getDeliveryHistory(webhookId, userId, limit = 50) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT wd.* FROM webhook_deliveries wd
                 JOIN webhook_endpoints we ON wd.webhook_id = we.id
                 WHERE wd.webhook_id = ? AND we.user_id = ?
                 ORDER BY wd.delivered_at DESC
                 LIMIT ?`,
                [webhookId, userId, limit],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        const deliveries = rows.map(row => ({
                            ...row,
                            eventData: JSON.parse(row.event_data),
                            responseBody: JSON.parse(row.response_body || '{}')
                        }));
                        resolve(deliveries);
                    }
                }
            );
        });
    }

    /**
     * Get user's tier for webhook limits
     */
    async getUserTier(userId) {
        // In production, this would query the user's actual subscription
        // For now, return a default tier
        return 'pro';
    }

    /**
     * Get user's current webhook count
     */
    async getUserWebhookCount(userId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT COUNT(*) as count FROM webhook_endpoints WHERE user_id = ? AND is_active = true',
                [userId],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row.count || 0);
                    }
                }
            );
        });
    }

    /**
     * Test webhook endpoint
     */
    async testWebhook(webhookId, userId) {
        const webhook = await this.getWebhookById(webhookId, userId);
        if (!webhook) {
            throw new Error('Webhook not found');
        }

        const testEvent = {
            eventType: 'webhook_test',
            eventData: {
                message: 'This is a test webhook from Disease.Zone',
                timestamp: new Date().toISOString(),
                webhookId: webhookId
            },
            timestamp: Date.now()
        };

        await this.sendWebhook(webhook, testEvent);
        
        return {
            success: true,
            message: 'Test webhook sent'
        };
    }

    /**
     * Get webhook by ID
     */
    async getWebhookById(webhookId, userId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM webhook_endpoints WHERE id = ? AND user_id = ?',
                [webhookId, userId],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else if (row) {
                        resolve({
                            ...row,
                            eventTypes: JSON.parse(row.event_types),
                            isActive: Boolean(row.is_active)
                        });
                    } else {
                        resolve(null);
                    }
                }
            );
        });
    }

    /**
     * Get webhook statistics
     */
    async getWebhookStats(userId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT 
                    we.id,
                    we.url,
                    we.success_count,
                    we.failure_count,
                    we.last_triggered,
                    COUNT(wd.id) as total_deliveries,
                    SUM(CASE WHEN wd.status = 'delivered' THEN 1 ELSE 0 END) as successful_deliveries
                 FROM webhook_endpoints we
                 LEFT JOIN webhook_deliveries wd ON we.id = wd.webhook_id
                 WHERE we.user_id = ?
                 GROUP BY we.id`,
                [userId],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows || []);
                    }
                }
            );
        });
    }

    /**
     * Close database connection
     */
    close() {
        if (this.db) {
            this.db.close();
        }
    }
}

module.exports = WebhookService;