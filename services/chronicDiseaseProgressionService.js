/**
 * Chronic Disease Progression Predictive Analytics Service
 *
 * Advanced machine learning models for predicting disease progression,
 * complications, and outcomes for cardiovascular disease, diabetes,
 * cancer, and other chronic conditions using clinical data, biomarkers,
 * and lifestyle factors.
 */

const { Matrix } = require('ml-matrix');
const DatabaseService = require('./databaseService');
const ChronicDiseaseRiskService = require('./chronicDiseaseRiskService');
const { performance } = require('perf_hooks');

class ChronicDiseaseProgressionService {
    constructor() {
        this.db = new DatabaseService();
        this.riskService = new ChronicDiseaseRiskService();

        // Disease progression models and parameters
        this.progressionModels = {
            cardiovascular: {
                stages: ['pre_disease', 'early_disease', 'established_disease', 'complications', 'end_stage'],
                progressionFactors: {
                    age: 0.08,
                    diabetes: 0.15,
                    smoking: 0.12,
                    hypertension: 0.10,
                    ldl_cholesterol: 0.09,
                    family_history: 0.06,
                    physical_inactivity: 0.07,
                    obesity: 0.08,
                    stress: 0.05,
                    medication_adherence: -0.12
                },
                transitionProbabilities: {
                    'pre_disease_to_early': 0.08,
                    'early_to_established': 0.15,
                    'established_to_complications': 0.12,
                    'complications_to_end_stage': 0.20
                },
                complications: ['myocardial_infarction', 'stroke', 'heart_failure', 'peripheral_artery_disease']
            },
            diabetes: {
                stages: ['prediabetes', 'early_diabetes', 'established_diabetes', 'complications', 'advanced_complications'],
                progressionFactors: {
                    hba1c: 0.20,
                    bmi: 0.12,
                    age: 0.08,
                    family_history: 0.10,
                    physical_inactivity: 0.09,
                    diet_quality: 0.11,
                    medication_adherence: -0.15,
                    blood_pressure: 0.07,
                    smoking: 0.08
                },
                transitionProbabilities: {
                    'prediabetes_to_early': 0.11,
                    'early_to_established': 0.18,
                    'established_to_complications': 0.25,
                    'complications_to_advanced': 0.15
                },
                complications: ['diabetic_retinopathy', 'diabetic_nephropathy', 'diabetic_neuropathy', 'diabetic_foot_ulcer', 'cardiovascular_disease']
            },
            cancer: {
                stages: ['stage_0', 'stage_i', 'stage_ii', 'stage_iii', 'stage_iv'],
                progressionFactors: {
                    tumor_grade: 0.25,
                    tumor_size: 0.20,
                    lymph_nodes: 0.18,
                    metastasis: 0.30,
                    age: 0.05,
                    comorbidities: 0.08,
                    treatment_response: -0.20
                },
                survivalModels: {
                    breast: { fiveYear: 0.90, tenYear: 0.84 },
                    prostate: { fiveYear: 0.98, tenYear: 0.95 },
                    lung: { fiveYear: 0.22, tenYear: 0.15 },
                    colorectal: { fiveYear: 0.65, tenYear: 0.58 },
                    pancreatic: { fiveYear: 0.10, tenYear: 0.05 }
                },
                complications: ['metastasis', 'treatment_toxicity', 'secondary_cancers', 'organ_dysfunction']
            },
            metabolic: {
                stages: ['metabolically_healthy', 'metabolic_dysfunction', 'metabolic_syndrome', 'multiple_comorbidities'],
                progressionFactors: {
                    insulin_resistance: 0.18,
                    visceral_adiposity: 0.15,
                    inflammatory_markers: 0.12,
                    lipid_profile: 0.10,
                    blood_pressure: 0.09,
                    glucose_tolerance: 0.14,
                    lifestyle_factors: 0.12,
                    genetic_predisposition: 0.10
                },
                complications: ['type2_diabetes', 'cardiovascular_disease', 'fatty_liver_disease', 'sleep_apnea']
            }
        };

        // Biomarker thresholds and progression indicators
        this.biomarkerThresholds = {
            cardiovascular: {
                ldl_cholesterol: { optimal: 70, elevated: 100, high: 160, veryHigh: 190 },
                hdl_cholesterol: { low: 40, optimal: 60 },
                triglycerides: { normal: 150, elevated: 200, high: 500 },
                blood_pressure: { normal: [120, 80], elevated: [130, 80], stage1: [140, 90], stage2: [160, 100] },
                crp: { low: 1.0, moderate: 3.0, high: 10.0 },
                nt_pro_bnp: { normal: 125, elevated: 450, high: 900 }
            },
            diabetes: {
                hba1c: { normal: 5.7, prediabetes: 6.4, diabetes: 7.0, poor_control: 9.0 },
                fasting_glucose: { normal: 100, prediabetes: 125, diabetes: 126 },
                postprandial_glucose: { normal: 140, prediabetes: 199, diabetes: 200 },
                microalbumin: { normal: 30, microalbuminuria: 300, macroalbuminuria: 999 }
            },
            cancer: {
                tumor_markers: {
                    psa: { normal: 4.0, elevated: 10.0, high: 20.0 },
                    ca125: { normal: 35, elevated: 65, high: 200 },
                    cea: { normal: 3.0, elevated: 10.0, high: 20.0 },
                    ca199: { normal: 37, elevated: 100, high: 1000 }
                }
            }
        };

        // Machine learning model parameters
        this.mlModels = {
            survival_analysis: {
                coxProportionalHazards: true,
                kaplanMeier: true,
                randomSurvivalForest: true
            },
            classification: {
                gradientBoosting: true,
                randomForest: true,
                neuralNetwork: true
            },
            regression: {
                multipleRegression: true,
                polynomialRegression: true,
                timeSeriesAnalysis: true
            }
        };
    }

