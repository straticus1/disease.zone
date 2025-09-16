/**
 * Herpes Analytics and Insights Service
 *
 * Advanced analytics service for HSV-1, HSV-2, and Shingles (Herpes Zoster)
 * Provides outbreak prediction, pattern analysis, and personalized insights
 * for patients and healthcare providers.
 */

const HerpesApiService = require('./herpesApiService');
const DatabaseService = require('./databaseService');
const { performance } = require('perf_hooks');

class HerpesAnalyticsService {
    constructor() {
        this.herpesApi = new HerpesApiService();
        this.db = new DatabaseService();

        // Herpes-specific analytics models
        this.outbreakPatterns = {
            hsv1: {
                averageFrequency: 1.5, // outbreaks per year
                triggerFactors: ['stress', 'illness', 'sun_exposure', 'fatigue'],
                seasonalPattern: { spring: 1.2, summer: 1.4, fall: 1.1, winter: 0.9 },
                durationDays: { min: 7, max: 14, average: 10 }
            },
            hsv2: {
                averageFrequency: 4.2, // outbreaks per year (first year)
                triggerFactors: ['stress', 'menstrual_cycle', 'illness', 'immunosuppression'],
                seasonalPattern: { spring: 1.1, summer: 1.0, fall: 1.2, winter: 1.1 },
                durationDays: { min: 5, max: 12, average: 8 }
            },
            shingles: {
                lifeTimeRisk: 0.33, // 1 in 3 lifetime risk
                ageRisk: { '50-59': 0.05, '60-69': 0.08, '70-79': 0.12, '80+': 0.18 },
                complications: { phn: 0.15, ocular: 0.03, neurological: 0.02 },
                durationDays: { min: 21, max: 35, average: 28 }
            }
        };

        this.riskFactors = {
            transmission: {
                hsv1: ['direct_contact', 'kissing', 'sharing_utensils', 'oral_sex'],
                hsv2: ['sexual_contact', 'multiple_partners', 'other_stis', 'young_age_first_sex'],
                shingles: ['age_over_50', 'immunocompromised', 'stress', 'certain_medications']
            },
            recurrence: {
                hsv1: ['stress', 'illness', 'sun_exposure', 'hormonal_changes'],
                hsv2: ['stress', 'illness', 'menstruation', 'sexual_activity', 'tight_clothing'],
                shingles: ['immunosuppression', 'cancer_treatment', 'organ_transplant', 'aging']
            }
        };
    }

    /**
     * Get comprehensive herpes analytics for a user
     */
    async getUserHerpesAnalytics(userId, timeframe = '1year') {
        const startTime = performance.now();

        try {
            const [
                familyHistory,
                personalHistory,
                riskAssessment,
                outbreakPredictions,
                populationData
            ] = await Promise.all([
                this.getFamilyHerpesHistory(userId),
                this.getPersonalHerpesHistory(userId),
                this.calculateHerpesRiskProfile(userId),
                this.predictOutbreakPatterns(userId),
                this.herpesApi.getHerpesSurveillanceData()
            ]);

            const analytics = {
                userId,
                analysisDate: new Date().toISOString(),
                timeframe,
                summary: {
                    riskLevel: riskAssessment.overallRisk,
                    knownConditions: personalHistory.conditions,
                    familyHistory: familyHistory.summary,
                    outbreakFrequency: personalHistory.outbreakFrequency
                },
                riskAssessment,
                outbreakPredictions,
                insights: await this.generatePersonalInsights(userId, riskAssessment, personalHistory),
                familyAnalytics: this.analyzeFamilyPatterns(familyHistory),
                populationComparison: this.compareToPopulation(riskAssessment, populationData),
                recommendations: await this.generateRecommendations(userId, riskAssessment),
                preventionStrategies: this.getPreventionStrategies(riskAssessment),
                treatmentOptions: await this.getTreatmentOptions(personalHistory.conditions)
            };

            console.log(`Herpes analytics generated in ${performance.now() - startTime}ms`);
            return analytics;

        } catch (error) {
            console.error('Error generating herpes analytics:', error);
            throw error;
        }
    }

