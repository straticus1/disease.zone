class GlobalHealthOrchestrator {
  constructor() {
    this.fetch = null;
    this.initFetch();

    // Load all API keys and configurations
    this.apiKeys = {
      cdc: process.env.CDC_API_KEY || null,
      who: process.env.WHO_API_KEY || null,
      california: process.env.CALIFORNIA_API_KEY || null,
      newYork: process.env.NEW_YORK_API_KEY || null,
      healthMap: process.env.HEALTHMAP_API_KEY || null,
      gisaid: process.env.GISAID_API_KEY || null,
      ecdc: process.env.ECDC_API_KEY || null,
      fda: process.env.FDA_API_KEY || null
    };

    // Data source configurations with capabilities
    this.dataSources = {
      // Global Organizations
      who: {
        name: 'WHO Global Health Observatory',
        baseURL: 'https://ghoapi.azureedge.net/api',
        capabilities: ['global', 'hiv', 'tb', 'malaria', 'ncd', 'mortality'],
        coverage: 'global',
        dataQuality: 'high',
        updateFrequency: 'monthly',
        priority: 1
      },
      ecdc: {
        name: 'European Centre for Disease Prevention and Control',
        baseURL: 'https://www.ecdc.europa.eu/sites/default/files/data',
        capabilities: ['surveillance', 'outbreaks', 'antimicrobial_resistance'],
        coverage: 'europe',
        dataQuality: 'high',
        updateFrequency: 'weekly',
        priority: 2
      },
      paho: {
        name: 'Pan American Health Organization',
        baseURL: 'https://www.paho.org/data/index.php/en',
        capabilities: ['americas', 'surveillance', 'outbreaks'],
        coverage: 'americas',
        dataQuality: 'high',
        updateFrequency: 'weekly',
        priority: 2
      },

      // US Federal
      cdc: {
        name: 'CDC Data.gov',
        baseURL: 'https://data.cdc.gov/api/views',
        capabilities: ['surveillance', 'sti', 'hiv', 'vaccines', 'mortality'],
        coverage: 'usa',
        dataQuality: 'very_high',
        updateFrequency: 'weekly',
        priority: 1
      },
      fdaOpenFDA: {
        name: 'FDA OpenFDA',
        baseURL: 'https://api.fda.gov',
        capabilities: ['adverse_events', 'drug_safety', 'vaccine_safety'],
        coverage: 'usa',
        dataQuality: 'high',
        updateFrequency: 'daily',
        priority: 3
      },
      cmsData: {
        name: 'CMS Data',
        baseURL: 'https://data.cms.gov/api/1',
        capabilities: ['healthcare_utilization', 'outcomes', 'demographics'],
        coverage: 'usa',
        dataQuality: 'high',
        updateFrequency: 'quarterly',
        priority: 4
      },

      // US States
      california: {
        name: 'California Health and Human Services',
        baseURL: 'https://data.chhs.ca.gov/api/3/action',
        capabilities: ['sti', 'communicable_diseases', 'hospital_data'],
        coverage: 'california',
        dataQuality: 'high',
        updateFrequency: 'weekly',
        priority: 2
      },
      newYork: {
        name: 'New York Health Data',
        baseURL: 'https://health.data.ny.gov/api/views',
        capabilities: ['hiv', 'sti', 'communicable_diseases'],
        coverage: 'new_york',
        dataQuality: 'high',
        updateFrequency: 'weekly',
        priority: 2
      },
      texas: {
        name: 'Texas Department of State Health Services',
        baseURL: 'https://dshs.texas.gov/data/api',
        capabilities: ['notifiable_conditions', 'sti'],
        coverage: 'texas',
        dataQuality: 'medium',
        updateFrequency: 'monthly',
        priority: 3
      },

      // Research & Academic
      ourWorldInData: {
        name: 'Our World in Data',
        baseURL: 'https://raw.githubusercontent.com/owid',
        capabilities: ['covid', 'vaccines', 'global_health', 'demographics'],
        coverage: 'global',
        dataQuality: 'very_high',
        updateFrequency: 'daily',
        priority: 1
      },
      healthMap: {
        name: 'HealthMap Outbreak Detection',
        baseURL: 'https://healthmap.org/HMapi.php',
        capabilities: ['outbreak_detection', 'disease_intelligence', 'news_monitoring'],
        coverage: 'global',
        dataQuality: 'medium',
        updateFrequency: 'real_time',
        priority: 2
      },
      gisaid: {
        name: 'GISAID Viral Surveillance',
        baseURL: 'https://www.epicov.org/epi3/api',
        capabilities: ['viral_genomics', 'mutations', 'lineages'],
        coverage: 'global',
        dataQuality: 'very_high',
        updateFrequency: 'daily',
        priority: 1
      },
      proMED: {
        name: 'ProMED Disease Intelligence',
        baseURL: 'https://promedmail.org/api',
        capabilities: ['outbreak_reports', 'expert_analysis', 'early_warning'],
        coverage: 'global',
        dataQuality: 'high',
        updateFrequency: 'real_time',
        priority: 2
      },

      // Existing integrations
      diseaseApi: {
        name: 'disease.sh',
        baseURL: 'https://disease.sh/v3',
        capabilities: ['covid', 'influenza', 'global'],
        coverage: 'global',
        dataQuality: 'high',
        updateFrequency: 'daily',
        priority: 1
      }
    };

    // Disease-specific source mapping
    this.diseaseSourceMap = {
      hiv: ['cdc', 'who', 'california', 'newYork', 'ourWorldInData'],
      aids: ['cdc', 'who', 'california', 'newYork'],
      covid: ['diseaseApi', 'ourWorldInData', 'ecdc', 'healthMap'],
      influenza: ['diseaseApi', 'cdc', 'ecdc', 'healthMap', 'gisaid'],
      tuberculosis: ['who', 'cdc', 'ecdc', 'ourWorldInData'],
      syphilis: ['cdc', 'california', 'newYork', 'texas'],
      gonorrhea: ['cdc', 'california', 'newYork', 'texas'],
      chlamydia: ['cdc', 'california', 'newYork', 'texas'],
      herpes: ['cdc', 'california'],
      hpv: ['cdc', 'california'],
      malaria: ['who', 'ecdc', 'ourWorldInData', 'healthMap'],
      dengue: ['who', 'healthMap', 'proMED'],
      zika: ['who', 'healthMap', 'proMED'],
      ebola: ['who', 'ecdc', 'healthMap', 'proMED'],
      mpox: ['cdc', 'ecdc', 'healthMap', 'proMED'],
      viral_hepatitis: ['cdc', 'who', 'ecdc'],
      antimicrobial_resistance: ['ecdc', 'who', 'cdc']
    };

    // Data fusion algorithms
    this.fusionStrategies = {
      'weighted_average': this.weightedAverageFusion.bind(this),
      'bayesian_fusion': this.bayesianFusion.bind(this),
      'consensus_ranking': this.consensusRanking.bind(this),
      'temporal_alignment': this.temporalAlignment.bind(this),
      'geographic_aggregation': this.geographicAggregation.bind(this)
    };

    // Real-time monitoring
    this.alertThresholds = {
      outbreak_detection: 2.0, // Standard deviations above baseline
      case_increase: 1.5,
      death_increase: 1.2,
      new_variants: 'immediate',
      data_anomalies: 'immediate'
    };

    // Cache and performance
    this.cache = new Map();
    this.requestQueue = [];
    this.isProcessing = false;

    // Initialize services
    this.initializeServices();
  }

  async initFetch() {
    if (!this.fetch) {
      const { default: fetch } = await import('node-fetch');
      this.fetch = fetch;
    }
  }

  async initializeServices() {
    // Initialize all integrated services
    try {
      const ComprehensiveSTIService = require('./comprehensiveSTIService');
      const DiseaseApiService = require('./diseaseApiService');
      const HPVSurveillanceService = require('./hpvSurveillanceService');
      const HerpesHSVService = require('./herpesHSVService');

      this.services = {
        sti: new ComprehensiveSTIService(),
        diseaseApi: new DiseaseApiService(),
        hpv: new HPVSurveillanceService(),
        herpes: new HerpesHSVService()
      };

      console.log('Global Health Orchestrator initialized with all services');
    } catch (error) {
      console.error('Error initializing services:', error);
    }
  }

  async aggregateGlobalData(options = {}) {
    const {
      diseases = ['all'],
      regions = ['global'],
      timeframe = 'current',
      fusionStrategy = 'weighted_average',
      includeOutbreaks = true,
      includeForecasts = true,
      qualityThreshold = 'medium'
    } = options;

    try {
      const startTime = Date.now();
      const results = {
        success: true,
        data: {},
        metadata: {
          sources: [],
          fusionStrategy: fusionStrategy,
          processingTime: 0,
          dataQuality: {},
          coverage: {},
          alerts: []
        }
      };

      // Determine diseases to process
      const targetDiseases = diseases.includes('all')
        ? Object.keys(this.diseaseSourceMap)
        : diseases;

      // Process each disease
      for (const disease of targetDiseases) {
        console.log(`Processing ${disease} data...`);

        const diseaseData = await this.processDiseaseData(
          disease,
          regions,
          timeframe,
          qualityThreshold
        );

        if (diseaseData.sources.length > 0) {
          // Apply data fusion
          const fusedData = await this.fusionStrategies[fusionStrategy](
            diseaseData.sources,
            disease
          );

          results.data[disease] = {
            aggregated: fusedData,
            sources: diseaseData.sources,
            confidence: this.calculateConfidence(diseaseData.sources),
            lastUpdated: new Date().toISOString()
          };

          // Check for alerts
          const alerts = await this.detectAnomalies(disease, fusedData);
          if (alerts.length > 0) {
            results.metadata.alerts.push(...alerts);
          }
        }
      }

      // Add outbreak detection if requested
      if (includeOutbreaks) {
        results.outbreaks = await this.detectGlobalOutbreaks(targetDiseases, regions);
      }

      // Add forecasts if requested
      if (includeForecasts) {
        results.forecasts = await this.generateForecasts(targetDiseases, timeframe);
      }

      // Calculate metadata
      results.metadata.processingTime = Date.now() - startTime;
      results.metadata.sources = this.getUniqueSourcesUsed(results.data);
      results.metadata.coverage = this.calculateGlobalCoverage(results.data);

      return results;

    } catch (error) {
      console.error('Error in global data aggregation:', error);
      return {
        success: false,
        error: error.message,
        data: {},
        metadata: { processingTime: Date.now() - startTime }
      };
    }
  }

  async processDiseaseData(disease, regions, timeframe, qualityThreshold) {
    const availableSources = this.diseaseSourceMap[disease] || [];
    const sourceData = [];

    // Fetch data from all available sources in parallel
    const fetchPromises = availableSources.map(async (sourceName) => {
      try {
        const source = this.dataSources[sourceName];
        if (!source || !this.meetsQualityThreshold(source, qualityThreshold)) {
          return null;
        }

        const data = await this.fetchFromSource(sourceName, disease, regions, timeframe);

        if (data && data.success) {
          return {
            source: sourceName,
            data: data.data,
            metadata: {
              ...data.metadata,
              priority: source.priority,
              quality: source.dataQuality,
              coverage: source.coverage,
              updateFrequency: source.updateFrequency
            }
          };
        }
      } catch (error) {
        console.error(`Error fetching from ${sourceName}:`, error);
        return null;
      }
    });

    const results = await Promise.allSettled(fetchPromises);

    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value) {
        sourceData.push(result.value);
      }
    });

    return { sources: sourceData };
  }

  async fetchFromSource(sourceName, disease, regions, timeframe) {
    const source = this.dataSources[sourceName];

    switch (sourceName) {
      case 'who':
        return await this.fetchFromWHO(disease, regions, timeframe);
      case 'ecdc':
        return await this.fetchFromECDC(disease, regions, timeframe);
      case 'california':
        return await this.fetchFromCalifornia(disease, regions, timeframe);
      case 'newYork':
        return await this.fetchFromNewYork(disease, regions, timeframe);
      case 'ourWorldInData':
        return await this.fetchFromOurWorldInData(disease, regions, timeframe);
      case 'healthMap':
        return await this.fetchFromHealthMap(disease, regions, timeframe);
      case 'gisaid':
        return await this.fetchFromGISAID(disease, regions, timeframe);
      case 'fdaOpenFDA':
        return await this.fetchFromFDA(disease, regions, timeframe);
      case 'cmsData':
        return await this.fetchFromCMS(disease, regions, timeframe);
      case 'proMED':
        return await this.fetchFromProMED(disease, regions, timeframe);
      case 'diseaseApi':
        return await this.services.diseaseApi.getCOVIDData({ scope: 'global' });
      case 'cdc':
        return await this.services.sti.queryDiseaseData({ diseases: [disease] });
      default:
        throw new Error(`Unknown source: ${sourceName}`);
    }
  }

  async fetchFromWHO(disease, regions, timeframe) {
    await this.initFetch();

    const diseaseMapping = {
      'hiv': 'HIV_0000000001',
      'tb': 'TB_1',
      'malaria': 'MALARIA_1'
    };

    const indicatorCode = diseaseMapping[disease];
    if (!indicatorCode) {
      return { success: false, error: `WHO indicator not mapped for ${disease}` };
    }

    try {
      const url = `${this.dataSources.who.baseURL}/${indicatorCode}`;
      const response = await this.fetch(url, {
        timeout: 15000,
        headers: { 'User-Agent': 'Disease Zone Global Aggregator' }
      });

      if (!response.ok) {
        throw new Error(`WHO API error: ${response.status}`);
      }

      const data = await response.json();

      return {
        success: true,
        data: data.value || [],
        metadata: {
          source: 'WHO GHO',
          indicator: indicatorCode,
          lastUpdated: new Date().toISOString()
        }
      };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async fetchFromCalifornia(disease, regions, timeframe) {
    await this.initFetch();

    const datasetMapping = {
      'syphilis': 'std-surveillance-syphilis',
      'gonorrhea': 'std-surveillance-gonorrhea',
      'chlamydia': 'std-surveillance-chlamydia',
      'hiv': 'hiv-surveillance-data'
    };

    const datasetId = datasetMapping[disease];
    if (!datasetId) {
      return { success: false, error: `California dataset not available for ${disease}` };
    }

    try {
      const url = `${this.dataSources.california.baseURL}/datastore_search?resource_id=${datasetId}&limit=1000`;

      const response = await this.fetch(url, {
        timeout: 15000,
        headers: { 'User-Agent': 'Disease Zone Global Aggregator' }
      });

      if (!response.ok) {
        throw new Error(`California API error: ${response.status}`);
      }

      const data = await response.json();

      return {
        success: true,
        data: data.result?.records || [],
        metadata: {
          source: 'California CHHS',
          dataset: datasetId,
          lastUpdated: new Date().toISOString()
        }
      };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async fetchFromHealthMap(disease, regions, timeframe) {
    await this.initFetch();

    try {
      const url = `${this.dataSources.healthMap.baseURL}?auth=${this.apiKeys.healthMap || 'demo'}&disease=${disease}&format=json`;

      const response = await this.fetch(url, {
        timeout: 15000,
        headers: { 'User-Agent': 'Disease Zone Global Aggregator' }
      });

      if (!response.ok) {
        throw new Error(`HealthMap API error: ${response.status}`);
      }

      const data = await response.json();

      return {
        success: true,
        data: data.alerts || [],
        metadata: {
          source: 'HealthMap',
          type: 'outbreak_detection',
          lastUpdated: new Date().toISOString()
        }
      };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async fetchFromOurWorldInData(disease, regions, timeframe) {
    await this.initFetch();

    const datasetMapping = {
      'covid': 'covid-19-data/master/public/data/owid-covid-data.json',
      'vaccines': 'covid-19-data/master/public/data/vaccinations/vaccinations.json'
    };

    const datasetPath = datasetMapping[disease];
    if (!datasetPath) {
      return { success: false, error: `Our World in Data not available for ${disease}` };
    }

    try {
      const url = `${this.dataSources.ourWorldInData.baseURL}/${datasetPath}`;

      const response = await this.fetch(url, {
        timeout: 30000,
        headers: { 'User-Agent': 'Disease Zone Global Aggregator' }
      });

      if (!response.ok) {
        throw new Error(`Our World in Data error: ${response.status}`);
      }

      const data = await response.json();

      return {
        success: true,
        data: data,
        metadata: {
          source: 'Our World in Data',
          dataset: datasetPath,
          lastUpdated: new Date().toISOString()
        }
      };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Additional source implementations would continue here...
  async fetchFromECDC(disease, regions, timeframe) {
    // ECDC implementation
    return { success: false, error: 'ECDC integration pending' };
  }

  async fetchFromNewYork(disease, regions, timeframe) {
    // New York Health Data implementation
    return { success: false, error: 'NY Health Data integration pending' };
  }

  async fetchFromGISAID(disease, regions, timeframe) {
    // GISAID implementation (requires special authentication)
    return { success: false, error: 'GISAID integration pending authentication' };
  }

  async fetchFromFDA(disease, regions, timeframe) {
    // FDA OpenFDA implementation
    return { success: false, error: 'FDA integration pending' };
  }

  async fetchFromCMS(disease, regions, timeframe) {
    // CMS Data implementation
    return { success: false, error: 'CMS integration pending' };
  }

  async fetchFromProMED(disease, regions, timeframe) {
    // ProMED implementation
    return { success: false, error: 'ProMED integration pending' };
  }

  // Data fusion algorithms
  async weightedAverageFusion(sources, disease) {
    if (sources.length === 0) return null;

    const weights = sources.map(source => {
      const priority = source.metadata.priority || 3;
      const quality = this.getQualityScore(source.metadata.quality);
      return (4 - priority) * quality; // Higher priority = lower number, so invert
    });

    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

    // Aggregate numeric values
    const aggregated = {};

    sources.forEach((source, index) => {
      const weight = weights[index] / totalWeight;

      if (Array.isArray(source.data)) {
        source.data.forEach(item => {
          Object.keys(item).forEach(key => {
            if (typeof item[key] === 'number') {
              aggregated[key] = (aggregated[key] || 0) + (item[key] * weight);
            }
          });
        });
      }
    });

    return {
      ...aggregated,
      fusionMethod: 'weighted_average',
      sourceCount: sources.length,
      weights: weights
    };
  }

  async bayesianFusion(sources, disease) {
    // Bayesian data fusion implementation
    return {
      fusionMethod: 'bayesian',
      sourceCount: sources.length,
      note: 'Bayesian fusion algorithm pending implementation'
    };
  }

  async consensusRanking(sources, disease) {
    // Consensus ranking implementation
    return {
      fusionMethod: 'consensus_ranking',
      sourceCount: sources.length,
      note: 'Consensus ranking algorithm pending implementation'
    };
  }

  async temporalAlignment(sources, disease) {
    // Temporal alignment implementation
    return {
      fusionMethod: 'temporal_alignment',
      sourceCount: sources.length,
      note: 'Temporal alignment algorithm pending implementation'
    };
  }

  async geographicAggregation(sources, disease) {
    // Geographic aggregation implementation
    return {
      fusionMethod: 'geographic_aggregation',
      sourceCount: sources.length,
      note: 'Geographic aggregation algorithm pending implementation'
    };
  }

  // Utility methods
  meetsQualityThreshold(source, threshold) {
    const qualityLevels = {
      'low': ['low', 'medium', 'high', 'very_high'],
      'medium': ['medium', 'high', 'very_high'],
      'high': ['high', 'very_high'],
      'very_high': ['very_high']
    };

    return qualityLevels[threshold]?.includes(source.dataQuality) || false;
  }

  getQualityScore(quality) {
    const scores = {
      'low': 1,
      'medium': 2,
      'high': 3,
      'very_high': 4
    };
    return scores[quality] || 1;
  }

  calculateConfidence(sources) {
    if (sources.length === 0) return 'none';

    const highQualitySources = sources.filter(s =>
      ['high', 'very_high'].includes(s.metadata.quality)
    );

    if (highQualitySources.length >= 3) return 'very_high';
    if (highQualitySources.length >= 2) return 'high';
    if (sources.length >= 2) return 'medium';
    return 'low';
  }

  async detectAnomalies(disease, data) {
    // Anomaly detection implementation
    const alerts = [];

    // Example: Simple threshold-based detection
    if (data.cases && data.cases > (data.baseline * this.alertThresholds.case_increase)) {
      alerts.push({
        type: 'case_increase',
        disease: disease,
        severity: 'medium',
        message: `${disease} cases ${((data.cases / data.baseline) * 100).toFixed(1)}% above baseline`,
        timestamp: new Date().toISOString()
      });
    }

    return alerts;
  }

  async detectGlobalOutbreaks(diseases, regions) {
    // Global outbreak detection implementation
    return {
      detected: [],
      monitoring: diseases,
      regions: regions,
      lastCheck: new Date().toISOString()
    };
  }

  async generateForecasts(diseases, timeframe) {
    // Forecasting implementation
    return {
      forecasts: {},
      method: 'ensemble',
      timeframe: timeframe,
      confidence: 'medium',
      generated: new Date().toISOString()
    };
  }

  getUniqueSourcesUsed(data) {
    const sources = new Set();
    Object.values(data).forEach(diseaseData => {
      if (diseaseData.sources) {
        diseaseData.sources.forEach(source => sources.add(source.source));
      }
    });
    return Array.from(sources);
  }

  calculateGlobalCoverage(data) {
    const coverage = {
      diseases: Object.keys(data).length,
      sources: this.getUniqueSourcesUsed(data).length,
      regions: new Set(),
      quality: 'mixed'
    };

    Object.values(data).forEach(diseaseData => {
      if (diseaseData.sources) {
        diseaseData.sources.forEach(source => {
          if (source.metadata.coverage) {
            coverage.regions.add(source.metadata.coverage);
          }
        });
      }
    });

    coverage.regions = Array.from(coverage.regions);
    return coverage;
  }

  async getSystemStatus() {
    const status = {
      orchestrator: 'operational',
      dataSources: {},
      capabilities: Object.keys(this.diseaseSourceMap),
      apiKeys: {},
      cache: {
        size: this.cache.size,
        hitRate: 0.85 // Placeholder
      },
      lastUpdated: new Date().toISOString()
    };

    // Check API key availability
    Object.entries(this.apiKeys).forEach(([key, value]) => {
      status.apiKeys[key] = !!value;
    });

    // Check data source status
    Object.entries(this.dataSources).forEach(([name, config]) => {
      status.dataSources[name] = {
        available: true, // Would check actual connectivity
        priority: config.priority,
        quality: config.dataQuality,
        coverage: config.coverage
      };
    });

    return status;
  }
}

module.exports = GlobalHealthOrchestrator;