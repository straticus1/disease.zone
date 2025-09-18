# Medical File Scanning Daemon Documentation

## Overview

The Medical File Scanning Daemon is a comprehensive security scanning service designed specifically for medical files. It provides multi-tiered scanning capabilities including antivirus detection, YARA rule-based analysis, and VirusTotal integration for premium users.

## Architecture

### Core Components

```
┌─────────────────────────────────────────┐
│         Medical File Scanner            │
├─────────────────────────────────────────┤
│  Queue Manager (Redis/Bull)             │
├─────────────────────────────────────────┤
│  Pipeline Engine:                       │
│  1. Basic Validation                    │
│  2. ClamAV (Antivirus)                  │
│  3. YARA Rules (Pattern Matching)       │
│  4. VirusTotal API (Gold tier)          │
│  5. Advanced Analysis                   │
├─────────────────────────────────────────┤
│  Results Aggregator & Risk Scoring     │
├─────────────────────────────────────────┤
│  WebSocket/API Response Handler         │
└─────────────────────────────────────────┘
```

### Scanning Tiers

The daemon supports four subscription tiers with different scanning capabilities:

#### Free Tier
- **Scanners**: Basic validation, ClamAV
- **File size limit**: 10MB
- **Daily limit**: 50 files
- **Priority**: Low

#### Premium Tier
- **Scanners**: Basic validation, ClamAV, Basic YARA rules
- **File size limit**: 50MB
- **Daily limit**: 200 files
- **Priority**: Normal

#### Gold Tier
- **Scanners**: All scanners including VirusTotal API
- **File size limit**: 100MB
- **Daily limit**: 1,000 files
- **Priority**: High

#### Enterprise Tier
- **Scanners**: All scanners + custom rules
- **File size limit**: 500MB
- **Daily limit**: 10,000 files
- **Priority**: Urgent

## Installation and Setup

### Prerequisites

1. **Redis Server** (for queue management)
2. **ClamAV** (antivirus engine)
3. **Node.js** dependencies

### Installation Steps

1. **Install Redis**:
```bash
# Ubuntu/Debian
sudo apt-get install redis-server

# macOS
brew install redis

# Start Redis
redis-server
```

2. **Install ClamAV**:
```bash
# Ubuntu/Debian
sudo apt-get install clamav clamav-daemon

# macOS
brew install clamav

# Start ClamAV daemon
sudo freshclam
sudo clamd
```

3. **Install Node.js Dependencies**:
```bash
npm install bull redis clamscan virustotal-api axios ws
```

### Configuration

Set the following environment variables:

```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# ClamAV Configuration
CLAMAV_HOST=localhost
CLAMAV_PORT=3310

# VirusTotal Configuration (Gold tier)
VIRUSTOTAL_API_KEY=your_virustotal_api_key

# WebSocket Configuration
SCAN_DAEMON_WS_PORT=8081
```

## Usage

### Starting the Daemon

```bash
# Start the daemon
node scanDaemon.js start

# Or use PM2 for production
pm2 start scanDaemon.js --name "medical-scan-daemon"
```

### Daemon Management

```bash
# Check status
node scanDaemon.js status

# Stop daemon
node scanDaemon.js stop

# Restart daemon
node scanDaemon.js restart

# Show help
node scanDaemon.js help
```

### API Integration

```javascript
const MedicalFileScanDaemon = require('./services/medicalFileScanDaemon');

const scanDaemon = new MedicalFileScanDaemon();
await scanDaemon.initialize();

// Submit file for scanning
const result = await scanDaemon.submitFile({
    fileId: 'unique-file-id',
    filePath: '/path/to/medical/file.dcm',
    fileName: 'scan.dcm',
    fileSize: 1024000,
    fileHash: 'sha256-hash',
    userTier: 'gold',
    userId: 'user-id'
});

console.log('Scan job submitted:', result.jobId);
```

## Scanning Engines

### 1. Basic Validation
- File existence and integrity verification
- Hash validation
- File type validation against magic numbers
- Basic malformation detection

### 2. ClamAV Integration
- Real-time antivirus scanning
- Updated virus signature database
- Malware detection and quarantine
- Performance optimized for medical files

### 3. YARA Rules
Custom rules designed for medical file security:

