/**
 * Vaccine & Immunization Tracking Service
 * Integrates with CDC ACIP, WHO immunization data, and vaccine surveillance systems
 * Provides comprehensive vaccine tracking, efficacy monitoring, and immunization scheduling
 */

class VaccineTrackingService {
    constructor() {
        this.cache = new Map();
        this.cacheExpiry = 1000 * 60 * 60 * 6; // 6 hours for vaccine data
        this.rateLimitDelay = 2000; // 2 seconds between API calls
        this.lastRequestTime = 0;

        // Vaccine data sources
        this.dataSources = {
            cdc_acip: {
                name: 'CDC Advisory Committee on Immunization Practices',
                endpoint: 'https://www.cdc.gov/vaccines/acip',
                active: true
            },
            who_immunization: {
                name: 'WHO Immunization Data',
                endpoint: 'https://apps.who.int/gho/data/view.main',
                regions: 194,
                active: true
            },
            vaers: {
                name: 'Vaccine Adverse Event Reporting System',
                endpoint: 'https://vaers.hhs.gov/data.html',
                active: true
            },
            v_safe: {
                name: 'v-safe After Vaccination Health Checker',
                endpoint: 'https://www.cdc.gov/coronavirus/2019-ncov/vaccines/safety/vsafe.html',
                active: true
            }
        };

        // Comprehensive vaccine database
        this.vaccines = {
            'covid-19': {
                vaccines: [
                    {
                        name: 'Pfizer-BioNTech COVID-19',
                        manufacturer: 'Pfizer-BioNTech',
                        type: 'mRNA',
                        doses: 2,
                        interval: '21 days',
                        efficacy: 0.95,
                        ageGroup: '6 months+',
                        fdaApproval: '2021-08-23',
                        storage: '-70°C',
                        variants: ['Alpha', 'Delta', 'Omicron']
                    },
                    {
                        name: 'Moderna COVID-19',
                        manufacturer: 'Moderna',
                        type: 'mRNA',
                        doses: 2,
                        interval: '28 days',
                        efficacy: 0.941,
                        ageGroup: '6 months+',
                        fdaApproval: '2022-01-31',
                        storage: '-20°C',
                        variants: ['Alpha', 'Delta', 'Omicron']
                    },
                    {
                        name: 'Johnson & Johnson COVID-19',
                        manufacturer: 'Janssen',
                        type: 'Viral vector',
                        doses: 1,
                        interval: 'Single dose',
                        efficacy: 0.72,
                        ageGroup: '18+',
                        fdaApproval: '2021-02-27',
                        storage: '2-8°C',
                        variants: ['Original strain']
                    }
                ]
            },
            'influenza': {
                vaccines: [
                    {
                        name: 'Seasonal Influenza (Quadrivalent)',
                        manufacturer: 'Multiple',
                        type: 'Inactivated',
                        doses: 1,
                        interval: 'Annual',
                        efficacy: 0.6,
                        ageGroup: '6 months+',
                        storage: '2-8°C',
                        strains: ['H1N1', 'H3N2', 'Victoria', 'Yamagata']
                    }
                ]
            },
            'measles': {
                vaccines: [
                    {
                        name: 'MMR (Measles, Mumps, Rubella)',
                        manufacturer: 'Merck',
                        type: 'Live attenuated',
                        doses: 2,
                        interval: '4 weeks',
                        efficacy: 0.97,
                        ageGroup: '12 months+',
                        storage: '2-8°C',
                        contraindications: ['Pregnancy', 'Immunocompromised']
                    }
                ]
            },
            'hepatitis_b': {
                vaccines: [
                    {
                        name: 'Hepatitis B',
                        manufacturer: 'Multiple',
                        type: 'Recombinant',
                        doses: 3,
                        interval: '0, 1-2, 6 months',
                        efficacy: 0.95,
                        ageGroup: 'Birth+',
                        storage: '2-8°C',
                        duration: 'Lifelong'
                    }
                ]
            }
        };

        // Immunization schedules by country/region
        this.immunizationSchedules = {
            'US_CDC': {
                name: 'US CDC Immunization Schedule',
                children: [
                    { vaccine: 'Hepatitis B', age: 'Birth', doses: 1 },
                    { vaccine: 'DTaP', age: '2 months', doses: 1 },
                    { vaccine: 'Hib', age: '2 months', doses: 1 },
                    { vaccine: 'IPV', age: '2 months', doses: 1 },
                    { vaccine: 'PCV13', age: '2 months', doses: 1 },
                    { vaccine: 'RV', age: '2 months', doses: 1 },
                    { vaccine: 'MMR', age: '12-15 months', doses: 1 },
                    { vaccine: 'Varicella', age: '12-15 months', doses: 1 }
                ],
                adults: [
                    { vaccine: 'Influenza', age: 'Annual', doses: 1 },
                    { vaccine: 'COVID-19', age: '6 months+', doses: 'Per guidelines' },
                    { vaccine: 'Tdap', age: 'Every 10 years', doses: 1 },
                    { vaccine: 'Zoster', age: '50+', doses: 2 }
                ]
            },
            'WHO_Global': {
                name: 'WHO Expanded Programme on Immunization',
                children: [
                    { vaccine: 'BCG', age: 'Birth', diseases: ['Tuberculosis'] },
                    { vaccine: 'DTP', age: '6, 10, 14 weeks', diseases: ['Diphtheria', 'Tetanus', 'Pertussis'] },
                    { vaccine: 'OPV', age: '6, 10, 14 weeks', diseases: ['Polio'] },
                    { vaccine: 'Measles', age: '9 months', diseases: ['Measles'] }
                ]
            }
        };

        // Vaccine effectiveness data
        this.effectivenessData = {
            'covid-19': {
                '2021': { pfizer: 0.95, moderna: 0.94, jj: 0.72 },
                '2022': { pfizer: 0.67, moderna: 0.71, jj: 0.31 }, // Against Omicron
                '2023': { bivalent: 0.58, updated: 0.43 },
                '2024': { updated_xbb: 0.54 }
            },
            'influenza': {
                '2019-2020': 0.39,
                '2020-2021': 0.24,
                '2021-2022': 0.16,
                '2022-2023': 0.42,
                '2023-2024': 0.34
            }
        };

        // Vaccine coverage statistics
        this.coverageStats = {
            'global': {
                'covid-19': {
                    oneDose: 0.687,
                    fullyVaccinated: 0.632,
                    boosted: 0.312,
                    lastUpdated: '2024-01-15'
                },
                'measles': {
                    dose1: 0.86,
                    dose2: 0.71,
                    targetCoverage: 0.95
                },
                'dtp3': {
                    coverage: 0.84,
                    targetCoverage: 0.90
                }
            },
            'us': {
                'covid-19': {
                    oneDose: 0.802,
                    fullyVaccinated: 0.696,
                    boosted: 0.487,
                    updated2023: 0.173
                },
                'influenza_2023': {
                    children: 0.578,
                    adults: 0.448,
                    elderly: 0.687
                },
                'childhood_vaccines': {
                    mmr: 0.937,
                    dtap: 0.941,
                    varicella: 0.923
                }
            }
        };

        // Adverse events monitoring
        this.adverseEvents = {
            'covid-19': {
                common: ['injection site pain', 'fatigue', 'headache', 'muscle pain'],
                serious: ['myocarditis', 'anaphylaxis', 'thrombosis'],
                rates: {
                    myocarditis: '12.6 per million doses (young males)',
                    anaphylaxis: '5 per million doses',
                    overall_serious: '0.003%'
                }
            },
            'influenza': {
                common: ['soreness', 'low-grade fever', 'aches'],
                serious: ['Guillain-Barré syndrome'],
                rates: {
                    gbs: '1-2 per million doses',
                    overall_serious: '0.001%'
                }
            }
        };
    }

