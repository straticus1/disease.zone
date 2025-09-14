/**
 * Asian Market Compliance Service
 * Handles compliance for Singapore (PDPA/eHRSS), Japan (APPI), South Korea (PIPA),
 * Hong Kong (PDPO), and other Asian jurisdictions
 */

const { EncryptionService } = require('./encryptionService');

class AsianComplianceService {
    constructor(databaseService) {
        this.db = databaseService;
        this.encryption = new EncryptionService();

        // Regional compliance configurations
        this.ASIAN_REGULATIONS = {
            SINGAPORE: {
                framework: 'PDPA_2020',
                health_data_governance: 'eHRSS',
                cross_border_restrictions: 'PDPA_CBTR',
                consent_requirements: 'opt_in',
                data_localization: 'healthcare_data',
                regulator: 'PDPC'
            },
            JAPAN: {
                framework: 'APPI_2022',
                health_data_governance: 'Personal_Information_Protection_Act',
                cross_border_restrictions: 'adequate_protection_required',
                consent_requirements: 'informed_consent',
                data_localization: 'none',
                regulator: 'PPC'
            },
            SOUTH_KOREA: {
                framework: 'PIPA_2020',
                health_data_governance: 'Medical_Service_Act',
                cross_border_restrictions: 'prior_consent_required',
                consent_requirements: 'explicit_consent',
                data_localization: 'sensitive_data',
                regulator: 'PIPC'
            },
            HONG_KONG: {
                framework: 'PDPO_2021',
                health_data_governance: 'Electronic_Health_Record_Ordinance',
                cross_border_restrictions: 'PDPO_amendments_2021',
                consent_requirements: 'prescribed_consent',
                data_localization: 'none',
                regulator: 'PCPD'
            },
            THAILAND: {
                framework: 'PDPA_2022',
                health_data_governance: 'National_Health_Security_Act',
                cross_border_restrictions: 'adequacy_or_consent',
                consent_requirements: 'explicit_consent',
                data_localization: 'none',
                regulator: 'PDPC_Thailand'
            },
            PHILIPPINES: {
                framework: 'DPA_2012',
                health_data_governance: 'Data_Privacy_Act',
                cross_border_restrictions: 'adequacy_assessment',
                consent_requirements: 'clear_consent',
                data_localization: 'none',
                regulator: 'NPC'
            }
        };
    }

    /**
     * Singapore PDPA & eHRSS Compliance
     * Personal Data Protection Act 2012 (amended 2020)
     * Electronic Health Record Sharing System
     */
    async handleSingaporePDPA(userId, processingActivity, healthDataContext = {}) {
        const pdpaRecord = {
            user_id: userId,
            regulation: 'SINGAPORE_PDPA',
            processing_activity: processingActivity,
            legal_basis: this.determinePDPALegalBasis(processingActivity),
            consent_obtained: healthDataContext.consentObtained || false,
            consent_method: healthDataContext.consentMethod || 'explicit',
            purpose_limitation: healthDataContext.purposeLimitation || true,
            data_minimization: healthDataContext.dataMinimization || true,
            retention_period: healthDataContext.retentionPeriod || 'business_purpose_duration',
            cross_border_transfer: healthDataContext.crossBorderTransfer || false,
            ehrs_integration: healthDataContext.ehrsIntegration || false,
            timestamp: new Date().toISOString()
        };

        // eHRSS specific requirements for health data
        if (healthDataContext.ehrsIntegration) {
            pdpaRecord.ehrs_compliance = {
                patient_consent: true, // Required for eHRSS participation
                data_standards: 'HL7_FHIR_R4', // eHRSS technical standards
                interoperability: 'MOH_standards',
                security_framework: 'NIST_cybersecurity_framework',
                audit_trail: 'comprehensive_logging'
            };
        }

        // Cross-border transfer restrictions (PDPA 2020 amendments)
        if (healthDataContext.crossBorderTransfer) {
            pdpaRecord.cbtr_compliance = await this.validateSingaporeCBTR(healthDataContext);
        }

        return await this.db.recordAsianCompliance(pdpaRecord);
    }

