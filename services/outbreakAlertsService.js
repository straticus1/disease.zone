/**
 * Public Health Emergency & Outbreak Alerts Service
 * Integrates with WHO Disease Outbreak News, CDC Outbreak Surveillance, and ProMED feeds
 * Provides real-time outbreak detection, severity assessment, and geographic tracking
 */

class OutbreakAlertsService {
    constructor() {
        this.cache = new Map();
        this.cacheExpiry = 1000 * 60 * 15; // 15 minutes for real-time alerts
        this.rateLimitDelay = 2000; // 2 seconds between API calls
        this.lastRequestTime = 0;

        // Data sources and endpoints
        this.dataSources = {
            who: {
                name: 'WHO Disease Outbreak News',
                endpoint: 'https://www.who.int/feeds/entity/csr/don/en/rss.xml',
                active: true
            },
            cdc: {
                name: 'CDC Health Alert Network',
                endpoint: 'https://emergency.cdc.gov/han/index.asp',
                active: true
            },
            promed: {
                name: 'ProMED-mail',
                endpoint: 'https://promedmail.org/promed-posts/',
                active: true
            }
        };

        // Severity classifications
        this.severityLevels = {
            1: { level: 'watch', color: '#3498db', description: 'Monitoring situation' },
            2: { level: 'advisory', color: '#f39c12', description: 'Health advisory issued' },
            3: { level: 'alert', color: '#e67e22', description: 'Public health alert' },
            4: { level: 'warning', color: '#e74c3c', description: 'Health warning' },
            5: { level: 'emergency', color: '#8e44ad', description: 'Public health emergency' }
        };

        // Disease patterns for detection
        this.diseasePatterns = {
            'pandemic_risk': ['influenza', 'coronavirus', 'sars', 'mers', 'h5n1', 'h1n1'],
            'vector_borne': ['malaria', 'dengue', 'zika', 'chikungunya', 'yellow fever', 'west nile'],
            'waterborne': ['cholera', 'typhoid', 'hepatitis a', 'norovirus', 'rotavirus'],
            'foodborne': ['salmonella', 'e.coli', 'listeria', 'campylobacter', 'botulism'],
            'airborne': ['tuberculosis', 'measles', 'pertussis', 'meningitis', 'pneumonia'],
            'hemorrhagic': ['ebola', 'marburg', 'lassa', 'crimean-congo', 'rift valley']
        };

        // Geographic regions
        this.regions = {
            'AFRO': 'Africa',
            'AMRO': 'Americas', 
            'SEARO': 'South-East Asia',
            'EURO': 'Europe',
            'EMRO': 'Eastern Mediterranean',
            'WPRO': 'Western Pacific'
        };

        // Mock outbreak data for demonstration
        this.mockOutbreaks = [
            {
                id: 'WHO-2024-001',
                disease: 'Dengue Fever',
                location: 'Bangladesh',
                region: 'SEARO',
                severity: 3,
                casesReported: 78542,
                deathsReported: 364,
                firstReported: '2024-01-15',
                lastUpdate: '2024-09-15',
                status: 'ongoing',
                description: 'Ongoing dengue outbreak in Dhaka and surrounding districts',
                affectedAreas: ['Dhaka', 'Chittagong', 'Sylhet'],
                riskFactors: ['monsoon season', 'urban crowding', 'poor sanitation']
            },
            {
                id: 'CDC-2024-002',
                disease: 'Mpox',
                location: 'Democratic Republic of Congo',
                region: 'AFRO',
                severity: 4,
                casesReported: 14542,
                deathsReported: 738,
                firstReported: '2024-08-01',
                lastUpdate: '2024-09-18',
                status: 'expanding',
                description: 'New clade Ib mpox variant spreading rapidly',
                affectedAreas: ['South Kivu', 'North Kivu', 'Kinshasa'],
                riskFactors: ['new variant', 'limited surveillance', 'weak health systems']
            },
            {
                id: 'WHO-2024-003',
                disease: 'Cholera',
                location: 'Haiti',
                region: 'AMRO',
                severity: 3,
                casesReported: 8743,
                deathsReported: 89,
                firstReported: '2024-03-10',
                lastUpdate: '2024-09-10',
                status: 'declining',
                description: 'Cholera outbreak following water infrastructure damage',
                affectedAreas: ['Port-au-Prince', 'Artibonite', 'West Department'],
                riskFactors: ['water contamination', 'poor sanitation', 'political instability']
            }
        ];
    }

