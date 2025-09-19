/**
 * Disease.Zone Platform Configuration System
 * Centralized configuration for all platform features, pricing, and services
 */

const fs = require('fs');
const path = require('path');

class PlatformConfig {
    constructor() {
        this.configPath = path.join(__dirname, '../data/platform-config.json');
        this.defaultConfig = {
            version: '2.0.0',
            lastUpdated: new Date().toISOString(),
            
            // Feature flags for gradual rollout
            features: {
                professionalTier: true,
                hospitalTier: true,
                usageBasedPricing: true,
                webhookSystem: true,
                verticalPackages: true,
                internationalSupport: false,
                blockchainAudit: false,
                graphqlApi: false,
                mobileSDK: false,
                aiPredictiveCredentialing: false,
                populationHealthDashboard: true,
                clinicalDecisionSupport: false
            },
            
            // API Pricing Tiers - Enhanced Structure
            apiTiers: {
                free: {
                    name: 'Free',
                    price: 0,
                    requestsPerDay: 1000,
                    requestsPerMinute: 10,
                    features: ['basic_data', 'outbreak_alerts', 'risk_assessment', 'demo_health_assessment', 'sample_lab_translation'],
                    limits: {
                        healthAssessments: 1, // per month
                        labTranslations: 3, // per month
                        epicRecords: 5, // view-only
                        webhooks: 0
                    },
                    overageRate: 0 // No overage for free tier
                },
                
                professional: {
                    name: 'Professional',
                    price: 19.99,
                    requestsPerDay: 15000,
                    requestsPerMinute: 150,
                    features: ['all_basic', 'unlimited_health_assessments', 'unlimited_lab_translation', 'basic_epic_integration', 'priority_alerts', 'monthly_reports'],
                    limits: {
                        healthAssessments: 'unlimited',
                        labTranslations: 'unlimited',
                        epicRecords: 100,
                        webhooks: 10
                    },
                    overageRate: 0.08 // $0.08 per additional 1000 requests
                },
                
                pro: {
                    name: 'Pro',
                    price: 49.99,
                    requestsPerDay: 50000,
                    requestsPerMinute: 500,
                    features: ['all_data', 'outbreak_alerts', 'risk_assessment', 'predictions', 'webhooks', 'priority_support', 'advanced_epic', 'custom_dashboards'],
                    limits: {
                        healthAssessments: 'unlimited',
                        labTranslations: 'unlimited',
                        epicRecords: 'unlimited',
                        webhooks: 50,
                        customReports: 10
                    },
                    overageRate: 0.05 // $0.05 per additional 1000 requests
                },
                
                enterprise: {
                    name: 'Enterprise',
                    price: 499.99,
                    requestsPerDay: 1000000,
                    requestsPerMinute: 10000,
                    features: ['all_data', 'predictions', 'webhooks', 'priority_support', 'custom_integration', 'sla', 'white_label', 'dedicated_support'],
                    limits: {
                        healthAssessments: 'unlimited',
                        labTranslations: 'unlimited',
                        epicRecords: 'unlimited',
                        webhooks: 'unlimited',
                        customReports: 'unlimited'
                    },
                    overageRate: 0.02 // $0.02 per additional 1000 requests
                }
            },
            
            // License Validation Pricing - Enhanced Structure
            licenseValidationTiers: {
                free: {
                    name: 'Free',
                    price: 0,
                    dailySearchLimit: 25,
                    features: {
                        basicLicenseLookup: true,
                        providerSearch: true,
                        licenseStatus: true,
                        stateBoardLinks: true,
                        violationCount: false,
                        violationDetails: false,
                        bulkExport: false,
                        apiAccess: false,
                        prioritySupport: false,
                        historicalData: false,
                        realtimeMonitoring: false,
                        malpracticeVerification: false,
                        boardCertification: false
                    }
                },
                
                premium: {
                    name: 'Premium',
                    price: 14.99,
                    dailySearchLimit: 250,
                    features: {
                        basicLicenseLookup: true,
                        providerSearch: true,
                        licenseStatus: true,
                        stateBoardLinks: true,
                        violationCount: true,
                        violationDetails: true,
                        bulkExport: false,
                        apiAccess: 'limited',
                        prioritySupport: false,
                        historicalData: '2_years',
                        realtimeMonitoring: true,
                        malpracticeVerification: true,
                        boardCertification: true,
                        violationTrendAnalysis: true
                    }
                },
                
                hospital: {
                    name: 'Hospital',
                    price: 29.99,
                    dailySearchLimit: 500,
                    features: {
                        basicLicenseLookup: true,
                        providerSearch: true,
                        licenseStatus: true,
                        stateBoardLinks: true,
                        violationCount: true,
                        violationDetails: true,
                        bulkExport: true,
                        apiAccess: 'standard',
                        prioritySupport: true,
                        historicalData: '5_years',
                        realtimeMonitoring: true,
                        malpracticeVerification: true,
                        boardCertification: true,
                        violationTrendAnalysis: true,
                        bulkVerificationTools: true,
                        multiStateLicenseTracking: true,
                        credentialingSystemIntegration: true,
                        automatedComplianceReporting: true,
                        customViolationAlerts: true
                    }
                },
                
                enterprise: {
                    name: 'Enterprise',
                    price: 69.99,
                    dailySearchLimit: 'unlimited',
                    features: {
                        basicLicenseLookup: true,
                        providerSearch: true,
                        licenseStatus: true,
                        stateBoardLinks: true,
                        violationCount: true,
                        violationDetails: true,
                        bulkExport: true,
                        apiAccess: 'full',
                        prioritySupport: true,
                        historicalData: 'unlimited',
                        realtimeMonitoring: true,
                        malpracticeVerification: true,
                        boardCertification: true,
                        violationTrendAnalysis: true,
                        bulkVerificationTools: true,
                        multiStateLicenseTracking: true,
                        credentialingSystemIntegration: true,
                        automatedComplianceReporting: true,
                        customViolationAlerts: true,
                        whiteLabelApi: true,
                        customSla: true,
                        dedicatedAccountManager: true,
                        customReportingDashboards: true,
                        advancedAnalyticsBenchmarking: true
                    }
                }
            },
            
            // Vertical-Specific Packages
            verticalPackages: {
                hospitalSystems: {
                    name: 'Hospital Systems Package',
                    price: 199.99,
                    description: 'Complete solution for hospital systems',
                    includes: ['epic_integration', 'license_validation', 'health_assessments'],
                    features: {
                        epicIntegration: 'full',
                        licenseValidation: 'hospital_tier',
                        healthAssessments: 'unlimited',
                        customOnboarding: true,
                        trainingIncluded: true,
                        dedicatedSupport: true,
                        complianceReporting: true
                    },
                    limits: {
                        users: 100,
                        apiCalls: 100000,
                        dataRetention: '7_years'
                    }
                },
                
                insuranceCompany: {
                    name: 'Insurance Company Package',
                    price: 299.99,
                    description: 'Risk assessment and provider verification for insurers',
                    includes: ['risk_assessment_api', 'claims_validation', 'provider_verification'],
                    features: {
                        riskAssessmentApi: 'advanced',
                        claimsValidation: true,
                        providerVerification: 'enterprise',
                        actuarialReporting: true,
                        fraudDetectionAlgorithms: true,
                        populationHealthAnalytics: true,
                        networkOptimization: true
                    },
                    limits: {
                        users: 'unlimited',
                        apiCalls: 500000,
                        dataRetention: '10_years'
                    }
                },
                
                telemedicinePlatform: {
                    name: 'Telemedicine Platform Package',
                    price: 149.99,
                    description: 'Provider verification and patient assessment for telehealth',
                    includes: ['provider_verification', 'patient_health_assessments', 'epic_integration'],
                    features: {
                        providerVerification: 'real_time',
                        patientHealthAssessments: 'unlimited',
                        epicIntegration: 'basic',
                        realtimeCredentialingUpdates: true,
                        complianceMonitoringDashboard: true,
                        telemedicineCompliance: true
                    },
                    limits: {
                        providers: 500,
                        patients: 10000,
                        apiCalls: 75000
                    }
                }
            },
            
            // Add-on Services Pricing
            addOnServices: {
                customIntegrations: {
                    name: 'Custom Integrations',
                    priceRange: [2500, 10000],
                    description: 'Custom API integrations and development',
                    includes: ['requirements_analysis', 'development', 'testing', 'deployment', 'documentation']
                },
                
                trainingCertification: {
                    name: 'Training & Certification',
                    courses: {
                        basicPlatformUsage: { price: 199, duration: '4_hours' },
                        advancedAnalytics: { price: 499, duration: '8_hours' },
                        apiIntegration: { price: 299, duration: '6_hours' },
                        complianceManagement: { price: 699, duration: '12_hours' },
                        masterCertification: { price: 999, duration: '16_hours' }
                    }
                },
                
                prioritySupport: {
                    name: 'Priority Support',
                    price: 99,
                    description: 'Enhanced support with faster response times',
                    features: ['2_hour_response', 'dedicated_contact', 'phone_support', 'screen_sharing']
                },
                
                dataExportServices: {
                    name: 'Data Export Services',
                    pricePerThousandRecords: 0.50,
                    formats: ['csv', 'json', 'xml', 'pdf'],
                    features: ['scheduled_exports', 'custom_formatting', 'secure_delivery']
                },
                
                customReports: {
                    name: 'Custom Reports',
                    priceRange: [500, 2500],
                    description: 'Custom analytics and reporting',
                    types: ['compliance_reports', 'trend_analysis', 'risk_assessments', 'performance_metrics']
                }
            },
            
            // Webhook Configuration
            webhooks: {
                enabled: true,
                maxWebhooksPerTier: {
                    free: 0,
                    professional: 10,
                    pro: 50,
                    enterprise: 'unlimited'
                },
                eventTypes: [
                    'license_status_change',
                    'violation_detected',
                    'credential_expiring',
                    'outbreak_alert',
                    'health_assessment_complete',
                    'api_limit_reached',
                    'payment_processed',
                    'subscription_changed'
                ],
                retryPolicy: {
                    maxRetries: 3,
                    backoffMultiplier: 2,
                    initialDelay: 1000
                }
            },
            
            // International Market Configuration
            international: {
                enabled: false,
                supportedCountries: {
                    canada: {
                        enabled: false,
                        licenseValidation: true,
                        healthSystem: 'provincial',
                        currency: 'CAD',
                        taxRate: 0.13
                    },
                    uk: {
                        enabled: false,
                        licenseValidation: true,
                        healthSystem: 'nhs',
                        currency: 'GBP',
                        taxRate: 0.20
                    },
                    australia: {
                        enabled: false,
                        licenseValidation: true,
                        healthSystem: 'ahpra',
                        currency: 'AUD',
                        taxRate: 0.10
                    }
                }
            },
            
            // Rate Limiting Configuration
            rateLimiting: {
                enabled: true,
                algorithms: ['token_bucket', 'sliding_window'],
                burstAllowance: 1.5, // 50% burst above normal limits
                distributedLimiting: true,
                customLimitsPerUser: true
            },
            
            // Analytics and Monitoring
            analytics: {
                enabled: true,
                retention: {
                    apiLogs: '90_days',
                    userActivity: '1_year',
                    billingData: '7_years',
                    complianceAudit: '10_years'
                },
                realTimeMetrics: true,
                customDashboards: true,
                alerting: {
                    enabled: true,
                    channels: ['email', 'slack', 'webhook'],
                    thresholds: {
                        errorRate: 0.05,
                        responseTime: 5000,
                        usageSpike: 2.0
                    }
                }
            },
            
            // Security Configuration
            security: {
                encryption: {
                    algorithm: 'AES-256-GCM',
                    keyRotation: '90_days'
                },
                authentication: {
                    mfa: true,
                    sso: ['saml', 'oauth2', 'oidc'],
                    sessionTimeout: 3600
                },
                compliance: {
                    hipaa: true,
                    gdpr: true,
                    soc2: true,
                    iso27001: false
                },
                auditLogging: {
                    enabled: true,
                    retention: '7_years',
                    immutable: true
                }
            }
        };
        
        this.loadConfig();
    }
    
