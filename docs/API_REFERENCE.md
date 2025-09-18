# DiseaseZone API Reference

## Overview

The DiseaseZone platform provides comprehensive RESTful APIs for accessing disease surveillance data, health analytics, and medical insights. All APIs are designed with healthcare standards in mind, ensuring HIPAA compliance and medical-grade security.

## Base URLs

- **Production**: `https://www.disease.zone/api`
- **API Portal**: `https://api.disease.zone/api`
- **Development**: `http://localhost:3000/api`

## Authentication

### API Keys
```http
Authorization: Bearer YOUR_API_KEY
```

### JWT Tokens
```http
Authorization: Bearer JWT_TOKEN
```

### Admin Authentication
```http
Authorization: Bearer ADMIN_JWT_TOKEN
X-Admin-Role: administrator
```

## Core Endpoints

### Health Check
**GET** `/health`

Returns the health status of the API service.

```json
{
  "status": "ok",
  "message": "Server is running"
}
```

## Admin Control Panel APIs

### Admin Dashboard Statistics

**GET** `/admin/stats/overview`

Retrieves comprehensive system statistics for the admin dashboard.

**Authentication:** Admin JWT required

**Response:**
```json
{
  "success": true,
  "timestamp": "2025-09-18T12:00:00Z",
  "stats": {
    "users": {
      "total": 15420,
      "active": 8934,
      "newToday": 125,
      "growth": "+12.3%"
    },
    "sessions": {
      "active": 1247,
      "peak24h": 3456,
      "avgDuration": "18.5 minutes"
    },
    "security": {
      "events": 23,
      "threats": 2,
      "blocked": 145
    },
    "system": {
      "uptime": "99.98%",
      "responseTime": "127ms",
      "errorRate": "0.02%"
    }
  }
}
```

### User Management

**GET** `/admin/users`

Retrieve paginated list of all users with detailed information.

**Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Results per page (default: 50)
- `search` (string): Search users by name or email
- `role` (string): Filter by user role
- `status` (string): Filter by user status (active, inactive, suspended)

**POST** `/admin/users`

Create a new user account with administrative privileges.

**Request Body:**
```json
{
  "email": "user@example.com",
  "name": "John Doe",
  "role": "user",
  "permissions": ["read", "write"],
  "sendWelcomeEmail": true
}
```

**PUT** `/admin/users/:userId`

Update user information and permissions.

**DELETE** `/admin/users/:userId`

Deactivate or delete a user account with audit logging.

### Security Management

**GET** `/admin/security/events`

Retrieve recent security events and alerts.

**Parameters:**
- `severity` (string): Filter by severity level (low, medium, high, critical)
- `type` (string): Event type (login, auth_failure, suspicious_activity)
- `from` (date): Start date for event range
- `to` (date): End date for event range

**Response:**
```json
{
  "success": true,
  "events": [
    {
      "id": "sec_001",
      "type": "auth_failure",
      "severity": "medium",
      "timestamp": "2025-09-18T11:45:00Z",
      "details": {
        "ip": "192.168.1.100",
        "userAgent": "Mozilla/5.0...",
        "attempts": 5,
        "blocked": true
      }
    }
  ],
  "summary": {
    "total": 23,
    "critical": 0,
    "high": 2,
    "medium": 8,
    "low": 13
  }
}
```

### System Monitoring

**GET** `/admin/system/health`

Comprehensive system health check with detailed metrics.

**Response:**
```json
{
  "status": "healthy",
  "uptime": "15d 4h 23m",
  "services": {
    "database": {
      "status": "healthy",
      "responseTime": "12ms",
      "connections": 45
    },
    "cache": {
      "status": "healthy",
      "hitRate": "94.2%",
      "memory": "2.1GB/8GB"
    },
    "api": {
      "status": "healthy",
      "requestsPerMinute": 1247,
      "errorRate": "0.02%"
    }
  },
  "performance": {
    "cpu": "23.4%",
    "memory": "67.8%",
    "disk": "34.2%",
    "network": "125 Mbps"
  }
}
```

### Configuration Management

**GET** `/admin/config`

Retrieve system configuration settings.

**PUT** `/admin/config`

Update system configuration with validation and audit logging.

**Request Body:**
```json
{
  "features": {
    "geolocation": true,
    "adminPanel": true,
    "advancedMapping": true
  },
  "security": {
    "sessionTimeout": 3600,
    "maxLoginAttempts": 5,
    "passwordMinLength": 8
  },
  "performance": {
    "cacheTimeout": 300,
    "rateLimit": 1000,
    "maxRequestSize": "10MB"
  }
}
```

