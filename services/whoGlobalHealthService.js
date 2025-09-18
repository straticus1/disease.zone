/**
 * WHO Global Health Observatory Service
 * Integrates with WHO GHO OData API for international disease surveillance
 * Provides global health statistics and cross-country comparisons
 */

class WHOGlobalHealthService {
    constructor() {
        this.baseURL = 'https://apps.who.int/gho/api/v1';
        this.odataURL = 'https://apps.who.int/gho/api';
        
        this.cache = new Map();
        this.cacheExpiry = 1000 * 60 * 60 * 4; // 4 hours cache for WHO data
        this.rateLimitDelay = 1000; // Conservative rate limiting
        this.lastRequestTime = 0;

        // WHO Global Health Observatory indicators
        this.indicators = {
            // Infectious diseases
            'tuberculosis': 'TB_2',
            'hiv': 'HIV_0000000001',
            'malaria': 'MALARIA_EST_DEATHS',
            'hepatitis': 'HEP_0000000001',
            'covid19': 'COVID_CASES',
            'influenza': 'INFLUENZA_SURVEILLANCE',
            
            // Non-communicable diseases
            'diabetes': 'NCD_BMI_30A',
            'heart_disease': 'NCD_CCS_4030',
            'cancer': 'CANCER_INCIDENCE',
            'stroke': 'NCD_CCS_4010',
            'copd': 'NCD_CCS_3090',
            
            // Mortality and life expectancy
            'life_expectancy': 'WHOSIS_000001',
            'infant_mortality': 'MDG_0000000006',
            'maternal_mortality': 'MDG_0000000026',
            'under5_mortality': 'MDG_0000000007',
            
            // Health systems
            'immunization': 'WHS4_544',
            'health_expenditure': 'HE_EOP_CHE_GDP',
            'hospital_beds': 'HCF_0001',
            'physicians': 'HWF_0001',
            
            // Environmental health
            'air_pollution': 'AIR_41',
            'water_sanitation': 'WSH_SANITATION_SAFELY_MANAGED',
            'household_pollution': 'AIR_42'
        };

        // WHO regions for better data organization
        this.regions = {
            'AFR': 'African Region',
            'AMR': 'Region of the Americas', 
            'SEAR': 'South-East Asian Region',
            'EUR': 'European Region',
            'EMR': 'Eastern Mediterranean Region',
            'WPR': 'Western Pacific Region'
        };

        // Country groupings for analysis
        this.countryGroups = {
            'high_income': ['USA', 'CAN', 'GBR', 'DEU', 'FRA', 'JPN', 'AUS'],
            'upper_middle': ['CHN', 'BRA', 'RUS', 'MEX', 'TUR', 'ARG'],
            'lower_middle': ['IND', 'IDN', 'BGD', 'PAK', 'NGA', 'VNM'],
            'low_income': ['AFG', 'ETH', 'MDG', 'MLI', 'NER', 'TCD']
        };
    }