    /**
     * Get family herpes history and patterns
     */
    async getFamilyHerpesHistory(userId) {
        try {
            const query = `
                SELECT
                    fd.*,
                    d.name as disease_name,
                    d.category,
                    d.subcategory,
                    d.icd10_codes
                FROM family_diseases fd
                JOIN diseases d ON fd.disease_id = d.id
                WHERE fd.user_id = ?
                    AND (d.name LIKE '%herpes%'
                        OR d.name LIKE '%hsv%'
                        OR d.name LIKE '%shingles%'
                        OR d.name LIKE '%zoster%')
                ORDER BY fd.created_at DESC
            `;

            const familyRecords = await this.db.query(query, [userId]);

            const analysis = {
                totalFamilyMembers: familyRecords.length,
                conditions: {},
                inheritancePatterns: {},
                ageOfOnset: {},
                summary: {
                    herpesHistory: familyRecords.length > 0,
                    affectedRelatives: familyRecords.length,
                    commonConditions: []
                }
            };

            // Analyze family patterns
            familyRecords.forEach(record => {
                const condition = record.disease_name;
                if (!analysis.conditions[condition]) {
                    analysis.conditions[condition] = {
                        count: 0,
                        relatives: [],
                        patterns: {}
                    };
                }

                analysis.conditions[condition].count++;
                analysis.conditions[condition].relatives.push({
                    relationship: record.family_member,
                    hasCondition: record.has_disease,
                    ageOfOnset: record.age_of_diagnosis,
                    symptoms: record.current_symptoms ? record.current_symptoms.split(',') : [],
                    treatments: record.treatments ? record.treatments.split(',') : []
                });
            });

            // Identify most common family conditions
            analysis.summary.commonConditions = Object.entries(analysis.conditions)
                .sort(([,a], [,b]) => b.count - a.count)
                .slice(0, 3)
                .map(([condition, data]) => ({
                    condition,
                    count: data.count,
                    prevalence: (data.count / familyRecords.length * 100).toFixed(1)
                }));

            return analysis;

        } catch (error) {
            console.error('Error fetching family herpes history:', error);
            return { summary: { herpesHistory: false, affectedRelatives: 0, commonConditions: [] } };
        }
    }

    /**
     * Get personal herpes history and track patterns
     */
    async getPersonalHerpesHistory(userId) {
        try {
            const query = `
                SELECT * FROM user_health_records
                WHERE user_id = ?
                    AND (condition_name LIKE '%herpes%'
                        OR condition_name LIKE '%hsv%'
                        OR condition_name LIKE '%shingles%'
                        OR condition_name LIKE '%zoster%')
                ORDER BY record_date DESC
            `;

            const healthRecords = await this.db.query(query, [userId]);

            const analysis = {
                conditions: [],
                outbreakHistory: [],
                outbreakFrequency: 0,
                lastOutbreak: null,
                triggerPatterns: {},
                symptomsTracking: {}
            };

            healthRecords.forEach(record => {
                if (record.record_type === 'condition') {
                    analysis.conditions.push({
                        condition: record.condition_name,
                        diagnosedDate: record.record_date,
                        severity: record.severity,
                        status: record.status
                    });
                } else if (record.record_type === 'outbreak') {
                    analysis.outbreakHistory.push({
                        date: record.record_date,
                        duration: record.duration_days,
                        severity: record.severity,
                        triggers: record.triggers ? record.triggers.split(',') : [],
                        symptoms: record.symptoms ? record.symptoms.split(',') : [],
                        treatment: record.treatment
                    });
                }
            });

            // Calculate outbreak frequency
            if (analysis.outbreakHistory.length > 0) {
                const firstOutbreak = new Date(analysis.outbreakHistory[analysis.outbreakHistory.length - 1].date);
                const lastOutbreak = new Date(analysis.outbreakHistory[0].date);
                const daysBetween = (lastOutbreak - firstOutbreak) / (1000 * 60 * 60 * 24);
                analysis.outbreakFrequency = analysis.outbreakHistory.length / (daysBetween / 365.25);
                analysis.lastOutbreak = lastOutbreak;
            }

            return analysis;

        } catch (error) {
            console.error('Error fetching personal herpes history:', error);
            return { conditions: [], outbreakHistory: [], outbreakFrequency: 0 };
        }
    }

    /**
     * Calculate comprehensive herpes risk profile
     */
    async calculateHerpesRiskProfile(userId) {
        try {
            const [userProfile, familyHistory, personalHistory] = await Promise.all([
                this.getUserProfile(userId),
                this.getFamilyHerpesHistory(userId),
                this.getPersonalHerpesHistory(userId)
            ]);

            const riskFactors = {
                demographic: this.calculateDemographicRisk(userProfile),
                behavioral: this.calculateBehavioralRisk(userProfile),
                family: this.calculateFamilyRisk(familyHistory),
                medical: this.calculateMedicalRisk(userProfile, personalHistory),
                environmental: this.calculateEnvironmentalRisk(userProfile)
            };

            const overallRisk = this.calculateOverallHerpesRisk(riskFactors);

            return {
                overallRisk,
                riskLevel: this.getRiskLevel(overallRisk),
                riskFactors,
                specificRisks: {
                    hsv1: this.calculateHSV1Risk(riskFactors, userProfile),
                    hsv2: this.calculateHSV2Risk(riskFactors, userProfile),
                    shingles: this.calculateShinglesRisk(riskFactors, userProfile)
                },
                modifiableFactors: this.identifyModifiableRiskFactors(riskFactors),
                recommendations: this.generateRiskBasedRecommendations(overallRisk, riskFactors)
            };

        } catch (error) {
            console.error('Error calculating herpes risk profile:', error);
            throw error;
        }
    }

