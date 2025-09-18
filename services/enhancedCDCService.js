/**
 * Enhanced CDC Data Service
 * Integrates multiple CDC APIs and data sources including WONDER, Open Data API, 
 * Environmental Health Tracking, and Content Syndication APIs
 */

class EnhancedCDCService {
    constructor() {
        this.endpoints = {
            openData: 'https://data.cdc.gov/resource',
            wonder: 'https://wonder.cdc.gov/controller/saved/D76',
            tracking: 'https://ephtracking.cdc.gov/apigateway/api/v1',
            syndication: 'https://tools.cdc.gov/api/v2',
            nchhstp: 'https://gis.cdc.gov/grasp/nchhstpatlas' // AtlasPlus data
        };

        this.cache = new Map();
        this.cacheExpiry = 1000 * 60 * 60 * 4; // 4 hours

        // Disease-specific dataset mappings for CDC Open Data
        this.datasetMappings = {
            'hiv': ['hiv-aids-surveillance', 'hiv-testing', 'hiv-prevention'],
            'std': ['sexually-transmitted-disease-surveillance', 'std-surveillance'],
            'tb': ['tuberculosis-surveillance', 'tb-cases'],
            'hepatitis': ['hepatitis-surveillance', 'viral-hepatitis'],
            'covid': ['covid-19-case-surveillance', 'covid-19-deaths'],
            'influenza': ['flu-surveillance', 'influenza-like-illness'],
            'cancer': ['cancer-statistics', 'cancer-incidence'],
            'heart': ['heart-disease-mortality', 'cardiovascular-disease'],
            'diabetes': ['diabetes-surveillance', 'diabetes-mortality'],
            'overdose': ['drug-overdose-deaths', 'opioid-overdose']
        };

        // WONDER database codes for different causes of death/disease
        this.wonderCodes = {
            'heart': ['I00-I09', 'I11', 'I13', 'I20-I51'],
            'cancer': ['C00-C97'],
            'covid': ['U07.1'],
            'diabetes': ['E10-E14'],
            'influenza': ['J09-J11'],
            'overdose': ['X40-X44', 'X60-X64', 'X85', 'Y10-Y14'],
            'suicide': ['X60-X84', 'Y87.0'],
            'accidents': ['V01-X59', 'Y85-Y86']
        };

        // Environmental health tracking measures
        this.trackingMeasures = {
            'asthma': ['296', '297', '298'],
            'cancer': ['420', '421', '422'],
            'birth_defects': ['139', '140', '141'],
            'carbon_monoxide': ['504', '505'],
            'heat_illness': ['600', '601'],
            'air_quality': ['570', '571', '572']
        };

        this.rateLimitDelay = 500; // Conservative rate limiting
        this.lastRequestTime = 0;
    }

