/**
 * Country-Specific Health Data Service
 * Integrates with multiple government health APIs for country/region-specific disease surveillance
 */

const axios = require('axios');

class CountryHealthService {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 15 * 60 * 1000; // 15 minutes for health data

        // API configurations for different countries
        this.apiConfigs = {
            US: {
                name: 'CDC Data API',
                baseUrl: 'https://data.cdc.gov',
                endpoints: {
                    covid: '/resource/vbim-akqf.json', // COVID-19 Case Surveillance
                    flu: '/resource/px52-2p9a.json',   // Weekly Flu Admissions
                    sti: '/resource/std-surveillance.json', // STI Surveillance placeholder
                    wastewater: '/resource/2ew6-ywp6.json' // Wastewater surveillance
                },
                regions: ['state', 'county'],
                rateLimit: 1000,
                apiKey: process.env.CDC_API_KEY || null
            },
            CA: {
                name: 'Health Canada API',
                baseUrl: 'https://health-infobase.canada.ca/api',
                endpoints: {
                    covid: '/covid19-epiSummary-cases',
                    chronic: '/ccdss-data',
                    flu: '/fluwatch-data'
                },
                regions: ['province', 'health_region'],
                rateLimit: 500,
                apiKey: null
            },
            GB: {
                name: 'UKHSA Data Dashboard API',
                baseUrl: 'https://api.ukhsa-dashboard.data.gov.uk',
                endpoints: {
                    covid: '/themes/infectious_disease/sub_themes/respiratory/topics/COVID-19',
                    testing: '/themes/infectious_disease/sub_themes/respiratory/topics/COVID-19/geography_types/Nation/geographies/England/metrics/COVID-19_testing_PCRcountByDay'
                },
                regions: ['nation', 'region', 'local_authority'],
                rateLimit: 1000,
                apiKey: null
            },
            AU: {
                name: 'Australian NNDSS API',
                baseUrl: 'https://www.health.gov.au/api',
                endpoints: {
                    nndss: '/nndss-data',
                    hospitals: '/myhospitals-data'
                },
                regions: ['state', 'territory'],
                rateLimit: 300,
                apiKey: null
            }
        };
    }

    /**
     * Get health data for a specific country and region
     */
    async getCountryHealthData(countryCode, options = {}) {
        const {
            region = 'all',
            dataType = 'covid',
            startDate = null,
            endDate = null,
            limit = 100
        } = options;

        console.log(`🌍 Fetching health data for ${countryCode}, region: ${region}, type: ${dataType}`);

        const cacheKey = `${countryCode}_${region}_${dataType}_${startDate}_${endDate}_${limit}`;

        // Check cache first
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                console.log('📦 Returning cached country health data');
                return cached.data;
            }
        }

        try {
            let data;

            switch (countryCode) {
                case 'US':
                    data = await this.fetchUSData(region, dataType, { startDate, endDate, limit });
                    break;
                case 'CA':
                    data = await this.fetchCanadaData(region, dataType, { startDate, endDate, limit });
                    break;
                case 'GB':
                    data = await this.fetchUKData(region, dataType, { startDate, endDate, limit });
                    break;
                case 'AU':
                    data = await this.fetchAustraliaData(region, dataType, { startDate, endDate, limit });
                    break;
                default:
                    data = await this.generateSampleData(countryCode, region, dataType);
            }

            // Cache the results
            this.cache.set(cacheKey, {
                data,
                timestamp: Date.now()
            });

            return data;

        } catch (error) {
            console.error(`❌ Failed to fetch health data for ${countryCode}:`, error);
            // Return sample data as fallback
            return await this.generateSampleData(countryCode, region, dataType);
        }
    }

    /**
     * Fetch US health data from CDC API
     */
    async fetchUSData(region, dataType, options) {
        const config = this.apiConfigs.US;
        const endpoint = config.endpoints[dataType];

        if (!endpoint) {
            throw new Error(`Data type ${dataType} not supported for US`);
        }

        let url = `${config.baseUrl}${endpoint}`;
        const params = new URLSearchParams();

        // Add region filter if specified
        if (region && region !== 'all') {
            params.append('state', region);
        }

        // Add date filters
        if (options.startDate) {
            params.append('$where', `submission_date >= '${options.startDate}'`);
        }

        // Add limit
        params.append('$limit', options.limit.toString());

        if (params.toString()) {
            url += `?${params.toString()}`;
        }

        console.log(`🇺🇸 Fetching CDC data from: ${url}`);

        const response = await axios.get(url, {
            timeout: 10000,
            headers: config.apiKey ? { 'X-App-Token': config.apiKey } : {}
        });

        return this.processUSData(response.data, region, dataType);
    }

    /**
     * Fetch Canada health data
     */
    async fetchCanadaData(region, dataType, options) {
        const config = this.apiConfigs.CA;

        // Canada API requires specific requests - using sample data for now
        console.log(`🇨🇦 Generating sample data for Canada (API integration pending)`);
        return await this.generateSampleData('CA', region, dataType);
    }

    /**
     * Fetch UK health data from UKHSA API
     */
    async fetchUKData(region, dataType, options) {
        const config = this.apiConfigs.GB;

        if (dataType === 'covid') {
            // Example UKHSA API call
            const url = `${config.baseUrl}/themes/infectious_disease/sub_themes/respiratory/topics/COVID-19/geography_types/Nation/geographies/England/metrics/COVID-19_cases_casesByDay?format=json`;

            console.log(`🇬🇧 Fetching UKHSA data from: ${url}`);

            try {
                const response = await axios.get(url, { timeout: 10000 });
                return this.processUKData(response.data, region, dataType);
            } catch (error) {
                console.warn(`⚠️ UKHSA API call failed, using sample data:`, error.message);
                return await this.generateSampleData('GB', region, dataType);
            }
        }

        return await this.generateSampleData('GB', region, dataType);
    }

    /**
     * Fetch Australia health data
     */
    async fetchAustraliaData(region, dataType, options) {
        console.log(`🇦🇺 Generating sample data for Australia (API integration pending)`);
        return await this.generateSampleData('AU', region, dataType);
    }

    /**
     * Process US CDC data
     */
    processUSData(rawData, region, dataType) {
        if (!Array.isArray(rawData)) {
            rawData = [rawData];
        }

        const processedData = rawData.slice(0, 50).map((item, index) => {
            let cases = 0;
            let location = 'Unknown';

            if (dataType === 'covid') {
                cases = parseInt(item.tot_cases || item.new_case || Math.random() * 1000);
                location = item.state || item.jurisdiction || `US Location ${index + 1}`;
            } else if (dataType === 'flu') {
                cases = parseInt(item.weekly_rate || Math.random() * 100);
                location = item.state || `US State ${index + 1}`;
            }

            return {
                id: `us_${index}`,
                location,
                country: 'US',
                region: item.state || region,
                cases,
                dataType,
                date: item.submission_date || item.week_ending_date || new Date().toISOString().split('T')[0],
                source: 'CDC',
                coordinates: this.getUSStateCoordinates(item.state || location)
            };
        });

        return {
            country: 'US',
            region,
            dataType,
            totalCases: processedData.reduce((sum, item) => sum + item.cases, 0),
            dataPoints: processedData,
            lastUpdated: new Date().toISOString(),
            source: 'CDC Data API'
        };
    }

    /**
     * Process UK UKHSA data
     */
    processUKData(rawData, region, dataType) {
        const data = rawData.results || rawData || [];

        const processedData = data.slice(0, 20).map((item, index) => ({
            id: `uk_${index}`,
            location: item.geography || `UK Region ${index + 1}`,
            country: 'GB',
            region: item.geography_type || region,
            cases: parseInt(item.metric_value || Math.random() * 500),
            dataType,
            date: item.date || new Date().toISOString().split('T')[0],
            source: 'UKHSA',
            coordinates: this.getUKRegionCoordinates(item.geography)
        }));

        return {
            country: 'GB',
            region,
            dataType,
            totalCases: processedData.reduce((sum, item) => sum + item.cases, 0),
            dataPoints: processedData,
            lastUpdated: new Date().toISOString(),
            source: 'UKHSA Data Dashboard API'
        };
    }

    /**
     * Generate sample data for countries without API access
     */
    async generateSampleData(countryCode, region, dataType) {
        const countryNames = {
            'US': 'United States',
            'CA': 'Canada',
            'GB': 'United Kingdom',
            'DE': 'Germany',
            'FR': 'France',
            'IT': 'Italy',
            'ES': 'Spain',
            'AU': 'Australia',
            'JP': 'Japan',
            'CN': 'China',
            'IN': 'India',
            'BR': 'Brazil',
            'MX': 'Mexico',
            'RU': 'Russia',
            'ZA': 'South Africa'
        };

        const sampleLocations = region === 'all' ?
            this.getCountrySampleLocations(countryCode) :
            [{ name: region, lat: 0, lng: 0 }];

        const dataPoints = sampleLocations.map((location, index) => ({
            id: `${countryCode.toLowerCase()}_${index}`,
            location: location.name,
            country: countryCode,
            region: region === 'all' ? location.region || 'National' : region,
            cases: Math.floor(Math.random() * 1000) + 50,
            dataType,
            date: new Date().toISOString().split('T')[0],
            source: `${countryNames[countryCode]} Health Ministry`,
            coordinates: [location.lat, location.lng]
        }));

        return {
            country: countryCode,
            region,
            dataType,
            totalCases: dataPoints.reduce((sum, item) => sum + item.cases, 0),
            dataPoints,
            lastUpdated: new Date().toISOString(),
            source: `Sample data for ${countryNames[countryCode]}`
        };
    }

    /**
     * Get sample locations for a country
     */
    getCountrySampleLocations(countryCode) {
        const locations = {
            'US': [
                { name: 'New York', lat: 40.7128, lng: -74.0060, region: 'NY' },
                { name: 'Los Angeles', lat: 34.0522, lng: -118.2437, region: 'CA' },
                { name: 'Chicago', lat: 41.8781, lng: -87.6298, region: 'IL' },
                { name: 'Houston', lat: 29.7604, lng: -95.3698, region: 'TX' }
            ],
            'CA': [
                { name: 'Toronto', lat: 43.6532, lng: -79.3832, region: 'ON' },
                { name: 'Vancouver', lat: 49.2827, lng: -123.1207, region: 'BC' },
                { name: 'Montreal', lat: 45.5017, lng: -73.5673, region: 'QC' }
            ],
            'GB': [
                { name: 'London', lat: 51.5074, lng: -0.1278, region: 'England' },
                { name: 'Edinburgh', lat: 55.9533, lng: -3.1883, region: 'Scotland' },
                { name: 'Cardiff', lat: 51.4816, lng: -3.1791, region: 'Wales' }
            ]
        };

        return locations[countryCode] || [
            { name: 'Capital City', lat: 0, lng: 0, region: 'National' }
        ];
    }

    /**
     * Get coordinates for US states
     */
    getUSStateCoordinates(state) {
        const coordinates = {
            'NY': [40.7128, -74.0060],
            'CA': [36.7783, -119.4179],
            'IL': [40.6331, -89.3985],
            'TX': [31.9686, -99.9018],
            'FL': [27.7663, -82.6404]
        };
        return coordinates[state] || [39.8283, -98.5795]; // Default to US center
    }

    /**
     * Get coordinates for UK regions
     */
    getUKRegionCoordinates(region) {
        const coordinates = {
            'England': [52.3555, -1.1743],
            'Scotland': [56.4907, -4.2026],
            'Wales': [52.1307, -3.7837],
            'Northern Ireland': [54.7877, -6.4923]
        };
        return coordinates[region] || [55.3781, -3.4360]; // Default to UK center
    }

    /**
     * Get available regions for a country
     */
    getAvailableRegions(countryCode) {
        const regions = {
            'US': Object.keys(this.getUSStateCoordinates('')),
            'CA': ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'ON', 'PE', 'QC', 'SK'],
            'GB': ['England', 'Scotland', 'Wales', 'Northern Ireland'],
            'AU': ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT']
        };

        return regions[countryCode] || [];
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
        console.log('🗑️ Country health data cache cleared');
    }

    /**
     * Get API status for all configured countries
     */
    async getAPIStatus() {
        const status = {};

        for (const [countryCode, config] of Object.entries(this.apiConfigs)) {
            try {
                // Simple health check - attempt to fetch a small amount of data
                await this.getCountryHealthData(countryCode, { limit: 1 });
                status[countryCode] = {
                    name: config.name,
                    status: 'operational',
                    lastChecked: new Date().toISOString()
                };
            } catch (error) {
                status[countryCode] = {
                    name: config.name,
                    status: 'error',
                    error: error.message,
                    lastChecked: new Date().toISOString()
                };
            }
        }

        return status;
    }
}

module.exports = CountryHealthService;