    /**
     * Predict disease progression using comprehensive analytics
     */
    async predictDiseaseProgression(userId, condition, timeframe = '5years') {
        const startTime = performance.now();

        try {
            // Gather comprehensive patient data
            const [
                currentHealth,
                historicalData,
                familyHistory,
                lifestyleData,
                biomarkerTrends
            ] = await Promise.all([
                this.getCurrentHealthStatus(userId, condition),
                this.getHistoricalHealthData(userId, condition),
                this.getFamilyDiseaseHistory(userId, condition),
                this.getLifestyleFactors(userId),
                this.getBiomarkerTrends(userId, condition)
            ]);

            // Determine current disease stage
            const currentStage = this.determineCurrentStage(condition, currentHealth, biomarkerTrends);

            // Apply progression prediction models
            const progression = await this.applyProgressionModels({
                condition,
                timeframe,
                currentStage,
                currentHealth,
                historicalData,
                familyHistory,
                lifestyleData,
                biomarkerTrends
            });

            // Generate intervention recommendations
            const interventions = await this.generateInterventionRecommendations(
                condition, progression, currentHealth
            );

            // Calculate monitoring schedule
            const monitoringPlan = this.createProgressionMonitoringPlan(
                condition, progression, currentStage
            );

            const result = {
                userId,
                condition,
                assessmentDate: new Date().toISOString(),
                timeframe,
                currentStage,
                progressionPrediction: {
                    likelihood: progression.progressionProbability,
                    expectedStage: progression.predictedStage,
                    timeToProgression: progression.timeToProgression,
                    confidence: progression.confidence,
                    riskFactors: progression.dominantRiskFactors
                },
                complications: {
                    riskAssessment: progression.complicationRisk,
                    likelyComplications: progression.likelyComplications,
                    preventableComplications: progression.preventableComplications
                },
                interventions,
                monitoringPlan,
                outcomeProjections: progression.outcomeProjections,
                alternativeScenarios: progression.alternativeScenarios,
                qualityOfLifeProjection: progression.qualityOfLifeProjection,
                lastUpdated: new Date().toISOString(),
                processingTime: performance.now() - startTime
            };

            // Log prediction for model improvement
            await this.logProgressionPrediction(userId, condition, result);

            return result;

        } catch (error) {
            console.error('Error predicting disease progression:', error);
            throw error;
        }
    }

