/**
 * FHIR-Blockchain Bridge API Routes
 *
 * RESTful API endpoints for FHIR data import to blockchain operations
 * Supports hospital connections, data imports, token rewards, and cross-chain verification
 */

const express = require('express');
const router = express.Router();
const FHIRBlockchainBridge = require('../services/fhirBlockchainBridge');
const FHIRService = require('../services/fhirService');
const ResponseHandler = require('../utils/responseHandler');

// Initialize services
let fhirBridge;
let fhirService;

// Initialize services with error handling
try {
  fhirBridge = new FHIRBlockchainBridge();
  fhirService = new FHIRService();
} catch (error) {
  console.warn('FHIR services initialization failed:', error.message);
  // Services will be initialized when needed
}

// Authentication middleware function
function requireAuth(req, res, next) {
  if (!req.app.locals.auth?.authenticateToken) {
    return res.status(500).json({ error: 'Authentication service not initialized' });
  }
  return req.app.locals.auth.authenticateToken(req, res, next);
}

/**
 * GET /api/fhir/blockchain/status
 * Get FHIR-Blockchain bridge status and health check
 */
router.get('/status', async (req, res) => {
  try {
    const status = await fhirBridge.getServiceStatus();

    ResponseHandler.success(res, {
      message: 'FHIR-Blockchain bridge status retrieved',
      data: status
    });
  } catch (error) {
    console.error('Error getting FHIR bridge status:', error);
    ResponseHandler.error(res, error.message, 500);
  }
});

/**
 * GET /api/fhir/hospitals
 * List connected FHIR-enabled hospitals
 */
router.get('/hospitals', requireAuth, async (req, res) => {
  try {
    const hospitals = await fhirService.getConnectedHospitals(req.user.id);

    ResponseHandler.success(res, {
      message: 'Connected hospitals retrieved',
      data: hospitals,
      count: hospitals.length
    });
  } catch (error) {
    console.error('Error getting connected hospitals:', error);
    ResponseHandler.error(res, error.message, 500);
  }
});

/**
 * POST /api/fhir/hospitals/connect
 * Connect to a new FHIR-enabled hospital
 */
router.post('/hospitals/connect', requireAuth, async (req, res) => {
  try {
    const { name, fhirEndpoint, authType, credentials } = req.body;

    // Validate required fields
    if (!name || !fhirEndpoint || !authType) {
      return ResponseHandler.error(res, 'Name, FHIR endpoint, and auth type are required', 400);
    }

    // Validate FHIR endpoint URL
    try {
      new URL(fhirEndpoint);
    } catch (urlError) {
      return ResponseHandler.error(res, 'Invalid FHIR endpoint URL', 400);
    }

    // Connect to hospital
    const connectionResult = await fhirService.connectToHospital({
      name,
      fhirEndpoint,
      authType,
      credentials,
      userId: req.user.id
    });

    ResponseHandler.success(res, {
      message: 'Successfully connected to FHIR-enabled hospital',
      data: connectionResult
    });
  } catch (error) {
    console.error('Error connecting to hospital:', error);
    ResponseHandler.error(res, error.message, 500);
  }
});

/**
 * POST /api/fhir/blockchain/import
 * Import FHIR data to blockchain with token rewards
 */
router.post('/import', requireAuth, async (req, res) => {
  try {
    const {
      hospitalId,
      patientId,
      resourceTypes = ['Patient', 'Observation', 'Condition'],
      consentLevels,
      walletAddress
    } = req.body;

    // Validate required fields
    if (!hospitalId || !patientId || !walletAddress) {
      return ResponseHandler.error(res, 'Hospital ID, patient ID, and wallet address are required', 400);
    }

    // Validate wallet address format
    if (!walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return ResponseHandler.error(res, 'Invalid Ethereum wallet address format', 400);
    }

    // Validate consent levels
    if (!consentLevels || typeof consentLevels !== 'object') {
      return ResponseHandler.error(res, 'Patient consent levels are required', 400);
    }

    // Verify user has access to this hospital
    const hospitalAccess = await fhirService.verifyHospitalAccess(req.user.id, hospitalId);
    if (!hospitalAccess) {
      return ResponseHandler.error(res, 'Access denied to specified hospital', 403);
    }

    // Import FHIR data to blockchain
    const importResult = await fhirBridge.importFHIRToBlockchain({
      hospitalId,
      patientId,
      resourceTypes,
      consentLevels,
      walletAddress,
      userId: req.user.id
    });

    ResponseHandler.success(res, {
      message: 'FHIR data successfully imported to blockchain',
      data: importResult
    });
  } catch (error) {
    console.error('Error importing FHIR data to blockchain:', error);
    ResponseHandler.error(res, error.message, 500);
  }
});

/**
 * GET /api/fhir/blockchain/history
 * Get FHIR import history for user
 */
