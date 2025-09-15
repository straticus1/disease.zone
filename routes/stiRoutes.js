const express = require('express');
const router = express.Router();

// Import all STI/STD services
const ComprehensiveSTIService = require('../services/comprehensiveSTIService');
const CDCDataService = require('../services/cdcDataService');
const STDService = require('../services/stdService');
const DiseaseApiService = require('../services/diseaseApiService');
const HPVSurveillanceService = require('../services/hpvSurveillanceService');
const HerpesHSVService = require('../services/herpesHSVService');
const ErrorHandlingService = require('../services/errorHandlingService');

// Initialize services
const comprehensiveSTI = new ComprehensiveSTIService();
const cdcData = new CDCDataService();
const stdService = new STDService();
const diseaseApi = new DiseaseApiService();
const hpvService = new HPVSurveillanceService();
const herpesService = new HerpesHSVService();
const errorHandler = new ErrorHandlingService();

// Middleware for error handling
router.use((req, res, next) => {
  req.errorHandler = errorHandler;
  req.services = {
    comprehensive: comprehensiveSTI,
    cdc: cdcData,
    std: stdService,
    diseaseApi: diseaseApi,
    hpv: hpvService,
    herpes: herpesService
  };
  next();
});

// Main comprehensive STI data endpoint
router.get('/data', async (req, res) => {
  try {
    const {
      diseases = 'all',
      region = 'all',
      timeframe = 'current',
      sources = 'auto',
      dataTypes = 'surveillance',
      includeMetadata = 'true'
    } = req.query;

    const options = {
      diseases: diseases.split(','),
      region,
      timeframe,
      sources: sources === 'auto' ? 'auto' : sources.split(','),
      dataTypes: dataTypes.split(','),
      includeMetadata: includeMetadata === 'true'
    };

    const result = await req.errorHandler.handleServiceCall(
      'comprehensive',
      () => req.services.comprehensive.queryDiseaseData(options),
      { disease: diseases, ...options }
    );

    res.json(result);

  } catch (error) {
    req.errorHandler.logError(error, { endpoint: '/sti/data', query: req.query });
    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code || 'STI_001'
    });
  }
});

// HIV/AIDS specific endpoints
router.get('/hiv', async (req, res) => {
  try {
    const {
      dataType = 'surveillance',
      region = 'all',
      year = 'latest',
      source = 'auto'
    } = req.query;

    const options = {
      diseases: ['hiv'],
      region,
      timeframe: year,
      sources: source,
      dataTypes: [dataType]
    };

    const result = await req.errorHandler.handleServiceCall(
      'cdc',
      () => req.services.comprehensive.queryDiseaseData(options),
      { disease: 'hiv', cdcService: req.services.cdc, ...options }
    );

    res.json(result);

  } catch (error) {
    req.errorHandler.logError(error, { endpoint: '/sti/hiv', query: req.query });
    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code || 'HIV_001'
    });
  }
});

router.get('/aids', async (req, res) => {
  try {
    const {
      dataType = 'surveillance',
      region = 'all',
      year = 'latest',
      source = 'auto'
    } = req.query;

    const options = {
      diseases: ['aids'],
      region,
      timeframe: year,
      sources: source,
      dataTypes: [dataType]
    };

    const result = await req.errorHandler.handleServiceCall(
      'cdc',
      () => req.services.comprehensive.queryDiseaseData(options),
      { disease: 'aids', cdcService: req.services.cdc, ...options }
    );

    res.json(result);

  } catch (error) {
    req.errorHandler.logError(error, { endpoint: '/sti/aids', query: req.query });
    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code || 'AIDS_001'
    });
  }
});

// Herpes/HSV specific endpoints
router.get('/herpes', async (req, res) => {
  try {
    const {
      virusType = 'both',
      dataType = 'prevalence',
      demographic = 'all',
      ageGroup = 'all',
      sex = 'all',
      race = 'all',
      year = 'latest'
    } = req.query;

    const result = await req.errorHandler.handleServiceCall(
      'nhanes',
      () => req.services.herpes.queryHerpesData({
        virusType,
        dataType,
        demographic,
        ageGroup,
        sex,
        race,
        year
      }),
      { disease: 'herpes', herpesService: req.services.herpes }
    );

    res.json(result);

  } catch (error) {
    req.errorHandler.logError(error, { endpoint: '/sti/herpes', query: req.query });
    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code || 'HERPES_001'
    });
  }
});