#### Basic Rules (All Tiers)
- Executable detection in medical files
- Script injection in DICOM files
- Basic malware patterns

#### Advanced Rules (Premium+)
- Steganography detection
- Network communication patterns
- Obfuscated code detection
- Medical-specific anomalies

### 4. VirusTotal API (Gold+)
- Multi-engine scanning (70+ engines)
- Hash-based lookups
- Risk scoring based on detection ratios
- Historical analysis data

### 5. Advanced Analysis (Gold+)
- Entropy analysis for encrypted payloads
- Embedded executable detection
- Behavioral pattern analysis
- ML-based classification

## YARA Rules

### Medical File Specific Rules

The daemon includes specialized YARA rules for medical files:

#### `/security/yara-rules/medical_files.yar`
- General medical file security rules
- Cross-format threat detection
- Network reference detection
- Steganography markers

#### `/security/yara-rules/dicom_specific.yar`
- DICOM format validation
- DICOM-specific threat detection
- Metadata injection detection
- Image payload analysis

### Custom Rule Development

To add custom YARA rules:

1. Create `.yar` files in `/security/yara-rules/`
2. Follow YARA syntax guidelines
3. Test rules with sample files
4. Update daemon configuration

Example custom rule:
```yara
rule Medical_Custom_Threat : suspicious
{
    meta:
        description = "Custom threat pattern"
        author = "Security Team"
        
    strings:
        $pattern = "suspicious_string"
        
    condition:
        $pattern and filesize < 100MB
}
```

## WebSocket API

### Real-time Updates

Connect to the WebSocket server for real-time scan updates:

```javascript
const ws = new WebSocket('ws://localhost:8081');

ws.onmessage = function(event) {
    const data = JSON.parse(event.data);
    
    switch(data.type) {
        case 'scan_result':
            console.log('Scan completed:', data);
            break;
        case 'scan_progress':
            console.log('Scan progress:', data.progress);
            break;
        case 'stats':
            console.log('Updated stats:', data.data);
            break;
    }
};
```

### Message Types

#### Scan Result
```json
{
    "type": "scan_result",
    "jobId": "job-uuid",
    "fileId": "file-uuid",
    "fileName": "medical_file.dcm",
    "result": {
        "status": "clean|suspicious|infected|error",
        "threatLevel": "clean|medium|high",
        "confidence": 95,
        "findings": [...],
        "recommendations": [...]
    }
}
```

#### Scan Progress
```json
{
    "type": "scan_progress",
    "jobId": "job-uuid",
    "fileId": "file-uuid",
    "progress": 75
}
```

#### Statistics Update
```json
{
    "type": "stats",
    "data": {
        "totalScans": 1234,
        "cleanFiles": 1200,
        "suspiciousFiles": 30,
        "infectedFiles": 4,
        "errors": 0,
        "averageScanTime": 1500
    }
}
```

## Database Schema

### Scan Results Table
```sql
CREATE TABLE scan_results (
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
    created_at TEXT NOT NULL
);
```

### Scan Queue Status Table
```sql
CREATE TABLE scan_queue_status (
    job_id TEXT PRIMARY KEY,
    file_id TEXT NOT NULL,
    status TEXT NOT NULL,
    progress INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
```

## REST API Endpoints

### File Scanning

#### Submit File for Scanning
```http
POST /api/medical-files/upload
Content-Type: multipart/form-data

- Automatically triggers scanning for uploaded files
- Returns scan job ID and estimated completion time
```

#### Get Scan Results
```http
GET /api/medical-files/{fileId}/scans
Authorization: Bearer {token}

Response:
{
    "fileId": "file-uuid",
    "scans": [
        {
            "id": "scan-uuid",
            "status": "clean",
            "threat_level": "clean",
            "scan_engines": ["clamav", "yara"],
            "created_at": "2025-09-18T10:30:00Z",
            "results": {...}
        }
    ]
}
```

#### Get Scan Queue Status
```http
GET /api/medical-files/scan-queue
Authorization: Bearer {token}

Response:
{
    "waiting": 5,
    "active": 2,
    "completed": 1250,
    "failed": 3
}
```

