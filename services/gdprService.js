const { EncryptionService } = require('./encryptionService');

class GDPRService {
    constructor(databaseService) {
        this.db = databaseService;
        this.encryption = new EncryptionService();
    }

    /**
     * Record lawful basis for data processing under GDPR Article 6
     * @param {number} userId - User ID
     * @param {string} dataType - Type of data being processed
     * @param {string} lawfulBasis - Legal basis for processing
     * @param {string} purpose - Specific purpose of processing
     * @param {object} additionalInfo - Additional context
     */
    async recordLawfulBasis(userId, dataType, lawfulBasis, purpose, additionalInfo = {}) {
        const lawfulBasisRecord = {
            user_id: userId,
            data_type: dataType, // 'personal_data', 'health_data', 'genetic_data'
            lawful_basis: lawfulBasis, // 'consent', 'legitimate_interest', 'public_health', 'scientific_research'
            specific_purpose: purpose,
            processing_details: JSON.stringify(additionalInfo),
            recorded_at: new Date().toISOString(),
            status: 'active'
        };

        return await this.db.recordLawfulBasis(lawfulBasisRecord);
    }

    /**
     * Manage user consent under GDPR Article 7
     * @param {number} userId - User ID
     * @param {string} consentType - Type of consent
     * @param {boolean} granted - Whether consent is granted
     * @param {object} consentDetails - Detailed consent information
     */
    async manageConsent(userId, consentType, granted, consentDetails = {}) {
        const consentRecord = {
            user_id: userId,
            consent_type: consentType, // 'data_processing', 'research_participation', 'marketing', 'profiling'
            consent_granted: granted,
            consent_method: consentDetails.method || 'explicit', // 'explicit', 'implied'
            consent_scope: JSON.stringify(consentDetails.scope || []),
            consent_timestamp: new Date().toISOString(),
            consent_version: consentDetails.version || '1.0',
            withdrawal_method: consentDetails.withdrawalMethod || 'user_request',
            ip_address: this.encryption.encrypt(consentDetails.ipAddress || ''),
            user_agent: this.encryption.encrypt(consentDetails.userAgent || ''),
            is_current: true
        };

        // Mark previous consent records as not current
        await this.db.updatePreviousConsent(userId, consentType, false);

        // Record new consent
        return await this.db.recordConsent(consentRecord);
    }

