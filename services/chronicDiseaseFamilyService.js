/**
 * Chronic Disease Family Tracking Service
 *
 * Specialized service for tracking hereditary patterns of cardiovascular disease,
 * diabetes, cancer, and other chronic conditions across family members.
 * Provides genetic risk assessment, inheritance pattern analysis, and family-based
 * prevention strategies.
 */

const DatabaseService = require('./databaseService');
const ChronicDiseaseRiskService = require('./chronicDiseaseRiskService');
const { v4: uuidv4 } = require('uuid');

class ChronicDiseaseFamilyService {
    constructor() {
        this.db = new DatabaseService();
        this.riskService = new ChronicDiseaseRiskService();

        // Hereditary risk patterns for chronic diseases
        this.inheritancePatterns = {
            cardiovascular: {
                'coronary_artery_disease': {
                    heritability: 0.57,
                    familialRisk: { parent: 1.7, sibling: 1.4, both_parents: 2.6 },
                    earlyOnsetFactor: 2.3
                },
                'hypertension': {
                    heritability: 0.62,
                    familialRisk: { parent: 1.8, sibling: 1.5, both_parents: 3.1 },
                    polygenic: true
                },
                'stroke': {
                    heritability: 0.37,
                    familialRisk: { parent: 1.3, sibling: 1.2, both_parents: 1.9 },
                    subtypeVariation: true
                },
                'atrial_fibrillation': {
                    heritability: 0.62,
                    familialRisk: { parent: 2.3, sibling: 2.1, both_parents: 4.7 },
                    earlyOnsetFactor: 3.2
                }
            },
            diabetes: {
                'type2_diabetes': {
                    heritability: 0.72,
                    familialRisk: { parent: 2.4, sibling: 2.5, both_parents: 6.1 },
                    ethnicVariation: true
                },
                'type1_diabetes': {
                    heritability: 0.88,
                    familialRisk: { parent: 15, sibling: 16, both_parents: 35 },
                    hlaAssociation: true
                },
                'gestational_diabetes': {
                    heritability: 0.45,
                    familialRisk: { mother: 4.2, sister: 3.8 },
                    genderSpecific: true
                }
            },
            cancer: {
                'breast_cancer': {
                    heritability: 0.31,
                    familialRisk: { mother: 2.1, sister: 2.3, both: 4.6 },
                    brcaMutations: { brca1: 72, brca2: 69 },
                    earlyOnsetFactor: 3.8
                },
                'prostate_cancer': {
                    heritability: 0.57,
                    familialRisk: { father: 2.5, brother: 3.4, both: 8.8 },
                    earlyOnsetFactor: 4.3
                },
                'colorectal_cancer': {
                    heritability: 0.35,
                    familialRisk: { parent: 1.8, sibling: 1.7, both_parents: 2.8 },
                    lynchSyndrome: 80,
                    fapSyndrome: 100
                },
                'lung_cancer': {
                    heritability: 0.26,
                    familialRisk: { parent: 1.5, sibling: 1.4 },
                    smokingInteraction: 3.2
                },
                'pancreatic_cancer': {
                    heritability: 0.36,
                    familialRisk: { parent: 4.6, sibling: 6.8, both_parents: 32 },
                    highPenetrance: true
                },
                'ovarian_cancer': {
                    heritability: 0.39,
                    familialRisk: { mother: 3.1, sister: 3.7 },
                    brcaMutations: { brca1: 44, brca2: 17 }
                },
                'melanoma': {
                    heritability: 0.58,
                    familialRisk: { parent: 2.2, sibling: 2.6 },
                    cdkn2aMutations: 76
                }
            },
            metabolic: {
                'hyperlipidemia': {
                    heritability: 0.54,
                    familialRisk: { parent: 2.1, sibling: 1.9 },
                    familialHypercholesterolemia: true
                },
                'metabolic_syndrome': {
                    heritability: 0.61,
                    familialRisk: { parent: 1.8, sibling: 1.6 },
                    componentClustering: true
                },
                'obesity': {
                    heritability: 0.73,
                    familialRisk: { parent: 2.7, sibling: 3.2, both_parents: 8.1 },
                    environmentalModulation: true
                }
            }
        };

        // Age-of-onset significance thresholds
        this.earlyOnsetThresholds = {
            'coronary_artery_disease': { male: 55, female: 65 },
            'breast_cancer': 50,
            'prostate_cancer': 55,
            'colorectal_cancer': 50,
            'type2_diabetes': 45,
            'stroke': 45,
            'hypertension': 40
        };

        // Genetic syndromes and high-penetrance mutations
        this.geneticSyndromes = {
            'lynch_syndrome': {
                associatedCancers: ['colorectal', 'endometrial', 'ovarian', 'gastric'],
                penetrance: { colorectal: 80, endometrial: 60 },
                screeningRecommendations: 'intensive_surveillance'
            },
            'brca1_mutation': {
                associatedCancers: ['breast', 'ovarian'],
                penetrance: { breast: 72, ovarian: 44 },
                preventiveOptions: 'prophylactic_surgery'
            },
            'brca2_mutation': {
                associatedCancers: ['breast', 'ovarian', 'prostate', 'pancreatic'],
                penetrance: { breast: 69, ovarian: 17, prostate: 20 },
                preventiveOptions: 'enhanced_screening'
            },
            'familial_hypercholesterolemia': {
                associatedConditions: ['premature_cad', 'myocardial_infarction'],
                penetrance: { cad: 85 },
                treatment: 'aggressive_lipid_management'
            }
        };
    }