    /**
     * Apply sophisticated progression models
     */
    async applyProgressionModels(params) {
        const { condition, timeframe, currentStage, currentHealth, historicalData, familyHistory, lifestyleData, biomarkerTrends } = params;

        const model = this.progressionModels[condition];
        if (!model) {
            throw new Error(`No progression model available for ${condition}`);
        }

        // Calculate risk factor contributions
        const riskFactorScores = this.calculateRiskFactorScores(
            condition, currentHealth, familyHistory, lifestyleData, biomarkerTrends
        );

        // Apply time-series analysis to biomarker trends
        const trendAnalysis = this.analyzeBiomarkerTrends(biomarkerTrends, condition);

        // Calculate base progression probability
        const baseProgression = this.calculateBaseProgressionProbability(
            condition, currentStage, riskFactorScores
        );

        // Apply trend adjustments
        const trendAdjustedProgression = this.applyTrendAdjustments(
            baseProgression, trendAnalysis, timeframe
        );

        // Generate alternative scenarios
        const alternativeScenarios = this.generateAlternativeScenarios(
            condition, currentStage, riskFactorScores, trendAnalysis
        );

        // Predict specific outcomes
        const outcomeProjections = await this.predictSpecificOutcomes(
            condition, trendAdjustedProgression, timeframe
        );

        // Assess complication risks
        const complicationRisk = this.assessComplicationRisk(
            condition, currentStage, riskFactorScores, trendAdjustedProgression
        );

        return {
            progressionProbability: trendAdjustedProgression.probability,
            predictedStage: trendAdjustedProgression.predictedStage,
            timeToProgression: trendAdjustedProgression.timeToProgression,
            confidence: this.calculatePredictionConfidence(historicalData, trendAnalysis),
            dominantRiskFactors: this.identifyDominantRiskFactors(riskFactorScores),
            complicationRisk,
            likelyComplications: complicationRisk.likely,
            preventableComplications: complicationRisk.preventable,
            outcomeProjections,
            alternativeScenarios,
            qualityOfLifeProjection: this.projectQualityOfLife(condition, trendAdjustedProgression)
        };
    }

    /**
     * Calculate risk factor contributions
     */
    calculateRiskFactorScores(condition, currentHealth, familyHistory, lifestyleData, biomarkerTrends) {
        const model = this.progressionModels[condition];
        const scores = {};

        Object.entries(model.progressionFactors).forEach(([factor, weight]) => {
            let factorValue = 0;

            // Map factor to actual data
            switch (factor) {
                case 'age':
                    factorValue = this.normalizeAge(currentHealth.age);
                    break;
                case 'hba1c':
                    factorValue = this.normalizeHbA1c(biomarkerTrends.hba1c?.latest);
                    break;
                case 'bmi':
                    factorValue = this.normalizeBMI(currentHealth.bmi);
                    break;
                case 'blood_pressure':
                    factorValue = this.normalizeBloodPressure(currentHealth.bloodPressure);
                    break;
                case 'ldl_cholesterol':
                    factorValue = this.normalizeLDLCholesterol(biomarkerTrends.ldl?.latest);
                    break;
                case 'smoking':
                    factorValue = lifestyleData.smoking?.current ? 1.0 : 0.0;
                    break;
                case 'family_history':
                    factorValue = this.normalizeFamilyHistory(familyHistory);
                    break;
                case 'physical_inactivity':
                    factorValue = lifestyleData.physicalActivity?.regular ? 0.0 : 1.0;
                    break;
                case 'medication_adherence':
                    factorValue = currentHealth.medicationAdherence || 0.5;
                    break;
                default:
                    factorValue = 0.5; // Default neutral value
            }

            scores[factor] = {
                value: factorValue,
                weight: weight,
                contribution: factorValue * Math.abs(weight)
            };
        });

        return scores;
    }

    /**
     * Analyze biomarker trends using time series analysis
     */
    analyzeBiomarkerTrends(biomarkerTrends, condition) {
        const analysis = {
            trends: {},
            velocities: {},
            accelerations: {},
            projections: {},
            alerts: []
        };

        Object.entries(biomarkerTrends).forEach(([biomarker, data]) => {
            if (!data || !data.values || data.values.length < 2) return;

            const values = data.values.map(v => v.value);
            const times = data.values.map(v => new Date(v.date).getTime());

            // Calculate trend (slope)
            const trend = this.calculateLinearTrend(times, values);
            analysis.trends[biomarker] = trend;

            // Calculate velocity (rate of change)
            const velocity = this.calculateVelocity(times, values);
            analysis.velocities[biomarker] = velocity;

            // Calculate acceleration (change in rate of change)
            if (values.length >= 3) {
                const acceleration = this.calculateAcceleration(times, values);
                analysis.accelerations[biomarker] = acceleration;
            }

            // Project future values
            analysis.projections[biomarker] = this.projectFutureBiomarkerValues(
                times, values, trend, 365 * 2 // 2 years
            );

            // Check for concerning trends
            const thresholds = this.biomarkerThresholds[condition]?.[biomarker];
            if (thresholds && this.isWorseningTrend(trend, biomarker, condition)) {
                analysis.alerts.push({
                    biomarker,
                    currentValue: values[values.length - 1],
                    trend: trend.slope,
                    severity: this.assessTrendSeverity(trend, thresholds),
                    timeToThreshold: this.calculateTimeToThreshold(trend, values[values.length - 1], thresholds)
                });
            }
        });

        return analysis;
    }

