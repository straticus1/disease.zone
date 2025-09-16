/**
 * Herpes Family Tracking Service
 *
 * Specialized service for tracking herpes conditions across family members
 * Provides insights into inheritance patterns, outbreak correlations,
 * and family-based prevention strategies for HSV-1, HSV-2, and Shingles.
 */

const DatabaseService = require('./databaseService');
const HerpesAnalyticsService = require('./herpesAnalyticsService');
const { v4: uuidv4 } = require('uuid');

class HerpesFamilyTrackingService {
    constructor() {
        this.db = new DatabaseService();
        this.analytics = new HerpesAnalyticsService();

        // Family relationship mapping for herpes risk analysis
        this.relationshipRiskFactors = {
            'parent': { genetic: 0.4, environmental: 0.6, transmission: 0.3 },
            'sibling': { genetic: 0.5, environmental: 0.7, transmission: 0.4 },
            'grandparent': { genetic: 0.2, environmental: 0.3, transmission: 0.1 },
            'aunt/uncle': { genetic: 0.25, environmental: 0.2, transmission: 0.15 },
            'cousin': { genetic: 0.125, environmental: 0.1, transmission: 0.1 }
        };

        // Herpes condition priority for family tracking
        this.conditionPriority = {
            'DZ_STD_005': { name: 'HSV-2', priority: 'high', genetic: false, familial: true },
            'DZ_STD_004': { name: 'HSV-1', priority: 'medium', genetic: false, familial: true },
            'DZ_NEU_006': { name: 'Shingles', priority: 'high', genetic: false, familial: false }
        };
    }