    /**
     * Add comprehensive chronic disease family record
     */
    async addChronicDiseaseFamilyRecord(userId, familyData) {
        try {
            const {
                familyMember,
                memberName,
                conditions = [], // Array of chronic conditions
                ageOfOnset = {},
                currentStatus = {},
                treatments = {},
                complications = {},
                lifestyle = {},
                notes = '',
                shareWithFamily = false,
                deceased = false,
                causeOfDeath = null
            } = familyData;

            const familyRecordId = uuidv4();

            // Process each chronic condition
            for (const condition of conditions) {
                await this.addConditionRecord(familyRecordId, userId, {
                    familyMember,
                    memberName,
                    condition,
                    ageOfOnset: ageOfOnset[condition],
                    currentStatus: currentStatus[condition],
                    treatments: treatments[condition] || [],
                    complications: complications[condition] || [],
                    lifestyle,
                    deceased,
                    causeOfDeath
                });
            }

            // Update family risk assessment
            await this.updateFamilyRiskProfile(userId);

            // Generate genetic counseling recommendations if warranted
            const geneticRecommendations = await this.assessGeneticCounselingNeed(userId);

            await this.logFamilyTrackingEvent(userId, {
                action: 'chronic_disease_family_record_added',
                familyRecordId,
                conditions,
                familyMember,
                geneticRecommendations
            });

            return {
                success: true,
                familyRecordId,
                conditions: conditions.length,
                geneticRecommendations,
                message: `Family record added for ${memberName || familyMember} with ${conditions.length} condition(s)`
            };

        } catch (error) {
            console.error('Error adding chronic disease family record:', error);
            throw error;
        }
    }

    /**
     * Get comprehensive family chronic disease analysis
     */
    async getFamilyChronicDiseaseAnalysis(userId) {
        try {
            const query = `
                SELECT
                    fd.*,
                    d.name as disease_name,
                    d.category,
                    d.subcategory,
                    d.disease_code
                FROM family_diseases fd
                JOIN diseases d ON fd.disease_id = d.id
                WHERE fd.user_id = ?
                    AND d.category IN ('cardiovascular', 'cancer', 'metabolic', 'genetic')
                ORDER BY fd.created_at DESC
            `;

            const familyRecords = await this.db.query(query, [userId]);

            const analysis = {
                totalFamilyMembers: new Set(familyRecords.map(r => r.family_member)).size,
                conditionsByCategory: this.groupConditionsByCategory(familyRecords),
                inheritancePatterns: await this.analyzeInheritancePatterns(familyRecords),
                familyRiskProfile: await this.calculateFamilyRiskProfile(userId),
                geneticSyndromeRisk: this.assessGeneticSyndromeRisk(familyRecords),
                earlyOnsetAnalysis: this.analyzeEarlyOnsetPatterns(familyRecords),
                recommendations: await this.generateFamilyRecommendations(userId, familyRecords),
                screeningSchedule: this.createFamilyScreeningSchedule(familyRecords),
                preventionStrategies: this.getFamilyPreventionStrategies(familyRecords),
                geneticCounselingIndications: await this.assessGeneticCounselingNeed(userId)
            };

            return analysis;

        } catch (error) {
            console.error('Error getting family chronic disease analysis:', error);
            throw error;
        }
    }

