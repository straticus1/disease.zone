/**
 * Medical Validation Service
 * Ensures medical data accuracy and terminology compliance
 * Validates against ICD-10, ICD-11, SNOMED CT, and clinical standards
 */

class MedicalValidationService {
    constructor() {
        // ICD-10 to ICD-11 mapping for transition period
        this.icd10ToIcd11Mapping = require('../data/icd10_to_icd11_mapping.json');

        // SNOMED CT integration (in production, this would be a proper terminology server)
        this.snomedCT = require('../data/snomed_ct_subset.json');

        // Clinical validation rules
        this.clinicalRules = this.initializeClinicalRules();

        // Drug terminology (RxNorm subset)
        this.rxNormData = require('../data/rxnorm_subset.json');

        // Laboratory terminology (LOINC subset)
        this.loincData = require('../data/loinc_subset.json');
    }

    /**
     * Validate disease information against medical standards
     * @param {object} diseaseData - Disease information to validate
     * @returns {object} - Validation result with corrections and suggestions
     */
    validateDiseaseData(diseaseData) {
        const validation = {
            isValid: true,
            errors: [],
            warnings: [],
            suggestions: [],
            correctedData: { ...diseaseData },
            validationMetadata: {
                validated_at: new Date().toISOString(),
                validation_version: '1.0',
                standards_used: ['ICD-10', 'ICD-11', 'SNOMED-CT']
            }
        };

        // Validate ICD-10 code
        if (diseaseData.icd10_code) {
            const icd10Validation = this.validateICD10Code(diseaseData.icd10_code, diseaseData.name);
            if (!icd10Validation.isValid) {
                validation.errors.push(...icd10Validation.errors);
                validation.isValid = false;
            } else {
                // Add ICD-11 mapping if available
                const icd11Code = this.getICD11Mapping(diseaseData.icd10_code);
                if (icd11Code) {
                    validation.correctedData.icd11_code = icd11Code;
                    validation.suggestions.push(`ICD-11 equivalent code available: ${icd11Code}`);
                }
            }
        } else {
            validation.warnings.push('ICD-10 code not provided - recommended for disease classification');

            // Suggest ICD-10 code based on disease name
            const suggestedCode = this.suggestICD10Code(diseaseData.name);
            if (suggestedCode) {
                validation.suggestions.push(`Suggested ICD-10 code: ${suggestedCode}`);
                validation.correctedData.icd10_code = suggestedCode;
            }
        }

        // Validate SNOMED CT codes if present
        if (diseaseData.snomed_codes) {
            const snomedValidation = this.validateSNOMEDCodes(diseaseData.snomed_codes);
            if (!snomedValidation.isValid) {
                validation.warnings.push(...snomedValidation.warnings);
            }
        }

        // Validate disease name against medical terminology
        const nameValidation = this.validateDiseaseName(diseaseData.name);
        if (nameValidation.standardizedName && nameValidation.standardizedName !== diseaseData.name) {
            validation.correctedData.name = nameValidation.standardizedName;
            validation.suggestions.push(`Standardized name: ${nameValidation.standardizedName}`);
        }

        // Validate symptoms terminology
        if (diseaseData.symptoms) {
            const symptomsValidation = this.validateSymptoms(diseaseData.symptoms);
            validation.correctedData.symptoms = symptomsValidation.standardizedSymptoms;
            if (symptomsValidation.corrections.length > 0) {
                validation.suggestions.push(`Symptom corrections: ${symptomsValidation.corrections.join(', ')}`);
            }
        }

        // Validate inheritance patterns for genetic diseases
        if (diseaseData.inheritance_pattern) {
            const inheritanceValidation = this.validateInheritancePattern(diseaseData.inheritance_pattern);
            if (!inheritanceValidation.isValid) {
                validation.errors.push(...inheritanceValidation.errors);
                validation.isValid = false;
            }
        }

        // Clinical consistency checks
        const clinicalValidation = this.performClinicalValidation(diseaseData);
        if (clinicalValidation.warnings.length > 0) {
            validation.warnings.push(...clinicalValidation.warnings);
        }

        return validation;
    }