    /**
     * Japan APPI (Act on Protection of Personal Information) Compliance
     * 2022 amendments with enhanced health data protection
     */
    async handleJapanAPPI(userId, processingContext) {
        const appiRecord = {
            user_id: userId,
            regulation: 'JAPAN_APPI',
            processing_purpose: processingContext.purpose,
            legal_basis: 'informed_consent', // Standard for health data
            sensitive_data_processing: processingContext.healthData || false,
            consent_granularity: 'specific_purpose', // APPI 2022 requirement
            third_party_provision: processingContext.thirdPartySharing || false,
            cross_border_transfer: processingContext.internationalTransfer || false,
            data_subject_rights: {
                access: true,
                correction: true,
                suspension: true, // APPI specific right
                deletion: true
            },
            timestamp: new Date().toISOString()
        };

        // Handle sensitive personal information (health data)
        if (processingContext.healthData) {
            appiRecord.sensitive_data_controls = {
                opt_in_consent: true,
                purpose_specific_consent: true,
                withdrawal_mechanism: true,
                special_care_category: 'medical_records'
            };
        }

        // Cross-border transfer validation
        if (processingContext.internationalTransfer) {
            appiRecord.transfer_mechanism = await this.validateJapanTransfer(processingContext);
        }

        return await this.db.recordAsianCompliance(appiRecord);
    }

    /**
     * South Korea PIPA (Personal Information Protection Act) Compliance
     * Enhanced protections for sensitive personal information
     */
    async handleSouthKoreaPIPA(userId, processingDetails) {
        const pipaRecord = {
            user_id: userId,
            regulation: 'SOUTH_KOREA_PIPA',
            processing_type: processingDetails.type,
            sensitive_information: processingDetails.healthData || false,
            legal_basis: this.determinePIPALegalBasis(processingDetails),
            consent_method: 'separate_explicit_consent', // Required for sensitive data
            purpose_specification: processingDetails.specificPurpose,
            retention_limitation: processingDetails.retentionPeriod,
            cross_border_approval: processingDetails.internationalTransfer ? 'PIPC_approval_required' : 'not_applicable',
            timestamp: new Date().toISOString()
        };

        // Sensitive personal information (health data) special handling
        if (processingDetails.healthData) {
            pipaRecord.sensitive_data_compliance = {
                separate_consent: true,
                explicit_purpose: true,
                minimal_processing: true,
                secure_processing: 'enhanced_security_measures',
                regular_deletion: 'automatic_retention_limits'
            };

            // Medical Service Act compliance for health data
            pipaRecord.medical_service_act = {
                healthcare_provider_role: processingDetails.healthcareProvider || false,
                patient_record_standards: 'Korean_medical_standards',
                telemedicine_compliance: processingDetails.telemedicine || false
            };
        }

        return await this.db.recordAsianCompliance(pipaRecord);
    }

    /**
     * Hong Kong PDPO (Personal Data Privacy Ordinance) Compliance
     * 2021 amendments addressing doxxing and cross-border transfers
     */
    async handleHongKongPDPO(userId, dataProcessingInfo) {
        const pdpoRecord = {
            user_id: userId,
            regulation: 'HONG_KONG_PDPO',
            data_user_obligations: {
                purpose_limitation: true,
                data_minimization: true,
                accuracy_maintenance: true,
                retention_limitation: true,
                security_measures: true,
                transfer_restrictions: true
            },
            prescribed_consent: dataProcessingInfo.prescribedConsent || false,
            sensitive_data: dataProcessingInfo.healthData || false,
            cross_border_transfer: dataProcessingInfo.internationalTransfer || false,
            doxxing_prevention: {
                measures_implemented: true, // 2021 amendments
                content_monitoring: 'automated_detection',
                takedown_procedures: 'rapid_response'
            },
            timestamp: new Date().toISOString()
        };

        // Health data specific requirements
        if (dataProcessingInfo.healthData) {
            pdpoRecord.health_data_controls = {
                enhanced_consent: true,
                medical_professional_involvement: dataProcessingInfo.medicalSupervision || false,
                patient_rights: ['access', 'correction', 'data_portability'],
                security_standards: 'healthcare_appropriate'
            };
        }

        return await this.db.recordAsianCompliance(pdpoRecord);
    }

    /**
     * Singapore eHRSS (Electronic Health Record Sharing System) Integration
     * National health data interoperability framework
     */
    async integrateEHRSS(userId, ehrData) {
        const ehrsIntegration = {
            user_id: userId,
            system: 'SINGAPORE_eHRSS',
            patient_consent_status: ehrData.patientConsent || 'pending',
            data_sharing_preferences: {
                primary_care: ehrData.primaryCare || false,
                specialist_care: ehrData.specialistCare || false,
                emergency_access: ehrData.emergencyAccess || true, // Default for safety
                research_participation: ehrData.researchConsent || false
            },
            technical_compliance: {
                hl7_fhir_version: 'R4',
                terminology_standards: ['SNOMED_CT', 'ICD_11', 'LOINC'],
                security_profile: 'IHE_ATNA',
                audit_logging: 'IHE_ATNA_compliant',
                identity_management: 'SingPass_integration'
            },
            interoperability_level: ehrData.interoperabilityLevel || 'basic',
            last_sync: new Date().toISOString(),
            consent_withdrawal_date: null
        };

        // Record consent for eHRSS participation
        if (ehrData.patientConsent === 'granted') {
            await this.recordEHRSSConsent(userId, ehrData.consentDetails);
        }

        return await this.db.recordEHRSSIntegration(ehrsIntegration);
    }

