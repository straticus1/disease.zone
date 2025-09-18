/**
 * FDA Drug Safety Service
 * Integrates with openFDA APIs for drug adverse events, recalls, and enforcement reports
 * Provides real-time drug safety alerts and medical device recall information
 */

class FDADrugSafetyService {
    constructor() {
        this.baseURL = 'https://api.fda.gov';
        this.endpoints = {
            drugAdverseEvents: '/drug/event.json',
            drugRecalls: '/drug/enforcement.json',
            deviceRecalls: '/device/enforcement.json',
            deviceAdverseEvents: '/device/event.json',
            foodRecalls: '/food/enforcement.json'
        };

        this.cache = new Map();
        this.cacheExpiry = 1000 * 60 * 30; // 30 minutes cache
        this.rateLimitDelay = 1000; // 1 second between requests
        this.lastRequestTime = 0;

        // FDA drug classification for risk assessment
        this.riskClassifications = {
            'Class I': { level: 'critical', description: 'Life-threatening situation' },
            'Class II': { level: 'serious', description: 'Temporary health problems' },
            'Class III': { level: 'minor', description: 'Unlikely to cause adverse effects' }
        };

        // Common drug categories for better organization
        this.drugCategories = {
            'antibiotics': ['amoxicillin', 'azithromycin', 'ciprofloxacin', 'doxycycline'],
            'pain_relievers': ['ibuprofen', 'acetaminophen', 'aspirin', 'naproxen'],
            'diabetes': ['metformin', 'insulin', 'glipizide', 'pioglitazone'],
            'heart': ['lisinopril', 'amlodipine', 'metoprolol', 'atorvastatin'],
            'mental_health': ['sertraline', 'escitalopram', 'alprazolam', 'lorazepam']
        };
    }

    /**
     * Search for drug adverse events by drug name
     */
    async searchAdverseEvents(drugName, options = {}) {
        const {
            limit = 100,
            skip = 0,
            dateRange = null,
            seriousness = null
        } = options;

        try {
            const cacheKey = `adverse_${drugName}_${JSON.stringify(options)}`;
            const cached = this.getCachedData(cacheKey);
            if (cached) return cached;

            let searchQuery = `patient.drug.medicinalproduct:"${drugName}"`;
            
            // Add date range filter if specified
            if (dateRange) {
                searchQuery += `+AND+receivedate:[${dateRange.start}+TO+${dateRange.end}]`;
            }

            // Add seriousness filter
            if (seriousness) {
                searchQuery += `+AND+serious:${seriousness}`;
            }

            const url = `${this.baseURL}${this.endpoints.drugAdverseEvents}?search=${encodeURIComponent(searchQuery)}&limit=${limit}&skip=${skip}`;
            
            await this.rateLimitedDelay();
            const response = await fetch(url, { timeout: 15000 });
            
            if (!response.ok) {
                if (response.status === 404) {
                    return { drugName, adverseEvents: [], totalFound: 0, message: 'No adverse events found' };
                }
                throw new Error(`FDA API error: ${response.status}`);
            }

            const data = await response.json();
            const processedEvents = this.processAdverseEvents(data.results || [], drugName);

            const result = {
                drugName,
                adverseEvents: processedEvents,
                totalFound: data.meta?.results?.total || 0,
                searchQuery,
                lastUpdated: new Date().toISOString(),
                source: 'FDA Adverse Event Reporting System (FAERS)'
            };

            this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
            return result;

        } catch (error) {
            console.error(`FDA adverse events search error for ${drugName}:`, error);
            return {
                drugName,
                error: error.message,
                adverseEvents: [],
                totalFound: 0
            };
        }
    }

    /**
     * Search for drug recalls and enforcement actions
     */
    async searchDrugRecalls(drugName, options = {}) {
        const {
            limit = 50,
            skip = 0,
            classification = null,
            status = null
        } = options;

        try {
            const cacheKey = `recalls_${drugName}_${JSON.stringify(options)}`;
            const cached = this.getCachedData(cacheKey);
            if (cached) return cached;

            let searchQuery = `product_description:"${drugName}"`;
            
            if (classification) {
                searchQuery += `+AND+classification:"${classification}"`;
            }

            if (status) {
                searchQuery += `+AND+status:"${status}"`;
            }

            const url = `${this.baseURL}${this.endpoints.drugRecalls}?search=${encodeURIComponent(searchQuery)}&limit=${limit}&skip=${skip}`;
            
            await this.rateLimitedDelay();
            const response = await fetch(url, { timeout: 15000 });
            
            if (!response.ok) {
                if (response.status === 404) {
                    return { drugName, recalls: [], totalFound: 0, message: 'No recalls found' };
                }
                throw new Error(`FDA API error: ${response.status}`);
            }

            const data = await response.json();
            const processedRecalls = this.processRecalls(data.results || [], drugName);

            const result = {
                drugName,
                recalls: processedRecalls,
                totalFound: data.meta?.results?.total || 0,
                searchQuery,
                lastUpdated: new Date().toISOString(),
                source: 'FDA Recall Enterprise System (RES)'
            };

            this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
            return result;

        } catch (error) {
            console.error(`FDA recalls search error for ${drugName}:`, error);
            return {
                drugName,
                error: error.message,
                recalls: [],
                totalFound: 0
            };
        }
    }