    /**
     * Predict outbreak patterns using machine learning models
     */
    async predictOutbreakPatterns(userId) {
        try {
            const personalHistory = await this.getPersonalHerpesHistory(userId);

            if (personalHistory.outbreakHistory.length < 3) {
                return {
                    prediction: 'insufficient_data',
                    message: 'More outbreak data needed for accurate predictions',
                    recommendations: [
                        'Track outbreak patterns in the app',
                        'Note triggers and symptoms',
                        'Monitor stress levels and health status'
                    ]
                };
            }

            // Analyze outbreak patterns
            const patterns = this.analyzeOutbreakPatterns(personalHistory.outbreakHistory);
            const nextOutbreak = this.predictNextOutbreak(patterns);
            const seasonalRisk = this.calculateSeasonalRisk(patterns);

            return {
                prediction: 'available',
                patterns,
                nextOutbreak,
                seasonalRisk,
                triggerProbabilities: this.calculateTriggerProbabilities(personalHistory.outbreakHistory),
                preventionWindow: this.calculatePreventionWindow(nextOutbreak),
                confidence: this.calculatePredictionConfidence(personalHistory.outbreakHistory)
            };

        } catch (error) {
            console.error('Error predicting outbreak patterns:', error);
            return { prediction: 'error', message: error.message };
        }
    }

    /**
     * Generate personalized herpes insights
     */
    async generatePersonalInsights(userId, riskAssessment, personalHistory) {
        const insights = [];

        // Risk-based insights
        if (riskAssessment.overallRisk > 70) {
            insights.push({
                type: 'high_risk_alert',
                message: 'Your risk profile indicates higher likelihood of herpes transmission or outbreaks',
                priority: 'high',
                recommendations: [
                    'Consider preventive antiviral therapy',
                    'Regular STI testing',
                    'Discuss with healthcare provider'
                ]
            });
        }

        // Family history insights
        if (riskAssessment.riskFactors.family > 30) {
            insights.push({
                type: 'family_history',
                message: 'Family history suggests genetic predisposition to herpes complications',
                priority: 'medium',
                recommendations: [
                    'Early vaccination for shingles',
                    'Stress management practices',
                    'Regular immune system support'
                ]
            });
        }

        // Age-specific insights
        const userAge = this.calculateAge(userId);
        if (userAge >= 50) {
            insights.push({
                type: 'age_related',
                message: 'Shingles risk increases significantly after age 50',
                priority: 'high',
                recommendations: [
                    'Shingrix vaccine recommended',
                    'Monitor for early shingles symptoms',
                    'Maintain strong immune system'
                ]
            });
        }

        // Outbreak pattern insights
        if (personalHistory.outbreakFrequency > 6) {
            insights.push({
                type: 'frequent_outbreaks',
                message: 'Frequent outbreaks may benefit from suppressive therapy',
                priority: 'high',
                recommendations: [
                    'Daily antiviral medication',
                    'Identify and avoid triggers',
                    'Stress reduction techniques'
                ]
            });
        }

        return insights;
    }

    /**
     * Generate personalized recommendations
     */
    async generateRecommendations(userId, riskAssessment) {
        const recommendations = {
            immediate: [],
            shortTerm: [],
            longTerm: [],
            lifestyle: [],
            medical: []
        };

        // Immediate recommendations
        if (riskAssessment.specificRisks.shingles > 50) {
            recommendations.immediate.push('Consult healthcare provider about shingles vaccination');
        }

        // Medical recommendations
        recommendations.medical = [
            'Regular STI screening',
            'Discuss antiviral options with doctor',
            'Monitor for symptoms and early treatment',
            'Consider suppressive therapy if frequent outbreaks'
        ];

        // Lifestyle recommendations
        recommendations.lifestyle = [
            'Stress management and relaxation techniques',
            'Healthy diet rich in lysine, low in arginine',
            'Regular exercise and adequate sleep',
            'Sun protection to prevent HSV-1 triggers',
            'Safe sexual practices and partner communication'
        ];

        return recommendations;
    }

