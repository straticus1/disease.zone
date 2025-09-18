/**
 * Clinical Trials Service
 * Integrates with ClinicalTrials.gov API v2.0 for disease-specific clinical trials
 * Provides alerts, search, and formatted trial information
 */

class ClinicalTrialsService {
    constructor() {
        this.baseURL = 'https://clinicaltrials.gov/api/v2/studies';
        this.rateLimitDelay = 1200; // 50 requests per minute = 1.2s between requests
        this.lastRequestTime = 0;
        
        // Cache for trial data
        this.cache = new Map();
        this.cacheExpiry = 1000 * 60 * 60 * 2; // 2 hours for clinical trials
        
        // Map diseases to ClinicalTrials.gov search terms
        this.diseaseMapping = {
            'hiv': ['HIV', 'Human Immunodeficiency Virus', 'AIDS'],
            'aids': ['AIDS', 'Acquired Immunodeficiency Syndrome', 'HIV'],
            'covid': ['COVID-19', 'SARS-CoV-2', 'Coronavirus'],
            'chlamydia': ['Chlamydia', 'Chlamydia trachomatis'],
            'gonorrhea': ['Gonorrhea', 'Neisseria gonorrhoeae'],
            'syphilis': ['Syphilis', 'Treponema pallidum'],
            'herpes': ['Herpes Simplex', 'HSV', 'Herpes Simplex Virus'],
            'hsv1': ['Herpes Simplex Virus 1', 'HSV-1'],
            'hsv2': ['Herpes Simplex Virus 2', 'HSV-2'],
            'hpv': ['Human Papillomavirus', 'HPV'],
            'hepatitis': ['Hepatitis', 'Hepatitis B', 'Hepatitis C'],
            'tuberculosis': ['Tuberculosis', 'TB', 'Mycobacterium tuberculosis'],
            'influenza': ['Influenza', 'Flu', 'H1N1', 'H3N2'],
            'cancer': ['Cancer', 'Carcinoma', 'Tumor', 'Neoplasm'],
            'diabetes': ['Diabetes', 'Type 1 Diabetes', 'Type 2 Diabetes'],
            'alzheimer': ['Alzheimer Disease', 'Dementia', 'Alzheimer'],
            'heart': ['Heart Disease', 'Cardiovascular Disease', 'Coronary Artery Disease']
        };

        // Trial status priorities for alerting
        this.statusPriority = {
            'RECRUITING': 1,
            'NOT_YET_RECRUITING': 2,
            'ENROLLING_BY_INVITATION': 3,
            'ACTIVE_NOT_RECRUITING': 4,
            'COMPLETED': 5,
            'SUSPENDED': 6,
            'TERMINATED': 7,
            'WITHDRAWN': 8
        };

        // Initialize tracking for new trials
        this.lastChecked = new Map();
        this.newTrialAlerts = [];
    }

