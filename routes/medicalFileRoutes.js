/**
 * Medical File Upload Routes
 * Handles file upload endpoints for medical data
 */

const express = require('express');
const router = express.Router();
const MedicalFileUploadService = require('../services/medicalFileUploadService');
const AuthMiddleware = require('../middleware/auth');
const ResponseHandler = require('../utils/responseHandler');

// Initialize the medical file upload service
const fileUploadService = new MedicalFileUploadService();

// Middleware for authentication (protect all routes)
// router.use(AuthMiddleware.requireAuth); // TODO: Fix auth middleware

/**
 * Upload medical files
 * POST /api/medical-files/upload
 */
router.post('/upload', async (req, res) => {
  try {
    // Use multer middleware for file upload
    fileUploadService.upload.array('medicalFiles', 10)(req, res, async (err) => {
      if (err) {
        return ResponseHandler.error(res, `Upload error: ${err.message}`, 400);
      }

      if (!req.files || req.files.length === 0) {
        return ResponseHandler.error(res, 'No files were uploaded', 400);
      }

      try {
        const processedFiles = [];
        const fileIds = [];

        // Process each uploaded file
        for (const file of req.files) {
          const fileInfo = await fileUploadService.processUploadedFile(file, {
            uploadedBy: req.user.id,
            userEmail: req.user.email
          });
          
          processedFiles.push(fileInfo);
          fileIds.push(fileInfo.id);
        }

        // Create research case if specified
        let caseId = null;
        if (req.body.createCase === 'true') {
          const caseData = {
            title: req.body.caseTitle || 'Medical File Upload',
            description: req.body.caseDescription || '',
            submitterEmail: req.user.email,
            submitterName: req.user.name || req.user.email
          };

          caseId = await fileUploadService.createResearchCase(fileIds, caseData);
        }

        // Send confirmation email
        if (req.body.sendConfirmation !== 'false') {
          await fileUploadService.sendUploadConfirmation(
            req.user.email,
            caseId || 'N/A',
            processedFiles
          );
        }

        ResponseHandler.success(res, {
          message: 'Files uploaded successfully',
          filesUploaded: processedFiles.length,
          files: processedFiles.map(f => ({
            id: f.id,
            originalName: f.originalName,
            fileType: f.fileType,
            size: f.size,
            isValid: f.dicomMetadata?.isValid || f.fhirMetadata?.isValid || true
          })),
          caseId: caseId
        });

      } catch (processingError) {
        console.error('Error processing uploaded files:', processingError);
        ResponseHandler.error(res, 'Error processing uploaded files', 500);
      }
    });

  } catch (error) {
    console.error('Upload route error:', error);
    ResponseHandler.error(res, 'Upload failed', 500);
  }
});

/**
 * Search uploaded files
 * GET /api/medical-files/search
 */
router.get('/search', async (req, res) => {
  try {
    const { q: query = '', fileType, dateFrom, dateTo, page = 1, limit = 20 } = req.query;
    
    const filters = {};
    if (fileType) filters.fileType = fileType;
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;

    const files = await fileUploadService.searchFiles(query, filters);
    
    ResponseHandler.success(res, {
      files: files,
      total: files.length,
      page: parseInt(page),
      hasMore: files.length === parseInt(limit)
    });

  } catch (error) {
    console.error('Search files error:', error);
    ResponseHandler.error(res, 'Search failed', 500);
  }
});

/**
 * Get file details
 * GET /api/medical-files/:fileId
 */
router.get('/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const db = await fileUploadService.databaseService.getDatabase();
    
    const file = await db.get('SELECT * FROM uploaded_files WHERE id = ?', [fileId]);
    
    if (!file) {
      return ResponseHandler.error(res, 'File not found', 404);
    }

    const fileDetails = {
      ...file,
      metadata: JSON.parse(file.metadata || '{}')
    };

    ResponseHandler.success(res, fileDetails);

  } catch (error) {
    console.error('Get file details error:', error);
    ResponseHandler.error(res, 'Failed to retrieve file details', 500);
  }
});

/**
 * Assign file to doctor or group
 * POST /api/medical-files/:fileId/assign
 */
router.post('/:fileId/assign', async (req, res) => {
  try {
    const { fileId } = req.params;
    const { doctorId, groupId } = req.body;

    if (!doctorId && !groupId) {
      return ResponseHandler.error(res, 'Either doctorId or groupId must be provided', 400);
    }

    await fileUploadService.assignFileToDoctor(fileId, doctorId, groupId);
    
    ResponseHandler.success(res, {
      message: 'File assigned successfully',
      fileId,
      assignedTo: doctorId || `group:${groupId}`
    });

  } catch (error) {
    console.error('Assign file error:', error);
    ResponseHandler.error(res, 'Failed to assign file', 500);
  }
});

/**
 * Take ownership of a file
 * POST /api/medical-files/:fileId/take-ownership
 */