    /**
     * Get prevention strategies based on herpes type
     */
    getPreventionStrategies(riskAssessment) {
        return {
            hsv1: {
                primary: [
                    'Avoid direct contact during active outbreaks',
                    'Don\'t share personal items (lip balm, utensils)',
                    'Practice good hand hygiene',
                    'Use sun protection on lips'
                ],
                secondary: [
                    'Recognize early warning signs',
                    'Start antiviral treatment immediately',
                    'Manage stress and maintain healthy lifestyle',
                    'Consider daily antivirals for frequent outbreaks'
                ]
            },
            hsv2: {
                primary: [
                    'Use condoms consistently',
                    'Limit number of sexual partners',
                    'Get tested and know partner\'s status',
                    'Avoid sexual contact during outbreaks'
                ],
                secondary: [
                    'Antiviral suppressive therapy',
                    'Recognize prodromal symptoms',
                    'Partner notification and testing',
                    'Pregnancy counseling if planning to conceive'
                ]
            },
            shingles: {
                primary: [
                    'Get Shingrix vaccine (adults 50+)',
                    'Maintain healthy immune system',
                    'Manage chronic conditions',
                    'Stress reduction techniques'
                ],
                secondary: [
                    'Recognize early rash and pain',
                    'Seek immediate medical care',
                    'Antiviral treatment within 72 hours',
                    'Pain management strategies'
                ]
            }
        };
    }

    /**
     * Get treatment options based on conditions
     */
    async getTreatmentOptions(conditions) {
        const treatments = {
            hsv1: {
                acute: [
                    'Acyclovir (Zovirax)',
                    'Valacyclovir (Valtrex)',
                    'Famciclovir (Famvir)',
                    'Topical antivirals for mild cases'
                ],
                suppressive: [
                    'Daily valacyclovir 500mg',
                    'Daily acyclovir 400mg twice daily',
                    'For 6+ outbreaks per year'
                ],
                natural: [
                    'L-lysine supplements',
                    'Topical lemon balm',
                    'Ice application for pain',
                    'Stress management'
                ]
            },
            hsv2: {
                acute: [
                    'Valacyclovir 1g twice daily for 7-10 days',
                    'Acyclovir 400mg three times daily',
                    'Famciclovir 250mg twice daily',
                    'Start within 24 hours of symptoms'
                ],
                suppressive: [
                    'Daily valacyclovir 500mg-1g',
                    'Daily acyclovir 400mg twice daily',
                    'Reduces transmission risk by 50%'
                ],
                supportive: [
                    'Sitz baths for comfort',
                    'Loose-fitting clothing',
                    'Urination assistance if painful',
                    'Counseling and support groups'
                ]
            },
            shingles: {
                acute: [
                    'Valacyclovir 1g three times daily',
                    'Acyclovir 800mg five times daily',
                    'Must start within 72 hours',
                    'Pain management medications'
                ],
                complications: [
                    'Gabapentin for nerve pain',
                    'Pregabalin for neuropathy',
                    'Topical lidocaine patches',
                    'Corticosteroids for severe inflammation'
                ],
                supportive: [
                    'Cool compresses',
                    'Loose clothing',
                    'Rest and nutrition',
                    'Avoid immunocompromised individuals'
                ]
            }
        };

        return treatments;
    }

    // Helper methods for calculations and analysis

    calculateDemographicRisk(userProfile) {
        let risk = 0;
        if (userProfile.age < 25) risk += 15; // Higher HSV-2 risk
        if (userProfile.age >= 50) risk += 25; // Shingles risk
        if (userProfile.sex === 'female') risk += 10; // Higher HSV-2 prevalence
        return Math.min(risk, 100);
    }

    calculateBehavioralRisk(userProfile) {
        // This would be based on user-provided behavioral data
        // For now, return moderate risk
        return 30;
    }

    calculateFamilyRisk(familyHistory) {
        if (!familyHistory.summary.herpesHistory) return 0;
        return Math.min(familyHistory.summary.affectedRelatives * 15, 50);
    }

    calculateMedicalRisk(userProfile, personalHistory) {
        let risk = 0;
        if (personalHistory.conditions.length > 0) risk += 40;
        if (userProfile.immunocompromised) risk += 30;
        return Math.min(risk, 100);
    }

    calculateEnvironmentalRisk(userProfile) {
        // Based on location, stress levels, etc.
        return 20;
    }

    calculateOverallHerpesRisk(riskFactors) {
        const weights = {
            demographic: 0.2,
            behavioral: 0.3,
            family: 0.15,
            medical: 0.25,
            environmental: 0.1
        };

        return Object.entries(riskFactors).reduce((total, [factor, value]) => {
            return total + (value * weights[factor]);
        }, 0);
    }

    getRiskLevel(risk) {
        if (risk < 25) return 'low';
        if (risk < 50) return 'moderate';
        if (risk < 75) return 'high';
        return 'very_high';
    }

    // Additional helper methods would be implemented here...
    // Including getUserProfile, calculateAge, analyzeOutbreakPatterns, etc.
}

module.exports = HerpesAnalyticsService;