    /**
     * Calculate personalized family risk multipliers
     */
    async calculateFamilyRiskProfile(userId) {
        try {
            const familyRecords = await this.getFamilyDiseaseRecords(userId);

            const riskProfile = {
                cardiovascular: { multiplier: 1.0, factors: [] },
                diabetes: { multiplier: 1.0, factors: [] },
                cancer: { multiplier: 1.0, factors: [] },
                metabolic: { multiplier: 1.0, factors: [] },
                overallFamilyRisk: 1.0,
                recommendedScreeningAge: {},
                intensifiedSurveillance: []
            };

            // Process each family record
            familyRecords.forEach(record => {
                if (!record.has_disease) return;

                const condition = this.mapDiseaseToCondition(record.disease_name);
                const category = this.getConditionCategory(condition);
                const relationship = record.family_member;
                const ageOfOnset = record.age_of_diagnosis;

                if (this.inheritancePatterns[category] && this.inheritancePatterns[category][condition]) {
                    const inheritanceData = this.inheritancePatterns[category][condition];
                    const familialRisk = inheritanceData.familialRisk[relationship] || 1.0;

                    // Apply early onset multiplier
                    let riskMultiplier = familialRisk;
                    if (ageOfOnset && this.earlyOnsetThresholds[condition] &&
                        ageOfOnset < this.earlyOnsetThresholds[condition]) {
                        riskMultiplier *= inheritanceData.earlyOnsetFactor || 1.5;
                        riskProfile.intensifiedSurveillance.push({
                            condition,
                            reason: 'early_onset_family_history',
                            relative: `${relationship} diagnosed at age ${ageOfOnset}`
                        });
                    }

                    riskProfile[category].multiplier *= riskMultiplier;
                    riskProfile[category].factors.push({
                        condition,
                        relationship,
                        ageOfOnset,
                        riskMultiplier
                    });

                    // Update screening recommendations
                    if (ageOfOnset) {
                        const recommendedAge = Math.max(25, ageOfOnset - 10);
                        if (!riskProfile.recommendedScreeningAge[condition] ||
                            recommendedAge < riskProfile.recommendedScreeningAge[condition]) {
                            riskProfile.recommendedScreeningAge[condition] = recommendedAge;
                        }
                    }
                }
            });

            // Calculate overall family risk
            const categoryRisks = [
                riskProfile.cardiovascular.multiplier,
                riskProfile.diabetes.multiplier,
                riskProfile.cancer.multiplier,
                riskProfile.metabolic.multiplier
            ];

            riskProfile.overallFamilyRisk = categoryRisks.reduce((sum, risk) => sum + risk, 0) / categoryRisks.length;

            return riskProfile;

        } catch (error) {
            console.error('Error calculating family risk profile:', error);
            return { overallFamilyRisk: 1.0 };
        }
    }