router.get('/history', requireAuth, async (req, res) => {
  try {
    const {
      limit = 10,
      offset = 0,
      hospitalId,
      startDate,
      endDate
    } = req.query;

    const filters = {
      userId: req.user.id,
      limit: parseInt(limit),
      offset: parseInt(offset)
    };

    if (hospitalId) filters.hospitalId = hospitalId;
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);

    const history = await fhirService.getFHIRImportHistory(filters);

    ResponseHandler.success(res, {
      message: 'FHIR import history retrieved',
      data: history.records,
      pagination: {
        total: history.total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: history.total > (parseInt(offset) + parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error getting FHIR import history:', error);
    ResponseHandler.error(res, error.message, 500);
  }
});

/**
 * GET /api/fhir/blockchain/tokens/:walletAddress
 * Get HEALTH token balance from FHIR contributions
 */
router.get('/tokens/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;

    // Validate wallet address format
    if (!walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return ResponseHandler.error(res, 'Invalid Ethereum wallet address format', 400);
    }

    // Get token balance and FHIR contribution history
    const tokenData = await fhirService.getFHIRTokenBalance({
      walletAddress,
      userId: req.user.id
    });

    ResponseHandler.success(res, {
      message: 'HEALTH token balance retrieved',
      data: tokenData
    });
  } catch (error) {
    console.error('Error getting FHIR token balance:', error);
    ResponseHandler.error(res, error.message, 500);
  }
});

/**
 * POST /api/fhir/blockchain/sync
 * Synchronize FHIR data across blockchain layers
 */
router.post('/sync', async (req, res) => {
  try {
    const {
      hospitalId,
      force = false,
      layers = ['hyperledger', 'polygon', 'ethereum']
    } = req.body;

    // Verify hospital access if specific hospital ID provided
    if (hospitalId) {
      const hospitalAccess = await fhirService.verifyHospitalAccess(req.user.id, hospitalId);
      if (!hospitalAccess) {
        return ResponseHandler.error(res, 'Access denied to specified hospital', 403);
      }
    }

    // Perform cross-chain synchronization
    const syncResult = await fhirBridge.synchronizeBlockchainLayers({
      userId: req.user.id,
      hospitalId,
      force,
      layers
    });

    ResponseHandler.success(res, {
      message: 'FHIR blockchain synchronization completed',
      data: syncResult
    });
  } catch (error) {
    console.error('Error synchronizing FHIR blockchain data:', error);
    ResponseHandler.error(res, error.message, 500);
  }
});

/**
 * GET /api/fhir/blockchain/verification/:sessionId
 * Get cross-chain verification details for import session
 */
router.get('/verification/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Get verification details
    const verification = await fhirService.getImportVerification({
      sessionId,
      userId: req.user.id
    });

    if (!verification) {
      return ResponseHandler.error(res, 'Verification record not found', 404);
    }

    ResponseHandler.success(res, {
      message: 'Import verification details retrieved',
      data: verification
    });
  } catch (error) {
    console.error('Error getting import verification:', error);
    ResponseHandler.error(res, error.message, 500);
  }
});

/**
 * GET /api/fhir/blockchain/research-insights
 * Get anonymized research insights generated from FHIR data
 */
router.get('/research-insights', async (req, res) => {
  try {
    const {
      diseaseCategory,
      dateRange,
      geographicRegion,
      limit = 10
    } = req.query;

    // Only medical professionals and researchers can access insights
    if (!['medical_professional', 'researcher', 'admin'].includes(req.user.role)) {
      return ResponseHandler.error(res, 'Insufficient permissions to access research insights', 403);
    }

    const filters = {
      userId: req.user.id,
      limit: parseInt(limit)
    };

    if (diseaseCategory) filters.diseaseCategory = diseaseCategory;
    if (dateRange) filters.dateRange = dateRange;
    if (geographicRegion) filters.geographicRegion = geographicRegion;

    const insights = await fhirService.getResearchInsights(filters);

    ResponseHandler.success(res, {
      message: 'FHIR research insights retrieved',
      data: insights.data,
      metadata: insights.metadata
    });
  } catch (error) {
    console.error('Error getting FHIR research insights:', error);
    ResponseHandler.error(res, error.message, 500);
  }
});

/**
 * POST /api/fhir/blockchain/marketplace/publish
 * Publish FHIR-derived dataset to research marketplace
 */
router.post('/marketplace/publish', async (req, res) => {
  try {
    const {
      sessionId,
      datasetName,
      description,
      price,
      accessLevel = 'anonymized'
    } = req.body;

    // Validate required fields
    if (!sessionId || !datasetName || !price) {
      return ResponseHandler.error(res, 'Session ID, dataset name, and price are required', 400);
    }

    // Only medical professionals can publish datasets
    if (!['medical_professional', 'researcher', 'admin'].includes(req.user.role)) {
      return ResponseHandler.error(res, 'Insufficient permissions to publish datasets', 403);
    }

    // Publish dataset to marketplace
    const publishResult = await fhirService.publishToMarketplace({
      sessionId,
      datasetName,
      description,
      price,
      accessLevel,
      publisherId: req.user.id
    });

    ResponseHandler.success(res, {
      message: 'FHIR dataset published to marketplace',
      data: publishResult
    });
  } catch (error) {
    console.error('Error publishing FHIR dataset to marketplace:', error);
    ResponseHandler.error(res, error.message, 500);
  }
});

/**
 * GET /api/fhir/blockchain/audit/:sessionId
 * Get comprehensive audit trail for FHIR import session
 */
router.get('/audit/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Only admins and the session owner can view audit trails
    const auditAccess = await fhirService.verifyAuditAccess(req.user.id, sessionId);
    if (!auditAccess && req.user.role !== 'admin') {
      return ResponseHandler.error(res, 'Access denied to audit trail', 403);
    }

    const auditTrail = await fhirService.getImportAuditTrail(sessionId);

    ResponseHandler.success(res, {
      message: 'FHIR import audit trail retrieved',
      data: auditTrail
    });
  } catch (error) {
    console.error('Error getting FHIR import audit trail:', error);
    ResponseHandler.error(res, error.message, 500);
  }
});

module.exports = router;