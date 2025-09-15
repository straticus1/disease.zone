class DiseaseApiService {
  constructor() {
    this.baseURL = 'https://disease.sh/v3';
    this.fetch = null;
    this.initFetch();

    // API configuration
    this.config = {
      timeout: 15000,
      retryAttempts: 3,
      retryDelay: 1000
    };

    // Supported endpoints and their capabilities
    this.endpoints = {
      covid: {
        global: '/covid-19/all',
        countries: '/covid-19/countries',
        states: '/covid-19/states',
        historical: '/covid-19/historical',
        vaccines: '/covid-19/vaccine'
      },
      influenza: {
        global: '/influenza',
        countries: '/influenza/countries'
      },
      general: {
        diseases: '/diseases',
        therapeutics: '/therapeutics'
      },
      tuberculosis: {
        global: '/tuberculosis',
        countries: '/tuberculosis/countries'
      },
      malaria: {
        global: '/malaria',
        countries: '/malaria/countries'  
      },
      hiv: {
        global: '/hiv',
        countries: '/hiv/countries'
      }
    };

    // Cache configuration
    this.cache = new Map();
    this.cacheExpiry = 1000 * 60 * 15; // 15 minutes default cache

    // Rate limiting
    this.lastRequestTime = 0;
    this.minRequestInterval = 100; // 100ms between requests
  }

  async initFetch() {
    if (!this.fetch) {
      const { default: fetch } = await import('node-fetch');
      this.fetch = fetch;
    }
  }

  async makeRequest(endpoint, options = {}) {
    await this.initFetch();
    await this.enforceRateLimit();

    const {
      params = {},
      retryCount = 0,
      useCache = true
    } = options;

    // Generate cache key
    const cacheKey = `${endpoint}-${JSON.stringify(params)}`;

    // Check cache first
    if (useCache && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheExpiry) {
        return { ...cached.data, source: 'cache' };
      }
    }

    try {
      // Build URL with parameters
      const url = new URL(`${this.baseURL}${endpoint}`);
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, value);
        }
      });

      this.lastRequestTime = Date.now();

      const response = await this.fetch(url.toString(), {
        timeout: this.config.timeout,
        headers: {
          'User-Agent': 'Disease Tracking Application (disease.zone)',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Disease API error: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();

      const result = {
        success: true,
        data: data,
        source: 'disease.sh',
        timestamp: new Date().toISOString(),
        endpoint: endpoint
      };

      // Cache successful results
      if (useCache) {
        this.cache.set(cacheKey, {
          data: result,
          timestamp: Date.now()
        });
      }

      return result;

    } catch (error) {
      // Retry logic
      if (retryCount < this.config.retryAttempts && !error.message.includes('404')) {
        console.warn(`Request failed, retrying (${retryCount + 1}/${this.config.retryAttempts}):`, error.message);
        await this.delay(this.config.retryDelay * (retryCount + 1));
        return this.makeRequest(endpoint, { ...options, retryCount: retryCount + 1 });
      }

      throw new Error(`Disease API request failed: ${error.message}`);
    }
  }

  async enforceRateLimit() {
    const timeSinceLastRequest = Date.now() - this.lastRequestTime;
    if (timeSinceLastRequest < this.minRequestInterval) {
      await this.delay(this.minRequestInterval - timeSinceLastRequest);
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getCOVIDData(options = {}) {
    const {
      scope = 'global', // 'global', 'countries', 'country', 'states'
      country = null,
      state = null,
      historical = false,
      days = 30
    } = options;

    try {
      let endpoint;
      let params = {};

      if (historical) {
        endpoint = this.endpoints.covid.historical;
        if (country) {
          endpoint += `/${country}`;
          if (state) {
            endpoint += `/${state}`;
          }
        }
        params.lastdays = days;
      } else {
        switch (scope) {
          case 'global':
            endpoint = this.endpoints.covid.global;
            break;
          case 'countries':
            endpoint = this.endpoints.covid.countries;
            break;
          case 'country':
            if (!country) throw new Error('Country parameter required for country scope');
            endpoint = `${this.endpoints.covid.countries}/${country}`;
            break;
          case 'states':
            endpoint = this.endpoints.covid.states;
            if (state) {
              endpoint += `/${state}`;
            }
            break;
          default:
            throw new Error(`Invalid scope: ${scope}`);
        }
      }

      const result = await this.makeRequest(endpoint, { params });

      return {
        ...result,
        dataType: 'covid-19',
        scope: scope,
        historical: historical
      };

    } catch (error) {
      console.error('Error fetching COVID data:', error);
      return {
        success: false,
        error: error.message,
        dataType: 'covid-19'
      };
    }
  }

  async getInfluenzaData(options = {}) {
    const {
      scope = 'global',
      country = null
    } = options;

    try {
      let endpoint = this.endpoints.influenza.global;

      if (scope === 'countries') {
        endpoint = this.endpoints.influenza.countries;
      } else if (scope === 'country' && country) {
        endpoint = `${this.endpoints.influenza.countries}/${country}`;
      }

      const result = await this.makeRequest(endpoint);

      return {
        ...result,
        dataType: 'influenza',
        scope: scope
      };

    } catch (error) {
      console.error('Error fetching influenza data:', error);
      return {
        success: false,
        error: error.message,
        dataType: 'influenza'
      };
    }
  }

  async getVaccineData(options = {}) {
    const {
      scope = 'global',
      country = null
    } = options;

    try {
      let endpoint = this.endpoints.covid.vaccines;

      if (scope === 'countries') {
        endpoint += '/coverage/countries';
      } else if (scope === 'country' && country) {
        endpoint += `/coverage/countries/${country}`;
      }

      const result = await this.makeRequest(endpoint);

      return {
        ...result,
        dataType: 'vaccines',
        scope: scope
      };

    } catch (error) {
      console.error('Error fetching vaccine data:', error);
      return {
        success: false,
        error: error.message,
        dataType: 'vaccines'
      };
    }
  }

  async getGeneralDiseaseInfo() {
    try {
      const result = await this.makeRequest(this.endpoints.general.diseases);

      return {
        ...result,
        dataType: 'disease-list'
      };

    } catch (error) {
      console.error('Error fetching disease list:', error);
      return {
        success: false,
        error: error.message,
        dataType: 'disease-list'
      };
    }
  }

  async getTherapeutics(options = {}) {
    try {
      const result = await this.makeRequest(this.endpoints.general.therapeutics);

      return {
        ...result,
        dataType: 'therapeutics'
      };

    } catch (error) {
      console.error('Error fetching therapeutics:', error);
      return {
        success: false,
        error: error.message,
        dataType: 'therapeutics'
      };
    }
  }

  async searchCountries(query) {
    try {
      const countries = await this.makeRequest(this.endpoints.covid.countries);

      if (!countries.success || !countries.data) {
        return { success: false, error: 'Failed to fetch countries list' };
      }

      const filtered = countries.data.filter(country =>
        country.country.toLowerCase().includes(query.toLowerCase()) ||
        country.countryInfo.iso2?.toLowerCase() === query.toLowerCase() ||
        country.countryInfo.iso3?.toLowerCase() === query.toLowerCase()
      );

      return {
        success: true,
        data: filtered,
        query: query,
        resultCount: filtered.length
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getServiceStatus() {
    try {
      // Test basic connectivity
      const testResult = await this.makeRequest(this.endpoints.covid.global, {
        useCache: false
      });

      return {
        status: testResult.success ? 'operational' : 'degraded',
        lastChecked: new Date().toISOString(),
        endpoints: {
          covid: testResult.success,
          influenza: true, // Assume working if COVID works
          general: true
        },
        cache: {
          size: this.cache.size,
          hitRate: this.calculateCacheHitRate()
        },
        rateLimit: {
          lastRequest: this.lastRequestTime,
          minInterval: this.minRequestInterval
        }
      };

    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        lastChecked: new Date().toISOString()
      };
    }
  }

  calculateCacheHitRate() {
    // Simple cache hit rate calculation
    // In a production system, you'd track hits/misses over time
    return this.cache.size > 0 ? 0.8 : 0; // Placeholder
  }

  clearCache() {
    this.cache.clear();
    return {
      success: true,
      message: 'Cache cleared',
      timestamp: new Date().toISOString()
    };
  }

  setCacheExpiry(milliseconds) {
    this.cacheExpiry = milliseconds;
    return {
      success: true,
      newExpiry: milliseconds,
      message: `Cache expiry set to ${milliseconds}ms`
    };
  }

  async getAvailableEndpoints() {
    return {
      covid: {
        description: 'COVID-19 pandemic data',
        endpoints: Object.keys(this.endpoints.covid),
        features: ['global', 'country-level', 'state-level', 'historical', 'vaccines']
      },
      influenza: {
        description: 'Influenza outbreak data',
        endpoints: Object.keys(this.endpoints.influenza),
        features: ['global', 'country-level']
      },
      general: {
        description: 'General disease information and therapeutics',
        endpoints: Object.keys(this.endpoints.general),
        features: ['disease-list', 'therapeutics']
      }
    };
  }

  async getSupportedCountries() {
    try {
      const result = await this.getCOVIDData({ scope: 'countries' });

      if (!result.success) {
        return { success: false, error: result.error };
      }

      const countries = result.data.map(country => ({
        name: country.country,
        iso2: country.countryInfo.iso2,
        iso3: country.countryInfo.iso3,
        flag: country.countryInfo.flag,
        population: country.population
      }));

      return {
        success: true,
        countries: countries,
        count: countries.length
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }


  async getTuberculosisData(options = {}) {
    const { scope = 'global', country = null } = options;

    try {
      let endpoint = this.endpoints.tuberculosis.global;
      if (scope === 'country' && country) {
        endpoint = `${this.endpoints.tuberculosis.countries}/${country}`;
      } else if (scope === 'countries') {
        endpoint = this.endpoints.tuberculosis.countries;
      }

      const result = await this.makeRequest(endpoint);
      return {
        ...result,
        dataType: 'tuberculosis',
        scope: scope
      };

    } catch (error) {
      console.error('Error fetching tuberculosis data:', error);
      return {
        success: false,
        error: error.message,
        dataType: 'tuberculosis'
      };
    }
  }

  async getHIVData(options = {}) {
    const { scope = 'global', country = null } = options;

    try {
      let endpoint = this.endpoints.hiv.global;
      if (scope === 'country' && country) {
        endpoint = `${this.endpoints.hiv.countries}/${country}`;
      } else if (scope === 'countries') {
        endpoint = this.endpoints.hiv.countries;
      }

      const result = await this.makeRequest(endpoint);
      return {
        ...result,
        dataType: 'hiv',
        scope: scope
      };

    } catch (error) {
      console.error('Error fetching HIV data:', error);
      return {
        success: false,
        error: error.message,
        dataType: 'hiv'
      };
    }
  }
}

module.exports = DiseaseApiService;