    /**
     * Calculate base progression probability
     */
    calculateBaseProgressionProbability(condition, currentStage, riskFactorScores) {
        const model = this.progressionModels[condition];
        const stages = model.stages;
        const currentStageIndex = stages.indexOf(currentStage);

        if (currentStageIndex === -1 || currentStageIndex === stages.length - 1) {
            return { probability: 0, nextStage: currentStage };
        }

        const nextStage = stages[currentStageIndex + 1];
        const transitionKey = `${currentStage}_to_${nextStage.split('_').pop()}`;
        const baseTransitionProb = model.transitionProbabilities[transitionKey] || 0.1;

        // Adjust base probability based on risk factors
        const riskAdjustment = Object.values(riskFactorScores)
            .reduce((sum, factor) => sum + factor.contribution, 0);

        const adjustedProbability = Math.min(0.95, Math.max(0.01,
            baseTransitionProb + (riskAdjustment * 0.1)
        ));

        return {
            probability: adjustedProbability,
            nextStage,
            baseTransitionProb,
            riskAdjustment
        };
    }

    /**
     * Apply trend adjustments to base progression
     */
    applyTrendAdjustments(baseProgression, trendAnalysis, timeframe) {
        let adjustmentFactor = 1.0;

        // Analyze concerning trends
        if (trendAnalysis.alerts.length > 0) {
            const severityAdjustment = trendAnalysis.alerts.reduce((sum, alert) => {
                return sum + (alert.severity * 0.1);
            }, 0);
            adjustmentFactor += severityAdjustment;
        }

        // Analyze positive trends (e.g., improving biomarkers)
        const improvingTrends = Object.values(trendAnalysis.trends).filter(trend =>
            trend.slope < 0 && trend.correlation > 0.5 // Negative slope = improvement for most biomarkers
        ).length;

        if (improvingTrends > 0) {
            adjustmentFactor -= (improvingTrends * 0.05);
        }

        const adjustedProbability = Math.min(0.95, Math.max(0.01,
            baseProgression.probability * adjustmentFactor
        ));

        // Calculate time to progression based on trend velocity
        const avgVelocity = Object.values(trendAnalysis.velocities)
            .reduce((sum, v) => sum + Math.abs(v), 0) / Object.keys(trendAnalysis.velocities).length;

        const timeMultiplier = this.parseTimeframe(timeframe);
        const timeToProgression = this.calculateTimeToProgression(
            adjustedProbability, avgVelocity, timeMultiplier
        );

        return {
            probability: adjustedProbability,
            predictedStage: baseProgression.nextStage,
            timeToProgression,
            adjustmentFactor,
            trendInfluence: adjustmentFactor - 1.0
        };
    }

    /**
     * Generate alternative scenarios based on interventions
     */
    generateAlternativeScenarios(condition, currentStage, riskFactorScores, trendAnalysis) {
        return {
            optimistic: {
                scenario: 'Optimal lifestyle changes and medication adherence',
                progressionReduction: 0.4,
                keyInterventions: ['lifestyle_modification', 'medication_optimization', 'regular_monitoring'],
                expectedOutcome: 'Delayed or prevented progression'
            },
            realistic: {
                scenario: 'Moderate lifestyle improvements',
                progressionReduction: 0.2,
                keyInterventions: ['partial_lifestyle_changes', 'medication_adherence'],
                expectedOutcome: 'Slower progression rate'
            },
            pessimistic: {
                scenario: 'No intervention or poor adherence',
                progressionAcceleration: 0.3,
                consequences: ['accelerated_progression', 'increased_complications'],
                expectedOutcome: 'Faster progression to advanced stages'
            }
        };
    }