    /**
     * Validate family disease record for clinical accuracy
     * @param {object} familyRecord - Family disease record
     * @returns {object} - Validation result
     */
    validateFamilyDiseaseRecord(familyRecord) {
        const validation = {
            isValid: true,
            errors: [],
            warnings: [],
            suggestions: [],
            correctedRecord: { ...familyRecord },
            clinicalFlags: []
        };

        // Validate family member relationship
        const relationshipValidation = this.validateFamilyRelationship(
            familyRecord.family_member,
            familyRecord.inheritance_pattern
        );
        if (!relationshipValidation.isValid) {
            validation.warnings.push(...relationshipValidation.warnings);
        }

        // Validate age consistency if diagnosis date and birth info available
        if (familyRecord.diagnosis_date && familyRecord.family_member_age) {
            const ageValidation = this.validateDiagnosisAge(
                familyRecord.disease_id,
                familyRecord.family_member_age,
                familyRecord.diagnosis_date
            );
            if (ageValidation.flags.length > 0) {
                validation.clinicalFlags.push(...ageValidation.flags);
            }
        }

        // Validate symptom consistency
        if (familyRecord.family_member_has_symptoms) {
            const symptomValidation = this.validateSymptomDiseaseConsistency(
                familyRecord.disease_id,
                familyRecord.family_member_has_symptoms
            );
            if (!symptomValidation.isConsistent) {
                validation.warnings.push(`Some symptoms may not be typical for this disease: ${symptomValidation.atypicalSymptoms.join(', ')}`);
            }
        }

        // Validate treatment appropriateness
        if (familyRecord.treatment_history) {
            const treatmentValidation = this.validateTreatmentHistory(
                familyRecord.disease_id,
                familyRecord.treatment_history
            );
            validation.suggestions.push(...treatmentValidation.suggestions);
        }

        return validation;
    }

    /**
     * Validate and standardize medication/treatment names
     * @param {array} treatments - Array of treatment names
     * @returns {object} - Standardized treatments with validation
     */
    validateTreatments(treatments) {
        const validation = {
            standardizedTreatments: [],
            corrections: [],
            warnings: [],
            rxNormCodes: []
        };

        treatments.forEach(treatment => {
            const standardized = this.standardizeTreatmentName(treatment);
            validation.standardizedTreatments.push(standardized.name);

            if (standardized.corrected) {
                validation.corrections.push(`${treatment} → ${standardized.name}`);
            }

            if (standardized.rxNormCode) {
                validation.rxNormCodes.push({
                    treatment: standardized.name,
                    rxnorm_code: standardized.rxNormCode
                });
            }

            if (standardized.warning) {
                validation.warnings.push(standardized.warning);
            }
        });

        return validation;
    }

    /**
     * Validate laboratory values and codes
     * @param {array} labValues - Laboratory values with codes
     * @returns {object} - Validation result with LOINC codes
     */
    validateLabValues(labValues) {
        const validation = {
            isValid: true,
            standardizedValues: [],
            loincCodes: [],
            rangeValidations: []
        };

        labValues.forEach(labValue => {
            const standardized = this.standardizeLabValue(labValue);
            validation.standardizedValues.push(standardized);

            if (standardized.loincCode) {
                validation.loincCodes.push(standardized.loincCode);
            }

            // Validate reference ranges
            const rangeValidation = this.validateReferenceRange(
                standardized.test,
                standardized.value,
                standardized.unit
            );
            validation.rangeValidations.push(rangeValidation);
        });

        return validation;
    }