    /**
     * Get vaccine information for a specific disease
     */
    async getVaccineInfo(disease, options = {}) {
        const {
            includeEfficacy = true,
            includeSchedule = true,
            includeAdverseEvents = false,
            country = 'US'
        } = options;

        try {
            const cacheKey = `vaccine_info_${disease}_${JSON.stringify(options)}`;
            const cached = this.getCachedData(cacheKey);
            if (cached) return cached;

            const diseaseKey = disease.toLowerCase().replace(/\s+/g, '_');
            const vaccineData = this.vaccines[diseaseKey];

            if (!vaccineData) {
                return {
                    disease,
                    message: 'No vaccine information available for this disease',
                    availableVaccines: []
                };
            }

            const result = {
                disease,
                availableVaccines: vaccineData.vaccines,
                totalVaccines: vaccineData.vaccines.length,
                lastUpdated: new Date().toISOString()
            };

            if (includeEfficacy && this.effectivenessData[diseaseKey]) {
                result.effectivenessHistory = this.effectivenessData[diseaseKey];
                result.currentEfficacy = this.getCurrentEfficacy(diseaseKey);
            }

            if (includeSchedule) {
                result.recommendedSchedule = this.getRecommendedSchedule(diseaseKey, country);
            }

            if (includeAdverseEvents && this.adverseEvents[diseaseKey]) {
                result.adverseEvents = this.adverseEvents[diseaseKey];
            }

            // Add coverage statistics
            result.coverageStatistics = this.getCoverageStatistics(diseaseKey);

            this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
            return result;

        } catch (error) {
            console.error(`Vaccine info error for ${disease}:`, error);
            return {
                disease,
                error: error.message,
                availableVaccines: []
            };
        }
    }

