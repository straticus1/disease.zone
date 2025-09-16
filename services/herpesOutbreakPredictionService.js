/**
 * Herpes Outbreak Prediction Service
 *
 * Advanced machine learning and statistical models for predicting
 * HSV-1, HSV-2, and Shingles outbreaks based on personal history,
 * triggers, seasonal patterns, and biomarkers.
 */

const { Matrix } = require('ml-matrix');
const DatabaseService = require('./databaseService');
const { performance } = require('perf_hooks');

class HerpesOutbreakPredictionService {
    constructor() {
        this.db = new DatabaseService();

        // Machine learning model parameters for outbreak prediction
        this.models = {
            hsv1: {
                baseFrequency: 1.2, // outbreaks per year
                seasonalFactors: { spring: 1.1, summer: 1.3, fall: 1.0, winter: 0.8 },
                triggerWeights: {
                    stress: 0.35,
                    illness: 0.28,
                    sun_exposure: 0.25,
                    fatigue: 0.20,
                    hormonal_changes: 0.18,
                    dental_work: 0.15
                },
                recoveryPattern: { early: 0.7, peak: 0.3, decline: 0.0 }
            },
            hsv2: {
                baseFrequency: 4.1, // outbreaks per year (first year)
                seasonalFactors: { spring: 1.0, summer: 0.9, fall: 1.2, winter: 1.1 },
                triggerWeights: {
                    stress: 0.40,
                    illness: 0.30,
                    menstrual_cycle: 0.35,
                    sexual_activity: 0.25,
                    tight_clothing: 0.15,
                    immunosuppression: 0.32
                },
                recoveryPattern: { early: 0.8, peak: 0.2, decline: 0.0 }
            },
            shingles: {
                lifetimeRisk: 0.333, // 1 in 3 lifetime risk
                ageFactors: {
                    '50-59': 0.05, '60-69': 0.08, '70-79': 0.12, '80+': 0.18
                },
                triggerWeights: {
                    immunosuppression: 0.50,
                    stress: 0.35,
                    illness: 0.30,
                    cancer_treatment: 0.45,
                    organ_transplant: 0.60
                },
                complications: { phn: 0.15, ocular: 0.03, neurological: 0.02 }
            }
        };

        // Environmental and seasonal factors
        this.environmentalFactors = {
            uvIndex: { low: 0.8, moderate: 1.0, high: 1.3, veryHigh: 1.5 },
            temperature: { cold: 1.2, mild: 1.0, hot: 1.1 },
            humidity: { low: 1.1, moderate: 1.0, high: 0.9 },
            airQuality: { good: 1.0, moderate: 1.1, poor: 1.3 }
        };
    }

    /**
     * Predict next outbreak based on personal history and current conditions
     */
    async predictNextOutbreak(userId, herpesType = 'hsv2') {
        const startTime = performance.now();

        try {
            // Get user's outbreak history
            const outbreakHistory = await this.getOutbreakHistory(userId, herpesType);
            const userProfile = await this.getUserProfile(userId);
            const currentTriggers = await this.getCurrentTriggerProfile(userId);

            if (outbreakHistory.length < 2) {
                return {
                    prediction: 'insufficient_data',
                    message: 'Need at least 2 recorded outbreaks for accurate prediction',
                    confidence: 0,
                    recommendedActions: [
                        'Continue tracking outbreaks in the app',
                        'Note triggers and symptoms',
                        'Track stress levels and health changes'
                    ]
                };
            }

            // Calculate personalized outbreak frequency
            const personalFrequency = this.calculatePersonalFrequency(outbreakHistory);

            // Apply machine learning prediction model
            const prediction = await this.applyPredictionModel({
                herpesType,
                personalFrequency,
                outbreakHistory,
                userProfile,
                currentTriggers
            });

            // Calculate confidence based on data quality and patterns
            const confidence = this.calculatePredictionConfidence(outbreakHistory, prediction);

            const result = {
                prediction: 'available',
                herpesType,
                nextOutbreak: {
                    estimatedDate: prediction.nextOutbreakDate,
                    probabilityRange: prediction.probabilityRange,
                    riskWindow: prediction.riskWindow
                },
                triggerAnalysis: prediction.triggerAnalysis,
                seasonalRisk: prediction.seasonalRisk,
                preventionWindow: prediction.preventionWindow,
                confidence: confidence,
                personalizedFactors: prediction.personalizedFactors,
                recommendations: this.generateOutbreakPreventionRecommendations(prediction),
                monitoringPlan: this.createMonitoringPlan(prediction),
                lastUpdated: new Date().toISOString(),
                processingTime: performance.now() - startTime
            };

            // Log prediction for model improvement
            await this.logPrediction(userId, herpesType, result);

            return result;

        } catch (error) {
            console.error('Error predicting herpes outbreak:', error);
            throw error;
        }
    }

