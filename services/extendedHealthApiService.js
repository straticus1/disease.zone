/**
 * Extended Health API Service
 *
 * Integrates with additional health data sources:
 * - Delphi Epidata API (CMU)
 * - Additional State Health APIs
 * - HealthData.gov
 * - America's Health Rankings
 * - Enhanced OpenFDA integration
 */

const axios = require('axios');
const { performance } = require('perf_hooks');

class ExtendedHealthApiService {
    constructor() {
        this.baseUrls = {
            // Delphi Epidata API (Carnegie Mellon University)
            delphi_epidata: 'https://api.delphi.cmu.edu/epidata/',

            // Federal APIs
            healthdata_gov: 'https://healthdata.gov/api/views/',
            openfda: 'https://api.fda.gov/',

            // America's Health Rankings
            ahr_api: 'https://www.americashealthrankings.org/api/',

            // Additional State APIs
            massachusetts: 'https://www.mass.gov/service-details/massgov-data-api',
            maryland: 'https://health.maryland.gov/api/',
            oregon: 'https://www.oregon.gov/oha/ph/api/',
            colorado: 'https://data-cdphe.opendata.arcgis.com/',
            delaware: 'https://dhss.delaware.gov/api/',
            nevada: 'https://dpbh.nv.gov/api/',
            vermont: 'https://www.healthvermont.gov/api/',
            illinois: 'https://dph.illinois.gov/api/',
            rhode_island: 'https://health.ri.gov/api/',
            hawaii: 'https://health.hawaii.gov/api/',
            pennsylvania: 'https://www.health.pa.gov/api/',
            washington: 'https://doh.wa.gov/api/',
            kansas: 'https://www.kdhe.ks.gov/api/',

            // New state APIs - Batch 2
            georgia: 'https://dph.georgia.gov/api/',
            south_dakota: 'https://doh.sd.gov/api/',
            utah: 'https://health.utah.gov/api/',
            north_carolina: 'https://epi.dph.ncdhhs.gov/api/',
            south_carolina: 'https://scdhec.gov/api/',
            missouri: 'https://health.mo.gov/api/',
            montana: 'https://dphhs.mt.gov/api/',
            mississippi: 'https://msdh.ms.gov/api/',
            louisiana: 'https://ldh.la.gov/api/',
            west_virginia: 'https://dhhr.wv.gov/api/'
        };

        this.delphiEndpoints = {
            // COVID-19 and Influenza-like illness
            covid_hosp: 'covid_hosp',
            covid_act_now: 'covid_act_now',
            covidcast: 'covidcast',

            // Influenza surveillance
            fluview: 'fluview',
            flusurv: 'flusurv',
            ilinet: 'ilinet',

            // Nowcasting and forecasting
            nowcast: 'nowcast',
            forecasts: 'forecasts',

            // Sensors and signals
            google_symptoms: 'google_symptoms',
            quidel: 'quidel',
            sensors: 'sensors'
        };

        this.stateDataTypes = {
            massachusetts: {
                covid_data: 'covid-19-dashboard-data',
                vital_stats: 'vital-statistics',
                communicable_disease: 'communicable-disease-surveillance',
                environmental_health: 'environmental-health-data'
            },
            maryland: {
                covid_data: 'covid19-data',
                health_stats: 'health-statistics',
                hospital_data: 'hospital-discharge-data',
                mortality_data: 'vital-statistics'
            },
            oregon: {
                covid_surveillance: 'covid-19-surveillance',
                flu_surveillance: 'influenza-surveillance',
                std_surveillance: 'std-surveillance',
                tb_surveillance: 'tuberculosis-surveillance'
            },
            colorado: {
                disease_surveillance: 'disease-surveillance-data',
                environmental_health: 'environmental-health',
                vital_records: 'vital-records',
                hospital_data: 'hospital-discharge-data'
            },
            delaware: {
                public_health: 'public-health-data',
                environmental: 'environmental-health',
                vital_stats: 'vital-statistics',
                chronic_disease: 'chronic-disease-data'
            },
            nevada: {
                covid_data: 'covid-19-surveillance',
                public_health: 'public-health-data',
                environmental_health: 'environmental-health-tracking',
                vital_statistics: 'vital-statistics',
                chronic_disease: 'chronic-disease-indicators',
                substance_abuse: 'substance-abuse-monitoring',
                maternal_health: 'maternal-child-health'
            },
            vermont: {
                covid_surveillance: 'covid-19-data',
                flu_surveillance: 'influenza-surveillance',
                environmental_health: 'environmental-health',
                vital_records: 'vital-records',
                chronic_disease: 'chronic-disease-surveillance',
                cancer_registry: 'cancer-registry-data',
                behavioral_health: 'behavioral-health-data',
                immunization: 'immunization-data'
            },
            illinois: {
                covid_data: 'covid-19-surveillance',
                flu_surveillance: 'influenza-surveillance',
                std_surveillance: 'std-surveillance',
                cancer_registry: 'cancer-registry',
                vital_statistics: 'vital-statistics',
                environmental_health: 'environmental-health',
                chronic_disease: 'chronic-disease-indicators',
                hospital_data: 'hospital-discharge-data'
            },
            rhode_island: {
                covid_data: 'covid-19-data',
                health_survey: 'health-survey-data',
                environmental_health: 'environmental-health',
                vital_statistics: 'vital-statistics',
                chronic_disease: 'chronic-disease-data',
                substance_abuse: 'substance-abuse-data',
                maternal_health: 'maternal-child-health'
            },
            hawaii: {
                covid_surveillance: 'covid-19-surveillance',
                environmental_health: 'environmental-health-tracking',
                vital_statistics: 'vital-statistics',
                chronic_disease: 'chronic-disease-surveillance',
                cancer_registry: 'cancer-registry-data',
                behavioral_health: 'behavioral-health',
                tropical_disease: 'tropical-disease-surveillance',
                vector_control: 'vector-control-data'
            },
            pennsylvania: {
                covid_data: 'covid-19-data',
                flu_surveillance: 'influenza-surveillance',
                std_surveillance: 'std-surveillance',
                cancer_registry: 'cancer-registry',
                vital_statistics: 'vital-statistics',
                environmental_health: 'environmental-health',
                chronic_disease: 'chronic-disease-surveillance',
                hospital_data: 'hospital-data'
            },
            washington: {
                covid_surveillance: 'covid-19-surveillance',
                flu_surveillance: 'influenza-surveillance',
                std_surveillance: 'std-surveillance',
                environmental_health: 'environmental-health-tracking',
                vital_statistics: 'vital-statistics',
                chronic_disease: 'chronic-disease-data',
                cancer_registry: 'cancer-registry',
                behavioral_health: 'behavioral-health-surveillance'
            },
            kansas: {
                covid_data: 'covid-19-surveillance',
                environmental_health: 'environmental-health',
                vital_statistics: 'vital-statistics',
                chronic_disease: 'chronic-disease-indicators',
                std_surveillance: 'std-surveillance',
                cancer_surveillance: 'cancer-surveillance',
                maternal_health: 'maternal-child-health',
                rural_health: 'rural-health-data'
            },
            georgia: {
                covid_surveillance: 'covid-19-surveillance',
                flu_surveillance: 'influenza-surveillance',
                std_surveillance: 'std-surveillance',
                cancer_registry: 'cancer-registry',
                vital_statistics: 'vital-statistics',
                environmental_health: 'environmental-health',
                chronic_disease: 'chronic-disease-surveillance',
                hospital_data: 'hospital-discharge-data',
                maternal_health: 'maternal-child-health',
                tb_surveillance: 'tuberculosis-surveillance'
            },
            south_dakota: {
                covid_data: 'covid-19-data',
                environmental_health: 'environmental-health',
                vital_statistics: 'vital-statistics',
                chronic_disease: 'chronic-disease-indicators',
                std_surveillance: 'std-surveillance',
                cancer_surveillance: 'cancer-surveillance',
                maternal_health: 'maternal-child-health',
                rural_health: 'rural-health-tracking',
                agricultural_health: 'agricultural-health-surveillance'
            },
            utah: {
                covid_surveillance: 'covid-19-surveillance',
                environmental_health: 'environmental-health-tracking',
                vital_statistics: 'vital-statistics',
                chronic_disease: 'chronic-disease-surveillance',
                cancer_registry: 'cancer-registry',
                behavioral_health: 'behavioral-health-surveillance',
                maternal_health: 'maternal-child-health',
                air_quality: 'air-quality-monitoring',
                occupational_health: 'occupational-health-surveillance'
            },
            north_carolina: {
                covid_data: 'covid-19-surveillance',
                flu_surveillance: 'influenza-surveillance',
                std_surveillance: 'std-surveillance',
                cancer_registry: 'cancer-registry',
                vital_statistics: 'vital-statistics',
                environmental_health: 'environmental-health',
                chronic_disease: 'chronic-disease-surveillance',
                hospital_data: 'hospital-data',
                vector_surveillance: 'vector-borne-disease-surveillance'
            },
            south_carolina: {
                covid_surveillance: 'covid-19-surveillance',
                environmental_health: 'environmental-health',
                vital_statistics: 'vital-statistics',
                chronic_disease: 'chronic-disease-indicators',
                std_surveillance: 'std-surveillance',
                cancer_registry: 'cancer-registry',
                maternal_health: 'maternal-child-health',
                coastal_health: 'coastal-health-monitoring',
                hurricane_health: 'hurricane-health-tracking'
            },
            missouri: {
                covid_data: 'covid-19-surveillance',
                flu_surveillance: 'influenza-surveillance',
                std_surveillance: 'std-surveillance',
                cancer_registry: 'cancer-registry',
                vital_statistics: 'vital-statistics',
                environmental_health: 'environmental-health',
                chronic_disease: 'chronic-disease-surveillance',
                hospital_data: 'hospital-discharge-data',
                rural_health: 'rural-health-data'
            },
            montana: {
                covid_surveillance: 'covid-19-surveillance',
                environmental_health: 'environmental-health-tracking',
                vital_statistics: 'vital-statistics',
                chronic_disease: 'chronic-disease-indicators',
                cancer_surveillance: 'cancer-surveillance',
                behavioral_health: 'behavioral-health-surveillance',
                rural_health: 'rural-health-tracking',
                mining_health: 'mining-health-surveillance',
                wildfire_health: 'wildfire-health-tracking'
            },
            mississippi: {
                covid_data: 'covid-19-surveillance',
                flu_surveillance: 'influenza-surveillance',
                std_surveillance: 'std-surveillance',
                cancer_registry: 'cancer-registry',
                vital_statistics: 'vital-statistics',
                environmental_health: 'environmental-health',
                chronic_disease: 'chronic-disease-surveillance',
                maternal_health: 'maternal-child-health',
                delta_health: 'mississippi-delta-health-tracking'
            },
            louisiana: {
                covid_surveillance: 'covid-19-surveillance',
                environmental_health: 'environmental-health',
                vital_statistics: 'vital-statistics',
                chronic_disease: 'chronic-disease-indicators',
                std_surveillance: 'std-surveillance',
                cancer_registry: 'cancer-registry',
                maternal_health: 'maternal-child-health',
                hurricane_health: 'hurricane-health-tracking',
                tropical_disease: 'tropical-disease-surveillance',
                coastal_health: 'coastal-environmental-health'
            },
            west_virginia: {
                covid_data: 'covid-19-surveillance',
                environmental_health: 'environmental-health',
                vital_statistics: 'vital-statistics',
                chronic_disease: 'chronic-disease-indicators',
                std_surveillance: 'std-surveillance',
                cancer_surveillance: 'cancer-surveillance',
                maternal_health: 'maternal-child-health',
                rural_health: 'rural-health-tracking',
                mining_health: 'mining-health-surveillance',
                opioid_surveillance: 'opioid-surveillance-data'
            }
        };

        this.cache = new Map();
        this.cacheTimeout = 30 * 60 * 1000; // 30 minutes for real-time data
    }