    /**
     * Search for medical device recalls
     */
    async searchDeviceRecalls(deviceName, options = {}) {
        const {
            limit = 50,
            classification = null
        } = options;

        try {
            const cacheKey = `device_recalls_${deviceName}_${JSON.stringify(options)}`;
            const cached = this.getCachedData(cacheKey);
            if (cached) return cached;

            let searchQuery = `product_description:"${deviceName}"`;
            
            if (classification) {
                searchQuery += `+AND+classification:"${classification}"`;
            }

            const url = `${this.baseURL}${this.endpoints.deviceRecalls}?search=${encodeURIComponent(searchQuery)}&limit=${limit}`;
            
            await this.rateLimitedDelay();
            const response = await fetch(url, { timeout: 15000 });
            
            if (!response.ok) {
                if (response.status === 404) {
                    return { deviceName, recalls: [], totalFound: 0, message: 'No device recalls found' };
                }
                throw new Error(`FDA API error: ${response.status}`);
            }

            const data = await response.json();
            const processedRecalls = this.processDeviceRecalls(data.results || [], deviceName);

            const result = {
                deviceName,
                recalls: processedRecalls,
                totalFound: data.meta?.results?.total || 0,
                lastUpdated: new Date().toISOString(),
                source: 'FDA Device Recall System'
            };

            this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
            return result;

        } catch (error) {
            console.error(`FDA device recalls search error for ${deviceName}:`, error);
            return {
                deviceName,
                error: error.message,
                recalls: [],
                totalFound: 0
            };
        }
    }

    /**
     * Get safety summary for a drug including both adverse events and recalls
     */
    async getDrugSafetySummary(drugName) {
        try {
            const [adverseEvents, recalls] = await Promise.allSettled([
                this.searchAdverseEvents(drugName, { limit: 20 }),
                this.searchDrugRecalls(drugName, { limit: 10 })
            ]);

            const adverseData = adverseEvents.status === 'fulfilled' ? adverseEvents.value : null;
            const recallData = recalls.status === 'fulfilled' ? recalls.value : null;

            // Calculate risk score
            const riskScore = this.calculateRiskScore(adverseData, recallData);

            return {
                drugName,
                riskScore,
                summary: {
                    totalAdverseEvents: adverseData?.totalFound || 0,
                    totalRecalls: recallData?.totalFound || 0,
                    seriousEvents: adverseData?.adverseEvents?.filter(e => e.serious).length || 0,
                    criticalRecalls: recallData?.recalls?.filter(r => r.classification === 'Class I').length || 0
                },
                adverseEvents: adverseData,
                recalls: recallData,
                recommendations: this.generateSafetyRecommendations(riskScore, adverseData, recallData),
                lastUpdated: new Date().toISOString()
            };

        } catch (error) {
            console.error(`Safety summary error for ${drugName}:`, error);
            return {
                drugName,
                error: error.message,
                riskScore: 0,
                summary: null
            };
        }
    }

    /**
     * Process adverse events data
     */
    processAdverseEvents(events, drugName) {
        return events.map(event => ({
            id: event.safetyreportid,
            receiveDate: event.receivedate,
            serious: event.serious === '1',
            seriousnessReasons: event.seriousnessother ? [event.seriousnessother] : [],
            reactions: (event.patient?.reaction || []).map(r => ({
                term: r.reactionmeddrapt,
                outcome: r.reactionoutcome
            })),
            reporterType: event.reporterqualification,
            age: event.patient?.patientonsetage,
            ageUnit: event.patient?.patientonsetageunit,
            sex: event.patient?.patientsex,
            weight: event.patient?.patientweight,
            drugs: (event.patient?.drug || []).map(d => ({
                name: d.medicinalproduct,
                indication: d.drugindication,
                dosage: d.drugstructuredosageunit,
                route: d.drugadministrationroute
            })),
            relevanceScore: this.calculateEventRelevance(event, drugName)
        }));
    }

    /**
     * Process recalls data
     */
    processRecalls(recalls, drugName) {
        return recalls.map(recall => ({
            id: recall.recall_number,
            classification: recall.classification,
            riskLevel: this.riskClassifications[recall.classification]?.level || 'unknown',
            product: recall.product_description,
            reason: recall.reason_for_recall,
            status: recall.status,
            recallDate: recall.recall_initiation_date,
            firmName: recall.recalling_firm,
            distribution: recall.distribution_pattern,
            quantity: recall.product_quantity,
            codeInfo: recall.code_info,
            relevanceScore: this.calculateRecallRelevance(recall, drugName)
        }));
    }