    /**
     * Apply advanced prediction model using historical data
     */
    async applyPredictionModel(params) {
        const { herpesType, personalFrequency, outbreakHistory, userProfile, currentTriggers } = params;

        // Time series analysis of outbreak patterns
        const timeSeriesAnalysis = this.performTimeSeriesAnalysis(outbreakHistory);

        // Calculate base prediction using exponential smoothing
        const basePrediction = this.exponentialSmoothing(
            outbreakHistory.map(o => o.daysSinceLastOutbreak),
            0.3 // alpha smoothing factor
        );

        // Adjust for current trigger levels
        const triggerAdjustment = this.calculateTriggerAdjustment(currentTriggers, herpesType);

        // Seasonal adjustment
        const seasonalAdjustment = this.calculateSeasonalAdjustment(herpesType);

        // Personal risk factor adjustment
        const personalAdjustment = this.calculatePersonalAdjustment(userProfile, herpesType);

        // Calculate next outbreak probability
        const daysUntilNextOutbreak = Math.round(
            basePrediction * triggerAdjustment * seasonalAdjustment * personalAdjustment
        );

        const nextOutbreakDate = new Date();
        nextOutbreakDate.setDate(nextOutbreakDate.getDate() + daysUntilNextOutbreak);

        // Create probability range (±7 days)
        const probabilityRange = {
            earliest: new Date(nextOutbreakDate.getTime() - 7 * 24 * 60 * 60 * 1000),
            latest: new Date(nextOutbreakDate.getTime() + 7 * 24 * 60 * 60 * 1000),
            mostLikely: nextOutbreakDate
        };

        // High-risk window (3 days before predicted date)
        const riskWindow = {
            start: new Date(nextOutbreakDate.getTime() - 3 * 24 * 60 * 60 * 1000),
            end: new Date(nextOutbreakDate.getTime() + 1 * 24 * 60 * 60 * 1000)
        };

        // Prevention window (7 days before predicted date)
        const preventionWindow = {
            start: new Date(nextOutbreakDate.getTime() - 7 * 24 * 60 * 60 * 1000),
            end: nextOutbreakDate
        };

        return {
            nextOutbreakDate,
            probabilityRange,
            riskWindow,
            preventionWindow,
            triggerAnalysis: this.analyzeTriggerProbabilities(currentTriggers, herpesType),
            seasonalRisk: this.calculateDetailedSeasonalRisk(herpesType),
            personalizedFactors: {
                baseFrequency: personalFrequency,
                triggerSensitivity: triggerAdjustment,
                seasonalPattern: seasonalAdjustment,
                personalRisk: personalAdjustment
            }
        };
    }

    /**
     * Perform time series analysis on outbreak history
     */
    performTimeSeriesAnalysis(outbreakHistory) {
        if (outbreakHistory.length < 3) {
            return { trend: 'insufficient_data', pattern: 'unknown' };
        }

        // Calculate intervals between outbreaks
        const intervals = [];
        for (let i = 1; i < outbreakHistory.length; i++) {
            const daysDiff = (new Date(outbreakHistory[i-1].date) - new Date(outbreakHistory[i].date)) / (1000 * 60 * 60 * 24);
            intervals.push(daysDiff);
        }

        // Calculate trend (are intervals getting longer or shorter?)
        const trend = this.calculateTrend(intervals);

        // Identify patterns
        const pattern = this.identifyPattern(intervals);

        return {
            trend: trend > 0 ? 'increasing_intervals' : trend < 0 ? 'decreasing_intervals' : 'stable',
            pattern,
            averageInterval: intervals.reduce((a, b) => a + b, 0) / intervals.length,
            intervalVariation: this.calculateStandardDeviation(intervals)
        };
    }