    /**
     * Load configuration from file or create default
     */
    loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const configData = fs.readFileSync(this.configPath, 'utf8');
                this.config = { ...this.defaultConfig, ...JSON.parse(configData) };
            } else {
                this.config = { ...this.defaultConfig };
                this.saveConfig();
            }
        } catch (error) {
            console.error('Error loading platform config:', error);
            this.config = { ...this.defaultConfig };
        }
    }
    
    /**
     * Save configuration to file
     */
    saveConfig() {
        try {
            const dataDir = path.dirname(this.configPath);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }
            
            this.config.lastUpdated = new Date().toISOString();
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
        } catch (error) {
            console.error('Error saving platform config:', error);
        }
    }
    
    /**
     * Get configuration value
     */
    get(path, defaultValue = null) {
        const keys = path.split('.');
        let value = this.config;
        
        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                return defaultValue;
            }
        }
        
        return value;
    }
    
    /**
     * Set configuration value
     */
    set(path, value) {
        const keys = path.split('.');
        let current = this.config;
        
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!(key in current) || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }
        
        current[keys[keys.length - 1]] = value;
        this.saveConfig();
    }
    
    /**
     * Check if feature is enabled
     */
    isFeatureEnabled(feature) {
        return this.get(`features.${feature}`, false);
    }
    
    /**
     * Enable/disable feature
     */
    setFeatureEnabled(feature, enabled) {
        this.set(`features.${feature}`, enabled);
    }
    
    /**
     * Get tier configuration
     */
    getTier(service, tier) {
        return this.get(`${service}.${tier}`, null);
    }
    
    /**
     * Get all tiers for a service
     */
    getAllTiers(service) {
        return this.get(service, {});
    }
    
    /**
     * Get vertical package configuration
     */
    getVerticalPackage(packageName) {
        return this.get(`verticalPackages.${packageName}`, null);
    }
    
    /**
     * Get add-on service configuration
     */
    getAddOnService(serviceName) {
        return this.get(`addOnServices.${serviceName}`, null);
    }
    
    /**
     * Get webhook configuration
     */
    getWebhookConfig() {
        return this.get('webhooks', {});
    }
    
    /**
     * Check if country is supported for international services
     */
    isCountrySupported(countryCode) {
        return this.get(`international.supportedCountries.${countryCode}.enabled`, false);
    }
    
    /**
     * Get complete configuration for API export
     */
    getFullConfig() {
        return { ...this.config };
    }
    
    /**
     * Get public configuration (safe for client-side)
     */
    getPublicConfig() {
        return {
            version: this.config.version,
            features: this.config.features,
            apiTiers: this.config.apiTiers,
            licenseValidationTiers: this.config.licenseValidationTiers,
            verticalPackages: this.config.verticalPackages,
            addOnServices: this.config.addOnServices,
            international: {
                enabled: this.config.international.enabled,
                supportedCountries: Object.keys(this.config.international.supportedCountries)
                    .filter(country => this.config.international.supportedCountries[country].enabled)
            }
        };
    }
    
    /**
     * Validate configuration
     */
    validateConfig() {
        const errors = [];
        
        // Validate pricing structure
        for (const [service, tiers] of Object.entries(['apiTiers', 'licenseValidationTiers'])) {
            const tierConfig = this.get(service, {});
            for (const [tierName, config] of Object.entries(tierConfig)) {
                if (typeof config.price !== 'number' || config.price < 0) {
                    errors.push(`Invalid price for ${service}.${tierName}`);
                }
            }
        }
        
        // Validate feature flags
        const features = this.get('features', {});
        for (const [feature, enabled] of Object.entries(features)) {
            if (typeof enabled !== 'boolean') {
                errors.push(`Feature flag ${feature} must be boolean`);
            }
        }
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    }
    
    /**
     * Reset to default configuration
     */
    resetToDefaults() {
        this.config = { ...this.defaultConfig };
        this.saveConfig();
    }
    
    /**
     * Export configuration for backup
     */
    exportConfig() {
        return {
            timestamp: new Date().toISOString(),
            config: this.config
        };
    }
    
    /**
     * Import configuration from backup
     */
    importConfig(configData) {
        try {
            if (configData.config) {
                this.config = { ...this.defaultConfig, ...configData.config };
                this.saveConfig();
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error importing config:', error);
            return false;
        }
    }
}

// Singleton instance
const platformConfig = new PlatformConfig();

module.exports = platformConfig;