    /**
     * Aggregate disease data from multiple CDC sources
     */
    async getAggregatedDiseaseData(disease, options = {}) {
        const {
            includeGeographic = true,
            includeTemporal = true,
            includeDemographic = true,
            years = [2020, 2021, 2022, 2023]
        } = options;

        try {
            const aggregatedData = {
                disease,
                totalCases: 0,
                totalDeaths: 0,
                dataPoints: [],
                sources: [],
                geographicData: [],
                temporalTrends: [],
                demographicBreakdown: [],
                lastUpdated: new Date().toISOString()
            };

            // Collect data from multiple sources in parallel
            const dataPromises = [
                this.getOpenDataResults(disease),
                this.getWONDERData(disease, years),
                this.getTrackingData(disease),
                this.getNCHHSTPData(disease)
            ];

            const results = await Promise.allSettled(dataPromises);

            // Process and aggregate results
            for (let i = 0; i < results.length; i++) {
                const result = results[i];
                if (result.status === 'fulfilled' && result.value) {
                    const sourceData = result.value;
                    
                    // Add to sources
                    aggregatedData.sources.push(sourceData.source);
                    
                    // Aggregate case counts
                    if (sourceData.totalCases) {
                        aggregatedData.totalCases += sourceData.totalCases;
                    }
                    
                    if (sourceData.totalDeaths) {
                        aggregatedData.totalDeaths += sourceData.totalDeaths;
                    }

                    // Merge data points
                    if (sourceData.dataPoints) {
                        aggregatedData.dataPoints.push(...sourceData.dataPoints);
                    }

                    // Merge geographic data
                    if (includeGeographic && sourceData.geographicData) {
                        aggregatedData.geographicData.push(...sourceData.geographicData);
                    }

                    // Merge temporal data
                    if (includeTemporal && sourceData.temporalData) {
                        aggregatedData.temporalTrends.push(...sourceData.temporalData);
                    }

                    // Merge demographic data
                    if (includeDemographic && sourceData.demographicData) {
                        aggregatedData.demographicBreakdown.push(...sourceData.demographicData);
                    }
                }
            }

            // Deduplicate and clean aggregated data
            aggregatedData.geographicData = this.deduplicateGeographicData(aggregatedData.geographicData);
            aggregatedData.temporalTrends = this.consolidateTemporalData(aggregatedData.temporalTrends);
            aggregatedData.demographicBreakdown = this.consolidateDemographicData(aggregatedData.demographicBreakdown);

            // Calculate summary statistics
            aggregatedData.summary = this.calculateSummaryStats(aggregatedData);

            return aggregatedData;

        } catch (error) {
            console.error(`Error aggregating CDC data for ${disease}:`, error);
            return {
                disease,
                error: error.message,
                totalCases: 0,
                totalDeaths: 0,
                sources: [],
                dataPoints: []
            };
        }
    }

    /**
     * Query CDC Open Data API
     */
    async getOpenDataResults(disease) {
        try {
            const datasets = this.datasetMappings[disease] || [disease];
            const allData = [];
            let totalCases = 0;
            let totalDeaths = 0;

            for (const dataset of datasets.slice(0, 2)) { // Limit to prevent rate limiting
                const url = `${this.endpoints.openData}/${dataset}.json?$limit=1000`;
                
                await this.rateLimitedDelay();
                const response = await fetch(url, { timeout: 15000 });
                
                if (response.ok) {
                    const data = await response.json();
                    
                    // Process data based on structure
                    const processedData = this.processOpenDataResponse(data, disease);
                    allData.push(...processedData.dataPoints);
                    totalCases += processedData.totalCases || 0;
                    totalDeaths += processedData.totalDeaths || 0;
                }
            }

            return {
                source: 'CDC Open Data API',
                totalCases,
                totalDeaths,
                dataPoints: allData,
                geographicData: this.extractGeographicData(allData),
                temporalData: this.extractTemporalData(allData),
                demographicData: this.extractDemographicData(allData)
            };

        } catch (error) {
            console.error(`Open Data API error for ${disease}:`, error);
            return null;
        }
    }

    /**
     * Query CDC WONDER API for mortality data
     */
    async getWONDERData(disease, years) {
        try {
            const codes = this.wonderCodes[disease];
            if (!codes) return null;

            // WONDER API requires XML request format
            const xmlRequest = this.buildWONDERRequest(codes, years);
            
            await this.rateLimitedDelay();
            const response = await fetch(this.endpoints.wonder, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/xml',
                    'User-Agent': 'Disease Zone Health Platform'
                },
                body: xmlRequest,
                timeout: 20000
            });