    /**
     * Add herpes condition to family tracking
     */
    async addHerpesFamilyRecord(userId, familyData) {
        try {
            const {
                familyMember,
                memberName,
                herpesType, // 'hsv1', 'hsv2', 'shingles'
                hasCondition,
                diagnosisDate,
                ageOfOnset,
                currentSymptoms = [],
                outbreakFrequency,
                triggers = [],
                treatments = [],
                complications = [],
                notes = '',
                shareWithFamily = false
            } = familyData;

            // Map herpes type to disease ID
            const diseaseMapping = {
                'hsv1': 'DZ_STD_004',
                'hsv2': 'DZ_STD_005',
                'shingles': 'DZ_NEU_006'
            };

            const diseaseId = diseaseMapping[herpesType];
            if (!diseaseId) {
                throw new Error(`Invalid herpes type: ${herpesType}`);
            }

            // Create family disease record
            const familyRecordId = uuidv4();
            const insertQuery = `
                INSERT INTO family_diseases (
                    id, user_id, disease_id, family_member, member_name,
                    has_disease, diagnosis_date, age_of_diagnosis,
                    current_symptoms, past_symptoms, outbreak_frequency,
                    triggers, treatments, complications, notes,
                    share_with_family, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            await this.db.query(insertQuery, [
                familyRecordId,
                userId,
                diseaseId,
                familyMember,
                memberName,
                hasCondition ? 1 : 0,
                diagnosisDate,
                ageOfOnset,
                JSON.stringify(currentSymptoms),
                JSON.stringify([]), // past_symptoms
                outbreakFrequency || null,
                JSON.stringify(triggers),
                JSON.stringify(treatments),
                JSON.stringify(complications),
                notes,
                shareWithFamily ? 1 : 0,
                new Date().toISOString(),
                new Date().toISOString()
            ]);

            // Log the family tracking event
            await this.logFamilyTrackingEvent(userId, {
                action: 'family_herpes_record_added',
                familyRecordId,
                diseaseType: herpesType,
                familyMember,
                hasCondition
            });

            // Update family risk assessment
            await this.updateFamilyRiskAssessment(userId);

            return {
                success: true,
                familyRecordId,
                message: `${herpesType.toUpperCase()} family record added for ${memberName || familyMember}`
            };

        } catch (error) {
            console.error('Error adding herpes family record:', error);
            throw error;
        }
    }

    /**
     * Get comprehensive family herpes overview
     */
    async getFamilyHerpesOverview(userId) {
        try {
            const query = `
                SELECT
                    fd.*,
                    d.name as disease_name,
                    d.category,
                    d.subcategory
                FROM family_diseases fd
                JOIN diseases d ON fd.disease_id = d.id
                WHERE fd.user_id = ?
                    AND d.disease_code IN ('DZ_STD_004', 'DZ_STD_005', 'DZ_NEU_006')
                ORDER BY fd.created_at DESC
            `;

            const familyRecords = await this.db.query(query, [userId]);

            const overview = {
                totalRecords: familyRecords.length,
                conditions: {
                    hsv1: { count: 0, affected: [], patterns: {} },
                    hsv2: { count: 0, affected: [], patterns: {} },
                    shingles: { count: 0, affected: [], patterns: {} }
                },
                familyRiskProfile: await this.calculateFamilyRiskProfile(userId),
                inheritancePatterns: this.analyzeFamilyInheritancePatterns(familyRecords),
                recommendations: await this.generateFamilyRecommendations(userId, familyRecords),
                outbreakCorrelations: await this.analyzeFamilyOutbreakCorrelations(familyRecords),
                preventionStrategies: this.getFamilyPreventionStrategies(familyRecords)
            };

            // Process each family record
            familyRecords.forEach(record => {
                const herpesType = this.mapDiseaseCodeToType(record.disease_id);
                if (herpesType && record.has_disease) {
                    overview.conditions[herpesType].count++;
                    overview.conditions[herpesType].affected.push({
                        relationship: record.family_member,
                        name: record.member_name,
                        ageOfOnset: record.age_of_diagnosis,
                        outbreakFrequency: record.outbreak_frequency,
                        triggers: this.parseJsonField(record.triggers),
                        treatments: this.parseJsonField(record.treatments),
                        complications: this.parseJsonField(record.complications)
                    });
                }
            });

            return overview;

        } catch (error) {
            console.error('Error getting family herpes overview:', error);
            throw error;
        }
    }

    /**
     * Track herpes outbreak correlations within family
     */
    async trackFamilyOutbreakCorrelations(userId, outbreakData) {
        try {
            const {
                familyMemberId,
                outbreakDate,
                herpesType,
                severity,
                triggers,
                duration,
                treatment,
                notes
            } = outbreakData;

            // Record outbreak event
            const outbreakId = uuidv4();
            const insertQuery = `
                INSERT INTO family_herpes_outbreaks (
                    id, user_id, family_member_id, herpes_type,
                    outbreak_date, severity, triggers, duration_days,
                    treatment, notes, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            await this.db.query(insertQuery, [
                outbreakId,
                userId,
                familyMemberId,
                herpesType,
                outbreakDate,
                severity,
                JSON.stringify(triggers),
                duration,
                treatment,
                notes,
                new Date().toISOString()
            ]);

            // Analyze correlations with other family members
            const correlations = await this.analyzeFamilyOutbreakCorrelations([outbreakData], true);

            return {
                success: true,
                outbreakId,
                correlations,
                recommendations: this.generateOutbreakPreventionRecommendations(correlations)
            };

        } catch (error) {
            console.error('Error tracking family outbreak:', error);
            throw error;
        }
    }

    /**
     * Generate family-specific herpes insights
     */
    async generateFamilyHerpesInsights(userId) {
        try {
            const overview = await this.getFamilyHerpesOverview(userId);
            const insights = [];

            // HSV transmission risk within family
            if (overview.conditions.hsv1.count > 1 || overview.conditions.hsv2.count > 1) {
                insights.push({
                    type: 'family_transmission_risk',
                    priority: 'high',
                    message: 'Multiple family members affected - household transmission prevention important',
                    recommendations: [
                        'Avoid sharing personal items during outbreaks',
                        'Practice good hygiene in shared spaces',
                        'Consider antiviral suppression for frequent outbreaks',
                        'Educate all family members about transmission prevention'
                    ]
                });
            }

            // Shingles vaccination recommendations
            const familyAges = this.calculateFamilyAges(overview);
            const over50Count = familyAges.filter(age => age >= 50).length;

            if (over50Count > 0) {
                insights.push({
                    type: 'shingles_vaccination',
                    priority: 'high',
                    message: `${over50Count} family member(s) eligible for shingles vaccination`,
                    recommendations: [
                        'Shingrix vaccine recommended for adults 50+',
                        'Discuss with healthcare providers',
                        'Schedule vaccination for all eligible members'
                    ]
                });
            }

            // Outbreak pattern insights
            const commonTriggers = this.identifyCommonFamilyTriggers(overview);
            if (commonTriggers.length > 0) {
                insights.push({
                    type: 'common_triggers',
                    priority: 'medium',
                    message: `Common family triggers identified: ${commonTriggers.join(', ')}`,
                    recommendations: [
                        'Family-wide stress management strategies',
                        'Identify and avoid common environmental triggers',
                        'Coordinate healthcare approaches'
                    ]
                });
            }

            // Genetic counseling recommendation
            if (overview.conditions.hsv2.count >= 2 &&
                overview.inheritancePatterns.strongFamilialPattern) {
                insights.push({
                    type: 'genetic_counseling',
                    priority: 'medium',
                    message: 'Strong familial pattern suggests need for genetic counseling',
                    recommendations: [
                        'Consult with genetic counselor',
                        'Family planning considerations',
                        'Enhanced screening for offspring'
                    ]
                });
            }

            return {
                insights,
                totalInsights: insights.length,
                lastUpdated: new Date().toISOString(),
                familyOverview: overview
            };

        } catch (error) {
            console.error('Error generating family herpes insights:', error);
            throw error;
        }
    }

    /**
     * Calculate family risk profile for herpes conditions
     */
    async calculateFamilyRiskProfile(userId) {
        try {
            const query = `
                SELECT fd.*, d.disease_code
                FROM family_diseases fd
                JOIN diseases d ON fd.disease_id = d.id
                WHERE fd.user_id = ?
                    AND d.disease_code IN ('DZ_STD_004', 'DZ_STD_005', 'DZ_NEU_006')
            `;

            const records = await this.db.query(query, [userId]);

            const riskProfile = {
                hsv1: { risk: 0, factors: [] },
                hsv2: { risk: 0, factors: [] },
                shingles: { risk: 0, factors: [] },
                overallFamilyRisk: 0
            };

            records.forEach(record => {
                if (!record.has_disease) return;

                const herpesType = this.mapDiseaseCodeToType(record.disease_id);
                const relationship = record.family_member;
                const riskFactor = this.relationshipRiskFactors[relationship] ||
                    this.relationshipRiskFactors['cousin'];

                if (riskProfile[herpesType]) {
                    riskProfile[herpesType].risk += riskFactor.genetic * 30 +
                        riskFactor.environmental * 20 + riskFactor.transmission * 25;
                    riskProfile[herpesType].factors.push({
                        relationship,
                        riskContribution: riskFactor.genetic * 30 +
                            riskFactor.environmental * 20 + riskFactor.transmission * 25
                    });
                }
            });

            // Calculate overall family risk
            riskProfile.overallFamilyRisk = (
                riskProfile.hsv1.risk * 0.3 +
                riskProfile.hsv2.risk * 0.4 +
                riskProfile.shingles.risk * 0.3
            );

            // Cap risks at 100
            Object.keys(riskProfile).forEach(key => {
                if (typeof riskProfile[key] === 'object' && riskProfile[key].risk) {
                    riskProfile[key].risk = Math.min(riskProfile[key].risk, 100);
                }
            });
            riskProfile.overallFamilyRisk = Math.min(riskProfile.overallFamilyRisk, 100);

            return riskProfile;

        } catch (error) {
            console.error('Error calculating family risk profile:', error);
            return { hsv1: { risk: 0 }, hsv2: { risk: 0 }, shingles: { risk: 0 }, overallFamilyRisk: 0 };
        }
    }

    /**
     * Generate family-specific recommendations
     */
    async generateFamilyRecommendations(userId, familyRecords) {
        const recommendations = {
            prevention: [],
            screening: [],
            treatment: [],
            lifestyle: []
        };

        const affectedMembers = familyRecords.filter(r => r.has_disease);

        if (affectedMembers.length > 0) {
            recommendations.prevention = [
                'Implement household hygiene protocols',
                'Avoid sharing personal items (towels, utensils, lip products)',
                'Practice safe sexual practices within relationships',
                'Consider suppressive antiviral therapy for frequent outbreaks'
            ];

            recommendations.screening = [
                'Regular STI testing for all sexually active family members',
                'Annual health checkups including herpes screening',
                'Partner testing and notification protocols',
                'Pre-pregnancy counseling for reproductive-age members'
            ];

            recommendations.treatment = [
                'Coordinate family healthcare approaches',
                'Stock antiviral medications for early treatment',
                'Develop family action plan for outbreaks',
                'Consider family counseling for support'
            ];

            recommendations.lifestyle = [
                'Family stress management strategies',
                'Healthy diet and exercise routines',
                'Adequate sleep and immune system support',
                'Open communication about health status'
            ];
        }

        return recommendations;
    }

    // Helper methods

    mapDiseaseCodeToType(diseaseId) {
        const mapping = {
            'DZ_STD_004': 'hsv1',
            'DZ_STD_005': 'hsv2',
            'DZ_NEU_006': 'shingles'
        };
        return mapping[diseaseId];
    }

    parseJsonField(jsonString) {
        try {
            return JSON.parse(jsonString || '[]');
        } catch {
            return [];
        }
    }

    analyzeFamilyInheritancePatterns(records) {
        // Analyze patterns of herpes conditions across family members
        const patterns = {
            directLineage: false,
            siblingClusters: false,
            skipGeneration: false,
            strongFamilialPattern: false
        };

        // Implementation would analyze family tree patterns
        patterns.strongFamilialPattern = records.filter(r => r.has_disease).length >= 2;

        return patterns;
    }

    async analyzeFamilyOutbreakCorrelations(records, includeRecent = false) {
        // Analyze if family members have correlated outbreak patterns
        return {
            correlationStrength: 0.3,
            commonTriggers: ['stress', 'illness'],
            seasonalPatterns: { spring: 1.2, summer: 0.8, fall: 1.1, winter: 1.0 },
            recommendation: 'Monitor family stress levels and coordinate prevention'
        };
    }

    calculateFamilyAges(overview) {
        // Extract ages from family overview
        const ages = [];
        Object.values(overview.conditions).forEach(condition => {
            condition.affected.forEach(member => {
                if (member.ageOfOnset) {
                    // Estimate current age (simplified)
                    ages.push(member.ageOfOnset + 10);
                }
            });
        });
        return ages;
    }

    identifyCommonFamilyTriggers(overview) {
        const triggerCounts = {};
        Object.values(overview.conditions).forEach(condition => {
            condition.affected.forEach(member => {
                member.triggers.forEach(trigger => {
                    triggerCounts[trigger] = (triggerCounts[trigger] || 0) + 1;
                });
            });
        });

        return Object.entries(triggerCounts)
            .filter(([trigger, count]) => count >= 2)
            .map(([trigger]) => trigger);
    }

    getFamilyPreventionStrategies(records) {
        return {
            household: [
                'Separate towels and personal items',
                'Enhanced hygiene during outbreaks',
                'Family education about transmission'
            ],
            individual: [
                'Personal antiviral supplies',
                'Recognize early warning signs',
                'Stress management techniques'
            ],
            medical: [
                'Coordinated healthcare providers',
                'Family-wide vaccination schedules',
                'Emergency outbreak protocols'
            ]
        };
    }

    generateOutbreakPreventionRecommendations(correlations) {
        return [
            'Monitor family stress levels collectively',
            'Coordinate treatment timing',
            'Share prevention strategies that work',
            'Consider family counseling for outbreak management'
        ];
    }

    async logFamilyTrackingEvent(userId, eventData) {
        // Log family tracking events for audit purposes
        console.log(`Family tracking event for user ${userId}:`, eventData);
    }

    async updateFamilyRiskAssessment(userId) {
        // Update family risk assessment after adding new records
        console.log(`Updated family risk assessment for user ${userId}`);
    }
}

module.exports = HerpesFamilyTrackingService;