    /**
     * Cross-border data transfer validation for Asian jurisdictions
     */
    async validateAsianCrossBorderTransfer(transferDetails) {
        const {
            sourceCountry,
            destinationCountry,
            dataType,
            transferMechanism,
            additionalSafeguards
        } = transferDetails;

        const validation = {
            transfer_id: this.encryption.generateSecureToken(16),
            source_country: sourceCountry,
            destination_country: destinationCountry,
            data_classification: this.classifyDataForTransfer(dataType),
            compliance_check: {},
            approved: false,
            conditions: [],
            timestamp: new Date().toISOString()
        };

        // Singapore CBTR validation
        if (sourceCountry === 'SINGAPORE') {
            validation.compliance_check.singapore = await this.validateSingaporeCBTR({
                destinationCountry,
                dataType,
                mechanism: transferMechanism
            });
        }

        // Japan adequacy assessment
        if (sourceCountry === 'JAPAN') {
            validation.compliance_check.japan = this.validateJapanTransfer({
                destinationCountry,
                personalInformationLevel: dataType,
                protectionMeasures: additionalSafeguards
            });
        }

        // South Korea prior consent requirement
        if (sourceCountry === 'SOUTH_KOREA') {
            validation.compliance_check.south_korea = {
                prior_consent_required: dataType === 'health_data',
                pipc_notification: dataType === 'sensitive_data',
                adequate_protection: this.assessAdequateProtection(destinationCountry)
            };
        }

        // Overall approval logic
        validation.approved = this.determineTransferApproval(validation.compliance_check);

        return validation;
    }

    /**
     * Data localization assessment for Asian markets
     */
    assessDataLocalizationRequirements(country, dataType) {
        const requirements = {
            country: country,
            data_type: dataType,
            localization_required: false,
            exceptions: [],
            compliance_measures: []
        };

        switch (country) {
            case 'SINGAPORE':
                if (dataType === 'health_data') {
                    requirements.localization_required = true;
                    requirements.compliance_measures.push('eHRSS_participation');
                    requirements.exceptions.push('emergency_medical_care');
                }
                break;

            case 'SOUTH_KOREA':
                if (['health_data', 'financial_data'].includes(dataType)) {
                    requirements.localization_required = true;
                    requirements.compliance_measures.push('PIPA_compliance');
                }
                break;

            case 'CHINA':
                if (['personal_data', 'health_data'].includes(dataType)) {
                    requirements.localization_required = true;
                    requirements.compliance_measures.push('cybersecurity_law_compliance');
                    requirements.exceptions.push('explicit_consent_for_transfer');
                }
                break;

            case 'INDONESIA':
                if (dataType === 'personal_data') {
                    requirements.localization_required = true;
                    requirements.compliance_measures.push('PDP_law_compliance');
                }
                break;
        }

        return requirements;
    }

    /**
     * Generate Asian-specific privacy notice content
     */
    generateAsianPrivacyNotice(country, dataType, processingPurpose) {
        const baseNotice = {
            country_specific_law: this.ASIAN_REGULATIONS[country]?.framework,
            regulator: this.ASIAN_REGULATIONS[country]?.regulator,
            data_subject_rights: this.getCountrySpecificRights(country),
            complaint_mechanism: this.getComplaintMechanism(country),
            local_representative: this.getLocalRepresentative(country),
            language_requirements: this.getLanguageRequirements(country)
        };

        // Country-specific customizations
        switch (country) {
            case 'SINGAPORE':
                return {
                    ...baseNotice,
                    pdpa_compliance: 'Personal Data Protection Act 2012 (amended 2020)',
                    ehrs_participation: dataType === 'health_data',
                    dnt_obligation: 'Do Not Call Registry compliance',
                    cbtr_disclosure: 'Cross-border transfer restrictions apply'
                };

            case 'JAPAN':
                return {
                    ...baseNotice,
                    appi_compliance: 'Act on Protection of Personal Information (2022 amendments)',
                    sensitive_data_handling: dataType === 'health_data' ? 'Special consent required' : 'Standard processing',
                    ppc_oversight: 'Personal Information Protection Commission supervision',
                    third_party_provision_rules: 'Opt-out mechanism available for non-sensitive data'
                };

            case 'SOUTH_KOREA':
                return {
                    ...baseNotice,
                    pipa_compliance: 'Personal Information Protection Act',
                    sensitive_data_rules: dataType === 'health_data' ? 'Separate explicit consent required' : 'Standard consent',
                    cross_border_restrictions: 'PIPC approval required for international transfers',
                    destruction_obligation: 'Automatic data destruction upon retention period expiry'
                };

            default:
                return baseNotice;
        }
    }