    /**
     * Analyze inheritance patterns in family
     */
    async analyzeInheritancePatterns(familyRecords) {
        const patterns = {
            autosomalDominant: [],
            autosomalRecessive: [],
            xLinked: [],
            multifactorial: [],
            sporadic: [],
            clustering: {},
            penetranceAnalysis: {}
        };

        // Group conditions by disease
        const conditionGroups = {};
        familyRecords.forEach(record => {
            const condition = record.disease_name;
            if (!conditionGroups[condition]) {
                conditionGroups[condition] = [];
            }
            conditionGroups[condition].push(record);
        });

        // Analyze each condition group
        Object.entries(conditionGroups).forEach(([condition, records]) => {
            const affectedRelatives = records.filter(r => r.has_disease);

            if (affectedRelatives.length >= 2) {
                const pattern = this.determineInheritancePattern(condition, affectedRelatives);
                patterns[pattern.type].push({
                    condition,
                    affectedCount: affectedRelatives.length,
                    pattern: pattern.description,
                    confidence: pattern.confidence
                });

                // Check for clustering in specific family lines
                const maternalLine = affectedRelatives.filter(r =>
                    ['mother', 'maternal_grandmother', 'maternal_aunt'].includes(r.family_member)
                );
                const paternalLine = affectedRelatives.filter(r =>
                    ['father', 'paternal_grandmother', 'paternal_uncle'].includes(r.family_member)
                );

                if (maternalLine.length >= 2) {
                    patterns.clustering[condition] = { line: 'maternal', count: maternalLine.length };
                } else if (paternalLine.length >= 2) {
                    patterns.clustering[condition] = { line: 'paternal', count: paternalLine.length };
                }
            }
        });

        return patterns;
    }

    /**
     * Assess genetic syndrome risk based on family patterns
     */
    assessGeneticSyndromeRisk(familyRecords) {
        const syndromeRisk = {};

        // Check for Lynch syndrome indicators
        const colorectalCancers = familyRecords.filter(r =>
            r.disease_name.toLowerCase().includes('colorectal') && r.has_disease
        );
        const endometrialCancers = familyRecords.filter(r =>
            r.disease_name.toLowerCase().includes('endometrial') && r.has_disease
        );

        if (colorectalCancers.length >= 2 || (colorectalCancers.length >= 1 && endometrialCancers.length >= 1)) {
            syndromeRisk.lynch_syndrome = {
                risk: 'moderate_to_high',
                indicators: [`${colorectalCancers.length} colorectal cancers`, `${endometrialCancers.length} endometrial cancers`],
                recommendation: 'Genetic counseling and microsatellite instability testing'
            };
        }

        // Check for BRCA syndrome indicators
        const breastCancers = familyRecords.filter(r =>
            r.disease_name.toLowerCase().includes('breast') && r.has_disease
        );
        const ovarianCancers = familyRecords.filter(r =>
            r.disease_name.toLowerCase().includes('ovarian') && r.has_disease
        );

        const earlyBreastCancers = breastCancers.filter(r =>
            r.age_of_diagnosis && r.age_of_diagnosis < 50
        );

        if (breastCancers.length >= 3 || ovarianCancers.length >= 1 || earlyBreastCancers.length >= 1) {
            syndromeRisk.brca_syndrome = {
                risk: 'moderate_to_high',
                indicators: [
                    `${breastCancers.length} breast cancers`,
                    `${ovarianCancers.length} ovarian cancers`,
                    `${earlyBreastCancers.length} early-onset breast cancers`
                ],
                recommendation: 'Genetic counseling and BRCA1/2 testing'
            };
        }

        // Check for familial hypercholesterolemia
        const hypercholesterolemias = familyRecords.filter(r =>
            r.disease_name.toLowerCase().includes('hypercholesterolemia') && r.has_disease
        );
        const earlyCAD = familyRecords.filter(r =>
            r.disease_name.toLowerCase().includes('coronary') && r.has_disease &&
            r.age_of_diagnosis && r.age_of_diagnosis < 55
        );

        if (hypercholesterolemias.length >= 2 || earlyCAD.length >= 2) {
            syndromeRisk.familial_hypercholesterolemia = {
                risk: 'moderate',
                indicators: [`${hypercholesterolemias.length} high cholesterol cases`, `${earlyCAD.length} early CAD cases`],
                recommendation: 'Lipid genetic panel and aggressive lipid management'
            };
        }

        return syndromeRisk;
    }