    // ========== DELPHI EPIDATA API METHODS ==========

    async getDelphiCovidData(options = {}) {
        try {
            const {
                signal = 'doctor_visits',
                time_type = 'day',
                time_values = 'latest',
                geo_type = 'state',
                geo_values = '*',
                as_of = null
            } = options;

            const cacheKey = `delphi_covid_${signal}_${geo_type}_${geo_values}_${time_values}`;

            if (this.cache.has(cacheKey)) {
                const cached = this.cache.get(cacheKey);
                if (Date.now() - cached.timestamp < this.cacheTimeout) {
                    return cached.data;
                }
            }

            const params = {
                signal,
                time_type,
                time_values,
                geo_type,
                geo_values
            };

            if (as_of) params.as_of = as_of;

            const response = await axios.get(`${this.baseUrls.delphi_epidata}covidcast`, {
                params,
                timeout: 30000
            });

            const processedData = this.processDelphiCovidData(response.data);

            this.cache.set(cacheKey, {
                data: processedData,
                timestamp: Date.now()
            });

            return processedData;

        } catch (error) {
            console.error('Error fetching Delphi COVID data:', error.message);
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    async getDelphiFluData(options = {}) {
        try {
            const {
                regions = ['nat'],
                epiweeks = 'latest',
                issues = 'latest'
            } = options;

            const cacheKey = `delphi_flu_${regions.join(',')}_${epiweeks}`;

            if (this.cache.has(cacheKey)) {
                const cached = this.cache.get(cacheKey);
                if (Date.now() - cached.timestamp < this.cacheTimeout) {
                    return cached.data;
                }
            }

            const response = await axios.get(`${this.baseUrls.delphi_epidata}fluview`, {
                params: {
                    regions: regions.join(','),
                    epiweeks,
                    issues
                },
                timeout: 30000
            });

            const processedData = this.processDelphiFluData(response.data);

            this.cache.set(cacheKey, {
                data: processedData,
                timestamp: Date.now()
            });

            return processedData;

        } catch (error) {
            console.error('Error fetching Delphi flu data:', error.message);
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    async getDelphiNowcast(signal, geo_type = 'state', geo_values = '*') {
        try {
            const cacheKey = `delphi_nowcast_${signal}_${geo_type}_${geo_values}`;

            if (this.cache.has(cacheKey)) {
                const cached = this.cache.get(cacheKey);
                if (Date.now() - cached.timestamp < this.cacheTimeout) {
                    return cached.data;
                }
            }

            const response = await axios.get(`${this.baseUrls.delphi_epidata}nowcast`, {
                params: {
                    signal,
                    geo_type,
                    geo_values
                },
                timeout: 30000
            });

            const processedData = this.processDelphiNowcast(response.data);

            this.cache.set(cacheKey, {
                data: processedData,
                timestamp: Date.now()
            });

            return processedData;

        } catch (error) {
            console.error('Error fetching Delphi nowcast:', error.message);
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    // ========== STATE API METHODS ==========

    async getNevadaHealthData(dataType = 'covid_data') {
        try {
            const endpoint = this.stateDataTypes.nevada[dataType];
            if (!endpoint) {
                throw new Error(`Unknown data type: ${dataType}`);
            }

            const cacheKey = `nv_${dataType}`;

            if (this.cache.has(cacheKey)) {
                const cached = this.cache.get(cacheKey);
                if (Date.now() - cached.timestamp < this.cacheTimeout) {
                    return cached.data;
                }
            }

            // Nevada uses REST API with JSON responses
            const response = await axios.get(`${this.baseUrls.nevada}${endpoint}`, {
                timeout: 30000,
                headers: {
                    'Accept': 'application/json'
                }
            });

            const processedData = this.processStateData(response.data, 'nevada', dataType);

            this.cache.set(cacheKey, {
                data: processedData,
                timestamp: Date.now()
            });

            return processedData;

        } catch (error) {
            console.error('Error fetching Nevada data:', error.message);
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    async getVermontHealthData(dataType = 'covid_surveillance') {
        try {
            const endpoint = this.stateDataTypes.vermont[dataType];
            if (!endpoint) {
                throw new Error(`Unknown data type: ${dataType}`);
            }

            const cacheKey = `vt_${dataType}`;

            if (this.cache.has(cacheKey)) {
                const cached = this.cache.get(cacheKey);
                if (Date.now() - cached.timestamp < this.cacheTimeout) {
                    return cached.data;
                }
            }

            // Vermont uses SOCRATA-based API
            const response = await axios.get(`${this.baseUrls.vermont}${endpoint}`, {
                timeout: 30000,
                headers: {
                    'Accept': 'application/json'
                },
                params: {
                    '$limit': 5000 // Vermont specific parameter
                }
            });

            const processedData = this.processStateData(response.data, 'vermont', dataType);

            this.cache.set(cacheKey, {
                data: processedData,
                timestamp: Date.now()
            });

            return processedData;

        } catch (error) {
            console.error('Error fetching Vermont data:', error.message);
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    async getMassachusettsHealthData(dataType = 'covid_data') {
        try {
            const endpoint = this.stateDataTypes.massachusetts[dataType];
            if (!endpoint) {
                throw new Error(`Unknown data type: ${dataType}`);
            }

            const cacheKey = `ma_${dataType}`;

            if (this.cache.has(cacheKey)) {
                const cached = this.cache.get(cacheKey);
                if (Date.now() - cached.timestamp < this.cacheTimeout) {
                    return cached.data;
                }
            }

            // Massachusetts uses a different API structure
            const response = await axios.get(`${this.baseUrls.massachusetts}/${endpoint}`, {
                timeout: 30000,
                headers: {
                    'Accept': 'application/json'
                }
            });

            const processedData = this.processStateData(response.data, 'massachusetts', dataType);

            this.cache.set(cacheKey, {
                data: processedData,
                timestamp: Date.now()
            });

            return processedData;

        } catch (error) {
            console.error('Error fetching Massachusetts data:', error.message);
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    async getStateHealthData(state, dataType) {
        try {
            const stateConfig = this.stateDataTypes[state];
            if (!stateConfig) {
                throw new Error(`State ${state} not supported`);
            }

            const endpoint = stateConfig[dataType];
            if (!endpoint) {
                throw new Error(`Data type ${dataType} not available for ${state}`);
            }

            const cacheKey = `${state}_${dataType}`;

            if (this.cache.has(cacheKey)) {
                const cached = this.cache.get(cacheKey);
                if (Date.now() - cached.timestamp < this.cacheTimeout) {
                    return cached.data;
                }
            }

            const baseUrl = this.baseUrls[state];
            const response = await axios.get(`${baseUrl}${endpoint}`, {
                timeout: 30000,
                headers: {
                    'Accept': 'application/json'
                }
            });

            const processedData = this.processStateData(response.data, state, dataType);

            this.cache.set(cacheKey, {
                data: processedData,
                timestamp: Date.now()
            });

            return processedData;

        } catch (error) {
            console.error(`Error fetching ${state} data:`, error.message);
            return {
                success: false,
                error: error.message,
                data: null,
                state,
                dataType
            };
        }
    }

    // ========== HEALTHDATA.GOV METHODS ==========

    async getHealthDataGov(dataset_id, options = {}) {
        try {
            const {
                limit = 1000,
                offset = 0,
                where = null,
                order = null
            } = options;

            const cacheKey = `healthdata_${dataset_id}_${limit}_${offset}`;

            if (this.cache.has(cacheKey)) {
                const cached = this.cache.get(cacheKey);
                if (Date.now() - cached.timestamp < this.cacheTimeout) {
                    return cached.data;
                }
            }

            const params = {
                '$limit': limit,
                '$offset': offset
            };

            if (where) params['$where'] = where;
            if (order) params['$order'] = order;

            const response = await axios.get(`${this.baseUrls.healthdata_gov}${dataset_id}/rows.json`, {
                params,
                timeout: 30000
            });

            const processedData = this.processHealthDataGov(response.data, dataset_id);

            this.cache.set(cacheKey, {
                data: processedData,
                timestamp: Date.now()
            });

            return processedData;

        } catch (error) {
            console.error('Error fetching HealthData.gov data:', error.message);
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    // ========== AMERICA'S HEALTH RANKINGS METHODS ==========

    async getAmericasHealthRankings(options = {}) {
        try {
            const {
                edition = 'annual',
                measure = 'overall',
                state = 'all',
                year = 'latest'
            } = options;

            const cacheKey = `ahr_${edition}_${measure}_${state}_${year}`;

            if (this.cache.has(cacheKey)) {
                const cached = this.cache.get(cacheKey);
                if (Date.now() - cached.timestamp < this.cacheTimeout) {
                    return cached.data;
                }
            }

            const response = await axios.get(`${this.baseUrls.ahr_api}rankings`, {
                params: {
                    edition,
                    measure,
                    state,
                    year
                },
                timeout: 30000
            });

            const processedData = this.processAmericasHealthRankings(response.data);

            this.cache.set(cacheKey, {
                data: processedData,
                timestamp: Date.now()
            });

            return processedData;

        } catch (error) {
            console.error('Error fetching America\'s Health Rankings:', error.message);
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    // ========== ENHANCED OPENFDA METHODS ==========

    async getOpenFDAData(endpoint, options = {}) {
        try {
            const {
                search = null,
                count = null,
                limit = 100,
                skip = 0
            } = options;

            const cacheKey = `openfda_${endpoint}_${search}_${count}_${limit}`;

            if (this.cache.has(cacheKey)) {
                const cached = this.cache.get(cacheKey);
                if (Date.now() - cached.timestamp < this.cacheTimeout) {
                    return cached.data;
                }
            }

            const params = {
                limit,
                skip
            };

            if (search) params.search = search;
            if (count) params.count = count;

            const response = await axios.get(`${this.baseUrls.openfda}${endpoint}`, {
                params,
                timeout: 30000
            });

            const processedData = this.processOpenFDAData(response.data, endpoint);

            this.cache.set(cacheKey, {
                data: processedData,
                timestamp: Date.now()
            });

            return processedData;

        } catch (error) {
            console.error('Error fetching OpenFDA data:', error.message);
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    // ========== DATA PROCESSING METHODS ==========

    processDelphiCovidData(rawData) {
        if (!rawData || !rawData.epidata) {
            return { success: false, data: [], message: 'No data available' };
        }

        return {
            success: true,
            data: rawData.epidata.map(item => ({
                geo_value: item.geo_value,
                time_value: item.time_value,
                value: item.value,
                stderr: item.stderr,
                sample_size: item.sample_size,
                direction: item.direction,
                signal: item.signal,
                source: 'Delphi Epidata'
            })),
            metadata: {
                total_results: rawData.epidata.length,
                source: 'CMU Delphi Research Group',
                last_updated: new Date().toISOString()
            }
        };
    }

    processDelphiFluData(rawData) {
        if (!rawData || !rawData.epidata) {
            return { success: false, data: [], message: 'No flu data available' };
        }

        return {
            success: true,
            data: rawData.epidata.map(item => ({
                region: item.region,
                epiweek: item.epiweek,
                wili: item.wili,
                ili: item.ili,
                num_ili: item.num_ili,
                num_patients: item.num_patients,
                num_providers: item.num_providers,
                source: 'Delphi Epidata'
            })),
            metadata: {
                total_results: rawData.epidata.length,
                source: 'CDC FluView via Delphi',
                last_updated: new Date().toISOString()
            }
        };
    }

    processDelphiNowcast(rawData) {
        return {
            success: true,
            data: rawData,
            metadata: {
                source: 'Delphi Nowcast',
                last_updated: new Date().toISOString()
            }
        };
    }

    processStateData(rawData, state, dataType) {
        return {
            success: true,
            data: rawData,
            metadata: {
                state: state,
                data_type: dataType,
                source: `${state.toUpperCase()} Health Department`,
                last_updated: new Date().toISOString()
            }
        };
    }

    processHealthDataGov(rawData, dataset_id) {
        return {
            success: true,
            data: rawData.data || rawData,
            metadata: {
                dataset_id: dataset_id,
                source: 'HealthData.gov',
                total_results: rawData.data ? rawData.data.length : 0,
                last_updated: new Date().toISOString()
            }
        };
    }

    processAmericasHealthRankings(rawData) {
        return {
            success: true,
            data: rawData,
            metadata: {
                source: 'America\'s Health Rankings',
                last_updated: new Date().toISOString()
            }
        };
    }

    processOpenFDAData(rawData, endpoint) {
        return {
            success: true,
            data: rawData.results || rawData,
            metadata: {
                endpoint: endpoint,
                source: 'FDA OpenFDA',
                total_results: rawData.meta ? rawData.meta.results.total : 0,
                last_updated: new Date().toISOString()
            }
        };
    }

    // ========== UTILITY METHODS ==========

    async getAvailableDataSources() {
        return {
            delphi_epidata: {
                name: 'Delphi Epidata API',
                description: 'Real-time epidemiological data from CMU',
                endpoints: Object.keys(this.delphiEndpoints),
                coverage: 'USA',
                update_frequency: 'Daily'
            },
            state_apis: {
                name: 'State Health Department APIs',
                description: 'State-level health surveillance data',
                states: Object.keys(this.stateDataTypes),
                coverage: 'State-level',
                update_frequency: 'Varies by state'
            },
            healthdata_gov: {
                name: 'HealthData.gov',
                description: 'Federal health datasets',
                coverage: 'USA',
                update_frequency: 'Varies by dataset'
            },
            americas_health_rankings: {
                name: 'America\'s Health Rankings',
                description: 'State health performance rankings',
                coverage: 'All US States',
                update_frequency: 'Annual'
            },
            openfda: {
                name: 'OpenFDA',
                description: 'FDA adverse events, drug labels, recalls',
                coverage: 'USA',
                update_frequency: 'Daily'
            }
        };
    }

    clearCache() {
        this.cache.clear();
        console.log('Extended Health API service cache cleared');
    }

    getCacheStats() {
        return {
            size: this.cache.size,
            entries: Array.from(this.cache.keys())
        };
    }
}

module.exports = ExtendedHealthApiService;