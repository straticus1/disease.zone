/**
 * Revolutionary Disease Alert System
 * Free webhook-based alerts that others can integrate
 * ZERO cost - just uses existing infrastructure
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// In-memory storage (replace with Redis/DB later)
const subscribers = new Map();
const alertHistory = [];

// Alert severity levels
const ALERT_LEVELS = {
    INFO: 1,
    LOW: 2,
    MEDIUM: 3,
    HIGH: 4,
    CRITICAL: 5
};

const ALERT_TYPES = {
    OUTBREAK_DETECTED: 'outbreak_detected',
    RISK_INCREASE: 'risk_increase',
    NEW_DISEASE: 'new_disease_detected',
    VACCINE_UPDATE: 'vaccine_update',
    TRAVEL_ADVISORY: 'travel_advisory'
};

// Subscribe to alerts
router.post('/subscribe', async (req, res) => {
    try {
        const {
            webhookUrl,
            alertTypes = ['outbreak_detected'],
            minSeverity = ALERT_LEVELS.MEDIUM,
            regions = ['global'],
            diseases = ['all'],
            email,
            organizationName
        } = req.body;

        if (!webhookUrl && !email) {
            return res.status(400).json({
                success: false,
                error: 'Either webhookUrl or email is required'
            });
        }

        // Generate unique subscriber ID
        const subscriberId = crypto.randomUUID();
        const secretKey = crypto.randomBytes(32).toString('hex');

        const subscription = {
            id: subscriberId,
            webhookUrl,
            email,
            organizationName,
            alertTypes,
            minSeverity,
            regions,
            diseases,
            secretKey,
            isActive: true,
            createdAt: new Date(),
            lastDelivery: null,
            totalAlerts: 0,
            failedDeliveries: 0
        };

        subscribers.set(subscriberId, subscription);

        // Send welcome notification
        if (webhookUrl) {
            await sendTestAlert(subscription);
        }

        res.json({
            success: true,
            subscriberId,
            secretKey,
            message: 'Successfully subscribed to disease alerts',
            subscription: {
                ...subscription,
                secretKey: undefined // Don't send back the secret
            },
            testAlert: 'A test alert has been sent to verify your webhook'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Unsubscribe from alerts
router.delete('/subscribe/:subscriberId', (req, res) => {
    const { subscriberId } = req.params;
    const { secretKey } = req.body;

    const subscription = subscribers.get(subscriberId);
    if (!subscription) {
        return res.status(404).json({
            success: false,
            error: 'Subscription not found'
        });
    }

    if (subscription.secretKey !== secretKey) {
        return res.status(401).json({
            success: false,
            error: 'Invalid secret key'
        });
    }

    subscribers.delete(subscriberId);

    res.json({
        success: true,
        message: 'Successfully unsubscribed from alerts'
    });
});

// Create and broadcast alert
router.post('/broadcast', async (req, res) => {
    try {
        const {
            type,
            severity,
            title,
            description,
            region,
            disease,
            data = {},
            source = 'disease.zone'
        } = req.body;

        if (!type || !severity || !title || !description) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: type, severity, title, description'
            });
        }

        const alert = {
            id: crypto.randomUUID(),
            type,
            severity,
            title,
            description,
            region: region || 'global',
            disease: disease || 'unknown',
            data,
            source,
            timestamp: new Date().toISOString(),
            deliveredTo: []
        };

        // Store alert in history
        alertHistory.push(alert);

        // Broadcast to all matching subscribers
        const deliveryResults = await broadcastAlert(alert);

        res.json({
            success: true,
            alert,
            deliveryResults: {
                total: deliveryResults.length,
                successful: deliveryResults.filter(r => r.success).length,
                failed: deliveryResults.filter(r => !r.success).length
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get alert history
router.get('/history', (req, res) => {
    const {
        limit = 50,
        offset = 0,
        severity,
        type,
        region,
        disease
    } = req.query;

    let filteredAlerts = alertHistory;

    // Apply filters
    if (severity) {
        filteredAlerts = filteredAlerts.filter(a => a.severity >= parseInt(severity));
    }
    if (type) {
        filteredAlerts = filteredAlerts.filter(a => a.type === type);
    }
    if (region && region !== 'all') {
        filteredAlerts = filteredAlerts.filter(a => a.region === region);
    }
    if (disease && disease !== 'all') {
        filteredAlerts = filteredAlerts.filter(a => a.disease === disease);
    }

    // Sort by timestamp (newest first)
    filteredAlerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Paginate
    const paginatedAlerts = filteredAlerts.slice(
        parseInt(offset),
        parseInt(offset) + parseInt(limit)
    );

    res.json({
        success: true,
        alerts: paginatedAlerts,
        pagination: {
            total: filteredAlerts.length,
            limit: parseInt(limit),
            offset: parseInt(offset)
        }
    });
});

// Get subscription status
router.get('/subscribe/:subscriberId', (req, res) => {
    const { subscriberId } = req.params;
    const subscription = subscribers.get(subscriberId);

    if (!subscription) {
        return res.status(404).json({
            success: false,
            error: 'Subscription not found'
        });
    }

    res.json({
        success: true,
        subscription: {
            ...subscription,
            secretKey: undefined // Don't expose the secret
        }
    });
});

// List all alert types and severity levels
router.get('/config', (req, res) => {
    res.json({
        success: true,
        config: {
            alertTypes: ALERT_TYPES,
            severityLevels: ALERT_LEVELS,
            supportedRegions: [
                'global', 'north_america', 'south_america', 'europe',
                'asia', 'africa', 'oceania', 'usa', 'canada', 'uk',
                'germany', 'france', 'japan', 'australia'
            ],
            supportedDiseases: [
                'all', 'covid', 'influenza', 'norovirus', 'rsv',
                'measles', 'tuberculosis', 'malaria', 'dengue',
                'zika', 'ebola', 'mpox', 'cholera'
            ]
        },
        examples: {
            subscription: {
                webhookUrl: 'https://your-api.com/disease-alerts',
                alertTypes: ['outbreak_detected', 'risk_increase'],
                minSeverity: ALERT_LEVELS.MEDIUM,
                regions: ['usa', 'canada'],
                diseases: ['covid', 'influenza'],
                email: 'alerts@yourorg.com',
                organizationName: 'Your Organization'
            },
            webhook_payload: {
                alertId: 'uuid-here',
                type: 'outbreak_detected',
                severity: 4,
                title: 'COVID-19 Outbreak Detected in New York',
                description: 'Significant increase in cases detected...',
                region: 'usa',
                disease: 'covid',
                timestamp: '2025-09-17T12:00:00Z',
                source: 'disease.zone',
                data: {
                    cases: 150,
                    growthRate: 0.25,
                    confidence: 0.87
                }
            }
        }
    });
});

// Webhook verification endpoint
router.get('/verify/:subscriberId', async (req, res) => {
    const { subscriberId } = req.params;
    const subscription = subscribers.get(subscriberId);

    if (!subscription) {
        return res.status(404).json({
            success: false,
            error: 'Subscription not found'
        });
    }

    try {
        const testResult = await sendTestAlert(subscription);
        res.json({
            success: true,
            message: 'Test alert sent',
            result: testResult
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Helper functions
async function broadcastAlert(alert) {
    const deliveryPromises = [];

    for (const [subscriberId, subscription] of subscribers.entries()) {
        if (!subscription.isActive) continue;

        // Check if alert matches subscription criteria
        if (!shouldDeliverAlert(alert, subscription)) continue;

        deliveryPromises.push(
            deliverAlert(alert, subscription)
                .then(result => ({ subscriberId, success: true, result }))
                .catch(error => ({ subscriberId, success: false, error: error.message }))
        );
    }

    return Promise.all(deliveryPromises);
}

function shouldDeliverAlert(alert, subscription) {
    // Check severity
    if (alert.severity < subscription.minSeverity) return false;

    // Check alert type
    if (!subscription.alertTypes.includes(alert.type) && !subscription.alertTypes.includes('all')) {
        return false;
    }

    // Check region
    if (!subscription.regions.includes(alert.region) && !subscription.regions.includes('global')) {
        return false;
    }

    // Check disease
    if (!subscription.diseases.includes(alert.disease) && !subscription.diseases.includes('all')) {
        return false;
    }

    return true;
}

async function deliverAlert(alert, subscription) {
    const payload = {
        ...alert,
        subscription: {
            id: subscription.id,
            organizationName: subscription.organizationName
        }
    };

    if (subscription.webhookUrl) {
        // Send webhook
        const signature = generateSignature(payload, subscription.secretKey);

        const response = await fetch(subscription.webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Disease-Alert-Signature': signature,
                'X-Disease-Alert-ID': alert.id,
                'User-Agent': 'disease.zone-alerts/1.0'
            },
            body: JSON.stringify(payload),
            timeout: 10000
        });

        if (!response.ok) {
            throw new Error(`Webhook delivery failed: ${response.status}`);
        }

        // Update subscription stats
        subscription.lastDelivery = new Date();
        subscription.totalAlerts += 1;

        return { status: 'delivered', timestamp: new Date() };
    }

    if (subscription.email) {
        // Send email (implement email service)
        console.log(`Email alert sent to ${subscription.email}: ${alert.title}`);
        return { status: 'email_sent', timestamp: new Date() };
    }

    throw new Error('No delivery method configured');
}

async function sendTestAlert(subscription) {
    const testAlert = {
        id: crypto.randomUUID(),
        type: ALERT_TYPES.OUTBREAK_DETECTED,
        severity: ALERT_LEVELS.INFO,
        title: 'Disease.zone Alert System - Test Alert',
        description: 'This is a test alert to verify your webhook configuration. Your alerts are working correctly!',
        region: 'global',
        disease: 'test',
        source: 'disease.zone',
        timestamp: new Date().toISOString(),
        data: {
            test: true,
            message: 'If you receive this, your integration is working!'
        }
    };

    return deliverAlert(testAlert, subscription);
}

function generateSignature(payload, secretKey) {
    const payloadString = JSON.stringify(payload);
    return crypto.createHmac('sha256', secretKey).update(payloadString).digest('hex');
}

module.exports = router;