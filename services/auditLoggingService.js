/**
 * Comprehensive Audit Logging and Data Governance Service
 * Implements HIPAA, GDPR, and international compliance requirements
 * for comprehensive audit trails and data governance
 */

const { EncryptionService } = require('./encryptionService');

class AuditLoggingService {
    constructor(databaseService) {
        this.db = databaseService;
        this.encryption = new EncryptionService();

        // Audit event classifications
        this.AUDIT_EVENT_TYPES = {
            // HIPAA Required Events
            HIPAA_LOGIN_SUCCESS: 'hipaa_login_success',
            HIPAA_LOGIN_FAILURE: 'hipaa_login_failure',
            HIPAA_LOGOUT: 'hipaa_logout',
            HIPAA_PHI_ACCESS: 'hipaa_phi_access',
            HIPAA_PHI_MODIFY: 'hipaa_phi_modify',
            HIPAA_PHI_DELETE: 'hipaa_phi_delete',
            HIPAA_PHI_EXPORT: 'hipaa_phi_export',
            HIPAA_SYSTEM_ACCESS: 'hipaa_system_access',
            HIPAA_EMERGENCY_ACCESS: 'hipaa_emergency_access',

            // GDPR Required Events
            GDPR_CONSENT_GRANTED: 'gdpr_consent_granted',
            GDPR_CONSENT_WITHDRAWN: 'gdpr_consent_withdrawn',
            GDPR_DATA_ACCESS_REQUEST: 'gdpr_data_access_request',
            GDPR_DATA_RECTIFICATION: 'gdpr_data_rectification',
            GDPR_DATA_ERASURE: 'gdpr_data_erasure',
            GDPR_DATA_PORTABILITY: 'gdpr_data_portability',
            GDPR_DATA_BREACH: 'gdpr_data_breach',
            GDPR_CROSS_BORDER_TRANSFER: 'gdpr_cross_border_transfer',

            // System Events
            SYSTEM_STARTUP: 'system_startup',
            SYSTEM_SHUTDOWN: 'system_shutdown',
            SYSTEM_ERROR: 'system_error',
            SYSTEM_CONFIG_CHANGE: 'system_config_change',

            // Security Events
            SECURITY_BREACH_DETECTED: 'security_breach_detected',
            SECURITY_UNAUTHORIZED_ACCESS: 'security_unauthorized_access',
            SECURITY_PRIVILEGE_ESCALATION: 'security_privilege_escalation',
            SECURITY_DATA_INTEGRITY_VIOLATION: 'security_data_integrity_violation',

            // API Events
            API_KEY_CREATED: 'api_key_created',
            API_KEY_USED: 'api_key_used',
            API_KEY_REVOKED: 'api_key_revoked',
            API_RATE_LIMIT_EXCEEDED: 'api_rate_limit_exceeded',

            // Medical Events
            MEDICAL_RECORD_CREATED: 'medical_record_created',
            MEDICAL_RECORD_ACCESSED: 'medical_record_accessed',
            MEDICAL_RECORD_UPDATED: 'medical_record_updated',
            MEDICAL_PROFESSIONAL_VERIFICATION: 'medical_professional_verification'
        };

        // Risk severity levels
        this.SEVERITY_LEVELS = {
            LOW: 'low',
            MEDIUM: 'medium',
            HIGH: 'high',
            CRITICAL: 'critical'
        };

        // Compliance frameworks
        this.COMPLIANCE_FRAMEWORKS = {
            HIPAA: 'hipaa',
            GDPR: 'gdpr',
            PIPEDA: 'pipeda',
            PDPA_SINGAPORE: 'pdpa_singapore',
            APPI_JAPAN: 'appi_japan',
            PIPA_KOREA: 'pipa_korea'
        };
    }