    /**
     * Perform comprehensive clinical validation using rule engine
     * @param {object} clinicalData - Complete clinical data for validation
     * @returns {object} - Clinical validation results
     */
    performComprehensiveClinicalValidation(clinicalData) {
        const validation = {
            overallRiskScore: 0,
            clinicalAlerts: [],
            recommendations: [],
            requiresReview: false,
            validationRules: []
        };

        // Apply clinical validation rules
        this.clinicalRules.forEach(rule => {
            const ruleResult = this.applyValidationRule(rule, clinicalData);
            if (ruleResult.triggered) {
                validation.validationRules.push(ruleResult);
                validation.overallRiskScore += ruleResult.riskScore;

                if (ruleResult.alert) {
                    validation.clinicalAlerts.push(ruleResult.alert);
                }

                if (ruleResult.recommendation) {
                    validation.recommendations.push(ruleResult.recommendation);
                }
            }
        });

        // Determine if medical professional review is required
        validation.requiresReview = validation.overallRiskScore > 50 || validation.clinicalAlerts.length > 2;

        return validation;
    }

    // Private validation methods

    validateICD10Code(code, diseaseName) {
        // In production, this would integrate with WHO ICD-10 API or database
        const validation = { isValid: true, errors: [] };

        // Basic format validation
        const icd10Pattern = /^[A-Z]\d{2}(\.\d{1,2})?$/;
        if (!icd10Pattern.test(code)) {
            validation.isValid = false;
            validation.errors.push(`Invalid ICD-10 format: ${code}`);
        }

        // Category validation (basic)
        const category = code.charAt(0);
        const categoryRanges = {
            'A': 'Certain infectious and parasitic diseases',
            'B': 'Certain infectious and parasitic diseases',
            'C': 'Neoplasms',
            'D': 'Neoplasms / Diseases of blood',
            'E': 'Endocrine, nutritional and metabolic diseases',
            'F': 'Mental and behavioural disorders',
            'G': 'Diseases of the nervous system',
            'H': 'Diseases of the eye / Diseases of the ear',
            'I': 'Diseases of the circulatory system',
            'J': 'Diseases of the respiratory system',
            'K': 'Diseases of the digestive system',
            'L': 'Diseases of the skin',
            'M': 'Diseases of the musculoskeletal system',
            'N': 'Diseases of the genitourinary system',
            'O': 'Pregnancy, childbirth and the puerperium',
            'P': 'Certain conditions originating in the perinatal period',
            'Q': 'Congenital malformations',
            'R': 'Symptoms, signs and abnormal findings',
            'S': 'Injury, poisoning',
            'T': 'Injury, poisoning',
            'V': 'External causes of morbidity and mortality',
            'W': 'External causes of morbidity and mortality',
            'X': 'External causes of morbidity and mortality',
            'Y': 'External causes of morbidity and mortality',
            'Z': 'Factors influencing health status'
        };

        if (!categoryRanges[category]) {
            validation.isValid = false;
            validation.errors.push(`Unknown ICD-10 category: ${category}`);
        }

        return validation;
    }

    validateSNOMEDCodes(codes) {
        const validation = { isValid: true, warnings: [] };

        codes.forEach(code => {
            // Basic SNOMED CT format validation
            if (!/^\d{6,18}$/.test(code)) {
                validation.warnings.push(`Invalid SNOMED CT format: ${code}`);
            }
        });

        return validation;
    }

    validateDiseaseName(name) {
        // In production, this would use NLP and medical terminology APIs
        const standardizedName = name
            .replace(/\bdisease\b/gi, 'Disease')
            .replace(/\bsyndrome\b/gi, 'Syndrome')
            .replace(/\bdisorder\b/gi, 'Disorder');

        return { standardizedName };
    }