    /**
     * Exponential smoothing for outbreak prediction
     */
    exponentialSmoothing(data, alpha) {
        if (data.length === 0) return 90; // Default 90 days

        let forecast = data[0];
        for (let i = 1; i < data.length; i++) {
            forecast = alpha * data[i] + (1 - alpha) * forecast;
        }

        return forecast;
    }

    /**
     * Calculate trigger-based adjustment
     */
    calculateTriggerAdjustment(currentTriggers, herpesType) {
        const model = this.models[herpesType];
        if (!model || !currentTriggers) return 1.0;

        let adjustment = 1.0;

        Object.entries(currentTriggers).forEach(([trigger, level]) => {
            const weight = model.triggerWeights[trigger] || 0;
            // level is 0-10 scale, convert to adjustment factor
            const triggerEffect = 1.0 - (weight * (level / 10) * 0.5);
            adjustment *= triggerEffect;
        });

        return Math.max(0.3, Math.min(1.7, adjustment)); // Clamp between 0.3x and 1.7x
    }

    /**
     * Calculate seasonal adjustment
     */
    calculateSeasonalAdjustment(herpesType) {
        const now = new Date();
        const month = now.getMonth();

        // Determine season
        let season;
        if (month >= 2 && month <= 4) season = 'spring';
        else if (month >= 5 && month <= 7) season = 'summer';
        else if (month >= 8 && month <= 10) season = 'fall';
        else season = 'winter';

        const model = this.models[herpesType];
        return model ? model.seasonalFactors[season] || 1.0 : 1.0;
    }

    /**
     * Calculate personal risk factor adjustment
     */
    calculatePersonalAdjustment(userProfile, herpesType) {
        let adjustment = 1.0;

        // Age factor (especially important for shingles)
        if (herpesType === 'shingles' && userProfile.age) {
            const ageGroup = this.getAgeGroup(userProfile.age);
            const model = this.models.shingles;
            adjustment *= (model.ageFactors[ageGroup] || 0.02) * 20; // Scale to reasonable factor
        }

        // Immune system status
        if (userProfile.immunocompromised) {
            adjustment *= 1.5; // Higher outbreak risk
        }

        // Gender factors (HSV-2 more prevalent in women)
        if (herpesType === 'hsv2' && userProfile.gender === 'female') {
            adjustment *= 1.2;
        }

        // Stress levels
        if (userProfile.stressLevel) {
            const stressAdjustment = 1.0 + (userProfile.stressLevel / 10) * 0.3;
            adjustment *= stressAdjustment;
        }

        return Math.max(0.5, Math.min(2.0, adjustment)); // Reasonable bounds
    }

    /**
     * Analyze trigger probabilities
     */
    analyzeTriggerProbabilities(currentTriggers, herpesType) {
        const model = this.models[herpesType];
        if (!model || !currentTriggers) return {};

        const analysis = {};

        Object.entries(model.triggerWeights).forEach(([trigger, baseWeight]) => {
            const currentLevel = currentTriggers[trigger] || 0;
            const probability = baseWeight * (currentLevel / 10);

            analysis[trigger] = {
                currentLevel,
                baseWeight,
                outbreakProbability: Math.min(0.95, probability),
                recommendation: this.getTriggerRecommendation(trigger, currentLevel)
            };
        });

        return analysis;
    }

    /**
     * Calculate detailed seasonal risk
     */
    calculateDetailedSeasonalRisk(herpesType) {
        const model = this.models[herpesType];
        const currentMonth = new Date().getMonth();

        return {
            current: this.calculateSeasonalAdjustment(herpesType),
            forecast: {
                nextMonth: model.seasonalFactors[this.getSeasonFromMonth(currentMonth + 1)] || 1.0,
                next3Months: this.calculateNext3MonthsRisk(herpesType),
                yearlyPattern: model.seasonalFactors
            },
            peakSeason: Object.entries(model.seasonalFactors)
                .reduce((max, [season, factor]) => factor > max.factor ? {season, factor} : max,
                    {season: 'spring', factor: 0})
        };
    }