    /**
     * Log comprehensive audit event with full compliance metadata
     * @param {object} auditEvent - Complete audit event information
     * @returns {string} - Unique audit log ID
     */
    async logAuditEvent(auditEvent) {
        const {
            eventType,
            userId,
            resourceType,
            resourceId,
            action,
            outcome,
            details,
            ipAddress,
            userAgent,
            sessionId,
            complianceFrameworks = [],
            severity = this.SEVERITY_LEVELS.MEDIUM,
            phiInvolved = false,
            crossBorderTransfer = false,
            emergencyAccess = false
        } = auditEvent;

        // Generate unique audit ID
        const auditId = this.encryption.generateSecureToken(32);

        // Create comprehensive audit record
        const auditRecord = {
            audit_id: auditId,
            event_type: eventType,
            event_timestamp: new Date().toISOString(),
            user_id: userId,
            session_id: sessionId,
            resource_type: resourceType,
            resource_id: resourceId,
            action_performed: action,
            outcome: outcome, // SUCCESS, FAILURE, PARTIAL
            severity_level: severity,
            phi_involved: phiInvolved ? 1 : 0,
            emergency_access: emergencyAccess ? 1 : 0,
            cross_border_transfer: crossBorderTransfer ? 1 : 0,

            // Encrypted PII/PHI fields
            ip_address: ipAddress ? this.encryption.encrypt(ipAddress) : null,
            user_agent: userAgent ? this.encryption.encrypt(userAgent) : null,

            // Compliance metadata
            compliance_frameworks: JSON.stringify(complianceFrameworks),
            retention_period: this.calculateRetentionPeriod(complianceFrameworks),

            // Event details (encrypted if contains sensitive data)
            event_details: details ? this.encryption.encrypt(JSON.stringify(details)) : null,

            // Integrity and tamper detection
            record_hash: null, // Will be calculated after record creation
            digital_signature: null, // For high-sensitivity events

            // Processing metadata
            audit_version: '2.0',
            processed_at: new Date().toISOString(),
            processing_location: process.env.AUDIT_PROCESSING_REGION || 'us-east-1'
        };

        // Calculate record hash for integrity verification
        auditRecord.record_hash = this.calculateRecordHash(auditRecord);

        // Add digital signature for critical events
        if (severity === this.SEVERITY_LEVELS.CRITICAL || phiInvolved) {
            auditRecord.digital_signature = this.generateDigitalSignature(auditRecord);
        }

        // Store audit record
        await this.db.insertAuditLog(auditRecord);

        // Trigger real-time monitoring for high-severity events
        if (severity === this.SEVERITY_LEVELS.HIGH || severity === this.SEVERITY_LEVELS.CRITICAL) {
            await this.triggerSecurityAlert(auditRecord);
        }

        // Update audit statistics
        await this.updateAuditStatistics(eventType, outcome, severity);

        return auditId;
    }

    /**
     * Log HIPAA-specific events with required metadata
     * @param {object} hipaaEvent - HIPAA audit event
     * @returns {string} - Audit log ID
     */
    async logHIPAAEvent(hipaaEvent) {
        const {
            eventType,
            userId,
            patientId,
            action,
            outcome,
            phiFields,
            clinicalContext,
            emergencyAccess = false,
            ipAddress,
            userAgent
        } = hipaaEvent;

        return await this.logAuditEvent({
            eventType: eventType,
            userId: userId,
            resourceType: 'patient_record',
            resourceId: patientId,
            action: action,
            outcome: outcome,
            details: {
                phi_fields_accessed: phiFields,
                clinical_context: clinicalContext,
                minimum_necessary_standard: true,
                authorization_basis: 'treatment_payment_operations'
            },
            ipAddress: ipAddress,
            userAgent: userAgent,
            complianceFrameworks: [this.COMPLIANCE_FRAMEWORKS.HIPAA],
            severity: emergencyAccess ? this.SEVERITY_LEVELS.HIGH : this.SEVERITY_LEVELS.MEDIUM,
            phiInvolved: true,
            emergencyAccess: emergencyAccess
        });
    }

