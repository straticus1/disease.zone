const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const platformConfig = require('../config/platformConfig');

/**
 * License Validation Pricing Service
 * 
 * Manages subscription tiers and usage tracking for the license validation service
 * Based on research showing most APIs are free, pricing focuses on value-added features
 */
class LicenseValidationPricingService {
    constructor() {
        this.dbPath = path.join(__dirname, '../data/license_subscriptions.db');
        
        // Get subscription tier definitions from platform config
        this.subscriptionTiers = platformConfig.getAllTiers('licenseValidationTiers');

        this.initializeDatabase();
    }

    /**
     * Initialize database for subscription and usage tracking
     */
    initializeDatabase() {
        // Ensure data directory exists
        const dataDir = path.dirname(this.dbPath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        this.db = new sqlite3.Database(this.dbPath);
        
        this.db.serialize(() => {
            // User subscriptions table
            this.db.run(`
                CREATE TABLE IF NOT EXISTS user_subscriptions (
                    user_id TEXT PRIMARY KEY,
                    tier TEXT NOT NULL DEFAULT 'free',
                    status TEXT NOT NULL DEFAULT 'active',
                    current_period_start INTEGER NOT NULL,
                    current_period_end INTEGER NOT NULL,
                    stripe_customer_id TEXT,
                    stripe_subscription_id TEXT,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                )
            `);

            // Usage tracking table
            this.db.run(`
                CREATE TABLE IF NOT EXISTS usage_tracking (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    action_type TEXT NOT NULL,
                    search_query TEXT,
                    results_count INTEGER DEFAULT 0,
                    timestamp INTEGER NOT NULL,
                    reset_period TEXT NOT NULL,
                    FOREIGN KEY(user_id) REFERENCES user_subscriptions(user_id)
                )
            `);

            // Usage summaries for quick lookups
            this.db.run(`
                CREATE TABLE IF NOT EXISTS usage_summaries (
                    user_id TEXT NOT NULL,
                    period_type TEXT NOT NULL,
                    period_start INTEGER NOT NULL,
                    searches_used INTEGER DEFAULT 0,
                    api_calls_used INTEGER DEFAULT 0,
                    last_updated INTEGER NOT NULL,
                    PRIMARY KEY(user_id, period_type, period_start)
                )
            `);

            // Payment history
            this.db.run(`
                CREATE TABLE IF NOT EXISTS payment_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    stripe_payment_intent_id TEXT,
                    amount INTEGER NOT NULL,
                    currency TEXT DEFAULT 'usd',
                    status TEXT NOT NULL,
                    tier TEXT NOT NULL,
                    billing_period TEXT NOT NULL,
                    created_at INTEGER NOT NULL
                )
            `);
        });
    }

    /**
     * Get subscription tier information
     * @param {string} tier - Tier name
     * @returns {Object} Tier configuration
     */
    getTierInfo(tier = 'free') {
        return this.subscriptionTiers[tier] || this.subscriptionTiers.free;
    }

    /**
     * Get all available tiers for pricing page
     * @returns {Object} All tier configurations
     */
    getAllTiers() {
        return this.subscriptionTiers;
    }

    /**
     * Get user's current subscription
     * @param {string} userId - User ID
     * @returns {Promise<Object>} User subscription data
     */
    async getUserSubscription(userId) {
        return new Promise((resolve) => {
            this.db.get(
                'SELECT * FROM user_subscriptions WHERE user_id = ?',
                [userId],
                (err, row) => {
                    if (err) {
                        console.error('Error fetching subscription:', err);
                        resolve(this.createDefaultSubscription(userId));
                    } else if (!row) {
                        // Create default free subscription
                        this.createUserSubscription(userId, 'free').then(resolve);
                    } else {
                        // Check if subscription is expired
                        if (row.current_period_end < Date.now()) {
                            row.status = 'expired';
                            row.tier = 'free';
                        }
                        resolve(row);
                    }
                }
            );
        });
    }

    /**
     * Create new user subscription
     * @param {string} userId - User ID
     * @param {string} tier - Subscription tier
     * @returns {Promise<Object>} Created subscription
     */
    async createUserSubscription(userId, tier = 'free') {
        const now = Date.now();
        const subscription = {
            user_id: userId,
            tier: tier,
            status: 'active',
            current_period_start: now,
            current_period_end: now + (30 * 24 * 60 * 60 * 1000), // 30 days
            created_at: now,
            updated_at: now
        };

        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT OR REPLACE INTO user_subscriptions 
                 (user_id, tier, status, current_period_start, current_period_end, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                Object.values(subscription),
                function(err) {
                    if (err) reject(err);
                    else resolve(subscription);
                }
            );
        });
    }

    /**
     * Update user subscription tier
     * @param {string} userId - User ID
     * @param {string} newTier - New subscription tier
     * @param {Object} paymentData - Payment information
     * @returns {Promise<Object>} Updated subscription
     */
    async updateUserSubscription(userId, newTier, paymentData = {}) {
        const now = Date.now();
        const tierInfo = this.getTierInfo(newTier);
        
        // Calculate new period end based on billing cycle
        const billingPeriod = paymentData.billingPeriod || 'monthly';
        const periodLength = billingPeriod === 'annual' ? 365 : 30;
        const newPeriodEnd = now + (periodLength * 24 * 60 * 60 * 1000);

        return new Promise((resolve, reject) => {
            this.db.run(
                `UPDATE user_subscriptions 
                 SET tier = ?, status = 'active', current_period_start = ?, current_period_end = ?,
                     stripe_customer_id = COALESCE(?, stripe_customer_id),
                     stripe_subscription_id = COALESCE(?, stripe_subscription_id),
                     updated_at = ?
                 WHERE user_id = ?`,
                [
                    newTier, now, newPeriodEnd,
                    paymentData.stripe_customer_id,
                    paymentData.stripe_subscription_id,
                    now, userId
                ],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        // Record payment if applicable
                        if (paymentData.amount && paymentData.amount > 0) {
                            this.recordPayment(userId, newTier, paymentData);
                        }
                        
                        resolve({
                            user_id: userId,
                            tier: newTier,
                            status: 'active',
                            current_period_start: now,
                            current_period_end: newPeriodEnd,
                            updated_at: now
                        });
                    }
                }.bind(this)
            );
        });
    }

    /**
     * Check if user can perform an action based on their tier limits
     * @param {string} userId - User ID
     * @param {string} actionType - Type of action ('search', 'api_call', etc.)
     * @returns {Promise<Object>} Usage check result
     */
    async checkUsageLimit(userId, actionType = 'search') {
        try {
            const subscription = await this.getUserSubscription(userId);
            const tierInfo = this.getTierInfo(subscription.tier);
            const usage = await this.getCurrentUsage(userId);

            const result = {
                allowed: true,
                tier: subscription.tier,
                usage: usage,
                limits: tierInfo.features,
                remaining: {},
                resetTime: null
            };

            // Check daily limits
            if (actionType === 'search') {
                const dailyLimit = tierInfo.dailySearchLimit;
                if (dailyLimit !== 'unlimited') {
                    const used = usage.daily_searches || 0;
                    result.remaining.daily = Math.max(0, dailyLimit - used);
                    result.allowed = used < dailyLimit;
                    
                    if (!result.allowed) {
                        result.error = 'Daily search limit exceeded';
                        result.upgradeMessage = this.getUpgradeMessage(subscription.tier);
                    }
                }
            }

            // Check API call limits for premium/hospital/enterprise
            if (actionType === 'api_call' && subscription.tier !== 'free') {
                let monthlyLimit;
                switch (subscription.tier) {
                    case 'premium':
                        monthlyLimit = 1000;
                        break;
                    case 'hospital':
                        monthlyLimit = 5000;
                        break;
                    case 'enterprise':
                        monthlyLimit = 'unlimited';
                        break;
                    default:
                        monthlyLimit = 0;
                }
                
                if (monthlyLimit !== 'unlimited') {
                    const used = usage.monthly_api_calls || 0;
                    result.remaining.monthly_api = Math.max(0, monthlyLimit - used);
                    
                    if (used >= monthlyLimit) {
                        result.allowed = false;
                        result.error = 'Monthly API limit exceeded';
                    }
                }
            }

            // Check bulk verification access for hospital tier
            if (actionType === 'bulk_verification' && !tierInfo.features.bulkVerificationTools) {
                result.allowed = false;
                result.error = 'Bulk verification not available in your tier';
                result.upgradeMessage = 'Upgrade to Hospital tier for bulk verification tools';
            }

            // Check compliance reporting access
            if (actionType === 'compliance_reporting' && !tierInfo.features.automatedComplianceReporting) {
                result.allowed = false;
                result.error = 'Compliance reporting not available in your tier';
                result.upgradeMessage = 'Upgrade to Hospital tier for automated compliance reporting';
            }

            return result;

        } catch (error) {
            console.error('Usage check error:', error);
            return {
                allowed: false,
                error: 'Unable to verify usage limits'
            };
        }
    }

    /**
     * Record usage for a user
     * @param {string} userId - User ID
     * @param {string} actionType - Type of action
     * @param {Object} metadata - Additional metadata
     * @returns {Promise<void>}
     */
    async recordUsage(userId, actionType, metadata = {}) {
        const now = Date.now();
        
        return new Promise((resolve) => {
            // Record detailed usage
            this.db.run(
                'INSERT INTO usage_tracking (user_id, action_type, search_query, results_count, timestamp, reset_period) VALUES (?, ?, ?, ?, ?, ?)',
                [
                    userId,
                    actionType,
                    metadata.searchQuery || null,
                    metadata.resultsCount || 0,
                    now,
                    'daily'
                ],
                () => {
                    // Update usage summaries
                    this.updateUsageSummaries(userId, actionType, now);
                    resolve();
                }
            );
        });
    }

    /**
     * Get current usage for a user
     * @param {string} userId - User ID
     * @returns {Promise<Object>} Usage statistics
     */
    async getCurrentUsage(userId) {
        const now = Date.now();
        const dayStart = now - (now % (24 * 60 * 60 * 1000));
        const monthStart = new Date(new Date(now).setDate(1)).getTime();

        return new Promise((resolve) => {
            // Get daily usage
            this.db.get(
                'SELECT COUNT(*) as daily_searches FROM usage_tracking WHERE user_id = ? AND action_type = "search" AND timestamp >= ?',
                [userId, dayStart],
                (err, dailyRow) => {
                    if (err) {
                        resolve({ daily_searches: 0, monthly_api_calls: 0 });
                        return;
                    }

                    // Get monthly API calls
                    this.db.get(
                        'SELECT COUNT(*) as monthly_api_calls FROM usage_tracking WHERE user_id = ? AND action_type = "api_call" AND timestamp >= ?',
                        [userId, monthStart],
                        (err, monthlyRow) => {
                            resolve({
                                daily_searches: dailyRow?.daily_searches || 0,
                                monthly_api_calls: monthlyRow?.monthly_api_calls || 0,
                                reset_daily: dayStart + (24 * 60 * 60 * 1000),
                                reset_monthly: new Date(new Date(monthStart).setMonth(new Date(monthStart).getMonth() + 1)).getTime()
                            });
                        }
                    );
                }
            );
        });
    }

    /**
     * Update usage summaries for quick lookups
     */
    async updateUsageSummaries(userId, actionType, timestamp) {
        const dayStart = timestamp - (timestamp % (24 * 60 * 60 * 1000));
        const monthStart = new Date(new Date(timestamp).setDate(1)).getTime();

        const periods = [
            { type: 'daily', start: dayStart },
            { type: 'monthly', start: monthStart }
        ];

        for (const period of periods) {
            const field = actionType === 'search' ? 'searches_used' : 'api_calls_used';
            
            this.db.run(
                `INSERT OR REPLACE INTO usage_summaries 
                 (user_id, period_type, period_start, ${field}, last_updated)
                 VALUES (?, ?, ?, COALESCE((SELECT ${field} FROM usage_summaries WHERE user_id = ? AND period_type = ? AND period_start = ?), 0) + 1, ?)`,
                [userId, period.type, period.start, userId, period.type, period.start, timestamp]
            );
        }
    }

    /**
     * Record payment transaction
     */
    async recordPayment(userId, tier, paymentData) {
        const tierInfo = this.getTierInfo(tier);
        const amount = paymentData.billingPeriod === 'annual' ? tierInfo.annual_price : tierInfo.monthly_price;

        return new Promise((resolve) => {
            this.db.run(
                'INSERT INTO payment_history (user_id, stripe_payment_intent_id, amount, currency, status, tier, billing_period, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    userId,
                    paymentData.stripe_payment_intent_id,
                    Math.round(amount * 100), // Store in cents
                    paymentData.currency || 'usd',
                    paymentData.status || 'succeeded',
                    tier,
                    paymentData.billingPeriod || 'monthly',
                    Date.now()
                ],
                resolve
            );
        });
    }

    /**
     * Get upgrade message based on current tier
     */
    getUpgradeMessage(currentTier) {
        const messages = {
            free: 'Upgrade to Premium ($14.99/month) for 250 daily searches and violation history access.',
            premium: 'Upgrade to Hospital ($29.99/month) for bulk verification tools and compliance reporting.',
            hospital: 'Upgrade to Enterprise ($69.99/month) for unlimited searches and dedicated support.',
            enterprise: 'You are on the highest tier available.'
        };

        return messages[currentTier] || messages.free;
    }

    /**
     * Get pricing page data
     */
    getPricingPageData() {
        return {
            tiers: this.subscriptionTiers,
            features: {
                basic_license_lookup: 'Basic license verification and status checking',
                provider_search: 'Search providers by name, state, and license number',
                license_status: 'Current license status and expiration dates',
                state_board_links: 'Direct links to official state board verification',
                violation_count: 'Number of disciplinary actions and violations',
                violation_details: 'Detailed violation descriptions and board actions',
                bulk_export: 'Export search results and violation data',
                api_access: 'Programmatic access via REST API',
                priority_support: 'Priority customer support',
                historical_data: 'Access to historical license and violation data',
                custom_reports: 'Custom reporting and analytics',
                white_label: 'White-label integration options'
            },
            comparison: this.getFeatureComparison()
        };
    }

    /**
     * Get feature comparison matrix
     */
    getFeatureComparison() {
        const features = Object.keys(this.subscriptionTiers.enterprise.features);
        const comparison = {};

        features.forEach(feature => {
            comparison[feature] = {
                free: this.subscriptionTiers.free.features[feature],
                premium: this.subscriptionTiers.premium.features[feature],
                enterprise: this.subscriptionTiers.enterprise.features[feature]
            };
        });

        return comparison;
    }

    /**
     * Create default subscription for new users
     */
    createDefaultSubscription(userId) {
        const now = Date.now();
        return {
            user_id: userId,
            tier: 'free',
            status: 'active',
            current_period_start: now,
            current_period_end: now + (30 * 24 * 60 * 60 * 1000),
            created_at: now,
            updated_at: now
        };
    }

    /**
     * Get subscription analytics
     */
    async getSubscriptionAnalytics() {
        return new Promise((resolve) => {
            this.db.all(
                `SELECT 
                    tier,
                    status,
                    COUNT(*) as user_count,
                    AVG(CASE WHEN status = 'active' THEN current_period_end - current_period_start ELSE 0 END) as avg_period_length
                 FROM user_subscriptions 
                 GROUP BY tier, status`,
                (err, rows) => {
                    if (err) {
                        console.error('Analytics query error:', err);
                        resolve([]);
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

module.exports = LicenseValidationPricingService;