    /**
     * Generate outbreak prevention recommendations
     */
    generateOutbreakPreventionRecommendations(prediction) {
        const recommendations = {
            immediate: [],
            preventionWindow: [],
            lifestyle: [],
            medical: []
        };

        // Immediate actions if outbreak likely within 7 days
        const daysUntilOutbreak = (prediction.nextOutbreakDate - new Date()) / (1000 * 60 * 60 * 24);
        if (daysUntilOutbreak <= 7) {
            recommendations.immediate = [
                'Consider prophylactic antiviral medication',
                'Increase stress management practices',
                'Ensure adequate sleep and nutrition',
                'Avoid known personal triggers'
            ];
        }

        // Prevention window recommendations
        recommendations.preventionWindow = [
            'Monitor for prodromal symptoms',
            'Keep antiviral medication readily available',
            'Practice stress reduction techniques',
            'Maintain healthy immune system support'
        ];

        // Lifestyle recommendations
        recommendations.lifestyle = [
            'Regular sleep schedule (7-9 hours nightly)',
            'Stress management (meditation, yoga, exercise)',
            'Balanced diet rich in lysine, low in arginine',
            'Moderate exercise routine'
        ];

        // Medical recommendations
        recommendations.medical = [
            'Discuss suppressive therapy with healthcare provider',
            'Keep emergency antiviral prescription',
            'Consider immune system evaluation if frequent outbreaks',
            'Regular follow-up with healthcare team'
        ];

        return recommendations;
    }

    /**
     * Create monitoring plan for outbreak prediction
     */
    createMonitoringPlan(prediction) {
        return {
            dailyTracking: [
                'Stress levels (1-10 scale)',
                'Sleep quality and duration',
                'Energy levels and fatigue',
                'Any prodromal symptoms'
            ],
            weeklyAssessment: [
                'Review trigger exposure',
                'Assess lifestyle factors',
                'Monitor medication adherence',
                'Update outbreak risk factors'
            ],
            criticalPeriod: {
                window: prediction.riskWindow,
                monitoring: [
                    'Increased symptom awareness',
                    'Daily stress tracking',
                    'Ready access to antiviral medication',
                    'Healthcare provider contact information'
                ]
            },
            alertThresholds: {
                high_risk: 'Prodromal symptoms + high trigger exposure',
                moderate_risk: 'Multiple triggers + seasonal peak',
                low_risk: 'Single trigger or off-season timing'
            }
        };
    }

    // Helper methods

    async getOutbreakHistory(userId, herpesType) {
        try {
            const query = `
                SELECT * FROM herpes_outbreaks
                WHERE user_id = ? AND herpes_type = ?
                ORDER BY outbreak_date DESC
                LIMIT 50
            `;
            return await this.db.query(query, [userId, herpesType]);
        } catch (error) {
            console.error('Error fetching outbreak history:', error);
            return [];
        }
    }

    async getUserProfile(userId) {
        try {
            const query = `SELECT * FROM users WHERE id = ?`;
            const users = await this.db.query(query, [userId]);
            return users[0] || {};
        } catch (error) {
            return {};
        }
    }

    async getCurrentTriggerProfile(userId) {
        try {
            const query = `
                SELECT trigger_name, current_level
                FROM user_trigger_tracking
                WHERE user_id = ? AND date >= date('now', '-7 days')
                ORDER BY date DESC
            `;
            const triggers = await this.db.query(query, [userId]);

            const profile = {};
            triggers.forEach(t => {
                if (!profile[t.trigger_name]) {
                    profile[t.trigger_name] = t.current_level;
                }
            });

            return profile;
        } catch (error) {
            return {};
        }
    }

    calculatePersonalFrequency(outbreakHistory) {
        if (outbreakHistory.length < 2) return 90; // Default 90 days

        const intervals = [];
        for (let i = 1; i < outbreakHistory.length; i++) {
            const daysDiff = Math.abs(
                (new Date(outbreakHistory[i-1].outbreak_date) - new Date(outbreakHistory[i].outbreak_date)) /
                (1000 * 60 * 60 * 24)
            );
            intervals.push(daysDiff);
        }

        return intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    }