    /**
     * Get current active outbreaks with filtering options
     */
    async getActiveOutbreaks(options = {}) {
        const {
            disease = null,
            region = null,
            severity = null,
            limit = 50,
            includeResolved = false
        } = options;

        try {
            const cacheKey = `outbreaks_${JSON.stringify(options)}`;
            const cached = this.getCachedData(cacheKey);
            if (cached) return cached;

            // In production, this would fetch from real APIs
            let outbreaks = [...this.mockOutbreaks];

            // Apply filters
            if (disease) {
                outbreaks = outbreaks.filter(o => 
                    o.disease.toLowerCase().includes(disease.toLowerCase())
                );
            }

            if (region) {
                outbreaks = outbreaks.filter(o => o.region === region);
            }

            if (severity) {
                outbreaks = outbreaks.filter(o => o.severity >= severity);
            }

            if (!includeResolved) {
                outbreaks = outbreaks.filter(o => o.status !== 'resolved');
            }

            // Sort by severity and recency
            outbreaks.sort((a, b) => {
                if (a.severity !== b.severity) return b.severity - a.severity;
                return new Date(b.lastUpdate) - new Date(a.lastUpdate);
            });

            const result = {
                outbreaks: outbreaks.slice(0, limit).map(this.enrichOutbreakData.bind(this)),
                totalFound: outbreaks.length,
                filters: { disease, region, severity, includeResolved },
                lastUpdated: new Date().toISOString(),
                alertLevel: this.calculateGlobalAlertLevel(outbreaks)
            };

            this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
            return result;

        } catch (error) {
            console.error('Outbreak alerts error:', error);
            return {
                outbreaks: [],
                error: error.message,
                totalFound: 0
            };
        }
    }

    /**
     * Get outbreak details by ID
     */
    async getOutbreakDetails(outbreakId) {
        try {
            const outbreak = this.mockOutbreaks.find(o => o.id === outbreakId);
            if (!outbreak) {
                return { error: 'Outbreak not found', outbreakId };
            }

            const enriched = this.enrichOutbreakData(outbreak);
            
            // Add detailed timeline and interventions
            enriched.timeline = this.generateOutbreakTimeline(outbreak);
            enriched.interventions = this.getRecommendedInterventions(outbreak);
            enriched.riskAssessment = this.assessOutbreakRisk(outbreak);
            enriched.geographicSpread = this.analyzeGeographicSpread(outbreak);

            return enriched;

        } catch (error) {
            console.error(`Outbreak details error for ${outbreakId}:`, error);
            return { error: error.message, outbreakId };
        }
    }

    /**
     * Search outbreaks by disease or location
     */
    async searchOutbreaks(query, options = {}) {
        const { limit = 20 } = options;

        try {
            const lowerQuery = query.toLowerCase();
            const matches = this.mockOutbreaks.filter(outbreak => 
                outbreak.disease.toLowerCase().includes(lowerQuery) ||
                outbreak.location.toLowerCase().includes(lowerQuery) ||
                outbreak.affectedAreas.some(area => 
                    area.toLowerCase().includes(lowerQuery)
                )
            );

            return {
                query,
                outbreaks: matches.slice(0, limit).map(this.enrichOutbreakData.bind(this)),
                totalMatches: matches.length,
                searchTime: new Date().toISOString()
            };

        } catch (error) {
            console.error(`Outbreak search error for "${query}":`, error);
            return {
                query,
                outbreaks: [],
                error: error.message,
                totalMatches: 0
            };
        }
    }

    /**
     * Get disease-specific outbreak history
     */
    async getDiseaseOutbreakHistory(disease, options = {}) {
        const { years = 5, includeProjections = false } = options;

        try {
            const filteredOutbreaks = this.mockOutbreaks.filter(o => 
                o.disease.toLowerCase().includes(disease.toLowerCase())
            );

            const history = {
                disease,
                timeframe: `${years} years`,
                outbreaks: filteredOutbreaks.map(this.enrichOutbreakData.bind(this)),
                statistics: this.calculateDiseaseStatistics(filteredOutbreaks),
                seasonalPatterns: this.analyzeSeasonalPatterns(disease, filteredOutbreaks),
                riskFactors: this.identifyRiskFactors(filteredOutbreaks)
            };

            if (includeProjections) {
                history.projections = this.generateRiskProjections(disease, filteredOutbreaks);
            }

            return history;

        } catch (error) {
            console.error(`Disease outbreak history error for ${disease}:`, error);
            return {
                disease,
                error: error.message,
                outbreaks: []
            };
        }
    }