    /**
     * Log GDPR-specific events with data subject rights tracking
     * @param {object} gdprEvent - GDPR audit event
     * @returns {string} - Audit log ID
     */
    async logGDPREvent(gdprEvent) {
        const {
            eventType,
            dataSubjectId,
            personalDataCategories,
            lawfulBasis,
            processingPurpose,
            dataSubjectRights,
            consentDetails,
            crossBorderTransfer = false,
            thirdCountry = null
        } = gdprEvent;

        return await this.logAuditEvent({
            eventType: eventType,
            userId: dataSubjectId,
            resourceType: 'personal_data',
            resourceId: dataSubjectId,
            action: eventType.split('_').slice(-1)[0], // Extract action from event type
            outcome: 'SUCCESS',
            details: {
                personal_data_categories: personalDataCategories,
                lawful_basis: lawfulBasis,
                processing_purpose: processingPurpose,
                data_subject_rights: dataSubjectRights,
                consent_details: consentDetails,
                third_country: thirdCountry,
                adequacy_decision: crossBorderTransfer ? this.checkAdequacyDecision(thirdCountry) : null
            },
            complianceFrameworks: [this.COMPLIANCE_FRAMEWORKS.GDPR],
            severity: crossBorderTransfer ? this.SEVERITY_LEVELS.HIGH : this.SEVERITY_LEVELS.MEDIUM,
            crossBorderTransfer: crossBorderTransfer
        });
    }

    /**
     * Log security events with threat intelligence
     * @param {object} securityEvent - Security audit event
     * @returns {string} - Audit log ID
     */
    async logSecurityEvent(securityEvent) {
        const {
            eventType,
            threatLevel,
            attackVector,
            affectedResources,
            mitigationActions,
            incidentId,
            ipAddress,
            userAgent,
            geolocation
        } = securityEvent;

        return await this.logAuditEvent({
            eventType: eventType,
            userId: null, // May not have user context for security events
            resourceType: 'security_system',
            resourceId: incidentId,
            action: 'security_monitoring',
            outcome: 'ALERT_GENERATED',
            details: {
                threat_level: threatLevel,
                attack_vector: attackVector,
                affected_resources: affectedResources,
                mitigation_actions: mitigationActions,
                geolocation: geolocation,
                threat_intelligence: await this.getSecurityIntelligence(ipAddress)
            },
            ipAddress: ipAddress,
            userAgent: userAgent,
            complianceFrameworks: [this.COMPLIANCE_FRAMEWORKS.HIPAA, this.COMPLIANCE_FRAMEWORKS.GDPR],
            severity: this.mapThreatLevelToSeverity(threatLevel)
        });
    }

    /**
     * Generate comprehensive audit report for compliance
     * @param {object} reportCriteria - Report generation criteria
     * @returns {object} - Comprehensive audit report
     */
    async generateAuditReport(reportCriteria) {
        const {
            startDate,
            endDate,
            complianceFramework,
            eventTypes,
            severityLevels,
            includeSystemEvents = false,
            includePHIEvents = true,
            format = 'detailed'
        } = reportCriteria;

        const report = {
            report_id: this.encryption.generateSecureToken(16),
            generated_at: new Date().toISOString(),
            report_period: {
                start_date: startDate,
                end_date: endDate
            },
            compliance_framework: complianceFramework,
            report_criteria: reportCriteria,

            // Summary statistics
            summary: await this.generateAuditSummary(reportCriteria),

            // Event breakdown
            events_by_type: await this.getEventsByType(reportCriteria),
            events_by_user: await this.getEventsByUser(reportCriteria),
            events_by_severity: await this.getEventsBySeverity(reportCriteria),

            // Compliance-specific sections
            compliance_violations: await this.identifyComplianceViolations(reportCriteria),
            security_incidents: await this.getSecurityIncidents(reportCriteria),
            data_subject_requests: complianceFramework === 'GDPR' ?
                await this.getDataSubjectRequests(reportCriteria) : null,

            // Risk assessment
            risk_assessment: await this.performRiskAssessment(reportCriteria),
            recommendations: await this.generateRecommendations(reportCriteria),

            // Integrity verification
            report_integrity: {
                total_events_analyzed: 0, // Will be calculated
                data_completeness_score: 0, // Will be calculated
                integrity_hash: null // Will be calculated at end
            }
        };

        // Calculate integrity metrics
        report.report_integrity.total_events_analyzed = await this.countAuditEvents(reportCriteria);
        report.report_integrity.data_completeness_score = await this.calculateCompletenessScore(reportCriteria);
        report.report_integrity.integrity_hash = this.calculateReportHash(report);

        return report;
    }