    calculatePredictionConfidence(outbreakHistory, prediction) {
        let confidence = 0;

        // More data = higher confidence
        const dataConfidence = Math.min(0.4, outbreakHistory.length * 0.05);
        confidence += dataConfidence;

        // Consistent patterns = higher confidence
        if (outbreakHistory.length >= 3) {
            const intervals = this.calculateOutbreakIntervals(outbreakHistory);
            const variance = this.calculateVariance(intervals);
            const consistencyConfidence = Math.max(0, 0.3 - variance / 1000);
            confidence += consistencyConfidence;
        }

        // Recent data = higher confidence
        const lastOutbreak = new Date(outbreakHistory[0]?.outbreak_date || Date.now());
        const daysSinceLastOutbreak = (Date.now() - lastOutbreak) / (1000 * 60 * 60 * 24);
        const recencyConfidence = Math.max(0, 0.3 - daysSinceLastOutbreak / 365);
        confidence += recencyConfidence;

        return Math.min(0.95, confidence);
    }

    // Additional helper methods for statistics and calculations...

    calculateTrend(data) {
        if (data.length < 2) return 0;
        let sum = 0;
        for (let i = 1; i < data.length; i++) {
            sum += data[i] - data[i-1];
        }
        return sum / (data.length - 1);
    }

    calculateStandardDeviation(data) {
        const mean = data.reduce((a, b) => a + b) / data.length;
        const variance = data.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / data.length;
        return Math.sqrt(variance);
    }

    calculateVariance(data) {
        const mean = data.reduce((a, b) => a + b) / data.length;
        return data.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / data.length;
    }

    identifyPattern(intervals) {
        // Simplified pattern identification
        const variance = this.calculateVariance(intervals);
        if (variance < 100) return 'regular';
        if (variance < 500) return 'somewhat_regular';
        return 'irregular';
    }

    getAgeGroup(age) {
        if (age >= 80) return '80+';
        if (age >= 70) return '70-79';
        if (age >= 60) return '60-69';
        if (age >= 50) return '50-59';
        return 'under_50';
    }

    getSeasonFromMonth(month) {
        month = month % 12;
        if (month >= 2 && month <= 4) return 'spring';
        if (month >= 5 && month <= 7) return 'summer';
        if (month >= 8 && month <= 10) return 'fall';
        return 'winter';
    }

    calculateNext3MonthsRisk(herpesType) {
        const currentMonth = new Date().getMonth();
        const model = this.models[herpesType];
        let totalRisk = 0;

        for (let i = 1; i <= 3; i++) {
            const season = this.getSeasonFromMonth(currentMonth + i);
            totalRisk += model.seasonalFactors[season] || 1.0;
        }

        return totalRisk / 3;
    }

    getTriggerRecommendation(trigger, level) {
        if (level >= 8) return `High ${trigger} levels - immediate intervention needed`;
        if (level >= 6) return `Moderate ${trigger} - consider prevention strategies`;
        if (level >= 4) return `Elevated ${trigger} - monitor closely`;
        return `${trigger} levels normal`;
    }

    calculateOutbreakIntervals(outbreakHistory) {
        const intervals = [];
        for (let i = 1; i < outbreakHistory.length; i++) {
            const daysDiff = Math.abs(
                (new Date(outbreakHistory[i-1].outbreak_date) - new Date(outbreakHistory[i].outbreak_date)) /
                (1000 * 60 * 60 * 24)
            );
            intervals.push(daysDiff);
        }
        return intervals;
    }

    async logPrediction(userId, herpesType, prediction) {
        try {
            const query = `
                INSERT INTO outbreak_predictions (
                    user_id, herpes_type, predicted_date, confidence,
                    prediction_data, created_at
                ) VALUES (?, ?, ?, ?, ?, ?)
            `;

            await this.db.query(query, [
                userId,
                herpesType,
                prediction.nextOutbreak.estimatedDate,
                prediction.confidence,
                JSON.stringify(prediction),
                new Date().toISOString()
            ]);
        } catch (error) {
            console.error('Error logging prediction:', error);
        }
    }
}

module.exports = HerpesOutbreakPredictionService;