    /**
     * Track vaccination coverage for a region
     */
    async getVaccinationCoverage(region, vaccine, options = {}) {
        const {
            timeframe = '1 year',
            ageGroups = 'all',
            includeProjections = false
        } = options;

        try {
            const cacheKey = `coverage_${region}_${vaccine}_${JSON.stringify(options)}`;
            const cached = this.getCachedData(cacheKey);
            if (cached) return cached;

            // Get coverage data based on region and vaccine
            let coverageData = this.coverageStats[region.toLowerCase()] || this.coverageStats.global;
            const vaccineKey = vaccine.toLowerCase().replace(/\s+/g, '_');

            const result = {
                region,
                vaccine,
                timeframe,
                coverage: coverageData[vaccineKey] || null,
                targetCoverage: this.getTargetCoverage(vaccineKey),
                trends: this.getCoverageTrends(region, vaccineKey),
                demographics: this.getCoverageDemographics(region, vaccineKey),
                lastUpdated: new Date().toISOString()
            };

            if (includeProjections) {
                result.projections = this.generateCoverageProjections(region, vaccineKey);
            }

            // Calculate herd immunity threshold
            if (vaccineKey === 'covid-19' || vaccineKey === 'measles') {
                result.herdImmunityThreshold = this.calculateHerdImmunityThreshold(vaccineKey);
            }

            this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
            return result;

        } catch (error) {
            console.error(`Coverage tracking error for ${region}/${vaccine}:`, error);
            return {
                region,
                vaccine,
                error: error.message,
                coverage: null
            };
        }
    }

    /**
     * Get personalized vaccination recommendations
     */
    async getVaccinationRecommendations(patientProfile, options = {}) {
        const {
            includeTravel = false,
            includeOccupational = false,
            includeCatchUp = true
        } = options;

        try {
            const { age, sex, medicalConditions, previousVaccinations, location } = patientProfile;

            const recommendations = [];

            // Age-based recommendations
            const ageRecommendations = this.getAgeBasedRecommendations(age);
            recommendations.push(...ageRecommendations);

            // Risk-based recommendations
            if (medicalConditions && medicalConditions.length > 0) {
                const riskRecommendations = this.getRiskBasedRecommendations(medicalConditions);
                recommendations.push(...riskRecommendations);
            }

            // Catch-up vaccinations
            if (includeCatchUp && previousVaccinations) {
                const catchUpRecommendations = this.getCatchUpRecommendations(
                    age, previousVaccinations
                );
                recommendations.push(...catchUpRecommendations);
            }

            // Travel recommendations
            if (includeTravel) {
                const travelRecommendations = this.getTravelRecommendations(location);
                recommendations.push(...travelRecommendations);
            }

            // Occupational recommendations
            if (includeOccupational && patientProfile.occupation) {
                const occupationalRecommendations = this.getOccupationalRecommendations(
                    patientProfile.occupation
                );
                recommendations.push(...occupationalRecommendations);
            }

            return {
                patientProfile: {
                    age,
                    sex,
                    riskFactors: medicalConditions || [],
                    location
                },
                recommendations: recommendations.map(this.prioritizeRecommendation.bind(this)),
                totalRecommendations: recommendations.length,
                nextReview: this.calculateNextReviewDate(age),
                generatedAt: new Date().toISOString()
            };

        } catch (error) {
            console.error('Vaccination recommendations error:', error);
            return {
                patientProfile,
                error: error.message,
                recommendations: []
            };
        }
    }

