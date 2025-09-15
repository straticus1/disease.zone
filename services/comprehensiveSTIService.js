class ComprehensiveSTIService {
  constructor() {
    this.fetch = null;
    this.initFetch();

    // Load API keys from environment
    this.apiKeys = {
      cdc: process.env.CDC_API_KEY || null,
      diseaseApi: process.env.DISEASE_API_KEY || null
    };

    // Access levels based on available API keys
    this.accessLevel = this.determineAccessLevel();

    // Initialize sub-services
    this.cdcService = null;
    this.stdService = null;
    this.diseaseShService = null;
    this.initServices();

    // Rate limiting configuration - generous defaults with disease.sh
    this.rateLimits = {
      standard: { requestsPerMinute: 100, maxConcurrent: 5 }, // disease.sh is generous
      enhanced: { requestsPerMinute: 200, maxConcurrent: 8 }, // with CDC key
      premium: { requestsPerMinute: 500, maxConcurrent: 15 }  // with multiple keys
    };

    this.currentRateLimit = this.rateLimits[this.accessLevel];

    // Cache configuration
    this.cache = new Map();
    this.cacheExpiry = {
      realtime: 1000 * 60 * 15, // 15 minutes
      daily: 1000 * 60 * 60 * 24, // 24 hours
      weekly: 1000 * 60 * 60 * 24 * 7 // 7 days
    };

    // Disease configuration - disease.sh prioritized as default
    this.supportedDiseases = {
      hiv: {
        sources: ['disease.sh', 'cdc', 'who'],
        dataTypes: ['surveillance', 'prevalence', 'mortality'],
        realtime: true
      },
      aids: {
        sources: ['disease.sh', 'cdc', 'who'],
        dataTypes: ['surveillance', 'mortality'],
        realtime: true
      },
      covid: {
        sources: ['disease.sh'],
        dataTypes: ['surveillance', 'cases', 'deaths', 'vaccines'],
        realtime: true
      },
      influenza: {
        sources: ['disease.sh', 'cdc'],
        dataTypes: ['surveillance', 'outbreaks'],
        realtime: true
      },
      tuberculosis: {
        sources: ['disease.sh', 'cdc'],
        dataTypes: ['surveillance', 'global'],
        realtime: true
      },
      herpes: {
        sources: ['nhanes', 'cdc'],
        dataTypes: ['prevalence', 'demographic'],
        realtime: false
      },
      hsv1: {
        sources: ['nhanes', 'cdc'],
        dataTypes: ['prevalence', 'demographic'],
        realtime: false
      },
      hsv2: {
        sources: ['nhanes', 'cdc'],
        dataTypes: ['prevalence', 'demographic'],
        realtime: false
      },
      hpv: {
        sources: ['hpv-impact', 'cdc'],
        dataTypes: ['surveillance', 'vaccination', 'cancer'],
        realtime: true
      },
      syphilis: {
        sources: ['disease.sh', 'cdc'],
        dataTypes: ['surveillance', 'incidence'],
        realtime: true
      },
      gonorrhea: {
        sources: ['disease.sh', 'cdc'],
        dataTypes: ['surveillance', 'incidence'],
        realtime: true
      },
      chlamydia: {
        sources: ['disease.sh', 'cdc'],
        dataTypes: ['surveillance', 'incidence'],
        realtime: true
      }
    };
  }

  async initFetch() {
    if (!this.fetch) {
      const { default: fetch } = await import('node-fetch');
      this.fetch = fetch;
    }
  }

  determineAccessLevel() {
    const keyCount = Object.values(this.apiKeys).filter(key => key).length;

    if (keyCount >= 2) return 'premium';
    if (keyCount === 1) return 'enhanced';
    return 'standard'; // disease.sh provides excellent default access without keys
  }

  async initServices() {
    try {
      const CDCDataService = require('./cdcDataService');
      const STDService = require('./stdService');

      this.cdcService = new CDCDataService();
      this.stdService = new STDService();

      // Initialize disease.sh service
      this.diseaseShService = {
        baseURL: 'https://disease.sh/v3',
        fetch: this.fetch
      };

    } catch (error) {
      console.error('Error initializing sub-services:', error);
    }
  }

  async queryDiseaseData(options = {}) {
    await this.initFetch();

    const {
      diseases = ['all'],
      region = 'all',
      timeframe = 'current',
      sources = 'auto',
      dataTypes = ['surveillance'],
      includeMetadata = true
    } = options;

    try {
      const results = {
        success: true,
        data: {},
        metadata: {
          accessLevel: this.accessLevel,
          sources: [],
          timestamp: new Date().toISOString(),
          coverage: {}
        }
      };

      // Process each requested disease
      const diseaseList = diseases.includes('all') ? Object.keys(this.supportedDiseases) : diseases;

      for (const disease of diseaseList) {
        if (!this.supportedDiseases[disease]) {
          console.warn(`Unsupported disease: ${disease}`);
          continue;
        }

        const diseaseConfig = this.supportedDiseases[disease];
        const availableSources = this.getAvailableSources(diseaseConfig.sources, sources);

        results.data[disease] = await this.fetchDiseaseFromSources(
          disease,
          availableSources,
          { region, timeframe, dataTypes }
        );

        results.metadata.coverage[disease] = {
          sources: availableSources,
          dataTypes: diseaseConfig.dataTypes,
          realtime: diseaseConfig.realtime
        };
      }

      // Cache results
      const cacheKey = this.generateCacheKey(options);
      const cacheType = this.determineCacheType(timeframe);
      this.cache.set(cacheKey, {
        data: results,
        timestamp: Date.now(),
        expiry: this.cacheExpiry[cacheType]
      });

      return results;

    } catch (error) {
      console.error('Error querying disease data:', error);
      return {
        success: false,
        error: error.message,
        data: {},
        accessLevel: this.accessLevel
      };
    }
  }

  getAvailableSources(diseaseSources, requestedSources) {
    if (requestedSources === 'auto') {
      // Auto-select based on access level - disease.sh first, then enhanced sources
      const prioritySources = this.accessLevel === 'premium'
        ? ['disease.sh', 'cdc', 'who', 'nhanes', 'hpv-impact']
        : this.accessLevel === 'enhanced'
        ? ['disease.sh', 'cdc', 'nhanes', 'hpv-impact']
        : ['disease.sh', 'nhanes']; // Even without keys, include NHANES for herpes data

      return diseaseSources.filter(source => prioritySources.includes(source));
    }

    if (Array.isArray(requestedSources)) {
      return diseaseSources.filter(source => requestedSources.includes(source));
    }

    return diseaseSources.includes(requestedSources) ? [requestedSources] : [];
  }

  async fetchDiseaseFromSources(disease, sources, options) {
    const results = {
      sources: {},
      aggregated: null,
      confidence: 'low'
    };

    // Fetch from each available source
    for (const source of sources) {
      try {
        let sourceData = null;

        switch (source) {
          case 'cdc':
            sourceData = await this.fetchFromCDC(disease, options);
            break;
          case 'disease.sh':
            sourceData = await this.fetchFromDiseaseAPI(disease, options);
            break;
          case 'who':
            sourceData = await this.fetchFromWHO(disease, options);
            break;
          case 'nhanes':
            sourceData = await this.fetchFromNHANES(disease, options);
            break;
          case 'hpv-impact':
            sourceData = await this.fetchFromHPVImpact(disease, options);
            break;
        }

        if (sourceData) {
          results.sources[source] = sourceData;
        }

      } catch (error) {
        console.error(`Error fetching ${disease} from ${source}:`, error);
        results.sources[source] = { error: error.message };
      }
    }

    // Aggregate data from multiple sources
    results.aggregated = this.aggregateSourceData(results.sources);
    results.confidence = this.calculateConfidence(results.sources);

    return results;
  }

  async fetchFromCDC(disease, options) {
    if (!this.cdcService) return null;

    try {
      const cdcData = await this.cdcService.querySTDData({
        disease: disease,
        year: this.timeframeToYear(options.timeframe),
        state: options.region,
        aggregateBy: 'state'
      });

      return {
        source: 'CDC NNDSS',
        data: cdcData.data || [],
        metadata: {
          lastUpdated: cdcData.timestamp,
          recordCount: cdcData.totalRecords || 0,
          dataQuality: 'high'
        }
      };
    } catch (error) {
      throw new Error(`CDC data fetch failed: ${error.message}`);
    }
  }

  async fetchFromDiseaseAPI(disease, options) {
    await this.initFetch();

    try {
      // Map disease names to disease.sh endpoints
      const diseaseMapping = {
        'covid': 'covid-19',
        'influenza': 'influenza',
        'tuberculosis': 'tuberculosis'
      };

      const apiDisease = diseaseMapping[disease] || disease;
      let url = `${this.diseaseShService.baseURL}/${apiDisease}`;

      // Add region filtering if specified
      if (options.region !== 'all') {
        url += `/countries/${options.region}`;
      } else {
        url += '/all';
      }

      const response = await this.fetch(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Disease Tracking Application'
        }
      });

      if (!response.ok) {
        throw new Error(`Disease API error: ${response.status}`);
      }

      const data = await response.json();

      return {
        source: 'disease.sh',
        data: Array.isArray(data) ? data : [data],
        metadata: {
          lastUpdated: data.updated || new Date().toISOString(),
          dataQuality: 'medium',
          realtime: true
        }
      };

    } catch (error) {
      // If disease.sh doesn't support this disease, return null instead of throwing
      if (error.message.includes('404') || error.message.includes('Disease API error: 404')) {
        return null;
      }
      throw error;
    }
  }

  async fetchFromWHO(disease, options) {
    // WHO Global Health Observatory API integration
    // Note: WHO is transitioning APIs, this is a placeholder for future implementation
    return {
      source: 'WHO GHO',
      data: [],
      metadata: {
        note: 'WHO API integration pending - API transition in progress',
        dataQuality: 'high'
      }
    };
  }

  async fetchFromNHANES(disease, options) {
    // NHANES data integration for prevalence studies (Herpes, HPV)
    if (!['herpes', 'hsv1', 'hsv2', 'hpv'].includes(disease)) {
      return null;
    }

    return {
      source: 'NHANES',
      data: [],
      metadata: {
        note: 'NHANES prevalence data - requires specific dataset integration',
        dataQuality: 'high',
        dataType: 'prevalence'
      }
    };
  }

  async fetchFromHPVImpact(disease, options) {
    // HPV-IMPACT surveillance network data
    if (disease !== 'hpv') return null;

    return {
      source: 'HPV-IMPACT',
      data: [],
      metadata: {
        note: 'HPV-IMPACT surveillance data - requires CDC partnership',
        dataQuality: 'high',
        coverage: '5 US sites'
      }
    };
  }

  aggregateSourceData(sources) {
    const validSources = Object.values(sources).filter(s => s && !s.error && s.data);

    if (validSources.length === 0) return null;

    // Simple aggregation strategy - can be enhanced
    const aggregated = {
      totalCases: 0,
      regions: new Set(),
      lastUpdated: null,
      sources: validSources.map(s => s.source)
    };

    validSources.forEach(source => {
      if (source.data && Array.isArray(source.data)) {
        source.data.forEach(item => {
          if (item.cases || item.totalCases) {
            aggregated.totalCases += (item.cases || item.totalCases || 0);
          }
          if (item.area || item.region || item.country) {
            aggregated.regions.add(item.area || item.region || item.country);
          }
        });
      }

      // Track most recent update
      const sourceUpdate = source.metadata?.lastUpdated;
      if (sourceUpdate && (!aggregated.lastUpdated || sourceUpdate > aggregated.lastUpdated)) {
        aggregated.lastUpdated = sourceUpdate;
      }
    });

    aggregated.regions = Array.from(aggregated.regions);
    return aggregated;
  }

  calculateConfidence(sources) {
    const validSources = Object.values(sources).filter(s => s && !s.error);
    const highQualitySources = validSources.filter(s => s.metadata?.dataQuality === 'high');

    if (highQualitySources.length >= 2) return 'high';
    if (validSources.length >= 2) return 'medium';
    if (validSources.length === 1) return 'low';
    return 'none';
  }

  timeframeToYear(timeframe) {
    const currentYear = new Date().getFullYear();

    switch (timeframe) {
      case 'current': return currentYear.toString();
      case 'previous': return (currentYear - 1).toString();
      case 'last5years': return 'all'; // Will need special handling
      default: return timeframe; // Assume it's already a year
    }
  }

  determineCacheType(timeframe) {
    if (['current', 'realtime'].includes(timeframe)) return 'realtime';
    if (['daily', 'week'].includes(timeframe)) return 'daily';
    return 'weekly';
  }

  generateCacheKey(options) {
    return JSON.stringify(options);
  }

  async getServiceStatus() {
    return {
      accessLevel: this.accessLevel,
      apiKeys: {
        cdc: !!this.apiKeys.cdc,
        diseaseApi: !!this.apiKeys.diseaseApi
      },
      services: {
        cdc: !!this.cdcService,
        std: !!this.stdService,
        diseaseApi: true
      },
      supportedDiseases: Object.keys(this.supportedDiseases),
      rateLimits: this.currentRateLimit,
      cacheSize: this.cache.size
    };
  }

  async getDiseaseInfo(disease) {
    if (!this.supportedDiseases[disease]) {
      throw new Error(`Unsupported disease: ${disease}`);
    }

    return {
      disease: disease,
      config: this.supportedDiseases[disease],
      availableSources: this.getAvailableSources(
        this.supportedDiseases[disease].sources,
        'auto'
      ),
      dataTypes: this.supportedDiseases[disease].dataTypes,
      realtime: this.supportedDiseases[disease].realtime
    };
  }

  async getAvailableRegions(disease) {
    // Return available regions based on disease and access level
    const baseRegions = ['US', 'Global'];
    const detailedRegions = [
      'US-AL', 'US-AK', 'US-AZ', 'US-AR', 'US-CA', 'US-CO', 'US-CT', 'US-DE',
      'US-FL', 'US-GA', 'US-HI', 'US-ID', 'US-IL', 'US-IN', 'US-IA', 'US-KS',
      'US-KY', 'US-LA', 'US-ME', 'US-MD', 'US-MA', 'US-MI', 'US-MN', 'US-MS',
      'US-MO', 'US-MT', 'US-NE', 'US-NV', 'US-NH', 'US-NJ', 'US-NM', 'US-NY',
      'US-NC', 'US-ND', 'US-OH', 'US-OK', 'US-OR', 'US-PA', 'US-RI', 'US-SC',
      'US-SD', 'US-TN', 'US-TX', 'US-UT', 'US-VT', 'US-VA', 'US-WA', 'US-WV',
      'US-WI', 'US-WY'
    ];

    return this.accessLevel === 'premium' ? detailedRegions : baseRegions;
  }
}

module.exports = ComprehensiveSTIService;