    /**
     * Analyze early onset patterns
     */
    analyzeEarlyOnsetPatterns(familyRecords) {
        const earlyOnsetCases = familyRecords.filter(record => {
            if (!record.age_of_diagnosis || !record.has_disease) return false;

            const condition = this.mapDiseaseToCondition(record.disease_name);
            const threshold = this.earlyOnsetThresholds[condition];

            return threshold && record.age_of_diagnosis < threshold;
        });

        const analysis = {
            totalEarlyOnsetCases: earlyOnsetCases.length,
            conditionBreakdown: {},
            averageAgeOfOnset: {},
            familyLineAnalysis: {},
            geneticImplications: []
        };

        // Group by condition
        earlyOnsetCases.forEach(record => {
            const condition = this.mapDiseaseToCondition(record.disease_name);

            if (!analysis.conditionBreakdown[condition]) {
                analysis.conditionBreakdown[condition] = [];
            }

            analysis.conditionBreakdown[condition].push({
                relationship: record.family_member,
                ageOfOnset: record.age_of_diagnosis,
                yearsEarly: this.earlyOnsetThresholds[condition] - record.age_of_diagnosis
            });
        });

        // Calculate averages and implications
        Object.entries(analysis.conditionBreakdown).forEach(([condition, cases]) => {
            const ages = cases.map(c => c.ageOfOnset);
            analysis.averageAgeOfOnset[condition] = ages.reduce((sum, age) => sum + age, 0) / ages.length;

            if (cases.length >= 2) {
                analysis.geneticImplications.push({
                    condition,
                    caseCount: cases.length,
                    averageAge: analysis.averageAgeOfOnset[condition],
                    implication: 'Strong genetic component likely',
                    recommendation: 'Genetic counseling recommended'
                });
            }
        });

        return analysis;
    }

    /**
     * Generate family-specific recommendations
     */
    async generateFamilyRecommendations(userId, familyRecords) {
        const recommendations = {
            screening: [],
            prevention: [],
            genetic: [],
            lifestyle: [],
            medical: []
        };

        const affectedConditions = new Set(
            familyRecords.filter(r => r.has_disease).map(r => this.mapDiseaseToCondition(r.disease_name))
        );

        // Screening recommendations
        if (affectedConditions.has('breast_cancer')) {
            recommendations.screening.push({
                test: 'Mammography and breast MRI',
                startAge: 40,
                frequency: 'annually',
                indication: 'Family history of breast cancer'
            });
        }

        if (affectedConditions.has('colorectal_cancer')) {
            recommendations.screening.push({
                test: 'Colonoscopy',
                startAge: 40,
                frequency: 'every 2-3 years',
                indication: 'Family history of colorectal cancer'
            });
        }

        if (affectedConditions.has('coronary_artery_disease')) {
            recommendations.screening.push({
                test: 'Lipid panel and coronary calcium score',
                startAge: 35,
                frequency: 'every 2-3 years',
                indication: 'Family history of CAD'
            });
        }

        if (affectedConditions.has('type2_diabetes')) {
            recommendations.screening.push({
                test: 'HbA1c and fasting glucose',
                startAge: 35,
                frequency: 'every 3 years',
                indication: 'Family history of diabetes'
            });
        }

        // Genetic counseling recommendations
        const geneticSyndromes = this.assessGeneticSyndromeRisk(familyRecords);
        Object.entries(geneticSyndromes).forEach(([syndrome, risk]) => {
            recommendations.genetic.push({
                service: 'Genetic counseling',
                indication: syndrome,
                urgency: risk.risk,
                details: risk.recommendation
            });
        });

        // Prevention recommendations
        recommendations.prevention = [
            'Maintain healthy weight (BMI 18.5-24.9)',
            'Regular physical activity (150+ minutes/week)',
            'Heart-healthy diet (Mediterranean or DASH)',
            'Avoid tobacco and limit alcohol',
            'Manage stress effectively',
            'Regular health checkups and screening'
        ];

        return recommendations;
    }