    validateSymptoms(symptoms) {
        const standardizedSymptoms = [];
        const corrections = [];

        symptoms.forEach(symptom => {
            let standardized = symptom.toLowerCase();

            // Common symptom standardizations
            const symptomMappings = {
                'headache': 'headache',
                'head ache': 'headache',
                'stomach ache': 'abdominal pain',
                'tummy ache': 'abdominal pain',
                'feeling sick': 'nausea',
                'throwing up': 'vomiting',
                'short of breath': 'dyspnea',
                'trouble breathing': 'dyspnea',
                'chest pain': 'chest pain',
                'fatigue': 'fatigue',
                'tiredness': 'fatigue',
                'exhaustion': 'fatigue'
            };

            if (symptomMappings[standardized] && symptomMappings[standardized] !== standardized) {
                corrections.push(`${symptom} → ${symptomMappings[standardized]}`);
                standardized = symptomMappings[standardized];
            }

            standardizedSymptoms.push(standardized);
        });

        return { standardizedSymptoms, corrections };
    }

    validateInheritancePattern(pattern) {
        const validPatterns = [
            'autosomal_dominant',
            'autosomal_recessive',
            'x_linked_dominant',
            'x_linked_recessive',
            'y_linked',
            'mitochondrial',
            'complex',
            'multifactorial',
            'somatic',
            'unknown'
        ];

        if (!validPatterns.includes(pattern)) {
            return {
                isValid: false,
                errors: [`Invalid inheritance pattern: ${pattern}. Valid patterns: ${validPatterns.join(', ')}`]
            };
        }

        return { isValid: true, errors: [] };
    }

    validateFamilyRelationship(relationship, inheritancePattern) {
        const validation = { isValid: true, warnings: [] };

        // Check inheritance pattern consistency
        if (inheritancePattern === 'x_linked_recessive' && relationship === 'father') {
            validation.warnings.push('X-linked recessive diseases are rarely passed from father to son');
        }

        if (inheritancePattern === 'y_linked' && ['mother', 'daughter'].includes(relationship)) {
            validation.warnings.push('Y-linked inheritance only occurs from father to son');
        }

        if (inheritancePattern === 'mitochondrial' && relationship === 'father') {
            validation.warnings.push('Mitochondrial diseases are typically inherited from mother');
        }

        return validation;
    }

    validateDiagnosisAge(diseaseId, age, diagnosisDate) {
        // In production, this would check against disease-specific age distributions
        const flags = [];

        // Example: Early-onset Alzheimer's
        if (diseaseId === 1 && age < 65) { // Assuming disease ID 1 is Alzheimer's
            flags.push({
                type: 'early_onset',
                message: 'Early-onset Alzheimer\'s disease (before age 65) - consider genetic counseling',
                severity: 'high'
            });
        }

        // Example: Pediatric diseases in adults
        if (age > 18) {
            const pediatricDiseases = [/* list of pediatric disease IDs */];
            if (pediatricDiseases.includes(diseaseId)) {
                flags.push({
                    type: 'adult_pediatric_disease',
                    message: 'This disease typically affects children - verify diagnosis',
                    severity: 'medium'
                });
            }
        }

        return { flags };
    }

    validateSymptomDiseaseConsistency(diseaseId, symptoms) {
        // In production, this would use a comprehensive symptom-disease database
        const validation = { isConsistent: true, atypicalSymptoms: [] };

        // Example symptom-disease mappings
        const diseaseSymptoms = {
            1: ['memory loss', 'confusion', 'disorientation', 'language problems'], // Alzheimer's
            2: ['joint pain', 'stiffness', 'swelling', 'reduced range of motion'] // Arthritis
        };

        const expectedSymptoms = diseaseSymptoms[diseaseId] || [];
        if (expectedSymptoms.length > 0) {
            symptoms.forEach(symptom => {
                if (!expectedSymptoms.some(expected => expected.includes(symptom.toLowerCase()))) {
                    validation.atypicalSymptoms.push(symptom);
                    validation.isConsistent = false;
                }
            });
        }

        return validation;
    }

    validateTreatmentHistory(diseaseId, treatments) {
        const suggestions = [];

        // Example treatment validations
        treatments.forEach(treatment => {
            if (treatment.toLowerCase().includes('aspirin') && diseaseId === 1) {
                suggestions.push('Aspirin may interact with Alzheimer\'s medications - consult healthcare provider');
            }
        });

        return { suggestions };
    }