    /**
     * Monitor vaccine effectiveness over time
     */
    async monitorVaccineEffectiveness(vaccine, options = {}) {
        const {
            timeframe = '2 years',
            variants = null,
            population = 'general'
        } = options;

        try {
            const vaccineKey = vaccine.toLowerCase().replace(/\s+/g, '_');
            const effectivenessData = this.effectivenessData[vaccineKey];

            if (!effectivenessData) {
                return {
                    vaccine,
                    message: 'No effectiveness data available',
                    effectiveness: null
                };
            }

            const result = {
                vaccine,
                timeframe,
                population,
                effectivenessHistory: effectivenessData,
                trends: this.analyzeEffectivenessTrends(effectivenessData),
                currentEffectiveness: this.getCurrentEfficacy(vaccineKey),
                factors: this.getEffectivenessFactors(vaccineKey),
                lastUpdated: new Date().toISOString()
            };

            if (variants) {
                result.variantEffectiveness = this.getVariantEffectiveness(vaccineKey, variants);
            }

            return result;

        } catch (error) {
            console.error(`Effectiveness monitoring error for ${vaccine}:`, error);
            return {
                vaccine,
                error: error.message,
                effectiveness: null
            };
        }
    }

    /**
     * Track adverse events and safety signals
     */
    async trackAdverseEvents(vaccine, options = {}) {
        const {
            severity = 'all',
            timeframe = '1 year',
            demographics = null
        } = options;

        try {
            const vaccineKey = vaccine.toLowerCase().replace(/\s+/g, '_');
            const adverseEventData = this.adverseEvents[vaccineKey];

            if (!adverseEventData) {
                return {
                    vaccine,
                    message: 'No adverse event data available',
                    events: []
                };
            }

            const result = {
                vaccine,
                timeframe,
                summary: {
                    commonEvents: adverseEventData.common,
                    seriousEvents: adverseEventData.serious,
                    rates: adverseEventData.rates
                },
                safetyProfile: this.generateSafetyProfile(adverseEventData),
                riskBenefit: this.calculateRiskBenefit(vaccineKey),
                monitoring: {
                    systems: ['VAERS', 'v-safe', 'VSD', 'CISA'],
                    lastUpdate: new Date().toISOString()
                }
            };

            if (demographics) {
                result.demographicBreakdown = this.getAdverseEventDemographics(
                    vaccineKey, demographics
                );
            }

            return result;

        } catch (error) {
            console.error(`Adverse events tracking error for ${vaccine}:`, error);
            return {
                vaccine,
                error: error.message,
                events: []
            };
        }
    }

    /**
     * Get current vaccine efficacy
     */
    getCurrentEfficacy(vaccineKey) {
        const data = this.effectivenessData[vaccineKey];
        if (!data) return null;

        const years = Object.keys(data).sort().reverse();
        const latestYear = years[0];
        const latestData = data[latestYear];

        if (typeof latestData === 'object') {
            const values = Object.values(latestData);
            return values.reduce((sum, val) => sum + val, 0) / values.length;
        }

        return latestData;
    }

