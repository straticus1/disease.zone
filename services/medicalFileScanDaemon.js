/**
 * Medical File Scanning Daemon
 * 
 * A comprehensive scanning service for medical files supporting:
 * - ClamAV antivirus scanning
 * - YARA rule-based detection
 * - VirusTotal API integration (Gold tier)
 * - Tiered scanning based on subscription levels
 * - Queue-based processing with Redis/Bull
 * - WebSocket real-time notifications
 */

const Bull = require('bull');
const Redis = require('redis');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws');
const EventEmitter = require('events');

// Scanning engines
const NodeClam = require('clamscan');
const VirusTotalAPI = require('virustotal-api');
const axios = require('axios');

// Database and logging
const DatabaseService = require('./databaseService');
const AuditLoggingService = require('./auditLoggingService');

class MedicalFileScanDaemon extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || null
      },
      clamav: {
        enabled: true,
        host: process.env.CLAMAV_HOST || 'localhost',
        port: process.env.CLAMAV_PORT || 3310,
        timeout: 60000
      },
      yara: {
        enabled: true,
        rulesPath: path.join(__dirname, '../security/yara-rules'),
        timeout: 30000
      },
      virustotal: {
        apiKey: process.env.VIRUSTOTAL_API_KEY,
        enabled: !!process.env.VIRUSTOTAL_API_KEY,
        timeout: 120000
      },
      websocket: {
        port: process.env.SCAN_DAEMON_WS_PORT || 8081
      },
      quarantine: {
        enabled: true,
        path: path.join(__dirname, '../quarantine')
      },
      ...options
    };

    this.scanningTiers = {
      free: {
        scanners: ['basic_validation', 'clamav'],
        priority: 'low',
        maxFileSize: 10 * 1024 * 1024, // 10MB
        maxFilesPerDay: 50
      },
      premium: {
        scanners: ['basic_validation', 'clamav', 'yara_basic'],
        priority: 'normal',
        maxFileSize: 50 * 1024 * 1024, // 50MB
        maxFilesPerDay: 200
      },
      gold: {
        scanners: ['basic_validation', 'clamav', 'yara_full', 'virustotal', 'advanced_analysis'],
        priority: 'high',
        maxFileSize: 100 * 1024 * 1024, // 100MB
        maxFilesPerDay: 1000
      },
      enterprise: {
        scanners: ['basic_validation', 'clamav', 'yara_full', 'virustotal', 'advanced_analysis', 'custom_rules'],
        priority: 'urgent',
        maxFileSize: 500 * 1024 * 1024, // 500MB
        maxFilesPerDay: 10000
      }
    };

    this.scanQueue = null;
    this.redis = null;
    this.clamav = null;
    this.wss = null;
    this.databaseService = new DatabaseService();
    this.auditService = new AuditLoggingService();
    
    this.scanStats = {
      totalScans: 0,
      cleanFiles: 0,
      infectedFiles: 0,
      suspiciousFiles: 0,
      errors: 0,
      averageScanTime: 0
    };

    this.isInitialized = false;
  }

  async initialize() {
    try {
      console.log('🔍 Initializing Medical File Scan Daemon...');

      // Initialize Redis connection
      await this.initializeRedis();
      
      // Initialize scanning queue
      await this.initializeQueue();
      
      // Initialize scanning engines
      await this.initializeScanningEngines();
      
      // Initialize WebSocket server
      await this.initializeWebSocket();
      
      // Initialize database tables
      await this.initializeDatabase();
      
      // Create quarantine directory
      await this.initializeDirectories();

      this.isInitialized = true;
      console.log('✅ Medical File Scan Daemon initialized successfully');
      
      this.emit('initialized');
      return true;
      
    } catch (error) {
      console.error('❌ Failed to initialize scan daemon:', error);
      throw error;
    }
  }

  async initializeRedis() {
    this.redis = Redis.createClient(this.options.redis);
    
    this.redis.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    this.redis.on('connect', () => {
      console.log('📡 Connected to Redis');
    });

    await this.redis.connect();
  }

  async initializeQueue() {
    this.scanQueue = new Bull('medical file scanning', {
      redis: this.options.redis,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    });

    // Process scanning jobs
    this.scanQueue.process('scan', this.processScanJob.bind(this));

    // Job event handlers
    this.scanQueue.on('completed', (job, result) => {
      console.log(`✅ Scan completed for job ${job.id}: ${result.status}`);
      this.broadcastScanResult(job.data, result);
      this.updateStats(result);
    });

    this.scanQueue.on('failed', (job, err) => {
      console.error(`❌ Scan failed for job ${job.id}:`, err.message);
      this.broadcastScanResult(job.data, { status: 'error', error: err.message });
      this.scanStats.errors++;
    });

    this.scanQueue.on('progress', (job, progress) => {
      this.broadcastProgress(job.data, progress);
    });

    console.log('🔄 Scanning queue initialized');
  }

  async initializeScanningEngines() {
    // Initialize ClamAV
    if (this.options.clamav.enabled) {
      try {
        this.clamav = await new NodeClam().init({
          removeInfected: false,
          quarantineInfected: this.options.quarantine.path,
          scanLog: path.join(__dirname, '../logs/clamav.log'),
          debugMode: false,
          clamdscan: {
            host: this.options.clamav.host,
            port: this.options.clamav.port,
            timeout: this.options.clamav.timeout
          }
        });
        console.log('🦠 ClamAV scanner initialized');
      } catch (error) {
        console.warn('⚠️ ClamAV initialization failed:', error.message);
        this.options.clamav.enabled = false;
      }
    }

    // Initialize VirusTotal API
    if (this.options.virustotal.enabled) {
      try {
        this.virusTotal = new VirusTotalAPI(this.options.virustotal.apiKey);
        console.log('🌐 VirusTotal API initialized');
      } catch (error) {
        console.warn('⚠️ VirusTotal initialization failed:', error.message);
        this.options.virustotal.enabled = false;
      }
    }

    console.log('🔧 Scanning engines initialized');
  }

  async initializeWebSocket() {
    this.wss = new WebSocket.Server({ 
      port: this.options.websocket.port,
      perMessageDeflate: false
    });

    this.wss.on('connection', (ws, req) => {
      console.log('🔌 WebSocket client connected');
      
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          this.handleWebSocketMessage(ws, data);
        } catch (error) {
          console.error('Invalid WebSocket message:', error);
        }
      });

      ws.on('close', () => {
        console.log('🔌 WebSocket client disconnected');
      });

      // Send current stats on connection
      ws.send(JSON.stringify({
        type: 'stats',
        data: this.scanStats
      }));
    });

    console.log(`🌐 WebSocket server listening on port ${this.options.websocket.port}`);
  }

  async initializeDatabase() {
    await this.databaseService.init();

    // Create scan results table
    const db = await this.databaseService.getDatabase();
    
    await db.run(`
      CREATE TABLE IF NOT EXISTS scan_results (
        id TEXT PRIMARY KEY,
        file_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_hash TEXT NOT NULL,
        scan_type TEXT NOT NULL,
        user_tier TEXT NOT NULL,
        status TEXT NOT NULL,
        threat_level TEXT DEFAULT 'clean',
        scan_engines TEXT NOT NULL,
        results TEXT NOT NULL,
        scan_time INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (file_id) REFERENCES uploaded_files (id)
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS scan_queue_status (
        job_id TEXT PRIMARY KEY,
        file_id TEXT NOT NULL,
        status TEXT NOT NULL,
        progress INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    console.log('🗄️ Scan database tables initialized');
  }

  async initializeDirectories() {
    if (this.options.quarantine.enabled) {
      await fs.mkdir(this.options.quarantine.path, { recursive: true });
      await fs.mkdir(path.join(__dirname, '../logs'), { recursive: true });
      console.log('📁 Quarantine and log directories created');
    }
  }

  async submitFile(fileData) {
    if (!this.isInitialized) {
      throw new Error('Scan daemon not initialized');
    }

    const {
      fileId,
      filePath,
      fileName,
      fileSize,
      fileHash,
      userTier = 'free',
      priority = null,
      userId,
      metadata = {}
    } = fileData;

    // Validate user tier and limits
    const tierConfig = this.scanningTiers[userTier];
    if (!tierConfig) {
      throw new Error(`Invalid user tier: ${userTier}`);
    }

    if (fileSize > tierConfig.maxFileSize) {
      throw new Error(`File size exceeds tier limit: ${fileSize} > ${tierConfig.maxFileSize}`);
    }

    // Check daily limits
    const dailyScans = await this.getDailyScansForUser(userId);
    if (dailyScans >= tierConfig.maxFilesPerDay) {
      throw new Error(`Daily scan limit exceeded for tier ${userTier}: ${dailyScans}/${tierConfig.maxFilesPerDay}`);
    }

    // Create scan job
    const jobId = uuidv4();
    const scanJob = {
      id: jobId,
      fileId,
      filePath,
      fileName,
      fileSize,
      fileHash,
      userTier,
      userId,
      metadata,
      scanners: tierConfig.scanners,
      submittedAt: new Date().toISOString()
    };

    // Add to queue with appropriate priority
    const job = await this.scanQueue.add('scan', scanJob, {
      priority: this.getPriorityValue(priority || tierConfig.priority),
      delay: 0
    });

    // Track job status
    await this.trackJobStatus(jobId, fileId, 'queued');

    console.log(`📋 Scan job ${jobId} queued for file ${fileName} (tier: ${userTier})`);

    return {
      jobId,
      status: 'queued',
      estimatedTime: this.getEstimatedScanTime(tierConfig.scanners, fileSize)
    };
  }

  async processScanJob(job) {
    const startTime = Date.now();
    const { data } = job;
    
    console.log(`🔍 Processing scan job ${data.id} for file ${data.fileName}`);
    
    try {
      await this.trackJobStatus(data.id, data.fileId, 'scanning');
      
      const scanResults = {
        jobId: data.id,
        fileId: data.fileId,
        filePath: data.filePath,
        fileName: data.fileName,
        fileHash: data.fileHash,
        userTier: data.userTier,
        startTime: new Date(startTime).toISOString(),
        engines: {},
        status: 'clean',
        threatLevel: 'clean',
        confidence: 100,
        recommendations: []
      };

      let progress = 0;
      const totalSteps = data.scanners.length;

      // Run each scanner based on user tier
      for (const scanner of data.scanners) {
        job.progress(Math.round((progress / totalSteps) * 100));
        
        console.log(`Running ${scanner} scanner...`);
        
        switch (scanner) {
          case 'basic_validation':
            scanResults.engines.basicValidation = await this.runBasicValidation(data);
            break;
            
          case 'clamav':
            if (this.options.clamav.enabled) {
              scanResults.engines.clamav = await this.runClamAVScan(data);
            }
            break;
            
          case 'yara_basic':
          case 'yara_full':
            scanResults.engines.yara = await this.runYARAScan(data, scanner === 'yara_full');
            break;
            
          case 'virustotal':
            if (this.options.virustotal.enabled) {
              scanResults.engines.virustotal = await this.runVirusTotalScan(data);
            }
            break;
            
          case 'advanced_analysis':
            scanResults.engines.advanced = await this.runAdvancedAnalysis(data);
            break;
        }
        
        progress++;
      }

      // Aggregate results and determine final status
      const finalResult = await this.aggregateResults(scanResults);
      
      // Store results in database
      await this.storeScanResults(finalResult);
      
      // Update job status
      await this.trackJobStatus(data.id, data.fileId, finalResult.status);
      
      const endTime = Date.now();
      finalResult.scanTime = endTime - startTime;
      finalResult.endTime = new Date(endTime).toISOString();

      console.log(`✅ Scan job ${data.id} completed: ${finalResult.status}`);
      
      return finalResult;
      
    } catch (error) {
      console.error(`❌ Scan job ${data.id} failed:`, error);
      await this.trackJobStatus(data.id, data.fileId, 'error');
      throw error;
    }
  }

  async runBasicValidation(fileData) {
    const result = {
      scanner: 'basic_validation',
      status: 'clean',
      findings: [],
      metadata: {}
    };

    try {
      // Check file existence
      const stats = await fs.stat(fileData.filePath);
      result.metadata.actualSize = stats.size;
      
      // Verify file hash
      const fileBuffer = await fs.readFile(fileData.filePath);
      const actualHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      
      if (actualHash !== fileData.fileHash) {
        result.status = 'suspicious';
        result.findings.push({
          type: 'hash_mismatch',
          message: 'File hash does not match expected value',
          severity: 'high'
        });
      }

      // Basic file type validation
      const fileTypeValidation = this.validateFileType(fileBuffer, fileData.fileName);
      if (!fileTypeValidation.valid) {
        result.status = 'suspicious';
        result.findings.push(fileTypeValidation);
      }

      result.metadata.scannedAt = new Date().toISOString();
      
    } catch (error) {
      result.status = 'error';
      result.error = error.message;
    }

    return result;
  }

  async runClamAVScan(fileData) {
    const result = {
      scanner: 'clamav',
      status: 'clean',
      findings: [],
      metadata: {}
    };

    try {
      const scanResult = await this.clamav.scanFile(fileData.filePath);
      
      result.metadata = {
        isInfected: scanResult.isInfected,
        viruses: scanResult.viruses || [],
        scannedAt: new Date().toISOString()
      };

      if (scanResult.isInfected) {
        result.status = 'infected';
        result.findings = scanResult.viruses.map(virus => ({
          type: 'malware',
          threat: virus,
          severity: 'critical'
        }));
      }

    } catch (error) {
      result.status = 'error';
      result.error = error.message;
    }

    return result;
  }

  async runYARAScan(fileData, fullRules = false) {
    const result = {
      scanner: 'yara',
      status: 'clean',
      findings: [],
      metadata: { fullRules }
    };

    try {
      // For now, we'll implement a basic rule check
      // In production, you'd use the yara-nodejs package
      const fileBuffer = await fs.readFile(fileData.filePath);
      const rules = await this.loadYARARules(fullRules);
      
      for (const rule of rules) {
        const matches = await this.checkYARARule(fileBuffer, rule, fileData);
        if (matches.length > 0) {
          result.status = 'suspicious';
          result.findings.push(...matches);
        }
      }

      result.metadata.rulesChecked = rules.length;
      result.metadata.scannedAt = new Date().toISOString();

    } catch (error) {
      result.status = 'error';
      result.error = error.message;
    }

    return result;
  }

  async runVirusTotalScan(fileData) {
    const result = {
      scanner: 'virustotal',
      status: 'clean',
      findings: [],
      metadata: {}
    };

    try {
      // Submit file hash to VirusTotal
      const hashResult = await this.virusTotal.fileReport(fileData.fileHash);
      
      if (hashResult.response_code === 1) {
        // File is known to VirusTotal
        const positives = hashResult.positives || 0;
        const total = hashResult.total || 0;
        
        result.metadata = {
          positives,
          total,
          scanDate: hashResult.scan_date,
          permalink: hashResult.permalink
        };

        if (positives > 0) {
          const riskLevel = this.calculateVirusTotalRisk(positives, total);
          result.status = riskLevel.status;
          result.findings.push({
            type: 'virustotal_detection',
            message: `${positives}/${total} engines detected threats`,
            severity: riskLevel.severity,
            details: hashResult.scans
          });
        }
      } else {
        // File not in VirusTotal database - could upload for Gold+ users
        result.metadata.message = 'File not found in VirusTotal database';
      }

    } catch (error) {
      result.status = 'error';
      result.error = error.message;
    }

    return result;
  }

  async runAdvancedAnalysis(fileData) {
    const result = {
      scanner: 'advanced_analysis',
      status: 'clean',
      findings: [],
      metadata: {}
    };

    try {
      // Advanced analysis could include:
      // - Entropy analysis
      // - File structure analysis
      // - Behavioral analysis
      // - ML-based classification

      const fileBuffer = await fs.readFile(fileData.filePath);
      
      // Calculate file entropy
      const entropy = this.calculateEntropy(fileBuffer);
      result.metadata.entropy = entropy;
      
      if (entropy > 7.5) {
        result.status = 'suspicious';
        result.findings.push({
          type: 'high_entropy',
          message: `High entropy detected: ${entropy.toFixed(2)}`,
          severity: 'medium'
        });
      }

      // Check for embedded executables in medical files
      if (this.hasEmbeddedExecutables(fileBuffer, fileData.fileName)) {
        result.status = 'suspicious';
        result.findings.push({
          type: 'embedded_executable',
          message: 'Potential embedded executable detected',
          severity: 'high'
        });
      }

      result.metadata.scannedAt = new Date().toISOString();

    } catch (error) {
      result.status = 'error';
      result.error = error.message;
    }

    return result;
  }

  // Helper methods

  validateFileType(fileBuffer, fileName) {
    const ext = path.extname(fileName).toLowerCase();
    
    // Basic magic number checks for medical files
    const magicNumbers = {
      '.dcm': [0x44, 0x49, 0x43, 0x4D], // "DICM" at offset 128
      '.pdf': [0x25, 0x50, 0x44, 0x46], // "%PDF"
      '.nii': [0x6E, 0x69, 0x31, 0x00], // NIfTI magic
    };

    if (magicNumbers[ext]) {
      const expected = magicNumbers[ext];
      const offset = ext === '.dcm' ? 128 : 0;
      
      for (let i = 0; i < expected.length; i++) {
        if (fileBuffer[offset + i] !== expected[i]) {
          return {
            valid: false,
            type: 'file_type_mismatch',
            message: `File extension ${ext} does not match file content`,
            severity: 'medium'
          };
        }
      }
    }

    return { valid: true };
  }

  calculateEntropy(buffer) {
    const frequencies = new Array(256).fill(0);
    for (let i = 0; i < buffer.length; i++) {
      frequencies[buffer[i]]++;
    }

    let entropy = 0;
    for (let i = 0; i < 256; i++) {
      if (frequencies[i] > 0) {
        const p = frequencies[i] / buffer.length;
        entropy -= p * Math.log2(p);
      }
    }

    return entropy;
  }

  hasEmbeddedExecutables(buffer, fileName) {
    // Check for PE headers (Windows executables)
    const peHeader = Buffer.from([0x4D, 0x5A]); // "MZ"
    
    for (let i = 0; i < buffer.length - 1; i++) {
      if (buffer[i] === peHeader[0] && buffer[i + 1] === peHeader[1]) {
        // Found potential PE header - check if it's suspicious location
        if (i > 1000) { // Not at the beginning of file
          return true;
        }
      }
    }

    return false;
  }

  calculateVirusTotalRisk(positives, total) {
    const ratio = positives / total;
    
    if (ratio >= 0.3) {
      return { status: 'infected', severity: 'critical' };
    } else if (ratio >= 0.1) {
      return { status: 'suspicious', severity: 'high' };
    } else if (positives > 0) {
      return { status: 'suspicious', severity: 'medium' };
    }
    
    return { status: 'clean', severity: 'info' };
  }

  async loadYARARules(fullRules) {
    // In a real implementation, these would be loaded from .yar files
    const basicRules = [
      {
        name: 'medical_file_executable',
        description: 'Detect executables in medical files',
        pattern: /MZ[\x00-\xFF]{58}PE/g
      },
      {
        name: 'script_in_dicom',
        description: 'Detect scripts in DICOM files',
        pattern: /<script|javascript|eval\(/gi
      }
    ];

    if (fullRules) {
      return [
        ...basicRules,
        {
          name: 'suspicious_network_activity',
          description: 'Detect network activity patterns',
          pattern: /http[s]?:\/\/[^\s]+|ftp:\/\/[^\s]+/gi
        },
        {
          name: 'crypto_patterns',
          description: 'Detect cryptographic patterns',
          pattern: /-----BEGIN [A-Z ]+-----/g
        }
      ];
    }

    return basicRules;
  }

  async checkYARARule(buffer, rule, fileData) {
    const matches = [];
    const content = buffer.toString('utf8', 0, Math.min(buffer.length, 10000)); // Check first 10KB
    
    const ruleMatches = content.match(rule.pattern);
    if (ruleMatches) {
      matches.push({
        type: 'yara_match',
        rule: rule.name,
        message: rule.description,
        matches: ruleMatches.length,
        severity: 'medium'
      });
    }

    return matches;
  }

  async aggregateResults(scanResults) {
    const engines = Object.values(scanResults.engines);
    let overallStatus = 'clean';
    let threatLevel = 'clean';
    let confidence = 100;
    const allFindings = [];

    // Collect all findings
    engines.forEach(engine => {
      if (engine.findings) {
        allFindings.push(...engine.findings);
      }
    });

    // Determine overall status based on engine results
    const infected = engines.some(engine => engine.status === 'infected');
    const suspicious = engines.some(engine => engine.status === 'suspicious');
    const errors = engines.some(engine => engine.status === 'error');

    if (infected) {
      overallStatus = 'infected';
      threatLevel = 'high';
      confidence = 95;
    } else if (suspicious) {
      overallStatus = 'suspicious';
      threatLevel = 'medium';
      confidence = 80;
    } else if (errors) {
      overallStatus = 'error';
      threatLevel = 'unknown';
      confidence = 0;
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(allFindings, overallStatus);

    return {
      ...scanResults,
      status: overallStatus,
      threatLevel,
      confidence,
      findings: allFindings,
      recommendations
    };
  }

  generateRecommendations(findings, status) {
    const recommendations = [];

    if (status === 'infected') {
      recommendations.push('Quarantine file immediately');
      recommendations.push('Do not execute or open file');
      recommendations.push('Notify security team');
    } else if (status === 'suspicious') {
      recommendations.push('Review file carefully before use');
      recommendations.push('Consider additional scanning');
      recommendations.push('Monitor file usage');
    }

    // Specific recommendations based on findings
    findings.forEach(finding => {
      switch (finding.type) {
        case 'hash_mismatch':
          recommendations.push('Verify file integrity and re-upload if necessary');
          break;
        case 'high_entropy':
          recommendations.push('File may be compressed or encrypted - verify source');
          break;
        case 'embedded_executable':
          recommendations.push('Scan with additional tools - potential malware');
          break;
      }
    });

    return [...new Set(recommendations)]; // Remove duplicates
  }

  async storeScanResults(results) {
    const db = await this.databaseService.getDatabase();
    
    await db.run(`
      INSERT INTO scan_results (
        id, file_id, file_path, file_hash, scan_type, user_tier,
        status, threat_level, scan_engines, results, scan_time, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      uuidv4(),
      results.fileId,
      results.filePath,
      results.fileHash,
      'comprehensive',
      results.userTier,
      results.status,
      results.threatLevel,
      JSON.stringify(Object.keys(results.engines)),
      JSON.stringify(results),
      results.scanTime || 0,
      new Date().toISOString()
    ]);

    // Log scan for audit
    await this.auditService.logScanResult(results);
  }

  async trackJobStatus(jobId, fileId, status, progress = null) {
    const db = await this.databaseService.getDatabase();
    
    await db.run(`
      INSERT OR REPLACE INTO scan_queue_status (
        job_id, file_id, status, progress, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 
        COALESCE((SELECT created_at FROM scan_queue_status WHERE job_id = ?), ?),
        ?
      )
    `, [
      jobId, fileId, status, progress || 0, 
      jobId, new Date().toISOString(), 
      new Date().toISOString()
    ]);
  }

  async getDailyScansForUser(userId) {
    const db = await this.databaseService.getDatabase();
    const today = new Date().toISOString().split('T')[0];
    
    const result = await db.get(`
      SELECT COUNT(*) as count 
      FROM scan_results sr
      JOIN uploaded_files uf ON sr.file_id = uf.id
      WHERE uf.uploaded_by = ? AND DATE(sr.created_at) = ?
    `, [userId, today]);

    return result?.count || 0;
  }

  getPriorityValue(priority) {
    const priorities = {
      'urgent': 1,
      'high': 2, 
      'normal': 3,
      'low': 4
    };
    return priorities[priority] || 3;
  }

  getEstimatedScanTime(scanners, fileSize) {
    const baseTimes = {
      'basic_validation': 1,
      'clamav': 5,
      'yara_basic': 3,
      'yara_full': 8,
      'virustotal': 15,
      'advanced_analysis': 10
    };

    const totalTime = scanners.reduce((sum, scanner) => {
      return sum + (baseTimes[scanner] || 5);
    }, 0);

    // Adjust for file size (larger files take longer)
    const sizeFactor = Math.max(1, fileSize / (10 * 1024 * 1024)); // Base on 10MB
    
    return Math.round(totalTime * sizeFactor);
  }

  updateStats(result) {
    this.scanStats.totalScans++;
    
    switch (result.status) {
      case 'clean':
        this.scanStats.cleanFiles++;
        break;
      case 'infected':
        this.scanStats.infectedFiles++;
        break;
      case 'suspicious':
        this.scanStats.suspiciousFiles++;
        break;
      default:
        this.scanStats.errors++;
    }

    if (result.scanTime) {
      this.scanStats.averageScanTime = Math.round(
        (this.scanStats.averageScanTime + result.scanTime) / 2
      );
    }
  }

  broadcastScanResult(jobData, result) {
    const message = {
      type: 'scan_result',
      jobId: jobData.id,
      fileId: jobData.fileId,
      fileName: jobData.fileName,
      result
    };

    this.broadcast(message);
  }

  broadcastProgress(jobData, progress) {
    const message = {
      type: 'scan_progress',
      jobId: jobData.id,
      fileId: jobData.fileId,
      progress
    };

    this.broadcast(message);
  }

  broadcast(message) {
    if (this.wss) {
      this.wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(message));
        }
      });
    }
  }

  handleWebSocketMessage(ws, data) {
    switch (data.type) {
      case 'get_stats':
        ws.send(JSON.stringify({
          type: 'stats',
          data: this.scanStats
        }));
        break;
        
      case 'get_queue_status':
        this.getQueueStatus().then(status => {
          ws.send(JSON.stringify({
            type: 'queue_status',
            data: status
          }));
        });
        break;
    }
  }

  async getQueueStatus() {
    const waiting = await this.scanQueue.getWaiting();
    const active = await this.scanQueue.getActive();
    const completed = await this.scanQueue.getCompleted();
    const failed = await this.scanQueue.getFailed();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length
    };
  }

  async getScanResult(jobId) {
    const db = await this.databaseService.getDatabase();
    
    const result = await db.get(`
      SELECT * FROM scan_results 
      WHERE JSON_EXTRACT(results, '$.jobId') = ?
    `, [jobId]);

    if (result) {
      return {
        ...result,
        results: JSON.parse(result.results)
      };
    }

    return null;
  }

  async getFileScans(fileId) {
    const db = await this.databaseService.getDatabase();
    
    const scans = await db.all(`
      SELECT * FROM scan_results 
      WHERE file_id = ? 
      ORDER BY created_at DESC
    `, [fileId]);

    return scans.map(scan => ({
      ...scan,
      results: JSON.parse(scan.results),
      scan_engines: JSON.parse(scan.scan_engines)
    }));
  }

  async shutdown() {
    console.log('🛑 Shutting down Medical File Scan Daemon...');

    if (this.scanQueue) {
      await this.scanQueue.close();
    }

    if (this.redis) {
      await this.redis.quit();
    }

    if (this.wss) {
      this.wss.close();
    }

    console.log('✅ Medical File Scan Daemon shutdown complete');
  }
}

module.exports = MedicalFileScanDaemon;