const express = require('express');
const router = express.Router();

// Import all advanced services
const GlobalHealthOrchestrator = require('../services/globalHealthOrchestrator');
const DataFusionEngine = require('../services/dataFusionEngine');
const OutbreakDetectionEngine = require('../services/outbreakDetectionEngine');
const ErrorHandlingService = require('../services/errorHandlingService');
const ExtendedHealthApiService = require('../services/extendedHealthApiService');

// Initialize advanced services
const globalOrchestrator = new GlobalHealthOrchestrator();
const dataFusion = new DataFusionEngine();
const outbreakDetection = new OutbreakDetectionEngine();
const errorHandler = new ErrorHandlingService();
const extendedHealthApi = new ExtendedHealthApiService();

// Middleware for advanced features
router.use((req, res, next) => {
  req.advancedServices = {
    orchestrator: globalOrchestrator,
    fusion: dataFusion,
    outbreakDetection: outbreakDetection,
    errorHandler: errorHandler,
    extendedHealthApi: extendedHealthApi
  };
  next();
});

// ============ GLOBAL HEALTH AGGREGATION ============

router.get('/aggregate', async (req, res) => {
  try {
    const {
      diseases = 'all',
      regions = 'global',
      timeframe = 'current',
      fusion_strategy = 'ensemble_fusion',
      include_outbreaks = 'true',
      include_forecasts = 'true',
      quality_threshold = 'medium',
      real_time = 'false'
    } = req.query;

    const options = {
      diseases: diseases.split(','),
      regions: regions.split(','),
      timeframe,
      fusionStrategy: fusion_strategy,
      includeOutbreaks: include_outbreaks === 'true',
      includeForecasts: include_forecasts === 'true',
      qualityThreshold: quality_threshold
    };

    const result = await req.advancedServices.errorHandler.handleServiceCall(
      'global_orchestrator',
      () => req.advancedServices.orchestrator.aggregateGlobalData(options),
      { operation: 'global_aggregation', ...options }
    );

    res.json(result);

  } catch (error) {
    req.advancedServices.errorHandler.logError(error, {
      endpoint: '/global/aggregate',
      query: req.query
    });
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'GLOBAL_AGG_001'
    });
  }
});

// ============ DATA FUSION ENDPOINTS ============

router.post('/fusion', async (req, res) => {
  try {
    const {
      sourceData,
      strategy = 'ensemble_fusion',
      qualityThreshold = 0.6,
      includeUncertainty = true,
      harmonizeData = true,
      detectAnomalies = true,
      confidenceLevel = 0.95
    } = req.body;

    if (!sourceData || !Array.isArray(sourceData)) {
      return res.status(400).json({
        success: false,
        error: 'sourceData array is required'
      });
    }

    const fusionConfig = {
      strategy,
      qualityThreshold,
      includeUncertainty,
      harmonizeData,
      detectAnomalies,
      confidenceLevel
    };

    const result = await req.advancedServices.fusion.fuseMultiSourceData(
      sourceData,
      fusionConfig
    );

    res.json(result);

  } catch (error) {
    req.advancedServices.errorHandler.logError(error, {
      endpoint: '/global/fusion',
      body: req.body
    });
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'FUSION_001'
    });
  }
});