    /**
     * Predict specific outcomes
     */
    async predictSpecificOutcomes(condition, progression, timeframe) {
        const outcomes = {};

        if (condition === 'cardiovascular') {
            outcomes.majorCardiacEvent = {
                probability: progression.probability * 0.6,
                timeframe,
                types: ['myocardial_infarction', 'stroke', 'cardiac_death']
            };
            outcomes.hospitalization = {
                probability: progression.probability * 0.8,
                averageLength: '4-7 days',
                cost: '$15000-$45000'
            };
        } else if (condition === 'diabetes') {
            outcomes.complications = {
                retinopathy: progression.probability * 0.4,
                nephropathy: progression.probability * 0.3,
                neuropathy: progression.probability * 0.5
            };
            outcomes.qualityOfLife = {
                physicalFunction: 1.0 - (progression.probability * 0.3),
                socialFunction: 1.0 - (progression.probability * 0.2),
                emotionalWellbeing: 1.0 - (progression.probability * 0.25)
            };
        } else if (condition === 'cancer') {
            const cancerType = this.extractCancerType(condition);
            const survivalModel = this.progressionModels.cancer.survivalModels[cancerType];

            if (survivalModel) {
                outcomes.survival = {
                    fiveYear: survivalModel.fiveYear * (1.0 - progression.probability * 0.3),
                    tenYear: survivalModel.tenYear * (1.0 - progression.probability * 0.4)
                };
            }
        }

        return outcomes;
    }

    /**
     * Assess complication risks
     */
    assessComplicationRisk(condition, currentStage, riskFactorScores, progression) {
        const model = this.progressionModels[condition];
        const complications = model.complications || [];

        const riskAssessment = {};
        const likely = [];
        const preventable = [];

        complications.forEach(complication => {
            const baseRisk = this.getBaseComplicationRisk(condition, complication, currentStage);
            const riskMultiplier = this.calculateComplicationRiskMultiplier(riskFactorScores, complication);
            const finalRisk = Math.min(0.9, baseRisk * riskMultiplier);

            riskAssessment[complication] = {
                risk: finalRisk,
                category: this.categorizeRisk(finalRisk),
                preventionPotential: this.assessPreventionPotential(complication, riskFactorScores)
            };

            if (finalRisk > 0.3) {
                likely.push({
                    complication,
                    risk: finalRisk,
                    timeframe: this.estimateComplicationTimeframe(finalRisk)
                });
            }

            if (riskAssessment[complication].preventionPotential > 0.5) {
                preventable.push({
                    complication,
                    currentRisk: finalRisk,
                    preventionPotential: riskAssessment[complication].preventionPotential,
                    interventions: this.getPreventionInterventions(complication)
                });
            }
        });

        return { overall: riskAssessment, likely, preventable };
    }

    /**
     * Generate intervention recommendations
     */
    async generateInterventionRecommendations(condition, progression, currentHealth) {
        const recommendations = {
            immediate: [],
            shortTerm: [],
            longTerm: [],
            lifestyle: [],
            medical: [],
            monitoring: []
        };

        const riskLevel = progression.progressionProbability > 0.5 ? 'high' :
                         progression.progressionProbability > 0.2 ? 'moderate' : 'low';

        if (riskLevel === 'high') {
            recommendations.immediate.push({
                intervention: 'Urgent medical evaluation',
                rationale: 'High progression risk detected',
                timeframe: '1-2 weeks',
                priority: 'urgent'
            });

            recommendations.medical.push({
                intervention: 'Medication optimization',
                details: 'Evaluate current medications and consider intensification',
                evidence: 'Can reduce progression risk by 30-50%'
            });
        }

        // Condition-specific recommendations
        if (condition === 'cardiovascular') {
            recommendations.lifestyle.push(
                { intervention: 'Cardiac rehabilitation program', impact: 'high' },
                { intervention: 'Mediterranean or DASH diet', impact: 'high' },
                { intervention: 'Regular aerobic exercise (150+ min/week)', impact: 'high' }
            );

            recommendations.medical.push(
                { intervention: 'Statin therapy optimization', indication: 'LDL control' },
                { intervention: 'ACE inhibitor/ARB', indication: 'Cardioprotection' }
            );
        } else if (condition === 'diabetes') {
            recommendations.lifestyle.push(
                { intervention: 'Diabetes self-management education', impact: 'high' },
                { intervention: 'Weight management program', impact: 'high' },
                { intervention: 'Continuous glucose monitoring', impact: 'medium' }
            );

            recommendations.medical.push(
                { intervention: 'HbA1c optimization (<7%)', indication: 'Complication prevention' },
                { intervention: 'Blood pressure management (<130/80)', indication: 'Cardiovascular protection' }
            );
        }

        return recommendations;
    }

