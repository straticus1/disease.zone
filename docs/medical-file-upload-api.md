# Medical File Upload API Documentation

## Overview

The Medical File Upload API provides comprehensive support for uploading, managing, and processing medical files in various formats including DICOM medical imaging, HL7/FHIR health data exchange formats, and research documents.

## Supported File Formats

### Medical Imaging
- **DICOM** (.dcm, .dicom) - Digital Imaging and Communications in Medicine
- **NIfTI** (.nii, .nifti) - Neuroimaging Informatics Technology Initiative  
- **MINC** (.mnc, .minc) - Medical Image NetCDF format

### Health Data Exchange
- **HL7** (.hl7) - Health Level Seven International standard
- **FHIR** (.json, .xml) - Fast Healthcare Interoperability Resources

### General Medical Documents
- **PDF** (.pdf) - Portable Document Format for reports
- **CSV** (.csv) - Comma-separated values for datasets
- **JSON** (.json) - JavaScript Object Notation for structured data
- **XML** (.xml) - Extensible Markup Language for structured documents

## API Endpoints

### Upload Medical Files

**Endpoint:** `POST /api/medical-files/upload`

**Authentication:** Required (JWT Bearer token)

**Content-Type:** `multipart/form-data`

**Parameters:**
- `medicalFiles[]` (files) - Array of medical files to upload (max 10 files, 100MB each)
- `createCase` (boolean) - Whether to create a research case for the uploaded files
- `caseTitle` (string) - Title for the research case (if createCase is true)
- `caseDescription` (string) - Description for the research case (if createCase is true)
- `sendConfirmation` (boolean) - Whether to send email confirmation (default: true)

**Response:**
```json
{
  "success": true,
  "message": "Files uploaded successfully",
  "filesUploaded": 2,
  "files": [
    {
      "id": "file-uuid-1",
      "originalName": "chest_ct.dcm",
      "fileType": "dicom",
      "size": 2457600,
      "isValid": true
    },
    {
      "id": "file-uuid-2", 
      "originalName": "patient_report.pdf",
      "fileType": "pdf",
      "size": 1024000,
      "isValid": true
    }
  ],
  "caseId": "case-uuid-123"
}
```

### Search Medical Files

**Endpoint:** `GET /api/medical-files/search`

**Authentication:** Required (JWT Bearer token)

**Query Parameters:**
- `q` (string) - Search query (file name, content, metadata)
- `fileType` (string) - Filter by file type (dicom, fhir, hl7, nifti, minc, pdf, csv, json, xml)
- `dateFrom` (string) - Filter files uploaded after this date (ISO format)
- `dateTo` (string) - Filter files uploaded before this date (ISO format)
- `page` (number) - Page number for pagination (default: 1)
- `limit` (number) - Number of results per page (default: 20)

**Response:**
```json
{
  "success": true,
  "files": [
    {
      "id": "file-uuid-1",
      "original_name": "chest_ct.dcm",
      "file_type": "dicom",
      "file_size": 2457600,
      "uploaded_at": "2024-09-18T10:30:00Z",
      "metadata": {
        "dicomMetadata": {
          "modality": "CT",
          "studyDescription": "Chest CT with contrast",
          "patientID": "anonymized",
          "isValid": true
        }
      }
    }
  ],
  "total": 1,
  "page": 1,
  "hasMore": false
}
```

### Get File Details

**Endpoint:** `GET /api/medical-files/:fileId`