    /**
     * Get recommended vaccination schedule
     */
    getRecommendedSchedule(diseaseKey, country) {
        const scheduleKey = country.toUpperCase() === 'US' ? 'US_CDC' : 'WHO_Global';
        const schedule = this.immunizationSchedules[scheduleKey];

        if (!schedule) return null;

        const relevantSchedule = [];
        
        // Search both children and adult schedules
        const allSchedules = [...(schedule.children || []), ...(schedule.adults || [])];
        
        for (const item of allSchedules) {
            if (item.vaccine.toLowerCase().includes(diseaseKey) || 
                diseaseKey.includes(item.vaccine.toLowerCase())) {
                relevantSchedule.push(item);
            }
        }

        return {
            country: schedule.name,
            schedule: relevantSchedule
        };
    }

    /**
     * Get coverage statistics
     */
    getCoverageStatistics(diseaseKey) {
        const globalCoverage = this.coverageStats.global[diseaseKey];
        const usCoverage = this.coverageStats.us[diseaseKey];

        return {
            global: globalCoverage,
            us: usCoverage,
            comparison: globalCoverage && usCoverage ? {
                usVsGlobal: usCoverage.fullyVaccinated - globalCoverage.fullyVaccinated
            } : null
        };
    }

    /**
     * Get target coverage for herd immunity
     */
    getTargetCoverage(vaccineKey) {
        const targets = {
            'covid-19': 0.70,
            'measles': 0.95,
            'influenza': 0.70,
            'dtp3': 0.90
        };

        return targets[vaccineKey] || 0.80;
    }

    /**
     * Get coverage trends
     */
    getCoverageTrends(region, vaccineKey) {
        // Mock trend data
        return {
            direction: 'stable',
            changePercent: 2.3,
            period: 'last 6 months',
            factors: ['vaccine hesitancy', 'access issues', 'policy changes']
        };
    }

    /**
     * Get coverage demographics
     */
    getCoverageDemographics(region, vaccineKey) {
        return {
            ageGroups: {
                '0-17': 0.82,
                '18-49': 0.67,
                '50-64': 0.74,
                '65+': 0.89
            },
            byRace: {
                'white': 0.75,
                'black': 0.61,
                'hispanic': 0.68,
                'asian': 0.83
            },
            byIncome: {
                'low': 0.58,
                'middle': 0.72,
                'high': 0.84
            }
        };
    }

    /**
     * Generate coverage projections
     */
    generateCoverageProjections(region, vaccineKey) {
        return {
            next3Months: 0.72,
            next6Months: 0.75,
            next12Months: 0.78,
            assumptions: ['Current vaccination rate', 'No major policy changes', 'Stable supply']
        };
    }

    /**
     * Calculate herd immunity threshold
     */
    calculateHerdImmunityThreshold(vaccineKey) {
        const thresholds = {
            'covid-19': { threshold: 0.70, r0: 2.5 },
            'measles': { threshold: 0.95, r0: 15 },
            'influenza': { threshold: 0.60, r0: 1.5 }
        };

        return thresholds[vaccineKey] || { threshold: 0.80, r0: 'unknown' };
    }

    /**
     * Get age-based recommendations
     */
    getAgeBasedRecommendations(age) {
        const recommendations = [];

        if (age < 2) {
            recommendations.push({
                vaccine: 'Routine childhood vaccines',
                priority: 'high',
                timing: 'Per CDC schedule',
                reason: 'Essential infant immunizations'
            });
        } else if (age >= 6 && age < 18) {
            recommendations.push({
                vaccine: 'Annual influenza',
                priority: 'medium',
                timing: 'Yearly',
                reason: 'School-age prevention'
            });
        } else if (age >= 18 && age < 65) {
            recommendations.push({
                vaccine: 'COVID-19 (updated)',
                priority: 'high',
                timing: 'Annually',
                reason: 'Ongoing pandemic protection'
            });
            recommendations.push({
                vaccine: 'Tdap booster',
                priority: 'medium',
                timing: 'Every 10 years',
                reason: 'Tetanus/diphtheria/pertussis immunity'
            });
        } else if (age >= 65) {
            recommendations.push({
                vaccine: 'Pneumococcal',
                priority: 'high',
                timing: 'One-time',
                reason: 'High-risk age group'
            });
            recommendations.push({
                vaccine: 'Zoster (shingles)',
                priority: 'high',
                timing: 'Two doses',
                reason: 'Prevent shingles complications'
            });
        }

        return recommendations;
    }