    /**
     * Process device recalls data
     */
    processDeviceRecalls(recalls, deviceName) {
        return recalls.map(recall => ({
            id: recall.recall_number,
            classification: recall.classification,
            riskLevel: this.riskClassifications[recall.classification]?.level || 'unknown',
            product: recall.product_description,
            reason: recall.reason_for_recall,
            status: recall.status,
            recallDate: recall.recall_initiation_date,
            firmName: recall.recalling_firm,
            deviceClass: recall.product_res_number,
            relevanceScore: this.calculateRecallRelevance(recall, deviceName)
        }));
    }

    /**
     * Calculate risk score based on adverse events and recalls
     */
    calculateRiskScore(adverseData, recallData) {
        let score = 0;

        if (adverseData?.adverseEvents) {
            const seriousEvents = adverseData.adverseEvents.filter(e => e.serious).length;
            const totalEvents = adverseData.adverseEvents.length;
            score += (seriousEvents / Math.max(totalEvents, 1)) * 40; // Max 40 points for adverse events
        }

        if (recallData?.recalls) {
            const criticalRecalls = recallData.recalls.filter(r => r.classification === 'Class I').length;
            const totalRecalls = recallData.recalls.length;
            score += (criticalRecalls / Math.max(totalRecalls, 1)) * 60; // Max 60 points for recalls
        }

        return Math.min(Math.round(score), 100);
    }

    /**
     * Calculate relevance of event to searched drug
     */
    calculateEventRelevance(event, drugName) {
        let score = 0;
        const drugs = event.patient?.drug || [];
        
        for (const drug of drugs) {
            if (drug.medicinalproduct?.toLowerCase().includes(drugName.toLowerCase())) {
                score += 50;
                if (drug.drugcharacterization === '1') score += 30; // Suspect drug
                if (drug.drugcharacterization === '2') score += 10; // Concomitant drug
            }
        }

        return Math.min(score, 100);
    }

    /**
     * Calculate relevance of recall to searched drug/device
     */
    calculateRecallRelevance(recall, searchTerm) {
        let score = 0;
        const product = recall.product_description?.toLowerCase() || '';
        const searchLower = searchTerm.toLowerCase();

        if (product.includes(searchLower)) {
            score += 50;
            if (product.startsWith(searchLower)) score += 20;
            if (product === searchLower) score += 30;
        }

        // Classification bonus
        if (recall.classification === 'Class I') score += 20;
        else if (recall.classification === 'Class II') score += 10;

        return Math.min(score, 100);
    }

    /**
     * Generate safety recommendations
     */
    generateSafetyRecommendations(riskScore, adverseData, recallData) {
        const recommendations = [];

        if (riskScore >= 70) {
            recommendations.push({
                level: 'critical',
                message: 'High risk medication - consult healthcare provider immediately',
                action: 'Contact your doctor before taking this medication'
            });
        } else if (riskScore >= 40) {
            recommendations.push({
                level: 'warning',
                message: 'Moderate risk - monitor for side effects',
                action: 'Watch for adverse reactions and report to healthcare provider'
            });
        } else {
            recommendations.push({
                level: 'info',
                message: 'Generally safe when used as directed',
                action: 'Follow prescribed dosage and instructions'
            });
        }

        // Add specific recommendations based on recalls
        if (recallData?.recalls?.length > 0) {
            const activeRecalls = recallData.recalls.filter(r => r.status === 'Ongoing');
            if (activeRecalls.length > 0) {
                recommendations.push({
                    level: 'warning',
                    message: `${activeRecalls.length} active recall(s) for this medication`,
                    action: 'Check with pharmacist about lot numbers and expiration dates'
                });
            }
        }

        return recommendations;
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
     * Generate safety alerts for multiple drugs
     */
    async generateSafetyDashboard(drugs) {
        const alerts = [];
        
        for (const drug of drugs.slice(0, 5)) { // Limit to prevent rate limiting
            try {
                const summary = await this.getDrugSafetySummary(drug);
                if (summary.riskScore >= 40) {
                    alerts.push({
                        drug,
                        riskScore: summary.riskScore,
                        type: summary.riskScore >= 70 ? 'critical' : 'warning',
                        summary: summary.summary,
                        recommendations: summary.recommendations
                    });
                }
            } catch (error) {
                console.error(`Dashboard error for ${drug}:`, error);
            }
        }

        return {
            alerts,
            totalDrugsChecked: drugs.length,
            highRiskCount: alerts.filter(a => a.type === 'critical').length,
            moderateRiskCount: alerts.filter(a => a.type === 'warning').length,
            lastUpdated: new Date().toISOString()
        };
    }

    /**
     * Get service status
     */
    getStatus() {
        return {
            endpoints: Object.keys(this.endpoints),
            cacheSize: this.cache.size,
            supportedCategories: Object.keys(this.drugCategories),
            riskClassifications: Object.keys(this.riskClassifications),
            rateLimitDelay: this.rateLimitDelay
        };
    }
}

module.exports = FDADrugSafetyService;