    /**
     * Handle data subject access request (GDPR Article 15)
     * @param {number} userId - User ID making the request
     * @param {string} requestType - Type of access request
     * @returns {object} - Complete data export for the user
     */
    async handleDataAccessRequest(userId, requestType = 'full_export') {
        const accessRequest = {
            user_id: userId,
            request_type: requestType,
            request_timestamp: new Date().toISOString(),
            status: 'processing',
            completion_deadline: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)).toISOString() // 30 days
        };

        // Log the request
        const requestId = await this.db.recordDataAccessRequest(accessRequest);

        // Compile user data
        const userData = {
            request_id: requestId,
            user_profile: await this.db.getUserById(userId),
            family_diseases: await this.db.getFamilyDiseasesByUserId(userId),
            consent_history: await this.db.getConsentHistory(userId),
            audit_logs: await this.db.getUserAuditLogs(userId),
            api_keys: await this.db.getAPIKeysByUserId(userId),
            data_processing_activities: await this.db.getDataProcessingActivities(userId),
            generated_at: new Date().toISOString(),
            format: 'JSON',
            retention_info: await this.getDataRetentionInfo(userId)
        };

        // Update request status
        await this.db.updateDataAccessRequest(requestId, {
            status: 'completed',
            completed_at: new Date().toISOString(),
            data_provided: true
        });

        return userData;
    }

    /**
     * Handle right to rectification (GDPR Article 16)
     * @param {number} userId - User ID
     * @param {object} rectificationData - Data to be corrected
     * @param {string} justification - Reason for rectification
     */
    async handleRectificationRequest(userId, rectificationData, justification) {
        const rectificationRequest = {
            user_id: userId,
            request_type: 'rectification',
            request_data: JSON.stringify(rectificationData),
            justification: justification,
            request_timestamp: new Date().toISOString(),
            status: 'pending_review'
        };

        const requestId = await this.db.recordRectificationRequest(rectificationRequest);

        // Log original data for audit trail
        await this.logDataChange(userId, 'rectification_requested', rectificationData, requestId);

        return {
            request_id: requestId,
            status: 'pending_review',
            review_deadline: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)).toISOString()
        };
    }

    /**
     * Handle right to erasure (GDPR Article 17 - "Right to be forgotten")
     * @param {number} userId - User ID
     * @param {string} erasureReason - Legal reason for erasure
     * @param {array} specificData - Specific data types to erase (optional)
     */
    async handleErasureRequest(userId, erasureReason, specificData = null) {
        // Validate erasure request
        const validReasons = [
            'no_longer_necessary',
            'consent_withdrawn',
            'unlawful_processing',
            'legal_obligation',
            'child_consent'
        ];

        if (!validReasons.includes(erasureReason)) {
            throw new Error('Invalid erasure reason provided');
        }

        // Check for legal obligations to retain data
        const retentionCheck = await this.checkRetentionObligations(userId);
        if (retentionCheck.mustRetain && !specificData) {
            return {
                success: false,
                reason: 'legal_obligation_to_retain',
                details: retentionCheck.reasons,
                partial_erasure_possible: true
            };
        }

        const erasureRequest = {
            user_id: userId,
            request_type: 'erasure',
            erasure_reason: erasureReason,
            specific_data: specificData ? JSON.stringify(specificData) : null,
            request_timestamp: new Date().toISOString(),
            status: 'processing'
        };

        const requestId = await this.db.recordErasureRequest(erasureRequest);

        // Perform erasure (pseudonymization for legally required retention)
        const erasureResult = await this.performErasure(userId, specificData, retentionCheck);

        // Update request status
        await this.db.updateErasureRequest(requestId, {
            status: 'completed',
            completed_at: new Date().toISOString(),
            erasure_method: erasureResult.method,
            data_erased: JSON.stringify(erasureResult.erasedData)
        });

        return erasureResult;
    }

    /**
     * Handle data portability request (GDPR Article 20)
     * @param {number} userId - User ID
     * @param {string} format - Requested format (JSON, XML, CSV)
     * @param {array} specificData - Specific data types requested
     */
    async handlePortabilityRequest(userId, format = 'JSON', specificData = null) {
        const portabilityData = {
            user_profile: await this.db.getUserById(userId),
            family_diseases: await this.db.getFamilyDiseasesByUserId(userId),
            consent_preferences: await this.db.getCurrentConsent(userId),
            created_by_user: true // Only user-provided data, not derived data
        };

        // Filter for specific data if requested
        if (specificData) {
            const filteredData = {};
            specificData.forEach(dataType => {
                if (portabilityData[dataType]) {
                    filteredData[dataType] = portabilityData[dataType];
                }
            });
            portabilityData = filteredData;
        }

        // Convert to requested format
        let formattedData;
        switch (format.toLowerCase()) {
            case 'xml':
                formattedData = this.convertToXML(portabilityData);
                break;
            case 'csv':
                formattedData = this.convertToCSV(portabilityData);
                break;
            default:
                formattedData = JSON.stringify(portabilityData, null, 2);
        }

        // Log portability request
        await this.db.recordDataPortabilityRequest({
            user_id: userId,
            request_timestamp: new Date().toISOString(),
            format: format,
            data_types: specificData ? JSON.stringify(specificData) : 'all',
            status: 'completed'
        });

        return {
            data: formattedData,
            format: format,
            generated_at: new Date().toISOString(),
            machine_readable: true,
            commonly_used_format: true
        };
    }

    /**
     * EHDS compliance - Health data processing under European Health Data Space
     * @param {number} userId - User ID
     * @param {string} processingPurpose - Purpose of health data processing
     * @param {object} ehdsContext - EHDS-specific context
     */
    async recordEHDSProcessing(userId, processingPurpose, ehdsContext = {}) {
        const ehdsRecord = {
            user_id: userId,
            processing_purpose: processingPurpose, // 'healthcare_delivery', 'research', 'policy_making', 'regulatory'
            data_category: 'health_data',
            ehds_lawful_basis: ehdsContext.lawfulBasis || 'public_health',
            data_minimization_applied: ehdsContext.dataMinimization || true,
            purpose_limitation_respected: ehdsContext.purposeLimitation || true,
            retention_period: ehdsContext.retentionPeriod || '10_years',
            cross_border_transfer: ehdsContext.crossBorderTransfer || false,
            recipient_country: ehdsContext.recipientCountry || null,
            adequacy_decision: ehdsContext.adequacyDecision || 'EU_EEA',
            processing_timestamp: new Date().toISOString()
        };

        return await this.db.recordEHDSProcessing(ehdsRecord);
    }

    /**
     * Data Protection Impact Assessment (DPIA) required check
     * @param {string} processingType - Type of data processing
     * @param {object} processingContext - Context of processing
     * @returns {object} - DPIA requirement assessment
     */
    assessDPIARequirement(processingType, processingContext) {
        const dpiaRequired =
            processingContext.sensitiveData ||
            processingContext.systematicMonitoring ||
            processingContext.largScaleProcessing ||
            processingContext.newTechnology ||
            processingContext.profiling ||
            processingType === 'genetic_analysis' ||
            processingType === 'automated_decision_making';

        return {
            dpia_required: dpiaRequired,
            reasons: this.getDPIAReasons(processingType, processingContext),
            consultation_required: dpiaRequired && processingContext.highRisk,
            supervisory_authority_consultation: processingContext.residualHighRisk || false
        };
    }

    /**
     * Generate privacy notice content for GDPR compliance
     * @param {string} dataType - Type of data being collected
     * @param {string} purpose - Purpose of data collection
     * @returns {object} - Privacy notice content
     */
    generatePrivacyNotice(dataType, purpose) {
        return {
            data_controller: {
                name: 'diseaseZone Medical Platform',
                contact: 'privacy@disease.zone',
                dpo_contact: 'dpo@disease.zone'
            },
            data_collected: this.getDataCategories(dataType),
            lawful_basis: this.getLawfulBasis(dataType, purpose),
            processing_purposes: this.getProcessingPurposes(purpose),
            retention_period: this.getRetentionPeriod(dataType),
            data_recipients: this.getDataRecipients(dataType),
            international_transfers: {
                occurs: false, // Update based on actual transfers
                safeguards: 'adequacy_decision',
                countries: ['EU', 'EEA']
            },
            individual_rights: {
                access: true,
                rectification: true,
                erasure: true,
                restrict_processing: true,
                data_portability: true,
                object: true,
                automated_decision_making: false
            },
            complaint_right: {
                supervisory_authority: 'Data Protection Authority',
                contact: 'complaint@dpa.gov'
            },
            last_updated: new Date().toISOString()
        };
    }

    /**
     * Cookie consent management for GDPR
     * @param {string} sessionId - Session identifier
     * @param {object} cookiePreferences - User cookie preferences
     */
    async manageCookieConsent(sessionId, cookiePreferences) {
        const cookieConsent = {
            session_id: sessionId,
            necessary_cookies: true, // Always required
            analytical_cookies: cookiePreferences.analytics || false,
            marketing_cookies: cookiePreferences.marketing || false,
            preference_cookies: cookiePreferences.preferences || false,
            consent_timestamp: new Date().toISOString(),
            consent_method: 'explicit',
            consent_version: '1.0'
        };

        await this.db.recordCookieConsent(cookieConsent);

        return {
            consent_recorded: true,
            preferences: cookieConsent,
            withdrawal_info: 'Preferences can be changed at any time in privacy settings'
        };
    }

    /**
     * Breach notification under GDPR Article 33/34
     * @param {object} breachDetails - Details of the data breach
     * @returns {object} - Breach notification requirements
     */
    async handleDataBreach(breachDetails) {
        const {
            breachType,
            dataTypes,
            affectedIndividuals,
            riskLevel,
            containmentMeasures,
            discoveryDate,
            breachDate
        } = breachDetails;

        const breach = {
            breach_id: this.encryption.generateSecureToken(16),
            breach_type: breachType,
            data_types: JSON.stringify(dataTypes),
            affected_count: affectedIndividuals,
            risk_level: riskLevel, // 'low', 'medium', 'high'
            discovery_date: discoveryDate,
            breach_date: breachDate,
            containment_measures: JSON.stringify(containmentMeasures),
            status: 'discovered',
            notification_requirements: {
                supervisory_authority: riskLevel !== 'low', // Art 33 - 72 hours
                individuals: riskLevel === 'high', // Art 34 - without undue delay
                notification_deadline_sa: new Date(Date.now() + (72 * 60 * 60 * 1000)), // 72 hours
                notification_deadline_individuals: riskLevel === 'high' ?
                    new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)) : null // Reasonable timeframe
            }
        };

        const breachId = await this.db.recordDataBreach(breach);

        // Auto-generate notification templates if required
        const notifications = {};
        if (breach.notification_requirements.supervisory_authority) {
            notifications.supervisory_authority = await this.generateSANotification(breach);
        }
        if (breach.notification_requirements.individuals) {
            notifications.individuals = await this.generateIndividualNotification(breach);
        }

        return {
            breach_id: breachId,
            notifications_required: breach.notification_requirements,
            notification_templates: notifications,
            next_steps: this.getBreachResponseSteps(riskLevel)
        };
    }

    // Private helper methods

    async performErasure(userId, specificData, retentionCheck) {
        const erasureResult = {
            method: 'complete_deletion',
            erasedData: [],
            pseudonymizedData: [],
            retainedData: []
        };

        if (!specificData) {
            // Full account erasure
            if (retentionCheck.mustRetain) {
                // Pseudonymize instead of delete
                await this.pseudonymizeUserData(userId);
                erasureResult.method = 'pseudonymization';
                erasureResult.pseudonymizedData = ['all_user_data'];
                erasureResult.retainedData = retentionCheck.reasons;
            } else {
                // Complete deletion
                await this.db.deleteUserData(userId);
                erasureResult.erasedData = ['complete_account'];
            }
        } else {
            // Selective erasure
            for (const dataType of specificData) {
                if (retentionCheck.retainedDataTypes.includes(dataType)) {
                    await this.pseudonymizeSpecificData(userId, dataType);
                    erasureResult.pseudonymizedData.push(dataType);
                } else {
                    await this.deleteSpecificData(userId, dataType);
                    erasureResult.erasedData.push(dataType);
                }
            }
        }

        return erasureResult;
    }

    async checkRetentionObligations(userId) {
        // Check various legal obligations to retain data
        const obligations = [];

        // Medical record retention (varies by jurisdiction)
        const medicalData = await this.db.getFamilyDiseasesByUserId(userId);
        if (medicalData.length > 0) {
            obligations.push('medical_record_retention_7_years');
        }

        // Audit log retention for financial or regulated activities
        const auditLogs = await this.db.getUserAuditLogs(userId);
        if (auditLogs.length > 0) {
            obligations.push('audit_log_retention_6_years');
        }

        // Legal proceedings or investigations
        const legalHolds = await this.db.getUserLegalHolds(userId);
        if (legalHolds.length > 0) {
            obligations.push('legal_hold_active');
        }

        return {
            mustRetain: obligations.length > 0,
            reasons: obligations,
            retainedDataTypes: this.mapObligationsToDataTypes(obligations)
        };
    }

    // Additional helper methods would go here...

    getDPIAReasons(processingType, context) {
        const reasons = [];
        if (context.sensitiveData) reasons.push('Processing of special category data');
        if (context.systematicMonitoring) reasons.push('Systematic monitoring of publicly accessible areas');
        if (context.largScaleProcessing) reasons.push('Large scale processing of personal data');
        return reasons;
    }

    getDataCategories(dataType) {
        const categories = {
            'health_data': ['Medical history', 'Family disease information', 'Symptoms', 'Treatment history'],
            'personal_data': ['Name', 'Email address', 'Account information'],
            'professional_data': ['Medical license', 'Specialty', 'Institution']
        };
        return categories[dataType] || [];
    }

    getLawfulBasis(dataType, purpose) {
        if (dataType === 'health_data') {
            return purpose === 'research' ? 'scientific_research' : 'public_health';
        }
        return 'legitimate_interest';
    }

    getRetentionPeriod(dataType) {
        const periods = {
            'health_data': '7 years after last interaction',
            'personal_data': '2 years after account deletion request',
            'audit_logs': '6 years for compliance purposes'
        };
        return periods[dataType] || '2 years';
    }
}

module.exports = GDPRService;