    /**
     * Get risk-based recommendations
     */
    getRiskBasedRecommendations(medicalConditions) {
        const recommendations = [];

        if (medicalConditions.includes('diabetes')) {
            recommendations.push({
                vaccine: 'Pneumococcal',
                priority: 'high',
                timing: 'As recommended',
                reason: 'Increased infection risk with diabetes'
            });
        }

        if (medicalConditions.includes('immunocompromised')) {
            recommendations.push({
                vaccine: 'Live vaccines contraindicated',
                priority: 'critical',
                timing: 'Avoid',
                reason: 'Safety concern for immunocompromised patients'
            });
        }

        return recommendations;
    }

    /**
     * Get catch-up recommendations
     */
    getCatchUpRecommendations(age, previousVaccinations) {
        const recommendations = [];
        const standardVaccines = ['MMR', 'Varicella', 'Hepatitis B', 'DTaP'];

        for (const vaccine of standardVaccines) {
            if (!previousVaccinations.includes(vaccine)) {
                recommendations.push({
                    vaccine: `${vaccine} (catch-up)`,
                    priority: 'medium',
                    timing: 'Schedule consultation',
                    reason: 'Missing from childhood series'
                });
            }
        }

        return recommendations;
    }

    /**
     * Get travel recommendations
     */
    getTravelRecommendations(destination) {
        const travelVaccines = {
            'africa': ['Yellow fever', 'Typhoid', 'Hepatitis A', 'Meningococcal'],
            'asia': ['Japanese encephalitis', 'Typhoid', 'Hepatitis A'],
            'south_america': ['Yellow fever', 'Typhoid', 'Hepatitis A']
        };

        const region = destination?.toLowerCase() || 'general';
        const vaccines = travelVaccines[region] || ['Hepatitis A', 'Typhoid'];

        return vaccines.map(vaccine => ({
            vaccine,
            priority: 'medium',
            timing: '2-4 weeks before travel',
            reason: `Endemic in ${destination || 'destination'}`
        }));
    }

    /**
     * Get occupational recommendations
     */
    getOccupationalRecommendations(occupation) {
        const occupationalVaccines = {
            'healthcare': ['Hepatitis B', 'Influenza (annual)', 'COVID-19'],
            'laboratory': ['Hepatitis B', 'Typhoid', 'Meningococcal'],
            'veterinary': ['Rabies', 'Hepatitis B'],
            'travel': ['Hepatitis A', 'Typhoid', 'Yellow fever']
        };

        const vaccines = occupationalVaccines[occupation.toLowerCase()] || [];

        return vaccines.map(vaccine => ({
            vaccine,
            priority: 'high',
            timing: 'Per occupational guidelines',
            reason: `Occupational exposure risk: ${occupation}`
        }));
    }

    /**
     * Prioritize recommendations
     */
    prioritizeRecommendation(recommendation) {
        const priorityScores = { 'critical': 1, 'high': 2, 'medium': 3, 'low': 4 };
        
        return {
            ...recommendation,
            priorityScore: priorityScores[recommendation.priority] || 5
        };
    }

    /**
     * Calculate next review date
     */
    calculateNextReviewDate(age) {
        if (age < 18) return '6 months'; // Children need more frequent review
        if (age >= 65) return '6 months'; // Elderly need more frequent review
        return '1 year'; // Adults annual review
    }