    /**
     * Generate real-time alerts for new outbreaks
     */
    async generateAlerts(options = {}) {
        const { severityThreshold = 3, regionsOfInterest = [] } = options;

        try {
            const recentOutbreaks = this.mockOutbreaks.filter(o => {
                const daysSinceUpdate = (Date.now() - new Date(o.lastUpdate)) / (1000 * 60 * 60 * 24);
                return daysSinceUpdate <= 7 && o.severity >= severityThreshold;
            });

            const alerts = recentOutbreaks.map(outbreak => ({
                id: `ALERT-${outbreak.id}`,
                type: outbreak.severity >= 4 ? 'urgent' : 'advisory',
                title: `${outbreak.disease} outbreak in ${outbreak.location}`,
                message: this.generateAlertMessage(outbreak),
                severity: outbreak.severity,
                region: outbreak.region,
                timestamp: new Date().toISOString(),
                actions: this.getRecommendedActions(outbreak),
                outbreak: this.enrichOutbreakData(outbreak)
            }));

            return {
                alerts,
                totalAlerts: alerts.length,
                urgentAlerts: alerts.filter(a => a.type === 'urgent').length,
                generatedAt: new Date().toISOString()
            };

        } catch (error) {
            console.error('Alert generation error:', error);
            return {
                alerts: [],
                error: error.message,
                totalAlerts: 0
            };
        }
    }

    /**
     * Enrich outbreak data with additional context
     */
    enrichOutbreakData(outbreak) {
        const severityInfo = this.severityLevels[outbreak.severity];
        const regionName = this.regions[outbreak.region];
        const diseaseCategory = this.categorizeDiseaseType(outbreak.disease);

        return {
            ...outbreak,
            severityInfo,
            regionName,
            diseaseCategory,
            caseFatalityRate: ((outbreak.deathsReported / outbreak.casesReported) * 100).toFixed(2),
            daysSinceFirstReport: Math.floor((Date.now() - new Date(outbreak.firstReported)) / (1000 * 60 * 60 * 24)),
            daysSinceLastUpdate: Math.floor((Date.now() - new Date(outbreak.lastUpdate)) / (1000 * 60 * 60 * 24)),
            trendDirection: this.calculateTrend(outbreak),
            riskScore: this.calculateRiskScore(outbreak)
        };
    }

    /**
     * Calculate global alert level based on active outbreaks
     */
    calculateGlobalAlertLevel(outbreaks) {
        const activeCritical = outbreaks.filter(o => o.severity >= 4 && o.status !== 'resolved').length;
        const activeHigh = outbreaks.filter(o => o.severity === 3 && o.status !== 'resolved').length;

        if (activeCritical >= 2) return { level: 'critical', color: '#8e44ad' };
        if (activeCritical >= 1 || activeHigh >= 3) return { level: 'high', color: '#e74c3c' };
        if (activeHigh >= 1) return { level: 'moderate', color: '#f39c12' };
        return { level: 'low', color: '#27ae60' };
    }

    /**
     * Categorize disease by transmission type
     */
    categorizeDiseaseType(disease) {
        const diseaseLower = disease.toLowerCase();
        
        for (const [category, patterns] of Object.entries(this.diseasePatterns)) {
            if (patterns.some(pattern => diseaseLower.includes(pattern))) {
                return category;
            }
        }
        
        return 'other';
    }

    /**
     * Calculate outbreak risk score
     */
    calculateRiskScore(outbreak) {
        let score = outbreak.severity * 20; // Base score from severity

        // Adjust for case numbers
        if (outbreak.casesReported > 10000) score += 20;
        else if (outbreak.casesReported > 1000) score += 10;

        // Adjust for fatality rate
        const fatalityRate = (outbreak.deathsReported / outbreak.casesReported) * 100;
        if (fatalityRate > 10) score += 20;
        else if (fatalityRate > 5) score += 10;

        // Adjust for spread status
        if (outbreak.status === 'expanding') score += 15;
        else if (outbreak.status === 'declining') score -= 10;

        return Math.min(Math.max(score, 0), 100);
    }

    /**
     * Calculate trend direction
     */
    calculateTrend(outbreak) {
        // Simplified trend calculation
        if (outbreak.status === 'expanding') return 'increasing';
        if (outbreak.status === 'declining') return 'decreasing';
        return 'stable';
    }

    /**
     * Generate alert message
     */
    generateAlertMessage(outbreak) {
        const fatalityRate = ((outbreak.deathsReported / outbreak.casesReported) * 100).toFixed(1);
        
        return `${outbreak.disease} outbreak reported in ${outbreak.location} with ${outbreak.casesReported.toLocaleString()} cases and ${outbreak.deathsReported} deaths (CFR: ${fatalityRate}%). Current status: ${outbreak.status}.`;
    }