    standardizeTreatmentName(treatment) {
        // In production, this would integrate with RxNorm/FDA drug databases
        const standardized = { name: treatment, corrected: false };

        // Common medication name standardizations
        const drugMappings = {
            'tylenol': 'Acetaminophen',
            'advil': 'Ibuprofen',
            'motrin': 'Ibuprofen',
            'aleve': 'Naproxen'
        };

        const lowerTreatment = treatment.toLowerCase();
        if (drugMappings[lowerTreatment]) {
            standardized.name = drugMappings[lowerTreatment];
            standardized.corrected = true;
            standardized.rxNormCode = this.getRxNormCode(drugMappings[lowerTreatment]);
        }

        return standardized;
    }

    standardizeLabValue(labValue) {
        // Standardize laboratory test names and units
        return {
            test: labValue.test,
            value: labValue.value,
            unit: this.standardizeUnit(labValue.unit),
            loincCode: this.getLoincCode(labValue.test)
        };
    }

    validateReferenceRange(test, value, unit) {
        // In production, this would use comprehensive reference range databases
        return {
            test: test,
            value: value,
            unit: unit,
            withinNormalRange: true, // Simplified
            referenceRange: '0-100', // Simplified
            flags: []
        };
    }

    initializeClinicalRules() {
        return [
            {
                id: 'genetic_counseling_recommendation',
                name: 'Genetic Counseling Recommendation',
                condition: (data) => data.inheritance_pattern && ['autosomal_dominant', 'autosomal_recessive'].includes(data.inheritance_pattern),
                action: {
                    riskScore: 20,
                    alert: 'Consider genetic counseling for inherited conditions',
                    recommendation: 'Genetic counseling recommended for family planning decisions'
                }
            },
            {
                id: 'early_onset_flag',
                name: 'Early Onset Disease Flag',
                condition: (data) => data.diagnosis_age && data.diagnosis_age < 40 && data.disease_category === 'neurological',
                action: {
                    riskScore: 30,
                    alert: 'Early-onset neurological condition detected',
                    recommendation: 'Consider comprehensive neurological evaluation'
                }
            }
        ];
    }

    applyValidationRule(rule, data) {
        const result = {
            ruleId: rule.id,
            ruleName: rule.name,
            triggered: false,
            riskScore: 0,
            alert: null,
            recommendation: null
        };

        if (rule.condition(data)) {
            result.triggered = true;
            result.riskScore = rule.action.riskScore;
            result.alert = rule.action.alert;
            result.recommendation = rule.action.recommendation;
        }

        return result;
    }

    // Helper methods for terminology lookups
    getRxNormCode(drugName) {
        // In production, integrate with RxNorm API
        return null;
    }

    getLoincCode(testName) {
        // In production, integrate with LOINC database
        return null;
    }

    standardizeUnit(unit) {
        const unitMappings = {
            'mg/dl': 'mg/dL',
            'mg/L': 'mg/L',
            'mmol/L': 'mmol/L',
            'g/L': 'g/L'
        };
        return unitMappings[unit] || unit;
    }

    getICD11Mapping(icd10Code) {
        // In production, this would use WHO ICD-11 mapping tables
        return this.icd10ToIcd11Mapping[icd10Code] || null;
    }

    suggestICD10Code(diseaseName) {
        // In production, this would use NLP and medical terminology matching
        const suggestions = {
            'alzheimer': 'G30.9',
            'diabetes': 'E11.9',
            'hypertension': 'I10',
            'asthma': 'J45.9'
        };

        const lowerName = diseaseName.toLowerCase();
        for (const [key, code] of Object.entries(suggestions)) {
            if (lowerName.includes(key)) {
                return code;
            }
        }
        return null;
    }
}

module.exports = MedicalValidationService;