#### Rescan File (Premium+)
```http
POST /api/medical-files/{fileId}/rescan
Authorization: Bearer {token}

Response:
{
    "message": "File submitted for rescanning",
    "scanJobId": "job-uuid",
    "estimatedTime": 30
}
```

## Security Considerations

### HIPAA Compliance
- All scan operations are logged for audit trails
- PHI data is never transmitted to external services (except VirusTotal for Gold+)
- File access is controlled through authentication
- Scan results include privacy recommendations

### Data Protection
- Files are scanned in isolated environments
- Temporary files are securely deleted after scanning
- Scan results are encrypted in transit
- User tier limitations prevent abuse

### Quarantine Management
- Infected files are automatically quarantined
- Quarantine directory has restricted access
- Quarantined files can be reviewed by administrators
- Automatic cleanup of old quarantined files

## Performance Optimization

### Queue Management
- Priority-based job processing
- Concurrent worker processes
- Automatic retry with exponential backoff
- Dead letter queue for failed jobs

### Caching
- Virus signature caching
- YARA rule compilation caching
- Scan result caching for duplicate files
- User tier information caching

### Monitoring
- Real-time performance metrics
- Queue depth monitoring
- Error rate tracking
- Resource usage monitoring

## Troubleshooting

### Common Issues

#### ClamAV Connection Failed
```bash
# Check ClamAV daemon status
sudo systemctl status clamav-daemon

# Restart ClamAV
sudo systemctl restart clamav-daemon

# Update virus signatures
sudo freshclam
```

#### Redis Connection Issues
```bash
# Check Redis status
redis-cli ping

# Restart Redis
sudo systemctl restart redis-server

# Check Redis logs
sudo journalctl -u redis-server
```

#### VirusTotal API Errors
- Check API key validity
- Verify API rate limits
- Monitor API quota usage
- Ensure network connectivity

### Log Files

#### Daemon Logs
- Main log: `logs/scan-daemon.log`
- Error log: `logs/scan-errors.log`
- Audit log: `logs/scan-audit.log`

#### ClamAV Logs
- Scan log: `logs/clamav.log`
- Daemon log: `/var/log/clamav/clamav.log`

#### Queue Logs
- Job processing: `logs/queue.log`
- Failed jobs: `logs/queue-errors.log`

### Performance Tuning

#### Redis Configuration
```
# redis.conf optimizations
maxmemory 2gb
maxmemory-policy allkeys-lru
save 900 1
```

#### ClamAV Configuration
```
# clamd.conf optimizations
MaxThreads 12
MaxFileSize 100M
MaxScanSize 100M
```

## Monitoring and Alerting

### Metrics Collection
- Scan throughput (files/minute)
- Average scan time per engine
- Queue depth and processing rate
- Error rates by scan type
- Resource utilization

### Alert Conditions
- High queue depth (>100 pending)
- Elevated error rates (>5%)
- Scanner engine failures
- Excessive scan times (>5 minutes)
- Infected file detection

### Integration with Monitoring Systems
```javascript
// Example Prometheus metrics export
const prometheus = require('prom-client');

const scanCounter = new prometheus.Counter({
    name: 'medical_scan_total',
    help: 'Total number of medical file scans',
    labelNames: ['status', 'tier', 'engine']
});

const scanDuration = new prometheus.Histogram({
    name: 'medical_scan_duration_seconds',
    help: 'Duration of medical file scans',
    labelNames: ['tier', 'engine']
});
```

## Development and Testing

### Running Tests
```bash
# Unit tests
npm test

# Integration tests with ClamAV
npm run test:integration

# Load testing
npm run test:load
```

### Mock Data
The daemon includes mock data for development:
```bash
# Generate test files
npm run generate-test-files

# Run with mock scanners
NODE_ENV=development npm start
```

### Debugging
```bash
# Enable debug mode
DEBUG=scan-daemon:* node scanDaemon.js start

# Verbose logging
VERBOSE=true node scanDaemon.js start
```

## License and Support

This medical file scanning daemon is part of the disease.zone platform and follows the same licensing terms. For support and feature requests, please contact the development team.

## Changelog

### v1.0.0 (2025-09-18)
- Initial release
- ClamAV integration
- YARA rule engine
- VirusTotal API support
- Tiered scanning system
- WebSocket real-time updates
- Comprehensive audit logging