    /**
     * Get global health indicator data
     */
    async getIndicatorData(indicator, options = {}) {
        const {
            countries = [],
            years = [],
            format = 'json'
        } = options;

        try {
            const cacheKey = `indicator_${indicator}_${JSON.stringify(options)}`;
            const cached = this.getCachedData(cacheKey);
            if (cached) return cached;

            const indicatorCode = this.indicators[indicator] || indicator;
            let url = `${this.baseURL}/DIMENSION/GHO/DimensionValues?$filter=Code eq '${indicatorCode}'&$format=${format}`;

            await this.rateLimitedDelay();
            let response = await fetch(url, { timeout: 20000 });
            
            if (!response.ok) {
                throw new Error(`WHO API error: ${response.status}`);
            }

            let metadata = await response.json();

            // Get actual data
            url = `${this.baseURL}/GHO/${indicatorCode}?$format=${format}`;
            
            if (countries.length > 0) {
                const countryFilter = countries.map(c => `SpatialDim eq '${c}'`).join(' or ');
                url += `&$filter=(${countryFilter})`;
            }

            await this.rateLimitedDelay();
            response = await fetch(url, { timeout: 20000 });
            
            if (!response.ok) {
                throw new Error(`WHO data API error: ${response.status}`);
            }

            const data = await response.json();
            const processedData = this.processIndicatorData(data.value || [], indicator, metadata);

            const result = {
                indicator,
                indicatorCode,
                metadata: {
                    title: metadata.value?.[0]?.Title || indicator,
                    description: metadata.value?.[0]?.Definition || '',
                    unit: metadata.value?.[0]?.Unit || ''
                },
                data: processedData,
                totalRecords: processedData.length,
                countries: [...new Set(processedData.map(d => d.country))],
                years: [...new Set(processedData.map(d => d.year))].sort(),
                lastUpdated: new Date().toISOString(),
                source: 'WHO Global Health Observatory'
            };

            this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
            return result;

        } catch (error) {
            console.error(`WHO indicator data error for ${indicator}:`, error);
            return {
                indicator,
                error: error.message,
                data: [],
                totalRecords: 0
            };
        }
    }

    /**
     * Get country health profile with multiple indicators
     */
    async getCountryHealthProfile(countryCode, indicators = []) {
        try {
            const defaultIndicators = indicators.length > 0 ? indicators : 
                ['life_expectancy', 'infant_mortality', 'tuberculosis', 'hiv', 'diabetes'];

            const profilePromises = defaultIndicators.map(indicator =>
                this.getIndicatorData(indicator, { countries: [countryCode] })
            );

            const results = await Promise.allSettled(profilePromises);
            const profile = {};

            for (let i = 0; i < defaultIndicators.length; i++) {
                const indicator = defaultIndicators[i];
                const result = results[i];
                
                if (result.status === 'fulfilled' && result.value.data.length > 0) {
                    profile[indicator] = {
                        latestValue: this.getLatestValue(result.value.data),
                        trend: this.calculateTrend(result.value.data),
                        data: result.value.data.slice(-5) // Last 5 years
                    };
                }
            }

            return {
                countryCode,
                countryName: this.getCountryName(countryCode),
                region: this.getCountryRegion(countryCode),
                incomeGroup: this.getIncomeGroup(countryCode),
                profile,
                lastUpdated: new Date().toISOString(),
                source: 'WHO Global Health Observatory'
            };

        } catch (error) {
            console.error(`Country health profile error for ${countryCode}:`, error);
            return {
                countryCode,
                error: error.message,
                profile: {}
            };
        }
    }

    /**
     * Compare health indicators across countries
     */
    async compareCountries(indicator, countries, options = {}) {
        const { 
            years = [],
            includeRegionalAverage = true 
        } = options;

        try {
            const data = await this.getIndicatorData(indicator, { countries, years });
            
            if (!data.data || data.data.length === 0) {
                return {
                    indicator,
                    countries,
                    comparison: [],
                    message: 'No data available for comparison'
                };
            }

            // Group data by country
            const countryData = {};
            for (const record of data.data) {
                if (!countryData[record.country]) {
                    countryData[record.country] = [];
                }
                countryData[record.country].push(record);
            }

            // Calculate comparison metrics
            const comparison = countries.map(country => {
                const records = countryData[country] || [];
                const latestValue = this.getLatestValue(records);
                const trend = this.calculateTrend(records);
                
                return {
                    country,
                    countryName: this.getCountryName(country),
                    latestValue,
                    trend,
                    yearsCovered: records.length,
                    dataAvailability: records.length > 0 ? 'available' : 'limited'
                };
            });

            // Add regional averages if requested
            let regionalAverages = [];
            if (includeRegionalAverage) {
                regionalAverages = await this.calculateRegionalAverages(indicator, countries);
            }

            return {
                indicator,
                countries,
                comparison,
                regionalAverages,
                summary: this.generateComparisonSummary(comparison),
                lastUpdated: new Date().toISOString(),
                source: 'WHO Global Health Observatory'
            };

        } catch (error) {
            console.error(`Country comparison error for ${indicator}:`, error);
            return {
                indicator,
                countries,
                error: error.message,
                comparison: []
            };
        }
    }

