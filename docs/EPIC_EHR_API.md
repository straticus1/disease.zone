# Epic EHR Integration API Documentation

## Overview

Disease.Zone's Epic EHR Integration provides seamless connectivity to Epic's healthcare platform, serving 78% of US hospital beds. This integration enables secure patient data access, comprehensive health analytics, and supports Epic App Orchard certification.

## Features

- **FHIR R4 Compliance** - Full support for Epic's FHIR R4 endpoints
- **SMART on FHIR** - OAuth 2.0 with PKCE for secure authorization
- **MyChart Integration** - Patient portal connectivity
- **App Orchard Ready** - Prepared for Epic certification
- **Real-time Sync** - Automated patient data synchronization
- **AI Analytics** - Disease intelligence from Epic data

## Authentication

All Epic endpoints use OAuth 2.0 with SMART on FHIR profile:

1. Register Epic organization
2. Initiate OAuth flow (returns authorization URL)
3. Patient completes Epic login
4. Handle callback to exchange code for tokens
5. Use tokens to access patient data

## API Endpoints

### Organization Management

#### POST /api/epic/organizations
Register a new Epic organization for integration.

**Request Body:**
```json
{
  "name": "Example Health System",
  "baseUrl": "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4",
  "fhirVersion": "R4",
  "authUrl": "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize",
  "tokenUrl": "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token",
  "clientId": "your-epic-client-id",
  "clientSecret": "your-epic-client-secret",
  "supportedResources": ["Patient", "Observation", "Condition"]
}
```

**Response:**
```json
{
  "success": true,
  "organizationId": "uuid",
  "message": "Epic organization registered successfully",
  "nextSteps": [
    "Complete Epic App Orchard certification",
    "Test OAuth flow with sandbox environment",
    "Configure patient authorization workflows"
  ]
}
```

### Patient Authorization

#### POST /api/epic/auth/initiate
Initiate Epic OAuth 2.0 authorization flow for a patient.

**Request Body:**
```json
{
  "organizationId": "uuid",
  "launchType": "standalone_launch",
  "redirectUri": "https://yourapp.com/epic/callback"
}
```

**Response:**
```json
{
  "success": true,
  "authorizationUrl": "https://fhir.epic.com/...",
  "state": "secure-state-token",
  "instructions": "Redirect user to authorizationUrl to complete Epic login",
  "security": "PKCE challenge generated for secure authorization"
}
```

#### GET /api/epic/auth/callback
Handle Epic OAuth callback and exchange authorization code for access tokens.

**Query Parameters:**
- `code` - Authorization code from Epic
- `state` - State parameter for validation
- `error` - Error code if authorization failed

**Response:**
```json
{
  "success": true,
  "authorizationId": "uuid",
  "patientId": "epic-patient-id",
  "message": "Epic authorization completed successfully",
  "expiresAt": "2024-01-01T12:00:00Z",
  "scope": "patient/*.read launch/patient",
  "nextSteps": [
    "Use authorizationId to fetch patient data",
    "Call /api/epic/patient/sync to retrieve comprehensive health record"
  ]
}
```

### Patient Data Access

#### GET /api/epic/patient/:authId/data/:resourceType
Fetch specific patient data from Epic FHIR API.

**Parameters:**
- `authId` - Authorization ID from successful OAuth
- `resourceType` - FHIR resource type (Patient, Observation, etc.)

**Query Parameters:**
- Standard FHIR search parameters supported

**Response:**
```json
{
  "success": true,
  "resourceType": "Observation",
  "data": {
    "resourceType": "Bundle",
    "total": 25,
    "entry": [
      {
        "resource": {
          "resourceType": "Observation",
          "id": "123",
          "code": {
            "coding": [
              {
                "system": "http://loinc.org",
                "code": "8302-2",
                "display": "Body height"
              }
            ]
          },
          "valueQuantity": {
            "value": 175,
            "unit": "cm"
          }
        }
      }
    ]
  },
  "metadata": {
    "source": "epic_fhir",
    "organization": "Example Health System",
    "fetchedAt": "2024-01-01T12:00:00Z",
    "recordCount": 25
  }
}
```

#### POST /api/epic/patient/:authId/sync
Synchronize comprehensive patient data from Epic.

**Request Body:**
```json
{
  "resourceTypes": ["Patient", "Condition", "Observation", "MedicationRequest", "AllergyIntolerance"]
}
```

**Response:**
```json
{
  "success": true,
  "syncResults": {
    "success": [
      {
        "resourceType": "Patient",
        "recordCount": 1,
        "fetchedAt": "2024-01-01T12:00:00Z"
      }
    ],
    "failed": [],
    "totalResources": 5,
    "successRate": "100.0%",
    "duration": 2500
  }
}
```

#### GET /api/epic/patient/:authId/summary
Generate comprehensive patient health summary.

**Response:**
```json
{
  "success": true,
  "patientSummary": {
    "patientId": "epic-patient-id",
    "demographics": {
      "name": "John Doe",
      "birthDate": "1980-01-01",
      "gender": "male"
    },
    "healthScore": 85,
    "activeConditions": [
      {
        "code": "E11",
        "display": "Type 2 diabetes mellitus",
        "clinicalStatus": "active"
      }
    ],
    "currentMedications": [
      {
        "medication": "Metformin 500mg",
        "status": "active"
      }
    ],
    "riskFactors": [
      "Diabetes increases cardiovascular risk"
    ],
    "lastUpdated": "2024-01-01T12:00:00Z"
  },
  "insights": {
    "riskLevel": "Medium",
    "primaryConcerns": ["Diabetes management"],
    "dataCompleteness": "Complete clinical data"
  }
}
```