    /**
     * Create progression monitoring plan
     */
    createProgressionMonitoringPlan(condition, progression, currentStage) {
        const plan = {
            biomarkers: [],
            imaging: [],
            functionalAssessments: [],
            frequency: {},
            alerts: []
        };

        const riskLevel = progression.progressionProbability > 0.5 ? 'high' :
                         progression.progressionProbability > 0.2 ? 'moderate' : 'low';

        const frequencyMap = {
            high: { biomarkers: 'monthly', imaging: 'quarterly', assessments: 'bimonthly' },
            moderate: { biomarkers: 'quarterly', imaging: 'biannually', assessments: 'quarterly' },
            low: { biomarkers: 'biannually', imaging: 'annually', assessments: 'biannually' }
        };

        plan.frequency = frequencyMap[riskLevel];

        if (condition === 'cardiovascular') {
            plan.biomarkers = ['lipid_panel', 'nt_pro_bnp', 'troponin', 'crp'];
            plan.imaging = ['echocardiogram', 'stress_testing'];
            plan.functionalAssessments = ['exercise_tolerance', 'quality_of_life'];
        } else if (condition === 'diabetes') {
            plan.biomarkers = ['hba1c', 'microalbumin', 'lipid_panel'];
            plan.imaging = ['retinal_screening', 'foot_examination'];
            plan.functionalAssessments = ['neuropathy_screening', 'quality_of_life'];
        }

        return plan;
    }

    // Helper methods for calculations and analysis

    determineCurrentStage(condition, currentHealth, biomarkerTrends) {
        const model = this.progressionModels[condition];
        if (!model) return 'unknown';

        // Simplified stage determination based on current health indicators
        if (condition === 'cardiovascular') {
            const ldl = biomarkerTrends.ldl?.latest || 100;
            const bp = currentHealth.bloodPressure?.systolic || 120;

            if (ldl < 70 && bp < 120) return 'pre_disease';
            if (ldl < 100 && bp < 140) return 'early_disease';
            if (ldl < 160 && bp < 160) return 'established_disease';
            return 'complications';
        } else if (condition === 'diabetes') {
            const hba1c = biomarkerTrends.hba1c?.latest || 5.5;

            if (hba1c < 5.7) return 'normal';
            if (hba1c < 6.5) return 'prediabetes';
            if (hba1c < 7.0) return 'early_diabetes';
            if (hba1c < 9.0) return 'established_diabetes';
            return 'complications';
        }

        return model.stages[0];
    }

    calculateLinearTrend(times, values) {
        if (times.length < 2) return { slope: 0, intercept: 0, correlation: 0 };

        const n = times.length;
        const sumX = times.reduce((sum, t) => sum + t, 0);
        const sumY = values.reduce((sum, v) => sum + v, 0);
        const sumXY = times.reduce((sum, t, i) => sum + (t * values[i]), 0);
        const sumXX = times.reduce((sum, t) => sum + (t * t), 0);
        const sumYY = values.reduce((sum, v) => sum + (v * v), 0);

        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;

        // Calculate correlation coefficient
        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
        const correlation = denominator === 0 ? 0 : numerator / denominator;

        return { slope, intercept, correlation };
    }

    calculateVelocity(times, values) {
        if (times.length < 2) return 0;

        const timeDeltas = [];
        const valueDeltas = [];

        for (let i = 1; i < times.length; i++) {
            timeDeltas.push(times[i] - times[i-1]);
            valueDeltas.push(values[i] - values[i-1]);
        }

        const avgTimeDelta = timeDeltas.reduce((sum, dt) => sum + dt, 0) / timeDeltas.length;
        const avgValueDelta = valueDeltas.reduce((sum, dv) => sum + dv, 0) / valueDeltas.length;

        return avgTimeDelta === 0 ? 0 : avgValueDelta / avgTimeDelta;
    }