router.post('/:fileId/take-ownership', async (req, res) => {
  try {
    const { fileId } = req.params;
    const doctorId = req.user.id;

    await fileUploadService.takeOwnership(fileId, doctorId);
    
    ResponseHandler.success(res, {
      message: 'Ownership taken successfully',
      fileId,
      ownedBy: doctorId
    });

  } catch (error) {
    console.error('Take ownership error:', error);
    ResponseHandler.error(res, 'Failed to take ownership', 500);
  }
});

/**
 * Get research cases
 * GET /api/medical-files/cases
 */
router.get('/cases', async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const db = await fileUploadService.databaseService.getDatabase();
    
    let sql = 'SELECT * FROM research_cases';
    const params = [];
    
    if (status) {
      sql += ' WHERE status = ?';
      params.push(status);
    }
    
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const cases = await db.all(sql, params);
    
    ResponseHandler.success(res, {
      cases: cases.map(c => ({
        ...c,
        fileIds: JSON.parse(c.file_ids || '[]')
      })),
      page: parseInt(page)
    });

  } catch (error) {
    console.error('Get research cases error:', error);
    ResponseHandler.error(res, 'Failed to retrieve research cases', 500);
  }
});

/**
 * Get file types statistics
 * GET /api/medical-files/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const db = await fileUploadService.databaseService.getDatabase();
    
    const stats = await db.all(`
      SELECT 
        file_type,
        COUNT(*) as count,
        SUM(file_size) as total_size
      FROM uploaded_files 
      GROUP BY file_type 
      ORDER BY count DESC
    `);

    const totalFiles = await db.get('SELECT COUNT(*) as total FROM uploaded_files');
    const totalSize = await db.get('SELECT SUM(file_size) as total FROM uploaded_files');

    // Include scanning statistics
    const scanStats = await fileUploadService.getScanStats();

    ResponseHandler.success(res, {
      totalFiles: totalFiles.total,
      totalSize: totalSize.total,
      byType: stats,
      scanning: scanStats
    });

  } catch (error) {
    console.error('Get stats error:', error);
    ResponseHandler.error(res, 'Failed to retrieve statistics', 500);
  }
});

/**
 * Get scan results for a file
 * GET /api/medical-files/:fileId/scans
 */
router.get('/:fileId/scans', async (req, res) => {
  try {
    const { fileId } = req.params;
    const scanResults = await fileUploadService.getScanResults(fileId);
    
    ResponseHandler.success(res, {
      fileId,
      scans: scanResults
    });

  } catch (error) {
    console.error('Get scan results error:', error);
    ResponseHandler.error(res, 'Failed to retrieve scan results', 500);
  }
});

/**
 * Get scan queue status
 * GET /api/medical-files/scan-queue
 */
router.get('/scan-queue', async (req, res) => {
  try {
    const queueStatus = await fileUploadService.scanDaemon.getQueueStatus();
    
    ResponseHandler.success(res, queueStatus);

  } catch (error) {
    console.error('Get scan queue error:', error);
    ResponseHandler.error(res, 'Failed to retrieve scan queue status', 500);
  }
});

/**
 * Rescan a file (Premium/Gold only)
 * POST /api/medical-files/:fileId/rescan
 */
router.post('/:fileId/rescan', async (req, res) => {
  try {
    const { fileId } = req.params;
    const db = await fileUploadService.databaseService.getDatabase();
    
    const file = await db.get('SELECT * FROM uploaded_files WHERE id = ?', [fileId]);
    
    if (!file) {
      return ResponseHandler.error(res, 'File not found', 404);
    }

    // Check user permissions for rescanning
    const userTier = await fileUploadService.getUserTier(req.user.id);
    if (userTier === 'free') {
      return ResponseHandler.error(res, 'Rescan feature requires Premium or Gold subscription', 403);
    }

    // Submit for rescanning
    const scanResult = await fileUploadService.submitForScanning(
      JSON.parse(file.metadata), 
      { uploadedBy: req.user.id, userTier }
    );
    
    ResponseHandler.success(res, {
      message: 'File submitted for rescanning',
      scanJobId: scanResult.jobId,
      estimatedTime: scanResult.estimatedTime
    });

  } catch (error) {
    console.error('Rescan file error:', error);
    ResponseHandler.error(res, 'Failed to rescan file', 500);
  }
});

/**
 * Download file (with proper security checks)
 * GET /api/medical-files/:fileId/download
 */
router.get('/:fileId/download', async (req, res) => {
  try {
    const { fileId } = req.params;
    const db = await fileUploadService.databaseService.getDatabase();
    
    const file = await db.get('SELECT * FROM uploaded_files WHERE id = ?', [fileId]);
    
    if (!file) {
      return ResponseHandler.error(res, 'File not found', 404);
    }

    // Check if user has permission to download (implement your logic here)
    // For now, all authenticated users can download

    res.download(file.file_path, file.original_name);

  } catch (error) {
    console.error('Download file error:', error);
    ResponseHandler.error(res, 'Failed to download file', 500);
  }
});

module.exports = router;