# FHIR Integration Guide

## Overview

diseaseZone's FHIR (Fast Healthcare Interoperability Resources) integration revolutionizes healthcare connectivity by enabling direct connections to healthcare providers, importing real patient data, and generating personalized health insights while maintaining complete privacy.

## 🏥 Key Features

### Hospital Discovery & Connection
- **Search FHIR-enabled hospitals** by location, name, state, distance
- **Real-time capability checking** - determine what data each hospital can provide
- **SMART on FHIR authentication** for secure hospital connections
- **Multi-server support** - Epic, Cerner, HAPI FHIR, Smart Health IT

### Health Data Import
- **FHIR Observations**: Lab results, vital signs, clinical measurements
- **FHIR Conditions**: Diagnoses and medical conditions with ICD-10 mapping
- **FHIR Immunizations**: Vaccination records and immunization history
- **FHIR Organizations**: Healthcare provider information and contacts

### Personalized Health Insights
- **Disease-specific recommendations** based on user's actual health data
- **Risk factor analysis** using surveillance algorithms
- **Local disease pattern comparison** (user's data vs regional trends)
- **Personalized prevention strategies**

## 🔒 Privacy-First Design

### Complete Data Anonymization
- **ICD-10 mapping** to internal disease codes for standardization
- **Geographic anonymization** for population-level insights
- **Age group categorization** instead of specific ages
- **Severity classification** without personal identifiers

### Enhanced Disease Surveillance
- **Anonymous contribution** to national disease surveillance
- **Geographic pattern analysis** for outbreak detection
- **Temporal trend analysis** for epidemic forecasting
- **Privacy-protected data sharing** for research advancement

## 🚀 API Endpoints

### Hospital Search and Discovery
```http
GET /api/fhir/hospitals/search
```

**Parameters:**
- `location` - Geographic location (e.g., "New York, NY")
- `name` - Hospital or organization name
- `state` - State abbreviation (e.g., "NY", "CA")
- `city` - City name
- `radius` - Search radius in miles (default: 50)
- `includeTest` - Include test/sandbox environments (default: false)

**Response:**
```json
{
  "success": true,
  "totalResults": 15,
  "hospitals": [
    {
      "id": "hospital-123",
      "name": "Example Medical Center",
      "fhirServerId": "epic-sandbox",
      "fhirVersion": "R4",
      "address": {
        "line": ["123 Health St"],
        "city": "New York",
        "state": "NY",
        "postalCode": "10001"
      },
      "capabilities": {
        "fhirVersion": "4.0.1",
        "supportedResources": [
          {"type": "Patient", "interactions": ["read", "search"]},
          {"type": "Observation", "interactions": ["read", "search"]},
          {"type": "Condition", "interactions": ["read", "search"]}
        ],
        "smartEnabled": true
      },
      "distance": 2.3,
      "testEnvironment": false
    }
  ]
}
```

### Initiate Hospital Connection
```http
POST /api/fhir/hospitals/connect
```

**Request Body:**
```json
{
  "hospitalId": "hospital-123",
  "scopes": ["patient/*.read"],
  "purpose": "disease-surveillance-insights"
}
```

**Response:**
```json
{
  "success": true,
  "connectionId": "fhir_1694889123456_abc123",
  "authorizationUrl": "https://fhir.hospital.com/auth/authorize?...",
  "instructions": [
    "1. Click the authorization link to connect to your hospital",
    "2. Log in with your patient portal credentials",
    "3. Review and approve data sharing permissions",
    "4. You will be redirected back to diseaseZone"
  ],
  "expiresAt": "2025-09-16T05:30:00.000Z"
}
```

### Get User's Hospital Connections
```http
GET /api/fhir/connections
```

**Response:**
```json
{
  "success": true,
  "connections": [
    {
      "id": "fhir_1694889123456_abc123",
      "hospitalId": "hospital-123",
      "hospitalName": "Example Medical Center",
      "status": "active",
      "connectedAt": "2025-09-16T04:00:00.000Z",
      "lastActivity": "2025-09-16T04:30:00.000Z",
      "patientId": "linked"
    }
  ]
}
```

### Sync Health Data
```http
POST /api/fhir/sync/:connectionId
```

**Request Body:**
```json
{
  "includeObservations": true,
  "includeConditions": true,
  "includeImmunizations": true,
  "anonymizeData": true
}
```

**Response:**
```json
{
  "success": true,
  "connectionId": "fhir_1694889123456_abc123",
  "syncResults": {
    "observations": [...],
    "conditions": [...],
    "immunizations": [...],
    "anonymizedInsights": {
      "diseaseExposures": [...],
      "riskFactors": [...],
      "geographicPatterns": []
    }
  },
  "recordCount": 25
}
```

### Get Personalized Health Insights
```http
GET /api/fhir/insights/:connectionId
```

**Response:**
```json
{
  "success": true,
  "insights": {
    "personalizedRiskFactors": [],
    "diseasePreventionRecommendations": [
      {
        "disease": "chlamydia",
        "recommendation": "Regular STD testing, safe sexual practices, and partner notification",
        "priority": "standard",
        "anonymous": true
      }
    ],
    "localDiseasePatterns": [
      {
        "disease": "chlamydia",
        "localTrend": "stable",
        "comparisonToNational": "below_average",
        "anonymous": true
      }
    ],
    "healthTrends": {
      "riskLevel": "low",
      "recommendations": [
        "Continue regular health screenings",
        "Maintain open communication with healthcare providers"
      ]
    }
  },
  "dataContribution": {
    "anonymousContribution": true,
    "enhancesSurveillance": true,
    "protectsPrivacy": true
  }
}
```

## 💻 Frontend Integration

### FHIR Dashboard Access
Access the FHIR hospital integration dashboard at:
```
http://localhost:3000/fhir-dashboard.html
```

### JavaScript Integration
```javascript
// Search for hospitals
const hospitals = await fetch('/api/fhir/hospitals/search?city=Boston&state=MA')
  .then(response => response.json());

// Initiate connection
const connection = await fetch('/api/fhir/hospitals/connect', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    hospitalId: 'hospital-123',
    scopes: ['patient/*.read'],
    purpose: 'disease-surveillance-insights'
  })
}).then(response => response.json());

// Redirect user to authorization URL
if (connection.success) {
  window.location.href = connection.authorizationUrl;
}
```

## 🔧 FHIR Service Configuration

### Supported FHIR Servers
- **HAPI FHIR**: `https://hapi.fhir.org/baseR4`
- **Smart Health IT**: `https://launch.smarthealthit.org/v/r4/fhir`
- **Cerner Sandbox**: `https://fhir-open.cerner.com/r4`
- **Epic Sandbox**: `https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4`

### FHIR Resource Types
- **Organization**: Healthcare organizations and hospitals
- **Patient**: Patient demographic and contact information
- **Observation**: Clinical observations and test results
- **Condition**: Patient conditions and diagnoses
- **DiagnosticReport**: Diagnostic test reports
- **Immunization**: Vaccination records
- **Location**: Physical locations of care
- **Practitioner**: Healthcare providers

### Disease Mapping (ICD-10 to Internal Codes)
- **A54**: Gonorrhea → `gonorrhea`
- **A56**: Chlamydia → `chlamydia`
- **A51**: Syphilis → `syphilis`
- **B20**: HIV → `hiv`
- **B21**: AIDS → `aids`
- **Z87**: Personal History → `personal_history`

## 🛡️ Security & Compliance

### OAuth2 Security
- **SMART on FHIR** authorization flow
- **Scoped access** with patient consent
- **Secure token storage** with automatic refresh
- **Connection management** with activity tracking

### Privacy Protection
- **Complete anonymization** before any analysis
- **No personal identifiers** stored or transmitted
- **Geographic anonymization** for location data
- **Age group categorization** instead of specific ages

### HIPAA Compliance
- **PHI protection** through anonymization
- **Audit logging** for all FHIR operations
- **Secure transmission** with TLS 1.3
- **Data retention policies** per regulatory requirements

## 📊 System Status

### Health Check Endpoint
```http
GET /api/fhir/status
```

**Response:**
```json
{
  "service": "FHIR Integration Service",
  "timestamp": "2025-09-16T05:00:00.000Z",
  "capabilities": {
    "hospitalSearch": true,
    "smartOnFhir": true,
    "anonymizedInsights": true,
    "diseaseTracking": true,
    "privacyProtected": true
  },
  "supportedResources": [
    "Organization", "Patient", "Observation", 
    "Condition", "Immunization"
  ],
  "fhirVersion": "R4",
  "totalConnections": 42
}
```

## 🚧 Development Notes

### OAuth2 Callback Handler
The system includes a callback handler at `/api/fhir/callback` for completing OAuth2 flows. In production, ensure your domain is registered with FHIR servers as an authorized redirect URI.

### Error Handling
All FHIR operations include comprehensive error handling with graceful fallbacks when hospitals are unavailable or data cannot be accessed.

### Testing
Use sandbox environments for development and testing. Set `includeTest=true` in hospital search requests to include test servers.

## 🌟 Impact

This FHIR integration transforms diseaseZone from a surveillance platform into a comprehensive healthcare intelligence system that:

1. **Connects users to healthcare providers** for seamless data access
2. **Provides personalized health insights** based on real medical data  
3. **Enhances disease surveillance** through anonymous data contribution
4. **Maintains complete privacy** while improving public health outcomes
5. **Bridges individual care** with population health intelligence

The system represents a revolutionary approach to healthcare data integration that prioritizes privacy while enabling unprecedented insights for both individual users and public health surveillance.