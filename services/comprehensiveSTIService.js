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

    // Smart Cache configuration with invalidation
    this.cache = new Map();
    this.cacheMetadata = new Map(); // Store ETags, Last-Modified, etc.
    this.cacheExpiry = {
      critical: 1000 * 60 * 5,      // 5 minutes (outbreaks, critical updates)
      realtime: 1000 * 60 * 10,     // 10 minutes (active surveillance)
      hourly: 1000 * 60 * 60,       // 1 hour (general disease data)
      daily: 1000 * 60 * 60 * 6,    // 6 hours (historical trends) - reduced from 24h
      weekly: 1000 * 60 * 60 * 24 * 2 // 2 days (static data) - reduced from 7d
    };

    // Smart cache tiers based on disease criticality
    this.cacheTiers = {
      critical: ['covid', 'influenza', 'ebola', 'sars', 'mers'],
      realtime: ['hiv', 'aids', 'tuberculosis', 'hepatitis'],
      hourly: ['chlamydia', 'gonorrhea', 'syphilis', 'herpes'],
      daily: ['hpv', 'hsv1', 'hsv2'],
      weekly: ['historical', 'demographics']
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
    await this.initFetch();
    
    try {
      // Try CDC surveillance data first
      if (this.cdcService) {
        const cdcData = await this.cdcService.querySTDData({
          disease: disease,
          year: this.timeframeToYear(options.timeframe),
          state: options.region,
          aggregateBy: 'state'
        });

        if (cdcData && cdcData.success) {
          return {
            source: 'CDC NNDSS',
            data: cdcData.data || [],
            metadata: {
              lastUpdated: cdcData.timestamp,
              recordCount: cdcData.totalRecords || 0,
              dataQuality: 'high'
            }
          };
        }
      }
      
      // For HIV/AIDS, try CDC data.gov API directly
      if (['hiv', 'aids'].includes(disease)) {
        return await this.fetchCDCHIVData(disease, options);
      }
      
      // For other STIs, try CDC STI surveillance
      if (['chlamydia', 'gonorrhea', 'syphilis'].includes(disease)) {
        return await this.fetchCDCSTIData(disease, options);
      }
      
      return null;
      
    } catch (error) {
      console.warn(`CDC data fetch failed for ${disease}:`, error.message);
      return null;
    }
  }
  
  async fetchCDCHIVData(disease, options) {
    try {
      // CDC HIV Surveillance data
      const hivApiUrl = 'https://data.cdc.gov/resource/bvek-hz5s.json'; // HIV surveillance
      const year = this.timeframeToYear(options.timeframe);
      
      let url = hivApiUrl + `?$limit=1000`;
      if (year && year !== 'all') {
        url += `&year=${year}`;
      }
      if (options.region && options.region !== 'all') {
        url += `&geography=${options.region.toUpperCase()}`;
      }
      
      const response = await this.fetch(url, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Disease Tracking Application (disease.zone)',
          'Accept': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        return {
          source: 'CDC HIV Surveillance',
          data: this.transformCDCHIVData(data, disease),
          metadata: {
            lastUpdated: new Date().toISOString(),
            dataSource: 'CDC HIV Surveillance Reports',
            recordCount: data.length,
            dataQuality: 'high',
            coverage: 'US jurisdictions',
            note: 'Real CDC HIV surveillance data'
          }
        };
      }
      
      return null;
    } catch (error) {
      console.warn(`CDC HIV API error:`, error.message);
      return null;
    }
  }
  
  async fetchCDCSTIData(disease, options) {
    try {
      // CDC STI surveillance data from data.gov
      const stiMapping = {
        chlamydia: 'https://data.cdc.gov/resource/fd7s-kh8x.json',
        gonorrhea: 'https://data.cdc.gov/resource/rddt-jvpf.json',
        syphilis: 'https://data.cdc.gov/resource/9w4f-bqzz.json'
      };
      
      const apiUrl = stiMapping[disease];
      if (!apiUrl) return null;
      
      const year = this.timeframeToYear(options.timeframe);
      let url = apiUrl + `?$limit=1000`;
      if (year && year !== 'all') {
        url += `&year=${year}`;
      }
      
      const response = await this.fetch(url, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Disease Tracking Application (disease.zone)',
          'Accept': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        return {
          source: `CDC ${disease.charAt(0).toUpperCase() + disease.slice(1)} Surveillance`,
          data: this.transformCDCSTIData(data, disease),
          metadata: {
            lastUpdated: new Date().toISOString(),
            dataSource: 'CDC STI Surveillance Reports',
            recordCount: data.length,
            dataQuality: 'high',
            coverage: 'US jurisdictions',
            note: `Real CDC ${disease} surveillance data`
          }
        };
      }
      
      return null;
    } catch (error) {
      console.warn(`CDC STI API error for ${disease}:`, error.message);
      return null;
    }
  }
  
  transformCDCHIVData(cdcData, disease) {
    return cdcData.map(item => ({
      disease: disease,
      region: item.geography || item.state || 'Unknown',
      cases: parseInt(item.cases) || parseInt(item.diagnoses) || 0,
      rate: parseFloat(item.rate) || 0,
      year: item.year || new Date().getFullYear(),
      demographic: item.population_group || 'all',
      data_type: 'surveillance'
    }));
  }
  
  transformCDCSTIData(cdcData, disease) {
    return cdcData.map(item => ({
      disease: disease,
      region: item.state || item.geography || 'Unknown',
      cases: parseInt(item.cases) || parseInt(item.count) || 0,
      rate: parseFloat(item.rate) || parseFloat(item.rate_per_100000) || 0,
      year: item.year || new Date().getFullYear(),
      data_type: 'surveillance'
    }));
  }

  async fetchFromDiseaseAPI(disease, options) {
    await this.initFetch();

    try {
      // Map disease names to disease.sh endpoints
      const diseaseMapping = {
        'covid': 'covid-19',
        'influenza': 'influenza', 
        'tuberculosis': 'tuberculosis',
        // STIs - disease.sh may not have direct STI data but we can try
        'hiv': 'hiv',
        'aids': 'hiv' // Map AIDS to HIV endpoint
      };

      const apiDisease = diseaseMapping[disease];
      
      // Skip STIs that disease.sh doesn't support
      if (['chlamydia', 'gonorrhea', 'syphilis', 'herpes', 'hsv1', 'hsv2', 'hpv'].includes(disease)) {
        // Return null - these will be handled by CDC APIs
        return null;
      }
      
      if (!apiDisease) {
        return null; // Disease not supported by disease.sh
      }

      let url = `${this.diseaseShService.baseURL}/${apiDisease}`;

      // Add region filtering if specified
      if (options.region !== 'all' && options.region !== 'global') {
        url += `/countries/${options.region}`;
      } else {
        url += '/all';
      }

      // Smart caching with conditional requests
      const cacheKey = `${disease}_${options.region || 'all'}`;
      const cachedMeta = this.cacheMetadata.get(cacheKey);
      const headers = {
        'User-Agent': 'Disease Tracking Application (disease.zone)',
        'Accept': 'application/json'
      };

      // Add conditional headers if we have cached metadata
      if (cachedMeta) {
        if (cachedMeta.etag) headers['If-None-Match'] = cachedMeta.etag;
        if (cachedMeta.lastModified) headers['If-Modified-Since'] = cachedMeta.lastModified;
      }

      const response = await this.fetch(url, {
        timeout: 10000,
        headers
      });

      if (!response.ok) {
        if (response.status === 304) {
          // Not modified - return cached data
          const cached = this.cache.get(cacheKey);
          if (cached) {
            console.log(`📋 Cache hit (304): ${cacheKey}`);
            return cached;
          }
        }
        if (response.status === 404) {
          return null; // Endpoint doesn't exist
        }
        throw new Error(`Disease API error: ${response.status}`);
      }

      // Store response metadata for future conditional requests
      const etag = response.headers.get('etag');
      const lastModified = response.headers.get('last-modified');
      if (etag || lastModified) {
        this.cacheMetadata.set(cacheKey, { etag, lastModified, updated: Date.now() });
      }

      const data = await response.json();

      // Transform disease.sh data to our standard format
      const transformedData = this.transformDiseaseShData(data, disease, options.region);

      return {
        source: 'disease.sh',
        data: transformedData,
        metadata: {
          lastUpdated: data.updated || new Date().toISOString(),
          dataQuality: 'high',
          realtime: true,
          endpoint: url
        }
      };

    } catch (error) {
      // If disease.sh doesn't support this disease, return null instead of throwing
      if (error.message.includes('404') || error.message.includes('Disease API error: 404')) {
        console.log(`Disease.sh does not support ${disease}, skipping...`);
        return null;
      }
      console.warn(`Disease.sh API error for ${disease}:`, error.message);
      return null;
    }
  }
  
  transformDiseaseShData(data, disease, region) {
    // Transform disease.sh format to our internal format
    if (Array.isArray(data)) {
      return data.map(item => ({
        disease: disease,
        region: item.country || region || 'global',
        cases: item.cases || 0,
        deaths: item.deaths || 0,
        recovered: item.recovered || 0,
        active: item.active || 0,
        population: item.population || 0,
        updated: item.updated || new Date().toISOString()
      }));
    } else {
      return [{
        disease: disease,
        region: data.country || region || 'global', 
        cases: data.cases || 0,
        deaths: data.deaths || 0,
        recovered: data.recovered || 0,
        active: data.active || 0,
        population: data.population || 0,
        updated: data.updated || new Date().toISOString()
      }];
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

  /**
   * Determine appropriate cache tier for a disease
   */
  getCacheTier(disease) {
    for (const [tier, diseases] of Object.entries(this.cacheTiers)) {
      if (diseases.includes(disease.toLowerCase())) {
        return tier;
      }
    }
    return 'hourly'; // Default tier
  }

  /**
   * Check if cached data should be refreshed based on smart invalidation
   */
  shouldRefreshCache(cacheKey, disease) {
    const cached = this.cache.get(cacheKey);
    if (!cached) return true;

    const tier = this.getCacheTier(disease);
    const maxAge = this.cacheExpiry[tier];
    const age = Date.now() - cached.timestamp;

    // Always refresh if expired
    if (age > maxAge) return true;

    // For critical diseases, also check if we have fresh metadata
    if (tier === 'critical') {
      const meta = this.cacheMetadata.get(cacheKey);
      if (!meta || (Date.now() - meta.updated) > this.cacheExpiry.critical) {
        return true;
      }
    }

    return false;
  }

  /**
   * Intelligent cache invalidation - refreshes only changed data
   */
  async refreshCacheSelectively(diseases = []) {
    const refreshPromises = [];
    
    for (const disease of diseases) {
      const cacheKey = `${disease}_all`;
      if (this.shouldRefreshCache(cacheKey, disease)) {
        console.log(`🔄 Selective refresh: ${disease}`);
        refreshPromises.push(
          this.fetchDiseaseData(disease, { region: 'all', forceRefresh: true })
        );
      }
    }

    if (refreshPromises.length > 0) {
      await Promise.allSettled(refreshPromises);
      console.log(`✅ Selective refresh completed for ${refreshPromises.length} diseases`);
    }
  }

  /**
   * Get cache status for monitoring
   */
  getCacheStatus() {
    const cacheStats = {
      totalEntries: this.cache.size,
      metadataEntries: this.cacheMetadata.size,
      tiers: {}
    };

    // Count entries by tier
    for (const [key] of this.cache) {
      const disease = key.split('_')[0];
      const tier = this.getCacheTier(disease);
      cacheStats.tiers[tier] = (cacheStats.tiers[tier] || 0) + 1;
    }

    return cacheStats;
  }
}

module.exports = ComprehensiveSTIService;