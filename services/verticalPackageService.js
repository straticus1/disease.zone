/**
 * Vertical Package Service
 * Manages industry-specific bundled packages with combined services
 */

const platformConfig = require('../config/platformConfig');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class VerticalPackageService {
    constructor() {
        this.dbPath = path.join(__dirname, '../data/vertical_packages.db');
        this.packages = platformConfig.get('verticalPackages', {});
        this.initializeDatabase();
    }

    /**
     * Initialize database for package subscriptions
     */
    initializeDatabase() {
        const dataDir = path.dirname(this.dbPath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        this.db = new sqlite3.Database(this.dbPath);
        
        this.db.serialize(() => {
            // Package subscriptions table
            this.db.run(`
                CREATE TABLE IF NOT EXISTS package_subscriptions (
                    user_id TEXT PRIMARY KEY,
                    package_name TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'active',
                    current_period_start INTEGER NOT NULL,
                    current_period_end INTEGER NOT NULL,
                    features TEXT NOT NULL,
                    limits TEXT NOT NULL,
                    stripe_subscription_id TEXT,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                )
            `);

            // Package usage tracking
            this.db.run(`
                CREATE TABLE IF NOT EXISTS package_usage (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    package_name TEXT NOT NULL,
                    service_type TEXT NOT NULL,
                    action_type TEXT NOT NULL,
                    usage_count INTEGER DEFAULT 1,
                    timestamp INTEGER NOT NULL,
                    metadata TEXT
                )
            `);

            // Custom package configurations
            this.db.run(`
                CREATE TABLE IF NOT EXISTS custom_packages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    package_name TEXT NOT NULL,
                    custom_features TEXT NOT NULL,
                    custom_limits TEXT NOT NULL,
                    custom_price REAL NOT NULL,
                    status TEXT DEFAULT 'pending',
                    created_at INTEGER NOT NULL,
                    approved_at INTEGER,
                    approved_by TEXT
                )
            `);
        });
    }

    /**
     * Get all available packages
     */
    getAvailablePackages() {
        return this.packages;
    }

    /**
     * Get specific package configuration
     */
    getPackage(packageName) {
        return this.packages[packageName] || null;
    }

    /**
     * Subscribe user to a vertical package
     */
    async subscribeToPackage(userId, packageName, paymentData = {}) {
        const packageConfig = this.getPackage(packageName);
        if (!packageConfig) {
            throw new Error(`Package ${packageName} not found`);
        }

        const now = Date.now();
        const subscription = {
            user_id: userId,
            package_name: packageName,
            status: 'active',
            current_period_start: now,
            current_period_end: now + (30 * 24 * 60 * 60 * 1000), // 30 days
            features: JSON.stringify(packageConfig.features),
            limits: JSON.stringify(packageConfig.limits),
            stripe_subscription_id: paymentData.stripe_subscription_id || null,
            created_at: now,
            updated_at: now
        };

        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT OR REPLACE INTO package_subscriptions 
                 (user_id, package_name, status, current_period_start, current_period_end, 
                  features, limits, stripe_subscription_id, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                Object.values(subscription),
                function(err) {
                    if (err) reject(err);
                    else resolve(subscription);
                }
            );
        });
    }

    /**
     * Get user's package subscription
     */
    async getUserPackageSubscription(userId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM package_subscriptions WHERE user_id = ? AND status = "active"',
                [userId],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else if (row) {
                        // Parse JSON fields
                        row.features = JSON.parse(row.features || '{}');
                        row.limits = JSON.parse(row.limits || '{}');
                        resolve(row);
                    } else {
                        resolve(null);
                    }
                }
            );
        });
    }

    /**
     * Check if user has access to a specific service
     */
    async checkServiceAccess(userId, serviceType, featureName) {
        try {
            const subscription = await this.getUserPackageSubscription(userId);
            
            if (!subscription) {
                return {
                    hasAccess: false,
                    reason: 'No active package subscription'
                };
            }

            const packageConfig = this.getPackage(subscription.package_name);
            if (!packageConfig) {
                return {
                    hasAccess: false,
                    reason: 'Package configuration not found'
                };
            }

            // Check if service is included in package
            if (!packageConfig.includes.includes(serviceType)) {
                return {
                    hasAccess: false,
                    reason: `Service ${serviceType} not included in ${subscription.package_name} package`
                };
            }

            // Check specific feature access
            if (featureName && !subscription.features[featureName]) {
                return {
                    hasAccess: false,
                    reason: `Feature ${featureName} not available in current package`
                };
            }

            return {
                hasAccess: true,
                subscription: subscription,
                packageConfig: packageConfig
            };

        } catch (error) {
            console.error('Service access check error:', error);
            return {
                hasAccess: false,
                reason: 'Error checking service access'
            };
        }
    }

    /**
     * Record package usage
     */
    async recordPackageUsage(userId, serviceType, actionType, metadata = {}) {
        const now = Date.now();
        
        return new Promise((resolve) => {
            this.db.run(
                'INSERT INTO package_usage (user_id, package_name, service_type, action_type, usage_count, timestamp, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [
                    userId,
                    metadata.packageName || 'unknown',
                    serviceType,
                    actionType,
                    metadata.usageCount || 1,
                    now,
                    JSON.stringify(metadata)
                ],
                resolve
            );
        });
    }

    /**
     * Get package usage analytics
     */
    async getPackageUsageAnalytics(userId, timeRange = '30_days') {
        const now = Date.now();
        let timeFilter;
        
        switch (timeRange) {
            case '7_days':
                timeFilter = now - (7 * 24 * 60 * 60 * 1000);
                break;
            case '30_days':
                timeFilter = now - (30 * 24 * 60 * 60 * 1000);
                break;
            case '90_days':
                timeFilter = now - (90 * 24 * 60 * 60 * 1000);
                break;
            default:
                timeFilter = now - (30 * 24 * 60 * 60 * 1000);
        }

        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT 
                    service_type,
                    action_type,
                    COUNT(*) as usage_count,
                    SUM(usage_count) as total_usage,
                    MIN(timestamp) as first_used,
                    MAX(timestamp) as last_used
                 FROM package_usage 
                 WHERE user_id = ? AND timestamp >= ?
                 GROUP BY service_type, action_type
                 ORDER BY total_usage DESC`,
                [userId, timeFilter],
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
     * Hospital Systems Package specific methods
     */
    async getHospitalSystemsAccess(userId) {
        const access = await this.checkServiceAccess(userId, 'epic_integration', 'epicIntegration');
        
        if (!access.hasAccess) {
            return access;
        }

        return {
            ...access,
            epicIntegration: access.subscription.features.epicIntegration,
            licenseValidation: access.subscription.features.licenseValidation,
            healthAssessments: access.subscription.features.healthAssessments,
            maxUsers: access.subscription.limits.users,
            maxApiCalls: access.subscription.limits.apiCalls
        };
    }

    /**
     * Insurance Company Package specific methods
     */
    async getInsuranceCompanyAccess(userId) {
        const access = await this.checkServiceAccess(userId, 'risk_assessment_api', 'riskAssessmentApi');
        
        if (!access.hasAccess) {
            return access;
        }

        return {
            ...access,
            riskAssessmentApi: access.subscription.features.riskAssessmentApi,
            claimsValidation: access.subscription.features.claimsValidation,
            providerVerification: access.subscription.features.providerVerification,
            fraudDetection: access.subscription.features.fraudDetectionAlgorithms,
            maxApiCalls: access.subscription.limits.apiCalls,
            dataRetention: access.subscription.limits.dataRetention
        };
    }

    /**
     * Telemedicine Platform Package specific methods
     */
    async getTelemedicinePlatformAccess(userId) {
        const access = await this.checkServiceAccess(userId, 'provider_verification', 'providerVerification');
        
        if (!access.hasAccess) {
            return access;
        }

        return {
            ...access,
            providerVerification: access.subscription.features.providerVerification,
            patientHealthAssessments: access.subscription.features.patientHealthAssessments,
            epicIntegration: access.subscription.features.epicIntegration,
            maxProviders: access.subscription.limits.providers,
            maxPatients: access.subscription.limits.patients,
            maxApiCalls: access.subscription.limits.apiCalls
        };
    }

    /**
     * Request custom package configuration
     */
    async requestCustomPackage(userId, packageName, customFeatures, customLimits, customPrice, requestedBy) {
        const now = Date.now();
        
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO custom_packages (user_id, package_name, custom_features, custom_limits, custom_price, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [
                    userId,
                    packageName,
                    JSON.stringify(customFeatures),
                    JSON.stringify(customLimits),
                    customPrice,
                    'pending',
                    now
                ],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({
                            id: this.lastID,
                            status: 'pending',
                            message: 'Custom package request submitted for review'
                        });
                    }
                }
            );
        });
    }

    /**
     * Get package pricing calculator
     */
    getPackagePricingCalculator(packageName, customizations = {}) {
        const basePackage = this.getPackage(packageName);
        if (!basePackage) {
            return null;
        }

        let calculatedPrice = basePackage.price;
        const breakdown = {
            basePrice: basePackage.price,
            customizations: [],
            totalPrice: basePackage.price
        };

        // Calculate additional costs for customizations
        if (customizations.additionalUsers) {
            const additionalUserCost = customizations.additionalUsers * 5; // $5 per additional user
            calculatedPrice += additionalUserCost;
            breakdown.customizations.push({
                item: 'Additional Users',
                quantity: customizations.additionalUsers,
                unitPrice: 5,
                totalCost: additionalUserCost
            });
        }

        if (customizations.additionalApiCalls) {
            const additionalApiCost = Math.ceil(customizations.additionalApiCalls / 10000) * 10; // $10 per 10K additional calls
            calculatedPrice += additionalApiCost;
            breakdown.customizations.push({
                item: 'Additional API Calls',
                quantity: customizations.additionalApiCalls,
                unitPrice: 0.001,
                totalCost: additionalApiCost
            });
        }

        if (customizations.extendedDataRetention) {
            const retentionCost = 25; // $25 for extended retention
            calculatedPrice += retentionCost;
            breakdown.customizations.push({
                item: 'Extended Data Retention',
                quantity: 1,
                unitPrice: 25,
                totalCost: retentionCost
            });
        }

        breakdown.totalPrice = calculatedPrice;
        
        return {
            packageName: packageName,
            basePackage: basePackage,
            customizations: customizations,
            pricing: breakdown,
            monthlyPrice: calculatedPrice,
            annualPrice: calculatedPrice * 10, // 2 months free on annual
            savings: calculatedPrice * 2
        };
    }

    /**
     * Get package comparison matrix
     */
    getPackageComparison() {
        const comparison = {};
        
        for (const [packageName, config] of Object.entries(this.packages)) {
            comparison[packageName] = {
                name: config.name,
                price: config.price,
                description: config.description,
                includes: config.includes,
                keyFeatures: Object.keys(config.features).filter(key => config.features[key] === true || config.features[key] !== false),
                limits: config.limits,
                targetAudience: this.getTargetAudience(packageName)
            };
        }
        
        return comparison;
    }

    /**
     * Get target audience for package
     */
    getTargetAudience(packageName) {
        const audiences = {
            hospitalSystems: 'Large healthcare organizations with 100+ providers',
            insuranceCompany: 'Health insurance providers and managed care organizations',
            telemedicinePlatform: 'Telehealth platforms and virtual care providers'
        };
        
        return audiences[packageName] || 'Enterprise customers';
    }

    /**
     * Generate package recommendation based on usage patterns
     */
    async generatePackageRecommendation(userId, currentServices = []) {
        try {
            const usageAnalytics = await this.getPackageUsageAnalytics(userId, '30_days');
            const recommendations = [];

            // Analyze usage patterns
            const serviceUsage = {};
            usageAnalytics.forEach(usage => {
                serviceUsage[usage.service_type] = (serviceUsage[usage.service_type] || 0) + usage.total_usage;
            });

            // Hospital Systems Package recommendation
            if (serviceUsage.epic_integration > 50 && serviceUsage.license_validation > 100) {
                recommendations.push({
                    package: 'hospitalSystems',
                    confidence: 0.85,
                    reasoning: 'High Epic integration and license validation usage indicates hospital system needs',
                    potentialSavings: this.calculatePotentialSavings(currentServices, 'hospitalSystems')
                });
            }

            // Insurance Company Package recommendation
            if (serviceUsage.risk_assessment_api > 200 && serviceUsage.claims_validation > 50) {
                recommendations.push({
                    package: 'insuranceCompany',
                    confidence: 0.90,
                    reasoning: 'Heavy risk assessment and claims validation usage suggests insurance company use case',
                    potentialSavings: this.calculatePotentialSavings(currentServices, 'insuranceCompany')
                });
            }

            // Telemedicine Platform recommendation
            if (serviceUsage.provider_verification > 30 && serviceUsage.patient_health_assessments > 100) {
                recommendations.push({
                    package: 'telemedicinePlatform',
                    confidence: 0.80,
                    reasoning: 'Provider verification and patient assessment patterns match telemedicine needs',
                    potentialSavings: this.calculatePotentialSavings(currentServices, 'telemedicinePlatform')
                });
            }

            return recommendations.sort((a, b) => b.confidence - a.confidence);

        } catch (error) {
            console.error('Package recommendation error:', error);
            return [];
        }
    }

    /**
     * Calculate potential savings from package vs individual services
     */
    calculatePotentialSavings(currentServices, packageName) {
        const packageConfig = this.getPackage(packageName);
        if (!packageConfig) return 0;

        // Simplified calculation - in production, use actual service pricing
        const individualCosts = {
            epic_integration: 99,
            license_validation: 69.99,
            health_assessments: 49.99,
            risk_assessment_api: 199,
            claims_validation: 149,
            provider_verification: 29.99
        };

        let currentCost = 0;
        packageConfig.includes.forEach(service => {
            if (currentServices.includes(service)) {
                currentCost += individualCosts[service] || 0;
            }
        });

        return Math.max(0, currentCost - packageConfig.price);
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

module.exports = VerticalPackageService;