    /**
     * Rate limiting helper
     */
    async rateLimitedRequest(url, options = {}) {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        
        if (timeSinceLastRequest < this.rateLimitDelay) {
            await new Promise(resolve => 
                setTimeout(resolve, this.rateLimitDelay - timeSinceLastRequest)
            );
        }

        this.lastRequestTime = Date.now();
        
        const response = await fetch(url, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Disease Zone Health Platform (disease.zone)',
                'Accept': 'application/json',
                ...options.headers
            },
            ...options
        });

        if (!response.ok) {
            throw new Error(`ClinicalTrials API error: ${response.status} ${response.statusText}`);
        }

        return response.json();
    }

    /**
     * Search for clinical trials by disease
     */
    async searchTrialsByDisease(disease, options = {}) {
        const {
            status = null,
            phase = null,
            limit = 20,
            includeResults = true
        } = options;

        try {
            const searchTerms = this.diseaseMapping[disease.toLowerCase()] || [disease];
            const cacheKey = `${disease}_${status || 'all'}_${phase || 'all'}`;
            
            // Check cache first
            const cached = this.getCachedData(cacheKey);
            if (cached) {
                return cached;
            }

            const results = [];
            
            // Search for each term variation
            for (const term of searchTerms.slice(0, 2)) { // Limit to 2 terms to avoid rate limits
                const queryParams = new URLSearchParams({
                    'query.cond': term,
                    'pageSize': Math.min(limit, 1000).toString()
                });

                if (status) {
                    queryParams.append('query.overallStatus', status);
                }

                if (phase) {
                    queryParams.append('query.phase', phase);
                }

                const url = `${this.baseURL}?${queryParams}`;
                const data = await this.rateLimitedRequest(url);

                if (data.studies && data.studies.length > 0) {
                    results.push(...data.studies);
                }
            }

            // Remove duplicates by NCT ID
            const uniqueTrials = this.deduplicateTrials(results);
            
            // Sort by relevance and status priority
            const sortedTrials = this.sortTrialsByRelevance(uniqueTrials, disease);
            
            // Limit results
            const limitedTrials = sortedTrials.slice(0, limit);

            // Transform to our format
            const transformedTrials = limitedTrials.map(trial => 
                this.transformTrialData(trial, disease)
            );

            const result = {
                disease,
                searchTerms,
                totalFound: uniqueTrials.length,
                returned: transformedTrials.length,
                trials: transformedTrials,
                lastUpdated: new Date().toISOString(),
                source: 'ClinicalTrials.gov'
            };

            // Cache the result
            this.cache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });

            return result;

        } catch (error) {
            console.error(`Clinical trials search error for ${disease}:`, error);
            return {
                disease,
                error: error.message,
                trials: [],
                totalFound: 0,
                returned: 0
            };
        }
    }

    /**
     * Transform ClinicalTrials.gov data to our standardized format
     */
    transformTrialData(trial, disease) {
        const protocolSection = trial.protocolSection || {};
        const identificationModule = protocolSection.identificationModule || {};
        const statusModule = protocolSection.statusModule || {};
        const designModule = protocolSection.designModule || {};
        const sponsorCollaboratorsModule = protocolSection.sponsorCollaboratorsModule || {};
        const conditionsModule = protocolSection.conditionsModule || {};
        const interventionsModule = protocolSection.interventionsModule || {};

        return {
            nctId: identificationModule.nctId,
            title: identificationModule.briefTitle,
            officialTitle: identificationModule.officialTitle,
            phase: designModule.phases ? designModule.phases.join(', ') : 'Not Specified',
            status: statusModule.overallStatus,
            studyType: designModule.studyType,
            conditions: conditionsModule.conditions || [],
            interventions: this.extractInterventions(interventionsModule.interventions || []),
            sponsor: sponsorCollaboratorsModule.leadSponsor?.name,
            collaborators: (sponsorCollaboratorsModule.collaborators || []).map(c => c.name),
            startDate: statusModule.startDateStruct?.date,
            completionDate: statusModule.primaryCompletionDateStruct?.date,
            enrollmentCount: designModule.enrollmentInfo?.count,
            eligibility: this.extractEligibilityInfo(protocolSection.eligibilityModule),
            locations: this.extractLocationInfo(protocolSection.contactsLocationsModule),
            clinicalTrialsUrl: `https://clinicaltrials.gov/ct2/show/${identificationModule.nctId}`,
            relevanceScore: this.calculateRelevanceScore(trial, disease),
            lastUpdated: statusModule.lastUpdatePostDateStruct?.date || new Date().toISOString()
        };
    }

    /**
     * Extract drug/intervention information
     */
    extractInterventions(interventions) {
        return interventions.map(intervention => ({
            type: intervention.type,
            name: intervention.name,
            description: intervention.description,
            drugNames: intervention.type === 'DRUG' ? [intervention.name] : []
        }));
    }

    /**
     * Extract eligibility criteria
     */
    extractEligibilityInfo(eligibilityModule) {
        if (!eligibilityModule) return null;

        return {
            criteria: eligibilityModule.eligibilityCriteria,
            minimumAge: eligibilityModule.minimumAge,
            maximumAge: eligibilityModule.maximumAge,
            sex: eligibilityModule.sex,
            healthyVolunteers: eligibilityModule.healthyVolunteers
        };
    }

    /**
     * Extract location information
     */
    extractLocationInfo(contactsLocationsModule) {
        if (!contactsLocationsModule?.locations) return [];

        return contactsLocationsModule.locations.slice(0, 5).map(location => ({
            facility: location.facility,
            city: location.city,
            state: location.state,
            country: location.country,
            status: location.status
        }));
    }

    /**
     * Calculate relevance score for trial
     */
    calculateRelevanceScore(trial, disease) {
        let score = 0;
        const protocolSection = trial.protocolSection || {};
        const statusModule = protocolSection.statusModule || {};
        const conditionsModule = protocolSection.conditionsModule || {};
        const identificationModule = protocolSection.identificationModule || {};

        // Status priority
        const status = statusModule.overallStatus;
        if (this.statusPriority[status]) {
            score += (10 - this.statusPriority[status]) * 10;
        }

        // Disease name match in title
        const title = identificationModule.briefTitle?.toLowerCase() || '';
        const searchTerms = this.diseaseMapping[disease.toLowerCase()] || [disease];
        
        for (const term of searchTerms) {
            if (title.includes(term.toLowerCase())) {
                score += 20;
                break;
            }
        }

        // Condition match
        const conditions = conditionsModule.conditions || [];
        if (conditions.some(condition => 
            searchTerms.some(term => 
                condition.toLowerCase().includes(term.toLowerCase())
            )
        )) {
            score += 15;
        }

        // Recent updates boost
        const lastUpdate = statusModule.lastUpdatePostDateStruct?.date;
        if (lastUpdate) {
            const daysSinceUpdate = (Date.now() - new Date(lastUpdate).getTime()) / (1000 * 60 * 60 * 24);
            if (daysSinceUpdate < 30) score += 10;
            else if (daysSinceUpdate < 90) score += 5;
        }

        return score;
    }

    /**
     * Remove duplicate trials by NCT ID
     */
    deduplicateTrials(trials) {
        const seen = new Set();
        return trials.filter(trial => {
            const nctId = trial.protocolSection?.identificationModule?.nctId;
            if (!nctId || seen.has(nctId)) return false;
            seen.add(nctId);
            return true;
        });
    }

    /**
     * Sort trials by relevance score
     */
    sortTrialsByRelevance(trials, disease) {
        return trials
            .map(trial => ({
                trial,
                score: this.calculateRelevanceScore(trial, disease)
            }))
            .sort((a, b) => b.score - a.score)
            .map(item => item.trial);
    }

    /**
     * Check for new trials since last check
     */
    async checkForNewTrials(disease) {
        try {
            const lastCheck = this.lastChecked.get(disease) || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            
            // Search for trials updated since last check
            const queryParams = new URLSearchParams({
                'query.cond': this.diseaseMapping[disease.toLowerCase()]?.[0] || disease,
                'query.lastUpdatePostDate': lastCheck.toISOString().split('T')[0],
                'pageSize': '100'
            });

            const url = `${this.baseURL}?${queryParams}`;
            const data = await this.rateLimitedRequest(url);

            const newTrials = (data.studies || [])
                .filter(trial => {
                    const updateDate = trial.protocolSection?.statusModule?.lastUpdatePostDateStruct?.date;
                    return updateDate && new Date(updateDate) > lastCheck;
                })
                .map(trial => this.transformTrialData(trial, disease));

            // Update last checked time
            this.lastChecked.set(disease, new Date());

            // Store alerts for new recruiting trials
            const recruitingTrials = newTrials.filter(trial => 
                ['RECRUITING', 'NOT_YET_RECRUITING', 'ENROLLING_BY_INVITATION'].includes(trial.status)
            );

            if (recruitingTrials.length > 0) {
                this.newTrialAlerts.push({
                    disease,
                    count: recruitingTrials.length,
                    trials: recruitingTrials.slice(0, 3), // Top 3 for alert
                    timestamp: new Date().toISOString()
                });
            }

            return {
                disease,
                newTrialsCount: newTrials.length,
                recruitingCount: recruitingTrials.length,
                trials: newTrials
            };

        } catch (error) {
            console.error(`Error checking for new trials for ${disease}:`, error);
            return { disease, error: error.message, newTrialsCount: 0, recruitingCount: 0, trials: [] };
        }
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
     * Get pending trial alerts
     */
    getNewTrialAlerts() {
        const alerts = [...this.newTrialAlerts];
        this.newTrialAlerts = []; // Clear after retrieval
        return alerts;
    }

    /**
     * Generate HTML page for clinical trials
     */
    generateTrialsPage(disease, trials) {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Clinical Trials for ${disease.charAt(0).toUpperCase() + disease.slice(1)} - diseaseZone</title>
    <style>
        body { font-family: 'Inter', Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background: #f8fafc; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 2rem; border-radius: 10px; margin-bottom: 2rem; }
        .trial-card { background: white; border-radius: 10px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .trial-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; }
        .trial-title { font-size: 1.2rem; font-weight: 600; color: #1e293b; margin: 0; }
        .trial-status { padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.875rem; font-weight: 500; }
        .status-recruiting { background: #dcfce7; color: #166534; }
        .status-active { background: #dbeafe; color: #1e40af; }
        .status-completed { background: #f3f4f6; color: #374151; }
        .trial-meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin: 1rem 0; }
        .meta-item { padding: 0.75rem; background: #f8fafc; border-radius: 6px; }
        .meta-label { font-weight: 600; color: #64748b; font-size: 0.875rem; }
        .meta-value { color: #1e293b; }
        .interventions { margin: 1rem 0; }
        .intervention-tag { display: inline-block; background: #e0e7ff; color: #3730a3; padding: 0.25rem 0.5rem; border-radius: 4px; margin: 0.25rem; font-size: 0.875rem; }
        .trial-link { display: inline-block; background: #2563eb; color: white; padding: 0.5rem 1rem; border-radius: 6px; text-decoration: none; margin-top: 1rem; }
        .trial-link:hover { background: #1d4ed8; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
        .stat-card { background: white; padding: 1.5rem; border-radius: 10px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .stat-number { font-size: 2rem; font-weight: 700; color: #2563eb; }
        .stat-label { color: #64748b; font-size: 0.875rem; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔬 Clinical Trials for ${disease.charAt(0).toUpperCase() + disease.slice(1)}</h1>
            <p>Current clinical trials and research studies from ClinicalTrials.gov</p>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <div class="stat-number">${trials.totalFound || 0}</div>
                <div class="stat-label">Total Trials Found</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${(trials.trials || []).filter(t => t.status === 'RECRUITING').length}</div>
                <div class="stat-label">Currently Recruiting</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${(trials.trials || []).filter(t => t.phase && t.phase.includes('3')).length}</div>
                <div class="stat-label">Phase 3 Trials</div>
            </div>
        </div>

        ${(trials.trials || []).map(trial => `
            <div class="trial-card">
                <div class="trial-header">
                    <h3 class="trial-title">${trial.title}</h3>
                    <span class="trial-status status-${trial.status.toLowerCase().replace(/[^a-z]/g, '')}">${trial.status}</span>
                </div>
                
                <div class="trial-meta">
                    <div class="meta-item">
                        <div class="meta-label">NCT ID</div>
                        <div class="meta-value">${trial.nctId}</div>
                    </div>
                    <div class="meta-item">
                        <div class="meta-label">Phase</div>
                        <div class="meta-value">${trial.phase}</div>
                    </div>
                    <div class="meta-item">
                        <div class="meta-label">Sponsor</div>
                        <div class="meta-value">${trial.sponsor || 'Not specified'}</div>
                    </div>
                    <div class="meta-item">
                        <div class="meta-label">Study Type</div>
                        <div class="meta-value">${trial.studyType}</div>
                    </div>
                </div>

                ${trial.interventions && trial.interventions.length > 0 ? `
                    <div class="interventions">
                        <strong>Interventions:</strong><br>
                        ${trial.interventions.map(intervention => 
                            `<span class="intervention-tag">${intervention.name}</span>`
                        ).join('')}
                    </div>
                ` : ''}

                <a href="${trial.clinicalTrialsUrl}" class="trial-link" target="_blank">View on ClinicalTrials.gov →</a>
            </div>
        `).join('')}
    </div>
</body>
</html>`;
    }

    /**
     * Get service status
     */
    getStatus() {
        return {
            cacheSize: this.cache.size,
            supportedDiseases: Object.keys(this.diseaseMapping),
            pendingAlerts: this.newTrialAlerts.length,
            lastChecked: Object.fromEntries(this.lastChecked),
            rateLimitDelay: this.rateLimitDelay
        };
    }
}

module.exports = ClinicalTrialsService;