    /**
     * Create family-specific screening schedule
     */
    createFamilyScreeningSchedule(familyRecords) {
        const schedule = {
            immediate: [], // Next 3 months
            shortTerm: [], // 3-12 months
            annual: [],
            biennial: [],
            longTerm: [] // >2 years
        };

        const affectedConditions = familyRecords.filter(r => r.has_disease);

        affectedConditions.forEach(record => {
            const condition = this.mapDiseaseToCondition(record.disease_name);
            const ageOfOnset = record.age_of_diagnosis;

            // Generate screening recommendations based on condition and family history
            const screeningRecs = this.getConditionScreeningRecommendations(condition, ageOfOnset);

            screeningRecs.forEach(rec => {
                schedule[rec.timing].push({
                    test: rec.test,
                    condition: condition,
                    familyConnection: `${record.family_member} diagnosed at age ${ageOfOnset}`,
                    rationale: rec.rationale
                });
            });
        });

        return schedule;
    }

    // Helper methods

    async addConditionRecord(familyRecordId, userId, conditionData) {
        const diseaseId = await this.getDiseaseId(conditionData.condition);

        const insertQuery = `
            INSERT INTO family_diseases (
                id, user_id, disease_id, family_member, member_name,
                has_disease, age_of_diagnosis, current_status,
                treatments, complications, notes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await this.db.query(insertQuery, [
            `${familyRecordId}_${conditionData.condition}`,
            userId,
            diseaseId,
            conditionData.familyMember,
            conditionData.memberName,
            1, // has_disease = true
            conditionData.ageOfOnset,
            conditionData.currentStatus,
            JSON.stringify(conditionData.treatments),
            JSON.stringify(conditionData.complications),
            conditionData.notes || '',
            new Date().toISOString(),
            new Date().toISOString()
        ]);
    }

    async getDiseaseId(conditionName) {
        // Map condition name to disease ID from database
        const query = 'SELECT id FROM diseases WHERE name LIKE ? LIMIT 1';
        const results = await this.db.query(query, [`%${conditionName}%`]);
        return results[0]?.id || null;
    }

    mapDiseaseToCondition(diseaseName) {
        const mapping = {
            'coronary artery disease': 'coronary_artery_disease',
            'heart attack': 'myocardial_infarction',
            'high blood pressure': 'hypertension',
            'diabetes': 'type2_diabetes',
            'breast cancer': 'breast_cancer',
            'prostate cancer': 'prostate_cancer',
            'lung cancer': 'lung_cancer',
            'colorectal cancer': 'colorectal_cancer',
            'high cholesterol': 'hyperlipidemia'
        };

        const lowercaseName = diseaseName.toLowerCase();
        return mapping[lowercaseName] || lowercaseName.replace(/\s+/g, '_');
    }

    getConditionCategory(condition) {
        const categories = {
            'coronary_artery_disease': 'cardiovascular',
            'hypertension': 'cardiovascular',
            'stroke': 'cardiovascular',
            'atrial_fibrillation': 'cardiovascular',
            'type2_diabetes': 'diabetes',
            'type1_diabetes': 'diabetes',
            'breast_cancer': 'cancer',
            'prostate_cancer': 'cancer',
            'lung_cancer': 'cancer',
            'colorectal_cancer': 'cancer',
            'hyperlipidemia': 'metabolic',
            'obesity': 'metabolic'
        };

        return categories[condition] || 'other';
    }

    groupConditionsByCategory(familyRecords) {
        const groups = {
            cardiovascular: [],
            diabetes: [],
            cancer: [],
            metabolic: [],
            other: []
        };

        familyRecords.forEach(record => {
            if (record.has_disease) {
                const condition = this.mapDiseaseToCondition(record.disease_name);
                const category = this.getConditionCategory(condition);

                groups[category].push({
                    condition: record.disease_name,
                    familyMember: record.family_member,
                    ageOfOnset: record.age_of_diagnosis
                });
            }
        });

        return groups;
    }

    determineInheritancePattern(condition, affectedRelatives) {
        // Simplified inheritance pattern determination
        const relationshipTypes = affectedRelatives.map(r => r.family_member);

        if (relationshipTypes.includes('mother') && relationshipTypes.includes('father')) {
            return {
                type: 'multifactorial',
                description: 'Both parents affected - likely polygenic',
                confidence: 0.7
            };
        } else if (relationshipTypes.filter(r => ['mother', 'father'].includes(r)).length >= 1 &&
                   relationshipTypes.filter(r => ['sibling'].includes(r)).length >= 1) {
            return {
                type: 'autosomalDominant',
                description: 'Parent-to-child transmission pattern',
                confidence: 0.8
            };
        } else {
            return {
                type: 'multifactorial',
                description: 'Complex inheritance likely',
                confidence: 0.6
            };
        }
    }

    getConditionScreeningRecommendations(condition, familyAgeOfOnset) {
        const baseRecommendations = {
            'breast_cancer': [
                { test: 'Mammography', timing: 'annual', rationale: 'Family history screening' },
                { test: 'Breast MRI', timing: 'annual', rationale: 'High-risk screening' }
            ],
            'colorectal_cancer': [
                { test: 'Colonoscopy', timing: 'biennial', rationale: 'Family history screening' }
            ],
            'coronary_artery_disease': [
                { test: 'Lipid panel', timing: 'annual', rationale: 'CAD risk assessment' },
                { test: 'Blood pressure monitoring', timing: 'annual', rationale: 'CVD prevention' }
            ],
            'type2_diabetes': [
                { test: 'HbA1c', timing: 'annual', rationale: 'Diabetes screening' },
                { test: 'Fasting glucose', timing: 'biennial', rationale: 'Prediabetes detection' }
            ]
        };

        return baseRecommendations[condition] || [];
    }

    getFamilyPreventionStrategies(familyRecords) {
        return {
            lifestyle: [
                'Family-wide healthy eating initiatives',
                'Group exercise and physical activity',
                'Tobacco cessation support for all members',
                'Stress management and mental health support'
            ],
            medical: [
                'Coordinated family healthcare providers',
                'Shared medical history documentation',
                'Family-based screening schedules',
                'Genetic counseling for high-risk families'
            ],
            environmental: [
                'Reduce household environmental risk factors',
                'Create supportive healthy environment',
                'Education about hereditary disease risks',
                'Emergency planning for family health crises'
            ]
        };
    }

    async getFamilyDiseaseRecords(userId) {
        const query = `
            SELECT fd.*, d.name as disease_name, d.category
            FROM family_diseases fd
            JOIN diseases d ON fd.disease_id = d.id
            WHERE fd.user_id = ? AND fd.has_disease = 1
        `;
        return await this.db.query(query, [userId]);
    }

    async assessGeneticCounselingNeed(userId) {
        const familyRecords = await this.getFamilyDiseaseRecords(userId);
        const syndromeRisk = this.assessGeneticSyndromeRisk(familyRecords);

        const recommendations = [];

        if (Object.keys(syndromeRisk).length > 0) {
            recommendations.push({
                priority: 'high',
                service: 'Genetic Counseling',
                indication: 'Multiple family cancer/disease patterns suggest hereditary syndrome',
                timeframe: 'Within 3-6 months'
            });
        }

        const earlyOnsetCases = familyRecords.filter(r =>
            r.age_of_diagnosis && r.age_of_diagnosis < (this.earlyOnsetThresholds[this.mapDiseaseToCondition(r.disease_name)] || 999)
        );

        if (earlyOnsetCases.length >= 2) {
            recommendations.push({
                priority: 'moderate',
                service: 'Genetic Risk Assessment',
                indication: 'Multiple early-onset cases in family',
                timeframe: 'Within 6-12 months'
            });
        }

        return recommendations;
    }

    async updateFamilyRiskProfile(userId) {
        // Update family risk profile after adding records
        console.log(`Family risk profile updated for user ${userId}`);
    }

    async logFamilyTrackingEvent(userId, eventData) {
        // Log family tracking events
        console.log(`Family tracking event logged for user ${userId}:`, eventData);
    }
}

module.exports = ChronicDiseaseFamilyService;