    // Private helper methods

    determinePDPALegalBasis(processingActivity) {
        const legalBases = {
            'healthcare_delivery': 'legitimate_interest',
            'research': 'consent',
            'public_health': 'legal_obligation',
            'marketing': 'consent'
        };
        return legalBases[processingActivity] || 'consent';
    }

    determinePIPALegalBasis(processingDetails) {
        if (processingDetails.healthData) {
            return 'separate_explicit_consent';
        }
        return processingDetails.consent ? 'consent' : 'legitimate_interest';
    }

    async validateSingaporeCBTR(transferContext) {
        // Singapore Cross-Border Transfer Restriction validation
        return {
            adequate_protection_assessment: this.assessAdequateProtection(transferContext.destinationCountry),
            contractual_safeguards: transferContext.contractualSafeguards || false,
            pdpc_notification: transferContext.pdpcNotification || false,
            individual_consent: transferContext.individualConsent || false,
            compliance_status: 'pending_review'
        };
    }

    validateJapanTransfer(transferContext) {
        const adequateCountries = ['EU', 'UK']; // Countries with adequacy decisions from Japan
        return {
            adequate_protection: adequateCountries.includes(transferContext.destinationCountry),
            personal_information_level: transferContext.personalInformationLevel,
            protection_measures: transferContext.protectionMeasures,
            ppc_approval_required: !adequateCountries.includes(transferContext.destinationCountry)
        };
    }

    assessAdequateProtection(country) {
        // Simplified adequacy assessment
        const adequateCountries = ['EU', 'UK', 'CANADA', 'JAPAN', 'SOUTH_KOREA'];
        return adequateCountries.includes(country);
    }

    classifyDataForTransfer(dataType) {
        const classifications = {
            'personal_data': 'standard',
            'health_data': 'sensitive',
            'genetic_data': 'highly_sensitive',
            'biometric_data': 'highly_sensitive'
        };
        return classifications[dataType] || 'standard';
    }

    determineTransferApproval(complianceChecks) {
        // Simplified approval logic - in production, this would be more sophisticated
        return Object.values(complianceChecks).every(check =>
            check.compliance_status !== 'rejected'
        );
    }

    getCountrySpecificRights(country) {
        const rights = {
            'SINGAPORE': ['access', 'correction', 'withdrawal_of_consent', 'data_portability'],
            'JAPAN': ['disclosure', 'correction', 'suspension', 'deletion'],
            'SOUTH_KOREA': ['access', 'correction', 'deletion', 'suspension_of_processing'],
            'HONG_KONG': ['access', 'correction', 'data_portability']
        };
        return rights[country] || ['access', 'correction'];
    }

    getComplaintMechanism(country) {
        const mechanisms = {
            'SINGAPORE': 'Personal Data Protection Commission (PDPC)',
            'JAPAN': 'Personal Information Protection Commission (PPC)',
            'SOUTH_KOREA': 'Personal Information Protection Commission (PIPC)',
            'HONG_KONG': 'Office of the Privacy Commissioner for Personal Data (PCPD)'
        };
        return mechanisms[country] || 'Local data protection authority';
    }

    getLocalRepresentative(country) {
        // In production, this would return actual local representative details
        return {
            required: ['SINGAPORE', 'SOUTH_KOREA'].includes(country),
            contact: `local-rep-${country.toLowerCase()}@disease.zone`,
            address: `Local representative address for ${country}`
        };
    }

    getLanguageRequirements(country) {
        const languages = {
            'SINGAPORE': ['English', 'Mandarin', 'Malay', 'Tamil'],
            'JAPAN': ['Japanese'],
            'SOUTH_KOREA': ['Korean'],
            'HONG_KONG': ['English', 'Traditional Chinese'],
            'THAILAND': ['Thai'],
            'PHILIPPINES': ['Filipino', 'English']
        };
        return languages[country] || ['English'];
    }

    async recordEHRSSConsent(userId, consentDetails) {
        const consentRecord = {
            user_id: userId,
            consent_type: 'ehrs_participation',
            consent_granted: true,
            consent_scope: JSON.stringify(consentDetails.scope || ['primary_care', 'emergency_access']),
            singpass_verified: consentDetails.singpassVerified || false,
            healthcare_provider: consentDetails.healthcareProvider || null,
            consent_timestamp: new Date().toISOString(),
            withdrawal_mechanism: 'ehrs_portal_or_healthcare_provider',
            consent_version: '1.0'
        };

        return await this.db.recordEHRSSConsent(consentRecord);
    }
}

module.exports = AsianComplianceService;