## Disease Surveillance APIs

### Interactive Disease Mapping

**GET** `/maps/overlays/disease`

Retrieves real-time disease surveillance data for mapping visualization.

**Parameters:**
- `disease` (required): Disease type (chlamydia, gonorrhea, syphilis)
- `region` (optional): Geographic region filter
- `timeframe` (optional): Data timeframe (default: current)

**Example:**
```http
GET /api/maps/overlays/disease?disease=chlamydia
```

**Response:**
```json
{
  "success": true,
  "dataPoints": 11,
  "overlays": [
    {
      "id": "chlamydia_nyc",
      "data": {
        "location": "New York City",
        "coordinates": [40.7128, -74.0060],
        "cases": 15420,
        "population": 8175133,
        "ratePerOneHundredK": 188.6,
        "severity": "moderate",
        "lastUpdated": "2025-09-16T10:00:00Z"
      }
    }
  ]
}
```

### STI/STD Surveillance

**GET** `/std/data`

Comprehensive STI surveillance data from multiple sources.

**Parameters:**
- `disease` (optional): Specific disease filter
- `demographics` (optional): Include demographic breakdowns
- `trends` (optional): Include historical trend data

**GET** `/std/summary`

Summary statistics for STI surveillance data.

## Chronic Disease Management APIs

### Comprehensive Disease Surveillance

**GET** `/chronic/surveillance`

Real-time chronic disease surveillance data from CDC, ACS, AHA, ADA, and other authoritative sources.

**Parameters:**
- `diseases` (array): Disease categories ['cardiovascular', 'diabetes', 'cancer', 'metabolic']
- `year` (number): Data year (default: current year - 1)
- `state` (string): State abbreviation for regional data
- `demographics` (boolean): Include demographic analysis
- `trends` (boolean): Include trend analysis

**Example:**
```http
GET /api/chronic/surveillance?diseases=cardiovascular,diabetes&year=2023&state=CA&demographics=true
```

**Response:**
```json
{
  "summary": {
    "dataYear": 2023,
    "lastUpdated": "2025-09-16T10:00:00Z",
    "sources": ["CDC", "ACS", "AHA", "ADA", "NCI SEER", "WHO"],
    "coverage": "California"
  },
  "cardiovascular": {
    "source": "CDC Heart Disease and Stroke Prevention",
    "heartDisease": {
      "prevalence": 6.5,
      "mortality": 165.0,
      "ageAdjustedRate": 155.4
    },
    "stroke": {
      "prevalence": 3.0,
      "mortality": 37.1,
      "ageAdjustedRate": 33.6
    }
  },
  "diabetes": {
    "source": "CDC Diabetes Surveillance System",
    "prevalence": 11.3,
    "incidence": 5.9,
    "mortality": 24.0
  }
}
```

### Risk Assessment

**POST** `/chronic/risk-assessment`

Comprehensive risk assessment for chronic diseases using validated clinical tools.

**Request Body:**
```json
{
  "userId": "user123",
  "riskFactors": {
    "age": 45,
    "gender": "male",
    "smoking": true,
    "diabetes": false,
    "hypertension": true,
    "cholesterol": {
      "total": 220,
      "ldl": 140,
      "hdl": 35
    },
    "familyHistory": {
      "heartDisease": true,
      "stroke": false,
      "diabetes": true
    }
  },
  "includeFramingham": true,
  "includeASCVD": true
}
```

**Response:**
```json
{
  "overallRisk": "high",
  "riskScore": 85,
  "framinghamScore": {
    "tenYearRisk": 24.5,
    "riskCategory": "high"
  },
  "ascvdScore": {
    "tenYearRisk": 22.8,
    "riskCategory": "intermediate-high"
  },
  "recommendations": [
    {
      "category": "lifestyle",
      "intervention": "smoking cessation",
      "priority": "high",
      "expectedBenefit": "40% risk reduction"
    }
  ]
}
```

### Disease Progression Modeling

**POST** `/chronic/progression-prediction`

Machine learning-powered disease progression predictions.

**Request Body:**
```json
{
  "userId": "user123",
  "diseaseType": "diabetes",
  "biomarkers": {
    "hba1c": 8.2,
    "fastingGlucose": 145,
    "bmi": 32.1
  },
  "predictionTimeframe": "5years"
}
```

## Herpes Analytics APIs

### Comprehensive User Analytics

**GET** `/herpes/analytics/{userId}`