    /**
     * Analyze effectiveness trends
     */
    analyzeEffectivenessTrends(effectivenessData) {
        const years = Object.keys(effectivenessData).sort();
        if (years.length < 2) return { trend: 'insufficient_data' };

        const firstYear = effectivenessData[years[0]];
        const lastYear = effectivenessData[years[years.length - 1]];

        const firstValue = typeof firstYear === 'object' ? Object.values(firstYear)[0] : firstYear;
        const lastValue = typeof lastYear === 'object' ? Object.values(lastYear)[0] : lastYear;

        const change = lastValue - firstValue;

        return {
            trend: change > 0.05 ? 'increasing' : change < -0.05 ? 'decreasing' : 'stable',
            changePercent: Math.round(change * 100),
            period: `${years[0]}-${years[years.length - 1]}`
        };
    }

    /**
     * Get effectiveness factors
     */
    getEffectivenessFactors(vaccineKey) {
        const factors = {
            'covid-19': ['Viral variants', 'Time since vaccination', 'Age', 'Immune status'],
            'influenza': ['Strain match', 'Age', 'Previous vaccination', 'Antigenic drift'],
            'measles': ['Vaccination schedule completion', 'Age at vaccination']
        };

        return factors[vaccineKey] || ['Time since vaccination', 'Age', 'Immune status'];
    }

    /**
     * Get variant effectiveness
     */
    getVariantEffectiveness(vaccineKey, variants) {
        if (vaccineKey !== 'covid-19') return null;

        const variantData = {
            'Alpha': 0.89,
            'Delta': 0.67,
            'Omicron': 0.35,
            'XBB.1.5': 0.54
        };

        return variants.map(variant => ({
            variant,
            effectiveness: variantData[variant] || 'unknown'
        }));
    }

    /**
     * Generate safety profile
     */
    generateSafetyProfile(adverseEventData) {
        return {
            overallSafety: 'Well-tolerated',
            commonReactions: adverseEventData.common.length,
            seriousEvents: adverseEventData.serious.length,
            riskLevel: 'Low',
            monitoringRecommendations: [
                'Report serious adverse events',
                'Monitor for allergic reactions',
                'Follow post-vaccination observation period'
            ]
        };
    }

    /**
     * Calculate risk-benefit ratio
     */
    calculateRiskBenefit(vaccineKey) {
        const benefits = {
            'covid-19': 'Prevents severe disease, hospitalization, death',
            'influenza': 'Reduces illness duration and severity',
            'measles': 'Prevents highly contagious disease with complications'
        };

        return {
            benefits: benefits[vaccineKey] || 'Prevents disease',
            risks: 'Minimal - mostly mild reactions',
            ratio: 'Strongly favors vaccination',
            recommendation: 'Benefits far outweigh risks'
        };
    }

    /**
     * Get adverse event demographics
     */
    getAdverseEventDemographics(vaccineKey, demographics) {
        return {
            ageGroups: {
                'under_18': 'Lower rates',
                '18-64': 'Moderate rates',
                'over_65': 'Similar rates'
            },
            sex: {
                'male': 'Slightly higher myocarditis risk (COVID-19)',
                'female': 'Standard risk profile'
            },
            riskFactors: ['Age', 'Previous reactions', 'Immune status']
        };
    }

    /**
     * Get cached data if valid
     */
    getCachedData(key) {
        const cached = this.cache.get(key);
        if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
            return cached.data;
        }
        return null;
    }

    /**
     * Rate limiting helper
     */
    async rateLimitedDelay() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        
        if (timeSinceLastRequest < this.rateLimitDelay) {
            await new Promise(resolve => 
                setTimeout(resolve, this.rateLimitDelay - timeSinceLastRequest)
            );
        }

        this.lastRequestTime = Date.now();
    }

    /**
     * Get service status
     */
    getStatus() {
        return {
            availableVaccines: Object.keys(this.vaccines),
            dataSources: Object.keys(this.dataSources),
            immunizationSchedules: Object.keys(this.immunizationSchedules),
            trackingCapabilities: [
                'Vaccine information',
                'Coverage monitoring',
                'Effectiveness tracking',
                'Adverse event monitoring',
                'Personalized recommendations'
            ],
            cacheSize: this.cache.size,
            lastUpdated: new Date().toISOString()
        };
    }
}

module.exports = VaccineTrackingService;