    calculateAcceleration(times, values) {
        if (times.length < 3) return 0;

        const velocities = [];
        for (let i = 1; i < times.length; i++) {
            const timeDelta = times[i] - times[i-1];
            const valueDelta = values[i] - values[i-1];
            velocities.push(timeDelta === 0 ? 0 : valueDelta / timeDelta);
        }

        const accelerations = [];
        for (let i = 1; i < velocities.length; i++) {
            accelerations.push(velocities[i] - velocities[i-1]);
        }

        return accelerations.reduce((sum, acc) => sum + acc, 0) / accelerations.length;
    }

    projectFutureBiomarkerValues(times, values, trend, futureDays) {
        const lastTime = times[times.length - 1];
        const futureTime = lastTime + (futureDays * 24 * 60 * 60 * 1000); // Convert days to milliseconds

        const projectedValue = trend.intercept + (trend.slope * futureTime);

        return {
            timepoint: new Date(futureTime),
            projectedValue,
            confidence: Math.abs(trend.correlation)
        };
    }

    // Normalization methods
    normalizeAge(age) {
        return Math.min(1.0, (age - 20) / 60); // Normalize age 20-80 to 0-1
    }

    normalizeHbA1c(hba1c) {
        if (!hba1c) return 0.5;
        return Math.min(1.0, Math.max(0.0, (hba1c - 4.0) / 10.0)); // 4-14% range
    }

    normalizeBMI(bmi) {
        if (!bmi) return 0.5;
        return Math.min(1.0, Math.max(0.0, (bmi - 18.5) / 20.0)); // 18.5-38.5 range
    }

    normalizeBloodPressure(bp) {
        if (!bp || !bp.systolic) return 0.5;
        return Math.min(1.0, Math.max(0.0, (bp.systolic - 90) / 100)); // 90-190 mmHg range
    }

    normalizeLDLCholesterol(ldl) {
        if (!ldl) return 0.5;
        return Math.min(1.0, Math.max(0.0, (ldl - 50) / 200)); // 50-250 mg/dL range
    }

    normalizeFamilyHistory(familyHistory) {
        if (!familyHistory) return 0.0;
        // Simple scoring based on number of affected relatives
        return Math.min(1.0, Object.keys(familyHistory).length * 0.2);
    }

    calculatePredictionConfidence(historicalData, trendAnalysis) {
        let confidence = 0.5;

        // More historical data = higher confidence
        if (historicalData && historicalData.length > 0) {
            confidence += Math.min(0.3, historicalData.length * 0.05);
        }

        // Strong trends = higher confidence
        const strongTrends = Object.values(trendAnalysis.trends || {}).filter(trend =>
            Math.abs(trend.correlation) > 0.7
        ).length;

        confidence += Math.min(0.2, strongTrends * 0.05);

        return Math.min(0.95, Math.max(0.1, confidence));
    }

    identifyDominantRiskFactors(riskFactorScores) {
        return Object.entries(riskFactorScores)
            .sort(([,a], [,b]) => b.contribution - a.contribution)
            .slice(0, 5)
            .map(([factor, data]) => ({
                factor,
                contribution: data.contribution,
                modifiable: !['age', 'family_history'].includes(factor)
            }));
    }

    projectQualityOfLife(condition, progression) {
        const baselineQOL = 0.85; // Assume baseline quality of life score
        const progressionImpact = progression.probability * 0.3; // Progression reduces QOL

        return {
            current: baselineQOL,
            projected: Math.max(0.2, baselineQOL - progressionImpact),
            factors: {
                physical: Math.max(0.1, baselineQOL - progressionImpact * 1.2),
                mental: Math.max(0.1, baselineQOL - progressionImpact * 0.8),
                social: Math.max(0.1, baselineQOL - progressionImpact * 0.6)
            }
        };
    }

    parseTimeframe(timeframe) {
        const multipliers = {
            '1year': 1,
            '2years': 2,
            '5years': 5,
            '10years': 10
        };
        return multipliers[timeframe] || 5;
    }

    calculateTimeToProgression(probability, velocity, timeMultiplier) {
        if (probability <= 0.01) return '10+ years';
        if (probability >= 0.9) return '6 months - 1 year';

        // Simplified calculation based on probability and trend velocity
        const baseTime = (-Math.log(1 - probability)) * timeMultiplier;
        const velocityAdjustment = velocity > 0 ? 0.8 : 1.2; // Faster if worsening trend

        const adjustedTime = baseTime * velocityAdjustment;

        if (adjustedTime < 0.5) return '6 months';
        if (adjustedTime < 1) return '6-12 months';
        if (adjustedTime < 2) return '1-2 years';
        if (adjustedTime < 5) return '2-5 years';
        return '5+ years';
    }