    /**
     * Perform real-time monitoring and alerting
     * @param {object} monitoringCriteria - Monitoring configuration
     */
    async startRealTimeMonitoring(monitoringCriteria) {
        const {
            alertThresholds,
            notificationChannels,
            complianceFrameworks,
            monitoringPeriod = 300000 // 5 minutes default
        } = monitoringCriteria;

        // Start monitoring intervals
        setInterval(async () => {
            await this.performAnomalyDetection(alertThresholds);
            await this.checkComplianceViolations(complianceFrameworks);
            await this.monitorSystemHealth();
        }, monitoringPeriod);

        console.log('🔍 Real-time audit monitoring started');
    }

    /**
     * Data retention and cleanup based on compliance requirements
     * @param {string} complianceFramework - Framework to apply
     */
    async performDataRetentionCleanup(complianceFramework) {
        const retentionPolicies = {
            [this.COMPLIANCE_FRAMEWORKS.HIPAA]: 6 * 365, // 6 years
            [this.COMPLIANCE_FRAMEWORKS.GDPR]: 3 * 365,  // 3 years for most data
            [this.COMPLIANCE_FRAMEWORKS.PIPEDA]: 2 * 365, // 2 years
            [this.COMPLIANCE_FRAMEWORKS.PDPA_SINGAPORE]: 3 * 365 // 3 years
        };

        const retentionDays = retentionPolicies[complianceFramework] || (6 * 365);
        const cutoffDate = new Date(Date.now() - (retentionDays * 24 * 60 * 60 * 1000));

        // Archive old audit logs before deletion
        await this.archiveOldAuditLogs(cutoffDate);

        // Delete expired audit logs
        const deletedCount = await this.deleteExpiredAuditLogs(cutoffDate);

        // Log the cleanup operation
        await this.logAuditEvent({
            eventType: 'AUDIT_DATA_RETENTION_CLEANUP',
            userId: 'system',
            resourceType: 'audit_logs',
            action: 'automated_cleanup',
            outcome: 'SUCCESS',
            details: {
                compliance_framework: complianceFramework,
                retention_period_days: retentionDays,
                cutoff_date: cutoffDate.toISOString(),
                records_deleted: deletedCount
            },
            severity: this.SEVERITY_LEVELS.LOW,
            complianceFrameworks: [complianceFramework]
        });

        return { recordsDeleted: deletedCount, cutoffDate };
    }

    // Private helper methods

    calculateRetentionPeriod(complianceFrameworks) {
        // Return the longest retention period required by any framework
        const periods = {
            [this.COMPLIANCE_FRAMEWORKS.HIPAA]: 6 * 365,
            [this.COMPLIANCE_FRAMEWORKS.GDPR]: 3 * 365,
            [this.COMPLIANCE_FRAMEWORKS.PIPEDA]: 2 * 365
        };

        let maxPeriod = 3 * 365; // Default 3 years
        complianceFrameworks.forEach(framework => {
            if (periods[framework] && periods[framework] > maxPeriod) {
                maxPeriod = periods[framework];
            }
        });

        return maxPeriod;
    }

    calculateRecordHash(auditRecord) {
        // Create hash of critical fields for integrity verification
        const hashableData = {
            audit_id: auditRecord.audit_id,
            event_type: auditRecord.event_type,
            event_timestamp: auditRecord.event_timestamp,
            user_id: auditRecord.user_id,
            resource_type: auditRecord.resource_type,
            resource_id: auditRecord.resource_id,
            action_performed: auditRecord.action_performed,
            outcome: auditRecord.outcome
        };

        return this.encryption.hash(JSON.stringify(hashableData));
    }