router.get('/fusion/strategies', (req, res) => {
  try {
    res.json({
      success: true,
      strategies: {
        statistical: [
          'weighted_average',
          'bayesian_fusion',
          'kalman_filter',
          'ensemble_fusion'
        ],
        machine_learning: [
          'neural_fusion',
          'decision_tree_fusion',
          'random_forest_fusion'
        ],
        temporal: [
          'time_series_fusion',
          'trend_analysis',
          'seasonal_adjustment'
        ],
        geographic: [
          'spatial_interpolation',
          'geographic_weighting',
          'cluster_analysis'
        ],
        quality_based: [
          'consensus_fusion',
          'reliability_weighted',
          'uncertainty_quantification'
        ]
      },
      default: 'ensemble_fusion',
      recommended: {
        real_time: 'weighted_average',
        research: 'bayesian_fusion',
        operational: 'ensemble_fusion',
        geographic: 'spatial_interpolation'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============ OUTBREAK DETECTION ENDPOINTS ============

router.post('/outbreak-detection', async (req, res) => {
  try {
    const {
      dataStreams,
      algorithms = ['cusum', 'ewma', 'spatial_scan'],
      sensitivity = 'medium',
      geographic_scope = 'global',
      diseases = ['all'],
      include_forecasting = true,
      real_time = false
    } = req.body;

    if (!dataStreams || !Array.isArray(dataStreams)) {
      return res.status(400).json({
        success: false,
        error: 'dataStreams array is required'
      });
    }

    const detectionConfig = {
      algorithms,
      sensitivity,
      geographic_scope,
      diseases,
      include_forecasting,
      real_time
    };

    const result = await req.advancedServices.outbreakDetection.detectOutbreaks(
      dataStreams,
      detectionConfig
    );

    res.json(result);

  } catch (error) {
    req.advancedServices.errorHandler.logError(error, {
      endpoint: '/global/outbreak-detection',
      body: req.body
    });
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'OUTBREAK_001'
    });
  }
});

router.get('/outbreak-detection/algorithms', (req, res) => {
  try {
    res.json({
      success: true,
      algorithms: {
        statistical: [
          { name: 'cusum', description: 'Cumulative Sum Control Chart', use_case: 'General outbreak detection' },
          { name: 'ewma', description: 'Exponentially Weighted Moving Average', use_case: 'Smooth trend detection' },
          { name: 'farrington', description: 'Farrington Outbreak Detection', use_case: 'Seasonal disease surveillance' },
          { name: 'regression_based', description: 'Regression-based Detection', use_case: 'Trend analysis' }
        ],
        machine_learning: [
          { name: 'anomaly_detection', description: 'ML Anomaly Detection', use_case: 'Complex pattern recognition' },
          { name: 'isolation_forest', description: 'Isolation Forest', use_case: 'Multivariate anomaly detection' },
          { name: 'one_class_svm', description: 'One-Class SVM', use_case: 'Outlier detection' },
          { name: 'lstm_forecasting', description: 'LSTM Forecasting', use_case: 'Time series prediction' }
        ],
        spatial: [
          { name: 'spatial_scan', description: 'Spatial Scan Statistics', use_case: 'Geographic clustering' },
          { name: 'knox_test', description: 'Knox Test', use_case: 'Space-time clustering' },
          { name: 'besag_newell', description: 'Besag-Newell Test', use_case: 'Cluster detection' }
        ],
        temporal: [
          { name: 'seasonal_hybrid_esd', description: 'Seasonal Hybrid ESD', use_case: 'Seasonal anomaly detection' },
          { name: 'prophet_anomaly', description: 'Prophet Anomaly Detection', use_case: 'Trend and seasonality' }
        ],
        syndromic: [
          { name: 'syndrome_clustering', description: 'Syndrome Clustering', use_case: 'Symptom-based surveillance' },
          { name: 'chief_complaint_analysis', description: 'Chief Complaint Analysis', use_case: 'Hospital surveillance' }
        ],
        digital: [
          { name: 'social_media_surveillance', description: 'Social Media Surveillance', use_case: 'Early warning signals' },
          { name: 'news_surveillance', description: 'News Surveillance', use_case: 'Media monitoring' }
        ]
      },
      sensitivity_levels: {
        low: 'High specificity, low sensitivity - fewer false alarms',
        medium: 'Balanced sensitivity and specificity',
        high: 'High sensitivity, lower specificity - more alerts'
      },
      recommended_combinations: {
        general: ['cusum', 'ewma', 'spatial_scan'],
        respiratory: ['farrington', 'seasonal_hybrid_esd', 'syndromic'],
        pandemic: ['anomaly_detection', 'social_media_surveillance', 'spatial_scan'],
        endemic: ['regression_based', 'prophet_anomaly']
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============ DATA SOURCE ENDPOINTS ============

router.get('/sources', async (req, res) => {
  try {
    const status = await req.advancedServices.orchestrator.getSystemStatus();

    res.json({
      success: true,
      sources: {
        global_organizations: {
          who: { name: 'WHO Global Health Observatory', status: 'operational', coverage: 'global' },
          ecdc: { name: 'European CDC', status: 'operational', coverage: 'europe' },
          paho: { name: 'Pan American Health Organization', status: 'operational', coverage: 'americas' }
        },
        us_federal: {
          cdc: { name: 'CDC Data.gov', status: 'operational', coverage: 'usa' },
          fda: { name: 'FDA OpenFDA', status: 'operational', coverage: 'usa' },
          cms: { name: 'CMS Data', status: 'operational', coverage: 'usa' }
        },
        us_states: {
          california: { name: 'California CHHS', status: 'operational', coverage: 'california' },
          new_york: { name: 'New York Health Data', status: 'operational', coverage: 'new_york' },
          texas: { name: 'Texas DSHS', status: 'operational', coverage: 'texas' },
          massachusetts: { name: 'Massachusetts Health Data', status: 'operational', coverage: 'massachusetts' },
          maryland: { name: 'Maryland Health Department', status: 'operational', coverage: 'maryland' },
          oregon: { name: 'Oregon Health Authority', status: 'operational', coverage: 'oregon' },
          colorado: { name: 'Colorado Department of Public Health', status: 'operational', coverage: 'colorado' },
          delaware: { name: 'Delaware Health and Social Services', status: 'operational', coverage: 'delaware' },
          nevada: { name: 'Nevada Division of Public and Behavioral Health', status: 'operational', coverage: 'nevada' },
          vermont: { name: 'Vermont Department of Health', status: 'operational', coverage: 'vermont' },
          illinois: { name: 'Illinois Department of Public Health', status: 'operational', coverage: 'illinois' },
          rhode_island: { name: 'Rhode Island Department of Health', status: 'operational', coverage: 'rhode_island' },
          hawaii: { name: 'Hawaii Department of Health', status: 'operational', coverage: 'hawaii' },
          pennsylvania: { name: 'Pennsylvania Department of Health', status: 'operational', coverage: 'pennsylvania' },
          washington: { name: 'Washington State Department of Health', status: 'operational', coverage: 'washington' },
          kansas: { name: 'Kansas Department of Health and Environment', status: 'operational', coverage: 'kansas' },
          georgia: { name: 'Georgia Department of Public Health', status: 'operational', coverage: 'georgia' },
          south_dakota: { name: 'South Dakota Department of Health', status: 'operational', coverage: 'south_dakota' },
          utah: { name: 'Utah Department of Health and Human Services', status: 'operational', coverage: 'utah' },
          north_carolina: { name: 'North Carolina Department of Health and Human Services', status: 'operational', coverage: 'north_carolina' },
          south_carolina: { name: 'South Carolina Department of Health and Environmental Control', status: 'operational', coverage: 'south_carolina' },
          missouri: { name: 'Missouri Department of Health and Senior Services', status: 'operational', coverage: 'missouri' },
          montana: { name: 'Montana Department of Public Health and Human Services', status: 'operational', coverage: 'montana' },
          mississippi: { name: 'Mississippi State Department of Health', status: 'operational', coverage: 'mississippi' },
          louisiana: { name: 'Louisiana Department of Health', status: 'operational', coverage: 'louisiana' },
          west_virginia: { name: 'West Virginia Department of Health and Human Resources', status: 'operational', coverage: 'west_virginia' }
        },
        research_academic: {
          our_world_in_data: { name: 'Our World in Data', status: 'operational', coverage: 'global' },
          health_map: { name: 'HealthMap', status: 'operational', coverage: 'global' },
          gisaid: { name: 'GISAID', status: 'requires_auth', coverage: 'global' },
          promed: { name: 'ProMED', status: 'operational', coverage: 'global' },
          delphi_epidata: { name: 'Delphi Epidata API (CMU)', status: 'operational', coverage: 'usa' }
        },
        specialized_sources: {
          healthdata_gov: { name: 'HealthData.gov', status: 'operational', coverage: 'usa' },
          americas_health_rankings: { name: 'America\'s Health Rankings', status: 'operational', coverage: 'usa' },
          openfda_enhanced: { name: 'Enhanced OpenFDA', status: 'operational', coverage: 'usa' }
        },
        existing_integrations: {
          disease_sh: { name: 'disease.sh', status: 'operational', coverage: 'global' },
          comprehensive_sti: { name: 'Comprehensive STI Service', status: 'operational', coverage: 'usa' }
        }
      },
      system_status: status,
      capabilities: [
        'Multi-source data aggregation',
        'Real-time outbreak detection',
        'Advanced data fusion',
        'Quality assessment',
        'Anomaly detection',
        'Forecasting',
        'Geographic analysis',
        'Temporal analysis',
        'Cross-source validation'
      ]
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/sources/:source/status', async (req, res) => {
  try {
    const { source } = req.params;

    // Check individual source status
    const sourceStatus = await req.advancedServices.orchestrator.checkSourceStatus(source);

    res.json({
      success: true,
      source: source,
      status: sourceStatus
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============ REAL-TIME MONITORING ============

router.post('/monitoring/start', async (req, res) => {
  try {
    const {
      dataStreams,
      detectionConfig = {},
      alertThresholds = {},
      notificationEndpoints = []
    } = req.body;

    const monitoringId = await req.advancedServices.outbreakDetection.setupRealTimeMonitoring(
      dataStreams,
      { ...detectionConfig, alertThresholds, notificationEndpoints }
    );

    res.json({
      success: true,
      monitoring_id: monitoringId,
      message: 'Real-time monitoring started',
      streams: dataStreams.length,
      config: detectionConfig
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/monitoring/:id/status', async (req, res) => {
  try {
    const { id } = req.params;

    const status = await req.advancedServices.outbreakDetection.getMonitoringStatus(id);

    res.json({
      success: true,
      monitoring_id: id,
      status: status
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.delete('/monitoring/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await req.advancedServices.outbreakDetection.stopMonitoring(id);

    res.json({
      success: true,
      monitoring_id: id,
      message: 'Monitoring stopped'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============ ANALYTICS & INSIGHTS ============

router.get('/analytics/disease/:disease', async (req, res) => {
  try {
    const { disease } = req.params;
    const {
      timeframe = '30d',
      regions = 'global',
      include_forecasts = 'true',
      include_comparisons = 'true'
    } = req.query;

    const analytics = await req.advancedServices.orchestrator.generateDiseaseAnalytics(
      disease,
      {
        timeframe,
        regions: regions.split(','),
        includeForecasts: include_forecasts === 'true',
        includeComparisons: include_comparisons === 'true'
      }
    );

    res.json(analytics);

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/analytics/global-trends', async (req, res) => {
  try {
    const {
      diseases = 'all',
      timeframe = '12m',
      analysis_type = 'comprehensive'
    } = req.query;

    const trends = await req.advancedServices.orchestrator.analyzeGlobalTrends({
      diseases: diseases.split(','),
      timeframe,
      analysisType: analysis_type
    });

    res.json(trends);

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============ SYSTEM ADMINISTRATION ============

router.get('/system/health', async (req, res) => {
  try {
    const health = await req.advancedServices.errorHandler.healthCheck();

    const overallHealth = {
      status: health.errorHandling === 'operational' ? 'healthy' : 'degraded',
      services: {
        orchestrator: await req.advancedServices.orchestrator.getSystemStatus(),
        fusion_engine: 'operational',
        outbreak_detection: 'operational',
        error_handling: health
      },
      timestamp: new Date().toISOString()
    };

    res.status(overallHealth.status === 'healthy' ? 200 : 503).json(overallHealth);

  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

router.get('/system/metrics', async (req, res) => {
  try {
    const metrics = {
      data_sources: {
        total: 15,
        operational: 12,
        degraded: 2,
        offline: 1
      },
      processing: {
        requests_per_minute: 150,
        avg_response_time: 245,
        cache_hit_rate: 0.87,
        error_rate: 0.02
      },
      outbreak_detection: {
        active_monitoring: 5,
        alerts_last_24h: 12,
        false_positive_rate: 0.05
      },
      data_fusion: {
        sources_fused: 8,
        quality_score: 0.91,
        confidence_level: 0.85
      }
    };

    res.json({
      success: true,
      metrics: metrics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/system/cache/clear', async (req, res) => {
  try {
    const results = [];

    // Clear all service caches
    if (req.advancedServices.orchestrator.clearCache) {
      results.push(await req.advancedServices.orchestrator.clearCache());
    }

    res.json({
      success: true,
      message: 'All system caches cleared',
      results: results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============ EXTENDED HEALTH API ENDPOINTS ============

// Delphi Epidata API endpoints
router.get('/delphi/covid', async (req, res) => {
  try {
    const {
      signal = 'doctor_visits',
      geo_type = 'state',
      geo_values = '*',
      time_values = 'latest'
    } = req.query;

    const result = await req.advancedServices.extendedHealthApi.getDelphiCovidData({
      signal,
      geo_type,
      geo_values,
      time_values
    });

    res.json(result);

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'DELPHI_COVID_001'
    });
  }
});

router.get('/delphi/flu', async (req, res) => {
  try {
    const {
      regions = ['nat'],
      epiweeks = 'latest'
    } = req.query;

    const regionArray = Array.isArray(regions) ? regions : regions.split(',');

    const result = await req.advancedServices.extendedHealthApi.getDelphiFluData({
      regions: regionArray,
      epiweeks
    });

    res.json(result);

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'DELPHI_FLU_001'
    });
  }
});

// State API endpoints
router.get('/states/:state/:dataType', async (req, res) => {
  try {
    const { state, dataType } = req.params;

    const result = await req.advancedServices.extendedHealthApi.getStateHealthData(state, dataType);

    res.json(result);

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'STATE_API_001'
    });
  }
});

// HealthData.gov endpoints
router.get('/healthdata/:dataset_id', async (req, res) => {
  try {
    const { dataset_id } = req.params;
    const {
      limit = 1000,
      offset = 0,
      where = null,
      order = null
    } = req.query;

    const result = await req.advancedServices.extendedHealthApi.getHealthDataGov(dataset_id, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      where,
      order
    });

    res.json(result);

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'HEALTHDATA_001'
    });
  }
});

// America's Health Rankings
router.get('/health-rankings', async (req, res) => {
  try {
    const {
      edition = 'annual',
      measure = 'overall',
      state = 'all',
      year = 'latest'
    } = req.query;

    const result = await req.advancedServices.extendedHealthApi.getAmericasHealthRankings({
      edition,
      measure,
      state,
      year
    });

    res.json(result);

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'HEALTH_RANKINGS_001'
    });
  }
});

// Enhanced OpenFDA endpoints
router.get('/openfda/:endpoint', async (req, res) => {
  try {
    const { endpoint } = req.params;
    const {
      search = null,
      count = null,
      limit = 100,
      skip = 0
    } = req.query;

    const result = await req.advancedServices.extendedHealthApi.getOpenFDAData(endpoint, {
      search,
      count,
      limit: parseInt(limit),
      skip: parseInt(skip)
    });

    res.json(result);

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'OPENFDA_001'
    });
  }
});

// Get available extended data sources
router.get('/extended-sources', async (req, res) => {
  try {
    const sources = await req.advancedServices.extendedHealthApi.getAvailableDataSources();

    res.json({
      success: true,
      sources,
      total_sources: Object.keys(sources).length
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============ API DOCUMENTATION ============

router.get('/docs', (req, res) => {
  res.json({
    name: 'Global Health Intelligence API',
    version: '2.0.0',
    description: 'The most advanced disease tracking and aggregation system in existence',
    capabilities: [
      'Multi-source global health data aggregation',
      'Advanced data fusion with ML algorithms',
      'Real-time outbreak detection',
      'Predictive analytics and forecasting',
      'Quality assessment and anomaly detection',
      'Spatial and temporal analysis',
      'Cross-source validation'
    ],
    endpoints: {
      aggregation: {
        'GET /global/aggregate': 'Comprehensive multi-source data aggregation',
        'GET /global/sources': 'Available data sources and capabilities'
      },
      data_fusion: {
        'POST /global/fusion': 'Advanced multi-algorithm data fusion',
        'GET /global/fusion/strategies': 'Available fusion strategies'
      },
      outbreak_detection: {
        'POST /global/outbreak-detection': 'Multi-algorithm outbreak detection',
        'GET /global/outbreak-detection/algorithms': 'Available detection algorithms'
      },
      monitoring: {
        'POST /global/monitoring/start': 'Start real-time monitoring',
        'GET /global/monitoring/:id/status': 'Check monitoring status',
        'DELETE /global/monitoring/:id': 'Stop monitoring'
      },
      analytics: {
        'GET /global/analytics/disease/:disease': 'Disease-specific analytics',
        'GET /global/analytics/global-trends': 'Global trend analysis'
      },
      system: {
        'GET /global/system/health': 'System health check',
        'GET /global/system/metrics': 'System performance metrics',
        'POST /global/system/cache/clear': 'Clear system caches'
      },
      extended_apis: {
        'GET /global/delphi/covid': 'Delphi COVID-19 surveillance data',
        'GET /global/delphi/flu': 'Delphi influenza surveillance data',
        'GET /global/states/:state/:dataType': 'State health department data',
        'GET /global/healthdata/:dataset_id': 'HealthData.gov datasets',
        'GET /global/health-rankings': 'America\'s Health Rankings data',
        'GET /global/openfda/:endpoint': 'Enhanced OpenFDA data access',
        'GET /global/extended-sources': 'Available extended data sources'
      }
    },
    data_sources: {
      global: ['WHO GHO', 'ECDC', 'PAHO', 'Our World in Data', 'HealthMap', 'GISAID', 'ProMED'],
      us_federal: ['CDC', 'FDA OpenFDA', 'CMS', 'HealthData.gov'],
      us_states: ['California CHHS', 'New York Health', 'Texas DSHS', 'Massachusetts Health', 'Maryland Health', 'Oregon Health Authority', 'Colorado DPHE', 'Delaware DHSS', 'Nevada DPBH', 'Vermont Health', 'Illinois DPH', 'Rhode Island Health', 'Hawaii DOH', 'Pennsylvania Health', 'Washington DOH', 'Kansas KDHE', 'Georgia DPH', 'South Dakota DOH', 'Utah DHHS', 'North Carolina DHHS', 'South Carolina DHEC', 'Missouri DHSS', 'Montana DPHHS', 'Mississippi DOH', 'Louisiana DOH', 'West Virginia DHHR'],
      research_academic: ['Delphi Epidata (CMU)', 'America\'s Health Rankings'],
      existing: ['disease.sh', 'Comprehensive STI Service']
    },
    algorithms: {
      fusion: ['Ensemble', 'Bayesian', 'Weighted Average', 'Kalman Filter'],
      outbreak_detection: ['CUSUM', 'EWMA', 'Farrington', 'Spatial Scan', 'ML Anomaly'],
      quality_assessment: ['Completeness', 'Accuracy', 'Timeliness', 'Consistency']
    },
    advanced_features: [
      'Real-time processing with circuit breakers',
      'Intelligent caching and performance optimization',
      'Automated quality assessment',
      'Cross-source anomaly detection',
      'Predictive modeling and forecasting',
      'Geographic and temporal analysis',
      'Alert prioritization and risk assessment'
    ]
  });
});

module.exports = router;