    // Additional helper methods...
    async getCurrentHealthStatus(userId, condition) {
        try {
            const query = `SELECT * FROM user_clinical_data WHERE user_id = ? ORDER BY measurement_date DESC LIMIT 1`;
            const data = await this.db.query(query, [userId]);
            return data[0] || {};
        } catch (error) {
            return {};
        }
    }

    async getHistoricalHealthData(userId, condition) {
        try {
            const query = `SELECT * FROM user_clinical_data WHERE user_id = ? ORDER BY measurement_date DESC LIMIT 20`;
            return await this.db.query(query, [userId]);
        } catch (error) {
            return [];
        }
    }

    async getFamilyDiseaseHistory(userId, condition) {
        try {
            const query = `
                SELECT fd.*, d.name as disease_name
                FROM family_diseases fd
                JOIN diseases d ON fd.disease_id = d.id
                WHERE fd.user_id = ? AND d.category LIKE ?
            `;
            return await this.db.query(query, [userId, `%${condition}%`]);
        } catch (error) {
            return [];
        }
    }

    async getLifestyleFactors(userId) {
        try {
            const query = `SELECT * FROM user_lifestyle_data WHERE user_id = ? ORDER BY assessment_date DESC LIMIT 1`;
            const data = await this.db.query(query, [userId]);
            return data[0] || {};
        } catch (error) {
            return {};
        }
    }

    async getBiomarkerTrends(userId, condition) {
        try {
            const query = `
                SELECT biomarker_name, value, measurement_date
                FROM user_biomarker_data
                WHERE user_id = ?
                ORDER BY biomarker_name, measurement_date DESC
            `;
            const data = await this.db.query(query, [userId]);

            const trends = {};
            data.forEach(record => {
                if (!trends[record.biomarker_name]) {
                    trends[record.biomarker_name] = { values: [] };
                }
                trends[record.biomarker_name].values.push({
                    value: record.value,
                    date: record.measurement_date
                });
            });

            // Add latest values for quick access
            Object.keys(trends).forEach(biomarker => {
                trends[biomarker].latest = trends[biomarker].values[0]?.value;
            });

            return trends;
        } catch (error) {
            return {};
        }
    }

    async logProgressionPrediction(userId, condition, result) {
        try {
            const query = `
                INSERT INTO progression_predictions (
                    user_id, condition, prediction_data, confidence,
                    predicted_stage, progression_probability, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `;

            await this.db.query(query, [
                userId,
                condition,
                JSON.stringify(result),
                result.progressionPrediction.confidence,
                result.progressionPrediction.expectedStage,
                result.progressionPrediction.likelihood,
                new Date().toISOString()
            ]);
        } catch (error) {
            console.error('Error logging progression prediction:', error);
        }
    }

    // Placeholder methods for additional functionality
    isWorseningTrend(trend, biomarker, condition) {
        return trend.slope > 0 && Math.abs(trend.correlation) > 0.5;
    }

    assessTrendSeverity(trend, thresholds) {
        return Math.abs(trend.slope) * Math.abs(trend.correlation);
    }

    calculateTimeToThreshold(trend, currentValue, thresholds) {
        return '1-2 years'; // Simplified placeholder
    }

    getBaseComplicationRisk(condition, complication, currentStage) {
        return 0.2; // Simplified placeholder
    }

    calculateComplicationRiskMultiplier(riskFactorScores, complication) {
        return 1.5; // Simplified placeholder
    }

    categorizeRisk(risk) {
        if (risk < 0.2) return 'low';
        if (risk < 0.5) return 'moderate';
        return 'high';
    }

    assessPreventionPotential(complication, riskFactorScores) {
        return 0.6; // Simplified placeholder
    }

    estimateComplicationTimeframe(risk) {
        return '2-5 years'; // Simplified placeholder
    }

    getPreventionInterventions(complication) {
        return ['lifestyle_modification', 'medication_optimization'];
    }

    extractCancerType(condition) {
        return 'breast'; // Simplified placeholder
    }
}

module.exports = ChronicDiseaseProgressionService;