    /**
     * Get global disease burden summary
     */
    async getGlobalDiseaseBurden(diseases = []) {
        try {
            const defaultDiseases = diseases.length > 0 ? diseases : 
                ['tuberculosis', 'hiv', 'malaria', 'diabetes', 'heart_disease'];

            const burdenPromises = defaultDiseases.map(disease =>
                this.getIndicatorData(disease, { countries: [] }) // All countries
            );

            const results = await Promise.allSettled(burdenPromises);
            const burden = {};

            for (let i = 0; i < defaultDiseases.length; i++) {
                const disease = defaultDiseases[i];
                const result = results[i];
                
                if (result.status === 'fulfilled' && result.value.data.length > 0) {
                    const globalData = result.value.data;
                    burden[disease] = {
                        globalTotal: this.calculateGlobalTotal(globalData),
                        countryCount: [...new Set(globalData.map(d => d.country))].length,
                        latestYear: Math.max(...globalData.map(d => d.year)),
                        topAffectedCountries: this.getTopAffectedCountries(globalData, 5),
                        regionalBreakdown: this.calculateRegionalBreakdown(globalData)
                    };
                }
            }

            return {
                diseases: defaultDiseases,
                burden,
                summary: {
                    totalCountriesAnalyzed: this.getTotalCountriesAnalyzed(burden),
                    dataCompleteness: this.calculateDataCompleteness(burden)
                },
                lastUpdated: new Date().toISOString(),
                source: 'WHO Global Health Observatory'
            };

        } catch (error) {
            console.error('Global disease burden error:', error);
            return {
                diseases,
                error: error.message,
                burden: {}
            };
        }
    }

    /**
     * Process WHO indicator data into standardized format
     */
    processIndicatorData(data, indicator, metadata) {
        return data.map(record => ({
            country: record.SpatialDim,
            countryName: this.getCountryName(record.SpatialDim),
            year: parseInt(record.TimeDim),
            value: parseFloat(record.NumericValue) || 0,
            displayValue: record.DisplayValue,
            unit: record.UnitOfMeasurement || metadata?.value?.[0]?.Unit || '',
            indicator,
            source: 'WHO GHO'
        })).filter(record => !isNaN(record.year) && record.value !== null);
    }

    /**
     * Get latest value from time series data
     */
    getLatestValue(data) {
        if (!data || data.length === 0) return null;
        
        const sorted = data.sort((a, b) => b.year - a.year);
        return {
            value: sorted[0].value,
            year: sorted[0].year,
            displayValue: sorted[0].displayValue
        };
    }

    /**
     * Calculate trend from time series data
     */
    calculateTrend(data) {
        if (!data || data.length < 2) return { direction: 'insufficient_data', change: 0 };

        const sorted = data.sort((a, b) => a.year - b.year);
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        
        const change = ((last.value - first.value) / first.value) * 100;
        const direction = change > 5 ? 'increasing' : change < -5 ? 'decreasing' : 'stable';

        return {
            direction,
            change: Math.round(change * 100) / 100,
            period: `${first.year}-${last.year}`,
            dataPoints: sorted.length
        };
    }

    /**
     * Calculate regional averages
     */
    async calculateRegionalAverages(indicator, countries) {
        const regionData = {};
        
        for (const country of countries) {
            const region = this.getCountryRegion(country);
            if (!regionData[region]) {
                regionData[region] = [];
            }
        }

        // This would require more complex WHO region data
        // For now, return placeholder structure
        return Object.keys(regionData).map(region => ({
            region,
            regionName: this.regions[region] || region,
            average: 0,
            countryCount: regionData[region].length
        }));
    }