router.get('/herpes/prevalence', async (req, res) => {
  try {
    const result = await req.errorHandler.handleServiceCall(
      'nhanes',
      () => req.services.herpes.getPrevalenceComparison(),
      { disease: 'herpes' }
    );

    res.json(result);

  } catch (error) {
    req.errorHandler.logError(error, { endpoint: '/sti/herpes/prevalence' });
    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code || 'HERPES_002'
    });
  }
});

router.get('/herpes/demographics', async (req, res) => {
  try {
    const result = await req.services.herpes.getDemographicCategories();
    res.json(result);

  } catch (error) {
    req.errorHandler.logError(error, { endpoint: '/sti/herpes/demographics' });
    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code || 'HERPES_003'
    });
  }
});

// HPV specific endpoints
router.get('/hpv', async (req, res) => {
  try {
    const {
      dataType = 'cancer',
      cancerType = 'cervical',
      region = 'national',
      year = 'latest',
      ageGroup = 'all',
      hpvType = 'all'
    } = req.query;

    const result = await req.errorHandler.handleServiceCall(
      'hpv-impact',
      () => req.services.hpv.queryHPVData({
        dataType,
        cancerType,
        region,
        year,
        ageGroup,
        hpvType
      }),
      { disease: 'hpv', hpvService: req.services.hpv }
    );

    res.json(result);

  } catch (error) {
    req.errorHandler.logError(error, { endpoint: '/sti/hpv', query: req.query });
    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code || 'HPV_001'
    });
  }
});

router.get('/hpv/vaccination', async (req, res) => {
  try {
    const {
      region = 'national',
      year = 'latest',
      ageGroup = 'all'
    } = req.query;

    const result = await req.errorHandler.handleServiceCall(
      'hpv-impact',
      () => req.services.hpv.queryHPVData({
        dataType: 'vaccination',
        region,
        year,
        ageGroup
      }),
      { disease: 'hpv' }
    );

    res.json(result);

  } catch (error) {
    req.errorHandler.logError(error, { endpoint: '/sti/hpv/vaccination', query: req.query });
    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code || 'HPV_002'
    });
  }
});

router.get('/hpv/guidelines', async (req, res) => {
  try {
    const result = await req.services.hpv.getVaccinationGuidelines();
    res.json(result);

  } catch (error) {
    req.errorHandler.logError(error, { endpoint: '/sti/hpv/guidelines' });
    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code || 'HPV_003'
    });
  }
});

router.get('/hpv/types', async (req, res) => {
  try {
    const result = await req.services.hpv.getHPVTypes();
    res.json(result);

  } catch (error) {
    req.errorHandler.logError(error, { endpoint: '/sti/hpv/types' });
    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code || 'HPV_004'
    });
  }
});

// Traditional STD endpoints (Syphilis, Gonorrhea, Chlamydia)
router.get('/std', async (req, res) => {
  try {
    const {
      disease = 'all',
      year = '2023',
      state = 'all',
      aggregateBy = 'state'
    } = req.query;

    const result = await req.errorHandler.handleServiceCall(
      'cdc',
      () => req.services.cdc.querySTDData({
        disease,
        year,
        state,
        aggregateBy
      }),
      { disease, cdcService: req.services.cdc }
    );

    res.json(result);

  } catch (error) {
    req.errorHandler.logError(error, { endpoint: '/sti/std', query: req.query });
    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code || 'STD_001'
    });
  }
});

// Disease.sh integration endpoints
router.get('/global', async (req, res) => {
  try {
    const {
      disease = 'covid',
      scope = 'global',
      country = null,
      historical = 'false'
    } = req.query;

    let result;

    if (disease === 'covid') {
      result = await req.errorHandler.handleServiceCall(
        'disease.sh',
        () => req.services.diseaseApi.getCOVIDData({
          scope,
          country,
          historical: historical === 'true'
        }),
        { disease: 'covid', diseaseService: req.services.diseaseApi }
      );
    } else if (disease === 'influenza') {
      result = await req.errorHandler.handleServiceCall(
        'disease.sh',
        () => req.services.diseaseApi.getInfluenzaData({ scope, country }),
        { disease: 'influenza' }
      );
    } else {
      throw new Error(`Unsupported global disease: ${disease}`);
    }

    res.json(result);

  } catch (error) {
    req.errorHandler.logError(error, { endpoint: '/sti/global', query: req.query });
    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code || 'GLOBAL_001'
    });
  }
});