Complete herpes analytics profile for a specific user.

**Parameters:**
- `timeframe` (optional): Analysis timeframe (default: '1year')
- `includeFamily` (boolean): Include family history analysis
- `includePredictions` (boolean): Include outbreak predictions

**Response:**
```json
{
  "userId": "user123",
  "analysisDate": "2025-09-16T10:00:00Z",
  "summary": {
    "riskLevel": "moderate",
    "knownConditions": ["hsv1"],
    "outbreakFrequency": 2.1,
    "lastOutbreak": "2025-08-15"
  },
  "riskAssessment": {
    "overallRisk": "moderate",
    "transmissionRisk": "low",
    "recurrenceRisk": "moderate",
    "complicationRisk": "low"
  },
  "outbreakPredictions": {
    "next30Days": 0.15,
    "next90Days": 0.42,
    "seasonalPattern": {
      "spring": 1.2,
      "summer": 1.4,
      "fall": 1.1,
      "winter": 0.9
    }
  }
}
```

### Outbreak Prediction

**POST** `/herpes/predict-outbreak`

Machine learning-powered outbreak prediction with 85%+ accuracy.

**Request Body:**
```json
{
  "userId": "user123",
  "herpesType": "hsv2",
  "currentStressLevel": 7,
  "recentIllness": false,
  "menstrualCycle": "luteal",
  "medicationAdherence": "high",
  "timeframe": "30days"
}
```

**Response:**
```json
{
  "prediction": {
    "probability": 0.23,
    "confidence": 0.87,
    "riskLevel": "moderate",
    "expectedTimeframe": "14-21 days"
  },
  "triggerFactors": [
    {
      "factor": "stress",
      "weight": 0.35,
      "impact": "high"
    },
    {
      "factor": "hormonal",
      "weight": 0.28,
      "impact": "moderate"
    }
  ],
  "recommendations": [
    {
      "type": "preventive",
      "action": "stress_management",
      "priority": "high"
    }
  ]
}
```

### Family Health Tracking

**GET** `/herpes/family-analysis/{userId}`

Multi-generational family herpes pattern analysis.

**Response:**
```json
{
  "familyHistory": true,
  "affectedRelatives": 3,
  "inheritancePatterns": {
    "hsv1": {
      "prevalence": 0.6,
      "averageAgeOfOnset": 12
    },
    "recurrenceFrequency": {
      "familyAverage": 2.8,
      "userComparison": "above_average"
    }
  },
  "recommendations": {
    "screening": ["partner_testing", "prenatal_counseling"],
    "prevention": ["stress_management", "immune_support"],
    "education": ["transmission_prevention", "family_planning"]
  }
}
```

## FHIR Integration APIs

### Hospital Connection

**POST** `/fhir/connect/initiate`

Initiate SMART on FHIR connection with healthcare provider.

**GET** `/fhir/hospitals/search`

Search for FHIR-enabled healthcare providers.

**POST** `/fhir/sync/patient-data`

Synchronize patient data from connected FHIR endpoints.

## Data Export & Integration

### CSV Export

**GET** `/export/csv/{dataType}`

Export data in CSV format for analysis.

### FHIR Export

**GET** `/export/fhir/{resourceType}`

Export data in FHIR format for interoperability.

## Error Handling

### HTTP Status Codes

- `200` - Success
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Rate Limited
- `500` - Internal Server Error

### Error Response Format

```json
{
  "error": {
    "code": "INVALID_PARAMETER",
    "message": "The specified disease type is not supported",
    "details": {
      "parameter": "disease",
      "value": "invalid_disease",
      "supportedValues": ["chlamydia", "gonorrhea", "syphilis"]
    }
  }
}
```

## Rate Limiting

- **Free Tier**: 100 requests/hour
- **Basic Tier**: 1,000 requests/hour
- **Professional Tier**: 10,000 requests/hour
- **Enterprise Tier**: Unlimited

Rate limit headers are included in all responses:
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1694851200
```

## SDKs & Libraries

### JavaScript/Node.js
```bash
npm install @diseasezone/api-client
```

### Python
```bash
pip install diseasezone-api
```

### R
```r
install.packages("diseaseZoneR")
```

## Support

- **Documentation**: [https://docs.disease.zone](https://docs.disease.zone)
- **API Portal**: [https://api.disease.zone](https://api.disease.zone)
- **Support**: [support@disease.zone](mailto:support@disease.zone)
- **Status**: [https://status.disease.zone](https://status.disease.zone)