    /**
     * Get recommended actions for outbreak
     */
    getRecommendedActions(outbreak) {
        const actions = [];
        
        if (outbreak.severity >= 4) {
            actions.push('Activate emergency response protocols');
            actions.push('Implement travel advisories');
        }
        
        if (outbreak.severity >= 3) {
            actions.push('Enhance surveillance measures');
            actions.push('Prepare healthcare systems');
        }
        
        actions.push('Monitor situation closely');
        actions.push('Review prevention strategies');
        
        return actions;
    }

    /**
     * Generate outbreak timeline
     */
    generateOutbreakTimeline(outbreak) {
        return [
            {
                date: outbreak.firstReported,
                event: 'First cases reported',
                type: 'detection'
            },
            {
                date: outbreak.lastUpdate,
                event: `Latest update: ${outbreak.casesReported} cases`,
                type: 'update'
            }
        ];
    }

    /**
     * Get recommended interventions
     */
    getRecommendedInterventions(outbreak) {
        const category = this.categorizeDiseaseType(outbreak.disease);
        const interventions = [];

        switch (category) {
            case 'vector_borne':
                interventions.push('Vector control measures', 'Community education', 'Bed net distribution');
                break;
            case 'waterborne':
                interventions.push('Water quality testing', 'Sanitation improvements', 'Oral rehydration therapy');
                break;
            case 'airborne':
                interventions.push('Contact tracing', 'Isolation protocols', 'Vaccination campaigns');
                break;
            default:
                interventions.push('Surveillance enhancement', 'Case management', 'Community engagement');
        }

        return interventions;
    }

    /**
     * Assess outbreak risk
     */
    assessOutbreakRisk(outbreak) {
        return {
            overallRisk: outbreak.severity >= 4 ? 'High' : outbreak.severity >= 3 ? 'Moderate' : 'Low',
            spreadRisk: outbreak.status === 'expanding' ? 'High' : 'Moderate',
            healthSystemImpact: outbreak.casesReported > 5000 ? 'High' : 'Moderate',
            factors: outbreak.riskFactors || []
        };
    }

    /**
     * Analyze geographic spread
     */
    analyzeGeographicSpread(outbreak) {
        return {
            primaryLocation: outbreak.location,
            affectedAreas: outbreak.affectedAreas || [],
            region: outbreak.region,
            crossBorderRisk: outbreak.severity >= 3 ? 'Monitor' : 'Low'
        };
    }

    /**
     * Calculate disease statistics
     */
    calculateDiseaseStatistics(outbreaks) {
        return {
            totalOutbreaks: outbreaks.length,
            averageCases: Math.round(outbreaks.reduce((sum, o) => sum + o.casesReported, 0) / outbreaks.length),
            averageDeaths: Math.round(outbreaks.reduce((sum, o) => sum + o.deathsReported, 0) / outbreaks.length),
            severityDistribution: this.getSeverityDistribution(outbreaks)
        };
    }

    /**
     * Get severity distribution
     */
    getSeverityDistribution(outbreaks) {
        const distribution = {};
        for (let i = 1; i <= 5; i++) {
            distribution[i] = outbreaks.filter(o => o.severity === i).length;
        }
        return distribution;
    }

    /**
     * Analyze seasonal patterns
     */
    analyzeSeasonalPatterns(disease, outbreaks) {
        return {
            peakMonths: ['June', 'July', 'August'], // Simplified
            lowMonths: ['December', 'January', 'February'],
            factors: ['Temperature', 'Rainfall', 'Humidity']
        };
    }

    /**
     * Identify risk factors
     */
    identifyRiskFactors(outbreaks) {
        const factors = new Set();
        outbreaks.forEach(o => {
            if (o.riskFactors) {
                o.riskFactors.forEach(factor => factors.add(factor));
            }
        });
        return Array.from(factors);
    }

    /**
     * Generate risk projections
     */
    generateRiskProjections(disease, outbreaks) {
        return {
            nextMonth: 'Moderate risk',
            next3Months: 'Low-moderate risk',
            factors: ['Seasonal patterns', 'Population movement', 'Climate conditions']
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
     * Get service status
     */
    getStatus() {
        return {
            dataSources: Object.keys(this.dataSources),
            cacheSize: this.cache.size,
            severityLevels: Object.keys(this.severityLevels),
            diseaseCategories: Object.keys(this.diseasePatterns),
            regions: Object.keys(this.regions),
            cacheExpiry: this.cacheExpiry
        };
    }
}

module.exports = OutbreakAlertsService;