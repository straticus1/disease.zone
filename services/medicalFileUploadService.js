/**
 * Medical File Upload Service
 * Handles upload, validation, and processing of medical files including:
 * - DICOM (Medical Imaging)
 * - HL7/FHIR (Health Data Exchange)
 * - NIfTI, MINC (Neuroimaging)
 * - PDF, XML, CSV, JSON (General Medical Documents)
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const mime = require('mime-types');
const dicomParser = require('dicom-parser');
const hl7parser = require('hl7parser');
const pdfParse = require('pdf-parse');
const csv = require('csv-parser');
const archiver = require('archiver');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');

// Import existing services
const EmailService = require('./emailService');
const DatabaseService = require('./databaseService');
const AuditLoggingService = require('./auditLoggingService');
const HIPAAService = require('./hipaaService');

class MedicalFileUploadService {
  constructor() {
    this.uploadDir = path.join(__dirname, '../uploads');
    this.tempDir = path.join(__dirname, '../temp');
    this.maxFileSize = 100 * 1024 * 1024; // 100MB
    this.allowedMimeTypes = new Set([
      // Medical Imaging
      'application/dicom',
      'application/octet-stream', // DICOM often appears as this
      'image/dicom',
      
      // Neuroimaging
      'application/x-nifti',
      'application/x-minc',
      
      // Health Data Exchange
      'application/hl7-v2',
      'application/fhir+json',
      'application/fhir+xml',
      
      // General formats
      'application/pdf',
      'application/xml',
      'text/xml',
      'application/json',
      'text/csv',
      'text/plain',
      
      // Image formats for medical images
      'image/png',
      'image/jpeg',
      'image/tiff',
      'image/bmp'
    ]);

    this.emailService = new EmailService();
    this.databaseService = new DatabaseService();
    this.auditService = new AuditLoggingService();
    this.hipaaService = new HIPAAService();

    this.initializeDirectories();
    this.setupMulter();
  }

  async initializeDirectories() {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
      await fs.mkdir(this.tempDir, { recursive: true });
      await fs.mkdir(path.join(this.uploadDir, 'dicom'), { recursive: true });
      await fs.mkdir(path.join(this.uploadDir, 'fhir'), { recursive: true });
      await fs.mkdir(path.join(this.uploadDir, 'documents'), { recursive: true });
      await fs.mkdir(path.join(this.uploadDir, 'research'), { recursive: true });
    } catch (error) {
      console.error('Error creating upload directories:', error);
    }
  }

  setupMulter() {
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        const fileType = this.detectFileType(file);
        const subDir = this.getSubDirectory(fileType);
        cb(null, path.join(this.uploadDir, subDir));
      },
      filename: (req, file, cb) => {
        const uniqueId = uuidv4();
        const timestamp = Date.now();
        const extension = path.extname(file.originalname) || this.getExtensionFromMime(file.mimetype);
        cb(null, `${timestamp}_${uniqueId}${extension}`);
      }
    });

    this.upload = multer({
      storage: storage,
      limits: {
        fileSize: this.maxFileSize,
        files: 10 // Allow up to 10 files per upload
      },
      fileFilter: (req, file, cb) => {
        if (this.isAllowedFileType(file)) {
          cb(null, true);
        } else {
          cb(new Error(`File type ${file.mimetype} is not allowed`), false);
        }
      }
    });
  }

  detectFileType(file) {
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype.toLowerCase();
    
    // DICOM detection
    if (mime.includes('dicom') || ext === '.dcm' || ext === '.dicom') {
      return 'dicom';
    }
    
    // FHIR detection
    if (mime.includes('fhir') || file.originalname.toLowerCase().includes('fhir')) {
      return 'fhir';
    }
    
    // HL7 detection
    if (mime.includes('hl7') || ext === '.hl7' || file.originalname.toLowerCase().includes('hl7')) {
      return 'hl7';
    }
    
    // Neuroimaging
    if (ext === '.nii' || ext === '.nifti' || mime.includes('nifti')) {
      return 'nifti';
    }
    
    if (ext === '.mnc' || ext === '.minc' || mime.includes('minc')) {
      return 'minc';
    }
    
    // General document types
    if (mime.includes('pdf')) return 'pdf';
    if (mime.includes('xml')) return 'xml';
    if (mime.includes('json')) return 'json';
    if (mime.includes('csv')) return 'csv';
    
    return 'general';
  }

  getSubDirectory(fileType) {
    const typeMapping = {
      'dicom': 'dicom',
      'fhir': 'fhir',
      'hl7': 'fhir',
      'nifti': 'research',
      'minc': 'research',
      'pdf': 'documents',
      'xml': 'documents',
      'json': 'documents',
      'csv': 'documents',
      'general': 'documents'
    };
    return typeMapping[fileType] || 'documents';
  }

  getExtensionFromMime(mimetype) {
    const extensions = {
      'application/dicom': '.dcm',
      'application/x-nifti': '.nii',
      'application/x-minc': '.mnc',
      'application/hl7-v2': '.hl7',
      'application/fhir+json': '.json',
      'application/fhir+xml': '.xml'
    };
    return extensions[mimetype] || '';
  }

  isAllowedFileType(file) {
    // Check MIME type
    if (this.allowedMimeTypes.has(file.mimetype)) {
      return true;
    }
    
    // Check file extension for files that might have generic MIME types
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = ['.dcm', '.dicom', '.nii', '.nifti', '.mnc', '.minc', '.hl7'];
    
    return allowedExtensions.includes(ext);
  }

  async processUploadedFile(file, metadata = {}) {
    try {
      const fileType = this.detectFileType(file);
      const fileInfo = {
        id: uuidv4(),
        originalName: file.originalname,
        filename: file.filename,
        path: file.path,
        size: file.size,
        mimetype: file.mimetype,
        fileType: fileType,
        uploadedAt: new Date(),
        metadata: metadata
      };

      // Generate file hash for integrity
      fileInfo.hash = await this.generateFileHash(file.path);

      // Validate and extract metadata based on file type
      switch (fileType) {
        case 'dicom':
          fileInfo.dicomMetadata = await this.processDICOMFile(file.path);
          break;
        case 'fhir':
        case 'hl7':
          fileInfo.fhirMetadata = await this.processFHIRFile(file.path);
          break;
        case 'pdf':
          fileInfo.textContent = await this.extractPDFText(file.path);
          break;
        case 'nifti':
          fileInfo.imagingMetadata = await this.processNIfTIFile(file.path);
          break;
      }

      // Store file information in database
      await this.storeFileMetadata(fileInfo);

      // Log the upload for audit purposes
      await this.auditService.logFileUpload(fileInfo);

      return fileInfo;
    } catch (error) {
      console.error('Error processing uploaded file:', error);
      throw error;
    }
  }

  async processDICOMFile(filePath) {
    try {
      const fileBuffer = await fs.readFile(filePath);
      const dataSet = dicomParser.parseDicom(fileBuffer);
      
      return {
        patientID: this.getDICOMValue(dataSet, 'x00100020'),
        studyDate: this.getDICOMValue(dataSet, 'x00080020'),
        modality: this.getDICOMValue(dataSet, 'x00080060'),
        studyDescription: this.getDICOMValue(dataSet, 'x00081030'),
        seriesDescription: this.getDICOMValue(dataSet, 'x0008103e'),
        institutionName: this.getDICOMValue(dataSet, 'x00080080'),
        isValid: true
      };
    } catch (error) {
      console.error('Error processing DICOM file:', error);
      return { isValid: false, error: error.message };
    }
  }

  getDICOMValue(dataSet, tag) {
    try {
      const element = dataSet.elements[tag];
      if (element) {
        return dataSet.string(tag);
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  async processFHIRFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      
      if (filePath.endsWith('.json') || content.trim().startsWith('{')) {
        // JSON FHIR resource
        const fhirResource = JSON.parse(content);
        return {
          resourceType: fhirResource.resourceType,
          id: fhirResource.id,
          version: fhirResource.meta?.versionId,
          lastUpdated: fhirResource.meta?.lastUpdated,
          isValid: true
        };
      } else if (filePath.endsWith('.hl7')) {
        // HL7 v2 message
        const parsed = hl7parser.parse(content);
        return {
          messageType: parsed.header?.messageType,
          sendingApplication: parsed.header?.sendingApplication,
          messageControlId: parsed.header?.messageControlId,
          isValid: true
        };
      }
      
      return { isValid: false, error: 'Unknown FHIR/HL7 format' };
    } catch (error) {
      console.error('Error processing FHIR/HL7 file:', error);
      return { isValid: false, error: error.message };
    }
  }

  async extractPDFText(filePath) {
    try {
      const fileBuffer = await fs.readFile(filePath);
      const data = await pdfParse(fileBuffer);
      return {
        text: data.text,
        pages: data.numpages,
        isValid: true
      };
    } catch (error) {
      console.error('Error extracting PDF text:', error);
      return { isValid: false, error: error.message };
    }
  }

  async processNIfTIFile(filePath) {
    try {
      // Basic NIfTI file validation (header check)
      const fileBuffer = await fs.readFile(filePath);
      const header = fileBuffer.slice(0, 348); // NIfTI header is 348 bytes
      
      // Check for NIfTI magic number
      const magic = header.readInt32LE(344);
      const isValid = magic === 0x6E2B3100 || magic === 0x6E693100;
      
      if (isValid) {
        return {
          dimensions: [
            header.readInt16LE(40), // dim[1] - x
            header.readInt16LE(42), // dim[2] - y
            header.readInt16LE(44)  // dim[3] - z
          ],
          datatype: header.readInt16LE(70),
          isValid: true
        };
      }
      
      return { isValid: false, error: 'Invalid NIfTI file format' };
    } catch (error) {
      console.error('Error processing NIfTI file:', error);
      return { isValid: false, error: error.message };
    }
  }

  async generateFileHash(filePath) {
    try {
      const fileBuffer = await fs.readFile(filePath);
      return crypto.createHash('sha256').update(fileBuffer).digest('hex');
    } catch (error) {
      console.error('Error generating file hash:', error);
      return null;
    }
  }

  async storeFileMetadata(fileInfo) {
    try {
      // Store in SQLite database
      const db = await this.databaseService.getDatabase();
      
      await db.run(`
        INSERT INTO uploaded_files (
          id, original_name, filename, file_path, file_size, 
          mimetype, file_type, file_hash, uploaded_at, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        fileInfo.id,
        fileInfo.originalName,
        fileInfo.filename,
        fileInfo.path,
        fileInfo.size,
        fileInfo.mimetype,
        fileInfo.fileType,
        fileInfo.hash,
        fileInfo.uploadedAt.toISOString(),
        JSON.stringify(fileInfo)
      ]);
      
      return true;
    } catch (error) {
      console.error('Error storing file metadata:', error);
      throw error;
    }
  }

  async createResearchCase(fileIds, caseData) {
    try {
      const caseId = uuidv4();
      const db = await this.databaseService.getDatabase();
      
      await db.run(`
        INSERT INTO research_cases (
          id, title, description, submitter_email, submitter_name,
          file_ids, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        caseId,
        caseData.title,
        caseData.description,
        caseData.submitterEmail,
        caseData.submitterName,
        JSON.stringify(fileIds),
        'pending',
        new Date().toISOString(),
        new Date().toISOString()
      ]);

      return caseId;
    } catch (error) {
      console.error('Error creating research case:', error);
      throw error;
    }
  }

  async sendUploadConfirmation(email, caseId, files) {
    try {
      const subject = 'Medical File Upload Confirmation - Research Case Submitted';
      const html = `
        <h2>Thank you for your submission!</h2>
        <p>Your medical files have been successfully uploaded and a research case has been created.</p>
        
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <strong>Case ID:</strong> ${caseId}<br>
          <strong>Files Uploaded:</strong> ${files.length}<br>
          <strong>Submission Date:</strong> ${new Date().toLocaleDateString()}
        </div>
        
        <h3>Files Uploaded:</h3>
        <ul>
          ${files.map(file => `<li>${file.originalName} (${(file.size / 1024 / 1024).toFixed(2)} MB)</li>`).join('')}
        </ul>
        
        <p>Your submission is now available for review by medical professionals on our platform.</p>
        
        <p>If you have any questions, please contact us at support@disease.zone</p>
        
        <p>Best regards,<br>The Disease Zone Team</p>
      `;

      await this.emailService.sendEmail(email, subject, html);
      return true;
    } catch (error) {
      console.error('Error sending upload confirmation:', error);
      return false;
    }
  }

  async searchFiles(query, filters = {}) {
    try {
      const db = await this.databaseService.getDatabase();
      let sql = `
        SELECT * FROM uploaded_files 
        WHERE (original_name LIKE ? OR file_type LIKE ?)
      `;
      const params = [`%${query}%`, `%${query}%`];

      if (filters.fileType) {
        sql += ' AND file_type = ?';
        params.push(filters.fileType);
      }

      if (filters.dateFrom) {
        sql += ' AND uploaded_at >= ?';
        params.push(filters.dateFrom);
      }

      if (filters.dateTo) {
        sql += ' AND uploaded_at <= ?';
        params.push(filters.dateTo);
      }

      sql += ' ORDER BY uploaded_at DESC LIMIT 50';

      const files = await db.all(sql, params);
      return files.map(file => ({
        ...file,
        metadata: JSON.parse(file.metadata || '{}')
      }));
    } catch (error) {
      console.error('Error searching files:', error);
      throw error;
    }
  }

  async assignFileToDoctor(fileId, doctorId, groupId = null) {
    try {
      const db = await this.databaseService.getDatabase();
      
      await db.run(`
        INSERT INTO file_assignments (
          file_id, doctor_id, group_id, assigned_at, status
        ) VALUES (?, ?, ?, ?, ?)
      `, [fileId, doctorId, groupId, new Date().toISOString(), 'assigned']);

      return true;
    } catch (error) {
      console.error('Error assigning file to doctor:', error);
      throw error;
    }
  }

  async takeOwnership(fileId, doctorId) {
    try {
      const db = await this.databaseService.getDatabase();
      
      await db.run(`
        UPDATE file_assignments 
        SET status = 'owned', owned_at = ? 
        WHERE file_id = ? AND doctor_id = ?
      `, [new Date().toISOString(), fileId, doctorId]);

      return true;
    } catch (error) {
      console.error('Error taking file ownership:', error);
      throw error;
    }
  }

  // Initialize database tables
  async initializeDatabase() {
    try {
      const db = await this.databaseService.getDatabase();
      
      // Create uploaded_files table
      await db.run(`
        CREATE TABLE IF NOT EXISTS uploaded_files (
          id TEXT PRIMARY KEY,
          original_name TEXT NOT NULL,
          filename TEXT NOT NULL,
          file_path TEXT NOT NULL,
          file_size INTEGER NOT NULL,
          mimetype TEXT NOT NULL,
          file_type TEXT NOT NULL,
          file_hash TEXT,
          uploaded_at TEXT NOT NULL,
          metadata TEXT
        )
      `);

      // Create research_cases table
      await db.run(`
        CREATE TABLE IF NOT EXISTS research_cases (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          submitter_email TEXT NOT NULL,
          submitter_name TEXT,
          file_ids TEXT NOT NULL,
          status TEXT DEFAULT 'pending',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);

      // Create file_assignments table
      await db.run(`
        CREATE TABLE IF NOT EXISTS file_assignments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          file_id TEXT NOT NULL,
          doctor_id TEXT NOT NULL,
          group_id TEXT,
          assigned_at TEXT NOT NULL,
          owned_at TEXT,
          status TEXT DEFAULT 'assigned'
        )
      `);

      console.log('Medical file upload database tables initialized');
    } catch (error) {
      console.error('Error initializing database:', error);
      throw error;
    }
  }
}

module.exports = MedicalFileUploadService;