            if (response.ok) {
                const xmlData = await response.text();
                return this.parseWONDERResponse(xmlData, disease);
            }

        } catch (error) {
            console.error(`WONDER API error for ${disease}:`, error);
        }
        
        return null;
    }

    /**
     * Query CDC Environmental Health Tracking API
     */
    async getTrackingData(disease) {
        try {
            const measures = this.trackingMeasures[disease];
            if (!measures) return null;

            const allData = [];
            
            for (const measureId of measures.slice(0, 2)) {
                const url = `${this.endpoints.tracking}/getMeasureData/${measureId}`;
                
                await this.rateLimitedDelay();
                const response = await fetch(url, { timeout: 15000 });
                
                if (response.ok) {
                    const data = await response.json();
                    const processedData = this.processTrackingResponse(data, disease);
                    allData.push(...processedData);
                }
            }

            return {
                source: 'CDC Environmental Health Tracking',
                dataPoints: allData,
                geographicData: this.extractGeographicData(allData),
                temporalData: this.extractTemporalData(allData)
            };

        } catch (error) {
            console.error(`Tracking API error for ${disease}:`, error);
        }
        
        return null;
    }

    /**
     * Get NCHHSTP AtlasPlus data (web scraping since no API)
     */
    async getNCHHSTPData(disease) {
        try {
            // Since AtlasPlus doesn't have a public API, we'll implement
            // a limited scraper for publicly available CSV exports
            const stiDiseases = ['hiv', 'aids', 'std', 'chlamydia', 'gonorrhea', 'syphilis'];
            
            if (!stiDiseases.includes(disease)) return null;

            // This would need to be implemented based on available export URLs
            // For now, return placeholder structure
            return {
                source: 'CDC NCHHSTP AtlasPlus',
                dataPoints: [],
                note: 'AtlasPlus data integration requires manual export - API not available'
            };

        } catch (error) {
            console.error(`NCHHSTP data error for ${disease}:`, error);
        }
        
        return null;
    }

    /**
     * Process CDC Open Data API response
     */
    processOpenDataResponse(data, disease) {
        const dataPoints = [];
        let totalCases = 0;
        let totalDeaths = 0;

        for (const item of data || []) {
            const processedItem = {
                disease,
                year: item.year || item.data_year || new Date().getFullYear(),
                state: item.state || item.jurisdiction || 'Unknown',
                cases: this.parseNumber(item.cases || item.count || item.case_count || 0),
                deaths: this.parseNumber(item.deaths || item.death_count || 0),
                rate: this.parseNumber(item.rate || item.case_rate || 0),
                population: this.parseNumber(item.population || 0),
                source: 'CDC Open Data',
                lastUpdated: item.date_updated || new Date().toISOString()
            };

            dataPoints.push(processedItem);
            totalCases += processedItem.cases;
            totalDeaths += processedItem.deaths;
        }

        return { dataPoints, totalCases, totalDeaths };
    }

    /**
     * Build WONDER API XML request
     */
    buildWONDERRequest(icdCodes, years) {
        return `<?xml version="1.0" encoding="utf-8"?>
        <request>
            <parameter>
                <name>B_1</name>
                <value>D76.V1</value>
            </parameter>
            <parameter>
                <name>B_2</name>
                <value>*All*</value>
            </parameter>
            <parameter>
                <name>B_3</name>
                <value>*All*</value>
            </parameter>
            <parameter>
                <name>F_D76.V1</name>
                <value>${icdCodes.join(';')}</value>
            </parameter>
            <parameter>
                <name>F_D76.V2</name>
                <value>${years.join(';')}</value>
            </parameter>
        </request>`;
    }

    /**
     * Parse WONDER API XML response
     */
    parseWONDERResponse(xmlData, disease) {
        // This would need proper XML parsing - simplified for demonstration
        const dataPoints = [];
        let totalDeaths = 0;

        // Extract death counts from XML (simplified)
        const deathMatches = xmlData.match(/<deaths>(\d+)<\/deaths>/g) || [];
        
        for (const match of deathMatches) {
            const deaths = parseInt(match.replace(/<\/?deaths>/g, ''));
            totalDeaths += deaths;
        }

        return {
            source: 'CDC WONDER',
            totalDeaths,
            dataPoints: [{
                disease,
                deaths: totalDeaths,
                source: 'WONDER',
                dataType: 'mortality'
            }]
        };
    }

    /**
     * Process Environmental Health Tracking response
     */
    processTrackingResponse(data, disease) {
        return (data.data || []).map(item => ({
            disease,
            year: item.reportYear,
            state: item.geographyName,
            value: this.parseNumber(item.value),
            measure: item.measureName,
            source: 'CDC Environmental Health Tracking'
        }));
    }

    /**
     * Utility functions
     */
    parseNumber(value) {
        const num = parseFloat(value);
        return isNaN(num) ? 0 : num;
    }

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

    extractGeographicData(dataPoints) {
        const geographic = new Map();
        
        for (const point of dataPoints) {
            const key = point.state || point.geography || 'Unknown';
            if (!geographic.has(key)) {
                geographic.set(key, { state: key, cases: 0, deaths: 0, count: 0 });
            }
            const geo = geographic.get(key);
            geo.cases += point.cases || 0;
            geo.deaths += point.deaths || 0;
            geo.count += 1;
        }
        
        return Array.from(geographic.values());
    }

    extractTemporalData(dataPoints) {
        const temporal = new Map();
        
        for (const point of dataPoints) {
            const year = point.year || new Date().getFullYear();
            if (!temporal.has(year)) {
                temporal.set(year, { year, cases: 0, deaths: 0, count: 0 });
            }
            const temp = temporal.get(year);
            temp.cases += point.cases || 0;
            temp.deaths += point.deaths || 0;
            temp.count += 1;
        }
        
        return Array.from(temporal.values()).sort((a, b) => a.year - b.year);
    }

    extractDemographicData(dataPoints) {
        // Extract demographic breakdowns if available in the data
        const demographics = new Map();
        
        for (const point of dataPoints) {
            const key = point.demographic || point.age_group || point.sex || 'All';
            if (!demographics.has(key)) {
                demographics.set(key, { category: key, cases: 0, deaths: 0 });
            }
            const demo = demographics.get(key);
            demo.cases += point.cases || 0;
            demo.deaths += point.deaths || 0;
        }
        
        return Array.from(demographics.values());
    }

    deduplicateGeographicData(geoData) {
        const deduplicated = new Map();
        
        for (const geo of geoData) {
            const key = geo.state;
            if (!deduplicated.has(key)) {
                deduplicated.set(key, geo);
            } else {
                const existing = deduplicated.get(key);
                existing.cases += geo.cases || 0;
                existing.deaths += geo.deaths || 0;
                existing.count += geo.count || 1;
            }
        }
        
        return Array.from(deduplicated.values());
    }

    consolidateTemporalData(temporalData) {
        const consolidated = new Map();
        
        for (const temp of temporalData) {
            const key = temp.year;
            if (!consolidated.has(key)) {
                consolidated.set(key, temp);
            } else {
                const existing = consolidated.get(key);
                existing.cases += temp.cases || 0;
                existing.deaths += temp.deaths || 0;
                existing.count += temp.count || 1;
            }
        }
        
        return Array.from(consolidated.values()).sort((a, b) => a.year - b.year);
    }

    consolidateDemographicData(demographicData) {
        const consolidated = new Map();
        
        for (const demo of demographicData) {
            const key = demo.category;
            if (!consolidated.has(key)) {
                consolidated.set(key, demo);
            } else {
                const existing = consolidated.get(key);
                existing.cases += demo.cases || 0;
                existing.deaths += demo.deaths || 0;
            }
        }
        
        return Array.from(consolidated.values());
    }

    calculateSummaryStats(aggregatedData) {
        return {
            totalDataPoints: aggregatedData.dataPoints.length,
            sourcesCount: aggregatedData.sources.length,
            yearsSpanned: aggregatedData.temporalTrends.length,
            statesIncluded: aggregatedData.geographicData.length,
            caseRate: aggregatedData.totalCases > 0 ? 
                (aggregatedData.totalCases / Math.max(1, aggregatedData.geographicData.length)) : 0,
            mortalityRate: aggregatedData.totalDeaths > 0 && aggregatedData.totalCases > 0 ? 
                (aggregatedData.totalDeaths / aggregatedData.totalCases * 100) : 0
        };
    }

    /**
     * Get service status
     */
    getStatus() {
        return {
            endpoints: Object.keys(this.endpoints),
            supportedDiseases: Object.keys(this.datasetMappings),
            wonderCodes: Object.keys(this.wonderCodes),
            trackingMeasures: Object.keys(this.trackingMeasures),
            cacheSize: this.cache.size,
            rateLimitDelay: this.rateLimitDelay
        };
    }
}

module.exports = EnhancedCDCService;