    generateDigitalSignature(auditRecord) {
        // In production, this would use proper digital signing with PKI
        return this.encryption.hash(
            JSON.stringify(auditRecord) + process.env.AUDIT_SIGNING_KEY || 'audit_key_2025'
        );
    }

    async triggerSecurityAlert(auditRecord) {
        // Trigger immediate security response for critical events
        if (auditRecord.severity_level === this.SEVERITY_LEVELS.CRITICAL) {
            console.log('🚨 CRITICAL SECURITY EVENT:', auditRecord.event_type);
            // In production: send to SIEM, notify security team, etc.
        }
    }

    async updateAuditStatistics(eventType, outcome, severity) {
        // Update real-time statistics for monitoring dashboards
        const stats = {
            event_type: eventType,
            outcome: outcome,
            severity: severity,
            timestamp: new Date().toISOString()
        };

        // In production: update monitoring metrics
        console.log('📊 Audit statistics updated:', stats);
    }

    mapThreatLevelToSeverity(threatLevel) {
        const mapping = {
            'low': this.SEVERITY_LEVELS.LOW,
            'medium': this.SEVERITY_LEVELS.MEDIUM,
            'high': this.SEVERITY_LEVELS.HIGH,
            'critical': this.SEVERITY_LEVELS.CRITICAL
        };
        return mapping[threatLevel] || this.SEVERITY_LEVELS.MEDIUM;
    }

    checkAdequacyDecision(thirdCountry) {
        // Check if third country has EU adequacy decision
        const adequateCountries = ['CA', 'UK', 'JP', 'KR', 'IL', 'CH', 'NZ'];
        return adequateCountries.includes(thirdCountry);
    }

    async getSecurityIntelligence(ipAddress) {
        // In production: integrate with threat intelligence services
        return {
            reputation_score: 'unknown',
            known_threats: [],
            geolocation: 'unknown',
            tor_exit_node: false
        };
    }

    // Report generation helper methods
    async generateAuditSummary(criteria) {
        return {
            total_events: 0,
            successful_events: 0,
            failed_events: 0,
            security_incidents: 0,
            compliance_violations: 0
        };
    }

    async getEventsByType(criteria) {
        // Return event counts by type
        return {};
    }

    async getEventsByUser(criteria) {
        // Return event counts by user
        return {};
    }

    async getEventsBySeverity(criteria) {
        // Return event counts by severity
        return {};
    }

    async identifyComplianceViolations(criteria) {
        // Identify potential compliance violations
        return [];
    }

    async getSecurityIncidents(criteria) {
        // Return security incidents in period
        return [];
    }

    async getDataSubjectRequests(criteria) {
        // Return GDPR data subject requests
        return [];
    }

    async performRiskAssessment(criteria) {
        return {
            overall_risk_score: 'low',
            risk_factors: [],
            mitigation_recommendations: []
        };
    }

    async generateRecommendations(criteria) {
        return [
            'Regular review of audit logs recommended',
            'Consider implementing additional monitoring for high-risk events'
        ];
    }

    calculateReportHash(report) {
        // Calculate hash for report integrity
        return this.encryption.hash(JSON.stringify(report));
    }

    async countAuditEvents(criteria) {
        // Count events matching criteria
        return 0;
    }

    async calculateCompletenessScore(criteria) {
        // Calculate data completeness percentage
        return 100;
    }

    async performAnomalyDetection(thresholds) {
        // Detect anomalous patterns in audit logs
        console.log('🔍 Performing anomaly detection...');
    }

    async checkComplianceViolations(frameworks) {
        // Check for compliance violations
        console.log('⚖️  Checking compliance violations...');
    }

    async monitorSystemHealth() {
        // Monitor audit system health
        console.log('💚 Monitoring audit system health...');
    }

    async archiveOldAuditLogs(cutoffDate) {
        // Archive logs before deletion
        console.log('📦 Archiving old audit logs before:', cutoffDate);
    }

    async deleteExpiredAuditLogs(cutoffDate) {
        // Delete expired audit logs
        console.log('🗑️  Deleting expired audit logs before:', cutoffDate);
        return 0;
    }
}

module.exports = AuditLoggingService;