**Authentication:** Required (JWT Bearer token)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "file-uuid-1",
    "original_name": "chest_ct.dcm",
    "filename": "1726656600000_file-uuid-1.dcm",
    "file_path": "/path/to/uploads/dicom/1726656600000_file-uuid-1.dcm",
    "file_size": 2457600,
    "mimetype": "application/dicom",
    "file_type": "dicom",
    "file_hash": "sha256-hash",
    "uploaded_at": "2024-09-18T10:30:00Z",
    "metadata": {
      "dicomMetadata": {
        "modality": "CT",
        "studyDescription": "Chest CT with contrast",
        "seriesDescription": "Axial images",
        "institutionName": "Hospital Name",
        "isValid": true
      }
    }
  }
}
```

### Download File

**Endpoint:** `GET /api/medical-files/:fileId/download`

**Authentication:** Required (JWT Bearer token)

**Response:** File download with appropriate headers

### Get File Statistics

**Endpoint:** `GET /api/medical-files/stats`

**Authentication:** Required (JWT Bearer token)

**Response:**
```json
{
  "success": true,
  "data": {
    "totalFiles": 125,
    "totalSize": 524288000,
    "byType": [
      {
        "file_type": "dicom",
        "count": 45,
        "total_size": 314572800
      },
      {
        "file_type": "pdf",
        "count": 30,
        "total_size": 104857600
      },
      {
        "file_type": "fhir",
        "count": 25,
        "total_size": 52428800
      }
    ]
  }
}
```

### Assign File to Doctor/Group

**Endpoint:** `POST /api/medical-files/:fileId/assign`

**Authentication:** Required (JWT Bearer token)

**Request Body:**
```json
{
  "doctorId": "doctor-uuid-123",
  "groupId": "group-uuid-456"  // Optional
}
```

**Response:**
```json
{
  "success": true,
  "message": "File assigned successfully",
  "fileId": "file-uuid-1",
  "assignedTo": "doctor-uuid-123"
}
```

### Take File Ownership

**Endpoint:** `POST /api/medical-files/:fileId/take-ownership`

**Authentication:** Required (JWT Bearer token)

**Response:**
```json
{
  "success": true,
  "message": "Ownership taken successfully",
  "fileId": "file-uuid-1",
  "ownedBy": "doctor-uuid-123"
}
```

### Get Research Cases

**Endpoint:** `GET /api/medical-files/cases`

**Authentication:** Required (JWT Bearer token)

**Query Parameters:**
- `status` (string) - Filter by case status (pending, active, completed)
- `page` (number) - Page number for pagination (default: 1)
- `limit` (number) - Number of results per page (default: 20)

**Response:**
```json
{
  "success": true,
  "data": {
    "cases": [
      {
        "id": "case-uuid-123",
        "title": "Chest CT Analysis Study",
        "description": "Comparative analysis of chest CT scans",
        "submitter_email": "researcher@hospital.com",
        "submitter_name": "Dr. Jane Smith",
        "fileIds": ["file-uuid-1", "file-uuid-2"],
        "status": "pending",
        "created_at": "2024-09-18T10:30:00Z",
        "updated_at": "2024-09-18T10:30:00Z"
      }
    ],
    "page": 1
  }
}
```

## File Processing Details

### DICOM Processing
- Automatic DICOM header parsing
- Extraction of patient ID, study information, modality
- Validation of DICOM format integrity
- Privacy-compliant metadata extraction

### FHIR/HL7 Processing
- JSON and XML FHIR resource validation
- HL7 v2 message parsing
- Resource type identification
- Compliance with FHIR R4 standard

### PDF Processing
- Text extraction from medical reports
- Full-text indexing for search
- Metadata preservation

### Neuroimaging Processing
- NIfTI header validation
- Dimension and datatype extraction
- Format compliance checking

## Security & Compliance

### HIPAA Compliance
- Secure file storage with encryption at rest
- Audit logging for all file operations
- Access controls and user authentication
- PHI anonymization and de-identification

### File Security
- SHA-256 hash generation for integrity verification
- Virus scanning (optional integration)
- File size and type validation
- Secure upload directory isolation

### Access Control
- JWT-based authentication required
- Role-based access permissions
- File ownership and assignment tracking
- Audit trail for all file access

## Error Handling

### Common Error Responses

**400 Bad Request:**
```json
{
  "success": false,
  "message": "File type application/executable is not allowed",
  "error": "INVALID_FILE_TYPE"
}
```

**401 Unauthorized:**
```json
{
  "success": false,
  "message": "Authentication required",
  "error": "UNAUTHORIZED"
}
```

**404 Not Found:**
```json
{
  "success": false,
  "message": "File not found",
  "error": "FILE_NOT_FOUND"
}
```

**413 Payload Too Large:**
```json
{
  "success": false,
  "message": "File size exceeds maximum limit of 100MB",
  "error": "FILE_TOO_LARGE"
}
```

**500 Internal Server Error:**
```json
{
  "success": false,
  "message": "File processing failed",
  "error": "PROCESSING_ERROR"
}
```

## Rate Limits

- **Upload:** 10 files per request, 100MB per file
- **Search:** 100 requests per minute per user
- **Download:** 50 requests per minute per user

## Examples

### Upload Multiple Medical Files with Research Case

```bash
curl -X POST http://localhost:3000/api/medical-files/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "medicalFiles=@chest_ct.dcm" \
  -F "medicalFiles=@radiology_report.pdf" \
  -F "medicalFiles=@lab_results.hl7" \
  -F "createCase=true" \
  -F "caseTitle=Patient X Diagnostic Review" \
  -F "caseDescription=Complete diagnostic workup including imaging and lab work"
```

### Search for DICOM Files from Last Week

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:3000/api/medical-files/search?fileType=dicom&dateFrom=2024-09-11T00:00:00Z"
```

### Download a Specific File

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -o downloaded_file.dcm \
  "http://localhost:3000/api/medical-files/file-uuid-123/download"
```

## Integration Notes

- All file metadata is stored in SQLite database with JSON fields
- File uploads trigger automatic email notifications
- Research cases link multiple files for collaborative review
- Full audit trail maintained for compliance requirements
- Integration with existing FHIR and authentication services