    /**
     * Generate comparison summary
     */
    generateComparisonSummary(comparison) {
        const validData = comparison.filter(c => c.latestValue !== null);
        
        if (validData.length === 0) {
            return { message: 'No valid data for comparison' };
        }

        const values = validData.map(c => c.latestValue.value);
        const highest = validData.find(c => c.latestValue.value === Math.max(...values));
        const lowest = validData.find(c => c.latestValue.value === Math.min(...values));

        return {
            highest: { country: highest.country, value: highest.latestValue },
            lowest: { country: lowest.country, value: lowest.latestValue },
            average: values.reduce((a, b) => a + b, 0) / values.length,
            range: Math.max(...values) - Math.min(...values),
            countriesWithData: validData.length
        };
    }

    /**
     * Helper functions for country/region mapping
     */
    getCountryName(code) {
        // This would ideally use a comprehensive country mapping
        const countryNames = {
            'USA': 'United States',
            'GBR': 'United Kingdom',
            'DEU': 'Germany',
            'FRA': 'France',
            'CHN': 'China',
            'IND': 'India',
            'BRA': 'Brazil',
            'JPN': 'Japan'
        };
        return countryNames[code] || code;
    }

    getCountryRegion(code) {
        // Simplified region mapping
        const regionMapping = {
            'USA': 'AMR', 'CAN': 'AMR', 'BRA': 'AMR', 'MEX': 'AMR',
            'GBR': 'EUR', 'DEU': 'EUR', 'FRA': 'EUR', 'RUS': 'EUR',
            'CHN': 'WPR', 'JPN': 'WPR', 'AUS': 'WPR',
            'IND': 'SEAR', 'IDN': 'SEAR', 'BGD': 'SEAR'
        };
        return regionMapping[code] || 'Unknown';
    }

    getIncomeGroup(code) {
        for (const [group, countries] of Object.entries(this.countryGroups)) {
            if (countries.includes(code)) {
                return group.replace('_', ' ');
            }
        }
        return 'unclassified';
    }

    calculateGlobalTotal(data) {
        return data.reduce((sum, record) => sum + record.value, 0);
    }

    getTopAffectedCountries(data, limit) {
        return data
            .sort((a, b) => b.value - a.value)
            .slice(0, limit)
            .map(record => ({
                country: record.country,
                countryName: record.countryName,
                value: record.value,
                year: record.year
            }));
    }

    calculateRegionalBreakdown(data) {
        const regions = {};
        
        for (const record of data) {
            const region = this.getCountryRegion(record.country);
            if (!regions[region]) {
                regions[region] = { total: 0, countries: 0 };
            }
            regions[region].total += record.value;
            regions[region].countries += 1;
        }

        return Object.entries(regions).map(([region, data]) => ({
            region,
            regionName: this.regions[region] || region,
            total: data.total,
            average: data.total / data.countries,
            countries: data.countries
        }));
    }

    getTotalCountriesAnalyzed(burden) {
        const allCountries = new Set();
        Object.values(burden).forEach(disease => {
            if (disease.countryCount) {
                // This is a simplified approach
                for (let i = 0; i < disease.countryCount; i++) {
                    allCountries.add(i);
                }
            }
        });
        return allCountries.size;
    }

    calculateDataCompleteness(burden) {
        const diseaseCount = Object.keys(burden).length;
        const completeDiseases = Object.values(burden).filter(d => d.countryCount > 50).length;
        return diseaseCount > 0 ? (completeDiseases / diseaseCount) * 100 : 0;
    }

    /**
     * Rate limiting and caching helpers
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
            endpoints: [this.baseURL, this.odataURL],
            supportedIndicators: Object.keys(this.indicators),
            regions: Object.keys(this.regions),
            countryGroups: Object.keys(this.countryGroups),
            cacheSize: this.cache.size,
            rateLimitDelay: this.rateLimitDelay
        };
    }
}

module.exports = WHOGlobalHealthService;