// Service status and health endpoints
router.get('/status', async (req, res) => {
  try {
    const [
      comprehensiveStatus,
      cdcStatus,
      diseaseApiStatus,
      hpvStatus,
      herpesStatus,
      errorStats
    ] = await Promise.allSettled([
      req.services.comprehensive.getServiceStatus(),
      req.services.cdc.getDatasetInfo(),
      req.services.diseaseApi.getServiceStatus(),
      req.services.hpv.getServiceStatus(),
      req.services.herpes.getServiceStatus(),
      req.errorHandler.getErrorStats()
    ]);

    res.json({
      success: true,
      services: {
        comprehensive: comprehensiveStatus.value,
        cdc: cdcStatus.value,
        diseaseApi: diseaseApiStatus.value,
        hpv: hpvStatus.value,
        herpes: herpesStatus.value
      },
      errorHandling: errorStats.value,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'STATUS_001'
    });
  }
});

router.get('/health', async (req, res) => {
  try {
    const healthCheck = await req.errorHandler.healthCheck();

    const overallHealth = Object.values(healthCheck.circuitBreakers)
      .every(breaker => breaker.healthy) ? 'healthy' : 'degraded';

    res.status(overallHealth === 'healthy' ? 200 : 503).json({
      status: overallHealth,
      ...healthCheck,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Administrative endpoints
router.post('/reset-circuit-breaker/:service', async (req, res) => {
  try {
    const { service } = req.params;
    const result = req.errorHandler.resetCircuitBreaker(service);

    res.json(result);

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.delete('/cache', async (req, res) => {
  try {
    const results = [];

    // Clear caches from all services
    if (req.services.comprehensive.clearCache) {
      results.push(req.services.comprehensive.clearCache());
    }
    if (req.services.diseaseApi.clearCache) {
      results.push(req.services.diseaseApi.clearCache());
    }
    if (req.services.hpv.clearCache) {
      results.push(req.services.hpv.clearCache());
    }
    if (req.services.herpes.clearCache) {
      results.push(req.services.herpes.clearCache());
    }

    res.json({
      success: true,
      message: 'All service caches cleared',
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

// Documentation endpoint
router.get('/docs', (req, res) => {
  res.json({
    name: 'STI/STD Surveillance API',
    version: '1.0.0',
    description: 'Comprehensive STI/STD surveillance data API with multi-source integration',
    endpoints: {
      main: {
        '/sti/data': 'Comprehensive disease data with auto-fallback',
        '/sti/status': 'Service status and health information',
        '/sti/health': 'Health check endpoint'
      },
      hiv_aids: {
        '/sti/hiv': 'HIV surveillance data',
        '/sti/aids': 'AIDS surveillance data'
      },
      herpes: {
        '/sti/herpes': 'Herpes prevalence and surveillance data',
        '/sti/herpes/prevalence': 'HSV-1/HSV-2 prevalence comparison',
        '/sti/herpes/demographics': 'Available demographic categories'
      },
      hpv: {
        '/sti/hpv': 'HPV surveillance and cancer data',
        '/sti/hpv/vaccination': 'HPV vaccination coverage',
        '/sti/hpv/guidelines': 'HPV vaccination guidelines',
        '/sti/hpv/types': 'HPV type classifications'
      },
      traditional_std: {
        '/sti/std': 'Syphilis, gonorrhea, chlamydia surveillance'
      },
      global: {
        '/sti/global': 'Global disease data via disease.sh'
      },
      admin: {
        'POST /sti/reset-circuit-breaker/:service': 'Reset circuit breaker',
        'DELETE /sti/cache': 'Clear all service caches'
      }
    },
    features: [
      'Multi-source data integration',
      'Automatic fallback mechanisms',
      'Circuit breaker pattern',
      'Rate limiting and error handling',
      'Comprehensive caching',
      'Real-time and historical data'
    ],
    dataSources: [
      'CDC NNDSS',
      'CDC WONDER',
      'NHANES',
      'HPV-IMPACT',
      'disease.sh',
      'WHO GHO (planned)'
    ]
  });
});

module.exports = router;