### System Information

#### GET /api/epic/supported-resources
Get list of supported Epic FHIR resources.

**Response:**
```json
{
  "success": true,
  "fhirVersion": "R4",
  "supportedResources": {
    "Patient": {
      "endpoint": "/Patient",
      "description": "Patient demographics and identifiers",
      "scopes": ["patient/Patient.read"],
      "priority": "high"
    },
    "Observation": {
      "endpoint": "/Observation", 
      "description": "Lab results, vital signs, clinical observations",
      "scopes": ["patient/Observation.read"],
      "priority": "high"
    }
  },
  "totalResources": 12,
  "recommendations": {
    "highPriority": ["Patient", "Observation", "Condition", "MedicationRequest", "AllergyIntolerance"],
    "epicRecommendation": "Use FHIR R4 for all new development (2025 best practice)"
  }
}
```

#### GET /api/epic/health
Epic integration health check.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00Z",
  "version": "1.0.0",
  "epicConnectivity": {
    "sandbox": "available",
    "production": "configured"
  },
  "features": {
    "oauth2": "enabled",
    "fhirR4": "supported",
    "appOrchard": "ready",
    "patientLaunch": "supported"
  },
  "compliance": {
    "smartOnFhir": "compliant",
    "pkce": "enforced",
    "hipaa": "aligned",
    "gdpr": "aligned"
  }
}
```

#### GET /api/epic/analytics/:organizationId
Get Epic integration analytics and usage metrics.

**Response:**
```json
{
  "success": true,
  "analytics": {
    "organizationId": "uuid",
    "timeRange": "7days",
    "apiCalls": {
      "total": 1250,
      "successful": 1198,
      "failed": 52,
      "successRate": 95.8
    },
    "performance": {
      "averageResponseTime": 485,
      "p95ResponseTime": 1200,
      "errorRate": 4.2
    },
    "compliance": {
      "rateLimitViolations": 0,
      "tokenRefreshes": 12
    }
  },
  "recommendations": [
    "Consider caching frequently accessed data"
  ]
}
```

### App Orchard Integration

#### POST /api/epic/app-orchard/submit
Submit Epic App Orchard application for certification.

**Request Body:**
```json
{
  "appName": "Disease.Zone Health Intelligence",
  "appDescription": "Comprehensive disease intelligence and health analytics platform",
  "certificationTier": "Workshop",
  "useCase": "Disease intelligence and health analytics",
  "technicalRequirements": {
    "fhirVersion": "R4",
    "scopes": ["patient/*.read", "launch/patient"],
    "resources": ["Patient", "Observation", "Condition"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "submissionId": "uuid",
  "message": "Epic App Orchard application submitted",
  "timeline": {
    "initialReview": "2-4 weeks",
    "technicalReview": "4-8 weeks", 
    "certificationDecision": "8-12 weeks"
  }
}
```

## Rate Limiting

Epic enforces strict rate limits (60 requests per minute). The integration includes automatic rate limiting:

```javascript
const epicRateLimit = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute
    message: {
        error: 'Epic API rate limit exceeded',
        retryAfter: '60 seconds'
    }
});
```

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Error description",
  "message": "Detailed error message",
  "troubleshooting": [
    "Check Epic organization configuration",
    "Verify patient authorization is valid"
  ]
}
```

Common error scenarios:
- **401 Unauthorized** - Invalid or expired tokens
- **403 Forbidden** - Insufficient scopes or permissions
- **429 Too Many Requests** - Rate limit exceeded
- **500 Internal Server Error** - Epic API unavailable

## Security Considerations

### HIPAA Compliance
- All patient data encrypted in transit and at rest
- Comprehensive audit logging for all Epic interactions
- Automatic token cleanup and session management

### OAuth Security
- PKCE (Proof Key for Code Exchange) required
- State parameter validation prevents CSRF attacks
- Secure token storage with automatic refresh

### Data Minimization
- Only requested scopes are authorized
- Patient data cached temporarily for performance
- Automatic data cleanup after session expiration

## Epic Sandbox Testing

For development and testing, use Epic's public sandbox:

- **Base URL:** `https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4`
- **Auth URL:** `https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize`
- **Token URL:** `https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token`
- **Test Patient ID:** You can use Epic's test patient credentials

## MyChart Integration

The integration supports MyChart patient portal connections:

1. **Patient-Initiated** - Patients can connect their MyChart account
2. **Consent Management** - Comprehensive consent tracking and withdrawal
3. **Data Sync** - Automatic synchronization with patient health records
4. **Insights** - AI-powered health insights from patient data

## Production Deployment

### Environment Variables
```bash
NODE_ENV=production
JWT_SECRET=your-secure-jwt-secret
SESSION_SECRET=your-secure-session-secret
API_RATE_LIMIT_ENABLED=true
EPIC_SANDBOX_CLIENT_ID=your-client-id
EPIC_SANDBOX_CLIENT_SECRET=your-client-secret
```

### AWS SSM Parameters (Optional)
```bash
/diseasezone/prod/mapbox-token
/diseasezone/prod/google-maps-key
```

## Support

For Epic integration support:
- Review Epic's FHIR documentation
- Check Epic App Orchard requirements  
- Contact Disease.Zone support for implementation assistance

## Changelog

### v3.9.0
- Initial Epic EHR integration release
- FHIR R4 support with 12+ resource types
- OAuth 2.0 with SMART on FHIR
- MyChart patient portal integration
- App Orchard certification preparation
- Comprehensive health analytics and AI insights