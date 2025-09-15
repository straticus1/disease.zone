# Global Health Intelligence API Documentation

## Overview

The Global Health Intelligence Platform provides comprehensive disease surveillance, outbreak detection, and data fusion capabilities through a unified API interface. This system integrates 15+ international and domestic health data sources to provide real-time global health intelligence.

## Base URL

```
http://localhost:3000
```

## Authentication

All endpoints require authentication via JWT token or API key:

```bash
# JWT Token (in header)
Authorization: Bearer YOUR_JWT_TOKEN

# API Key (in header)
X-API-Key: YOUR_API_KEY
```

## Global Health Intelligence Endpoints

### Data Aggregation

#### `GET /global/aggregate`

Aggregates health data from multiple international sources with intelligent fallback mechanisms.

**Query Parameters:**
- `sources` (array): Specific data sources to query (optional)
- `regions` (array): Geographic regions to focus on (optional)
- `diseases` (array): Specific diseases to track (optional)
- `timeframe` (string): Time period for data (1d, 7d, 30d, 90d)
- `includeMetadata` (boolean): Include source metadata and quality scores

**Example Request:**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:3000/global/aggregate?regions=US,EU&diseases=covid-19,influenza&timeframe=7d"
```

**Example Response:**
```json
{
  "status": "success",
  "timestamp": "2025-09-15T10:30:00Z",
  "aggregation": {
    "sources_queried": ["WHO", "ECDC", "CDC", "disease.sh"],
    "sources_successful": 4,
    "sources_failed": 0,
    "data": {
      "US": {
        "covid-19": {
          "cases": 1234567,
          "deaths": 12345,
          "recovered": 1200000,
          "trend": "decreasing"
        }
      }
    },
    "metadata": {
      "data_quality_score": 0.95,
      "coverage_percentage": 100,
      "last_updated": "2025-09-15T09:00:00Z"
    }
  }
}
```

### Data Fusion

#### `POST /global/fusion`

Performs advanced data fusion using multiple algorithms to reconcile conflicting data from different sources.

**Request Body:**
```json
{
  "sources": ["WHO", "ECDC", "CDC"],
  "fusionMethod": "bayesian",
  "confidenceThreshold": 0.8,
  "anomalyDetection": true,
  "regions": ["US", "EU"],
  "diseases": ["covid-19", "influenza"]
}
```

**Fusion Methods:**
- `bayesian` - Bayesian data fusion with uncertainty quantification
- `ensemble` - Machine learning ensemble methods
- `weighted_average` - Weighted averaging based on source reliability
- `neural_network` - Deep learning fusion
- `dempster_shafer` - Evidence theory fusion
- `kalman_filter` - Dynamic state estimation

**Example Response:**
```json
{
  "status": "success",
  "fusion_result": {
    "method_used": "bayesian",
    "confidence_score": 0.92,
    "fused_data": {
      "US": {
        "covid-19": {
          "cases": 1234500,
          "uncertainty_range": [1230000, 1239000],
          "source_agreement": 0.88
        }
      }
    },
    "anomalies_detected": [],
    "quality_assessment": {
      "overall_quality": 0.94,
      "source_reliability": {
        "WHO": 0.95,
        "ECDC": 0.92,
        "CDC": 0.98
      }
    }
  }
}
```

### Outbreak Detection

#### `POST /global/outbreak-detection`

Analyzes health data streams using multiple outbreak detection algorithms to identify potential disease outbreaks.

**Request Body:**
```json
{
  "detection_methods": ["cusum", "ewma", "spatial_scan"],
  "sensitivity": "high",
  "temporal_window": "14d",
  "spatial_resolution": "county",
  "diseases": ["all"],
  "regions": ["global"]
}
```

**Detection Methods:**
- `cusum` - Cumulative Sum Control Charts
- `ewma` - Exponentially Weighted Moving Average
- `spatial_scan` - Spatial Scan Statistics (Kulldorff's method)
- `temporal_scan` - Temporal scan statistics
- `space_time_scan` - Spatio-temporal cluster detection
- `ml_anomaly` - Machine learning anomaly detection
- `seasonal_arima` - Seasonal ARIMA modeling
- `prophet_forecast` - Facebook Prophet forecasting

**Example Response:**
```json
{
  "status": "success",
  "detection_results": {
    "alerts_generated": 2,
    "outbreaks_detected": [
      {
        "id": "outbreak_001",
        "disease": "influenza",
        "location": {
          "country": "US",
          "state": "California",
          "coordinates": [37.7749, -122.4194]
        },
        "detection_method": "spatial_scan",
        "confidence": 0.89,
        "severity": "moderate",
        "estimated_start": "2025-09-10T00:00:00Z",
        "affected_population": 15000,
        "growth_rate": 0.15
      }
    ],
    "monitoring_recommendations": [
      "Increase surveillance in detected outbreak regions",
      "Monitor neighboring areas for spread patterns"
    ]
  }
}
```

### Real-time Monitoring

#### `GET /global/monitoring`

Provides real-time monitoring dashboard data with continuous surveillance metrics.

**Query Parameters:**
- `metrics` (array): Specific metrics to monitor
- `refresh_rate` (string): Update frequency (1m, 5m, 15m, 1h)
- `alert_threshold` (number): Alert sensitivity (0.1-1.0)

**Example Response:**
```json
{
  "status": "success",
  "monitoring_data": {
    "global_health_status": "stable",
    "active_alerts": 3,
    "data_sources_online": 14,
    "data_sources_offline": 1,
    "last_update": "2025-09-15T10:30:00Z",
    "key_metrics": {
      "global_case_trend": "decreasing",
      "outbreak_risk_level": "low",
      "data_quality_score": 0.94
    },
    "regional_status": {
      "US": "stable",
      "EU": "stable",
      "Asia": "monitoring"
    }
  }
}
```

### Analytics & Insights

#### `GET /global/analytics`

Provides comprehensive health analytics, trends, and predictive insights.

**Query Parameters:**
- `analysis_type` (string): Type of analysis (trend, prediction, correlation)
- `timeframe` (string): Analysis period (30d, 90d, 1y)
- `regions` (array): Geographic focus areas
- `export_format` (string): Output format (json, csv, pdf)

**Example Response:**
```json
{
  "status": "success",
  "analytics": {
    "trend_analysis": {
      "global_trend": "decreasing",
      "regional_trends": {
        "US": "stable",
        "EU": "decreasing"
      },
      "trend_confidence": 0.87
    },
    "predictions": {
      "next_30_days": {
        "expected_cases": 950000,
        "confidence_interval": [900000, 1000000]
      }
    },
    "correlations": {
      "seasonality_impact": 0.72,
      "mobility_correlation": 0.45
    }
  }
}
```

## STI/STD Surveillance Endpoints

### HIV Surveillance

#### `GET /sti/hiv`

Comprehensive HIV surveillance data with multi-source integration.

**Query Parameters:**
- `demographics` (array): Age groups, gender, ethnicity filters
- `geographic_level` (string): national, state, county, city
- `timeframe` (string): Data period (1m, 3m, 6m, 1y)
- `include_trends` (boolean): Include trend analysis

**Example Response:**
```json
{
  "status": "success",
  "data": {
    "total_cases": 1200000,
    "new_cases_this_period": 35000,
    "demographic_breakdown": {
      "age_groups": {
        "13-24": 15000,
        "25-34": 12000,
        "35-44": 8000
      }
    },
    "geographic_distribution": {
      "top_affected_states": ["CA", "FL", "TX", "NY"]
    },
    "trends": {
      "overall_trend": "stable",
      "high_risk_populations": "increasing"
    }
  }
}
```

### HPV Surveillance

#### `GET /sti/hpv`

HPV tracking with vaccination impact analysis.

**Example Response:**
```json
{
  "status": "success",
  "data": {
    "total_cases": 79000000,
    "vaccination_coverage": 0.54,
    "cancer_prevention_impact": {
      "cervical_cancer_reduction": 0.87,
      "other_cancers_reduction": 0.45
    },
    "strain_distribution": {
      "high_risk_strains": 0.60,
      "vaccine_preventable": 0.70
    }
  }
}
```

### Comprehensive STI Dashboard

#### `GET /sti/comprehensive`

Unified STI surveillance dashboard with all supported diseases.

**Example Response:**
```json
{
  "status": "success",
  "dashboard": {
    "overview": {
      "total_sti_burden": 26000000,
      "annual_new_cases": 2600000,
      "most_prevalent": "HPV"
    },
    "disease_breakdown": {
      "hiv": 1200000,
      "hpv": 79000000,
      "herpes": 12000000,
      "chlamydia": 1800000,
      "gonorrhea": 850000,
      "syphilis": 175000
    },
    "trends": {
      "overall": "increasing",
      "youth": "concerning",
      "prevention_impact": "positive"
    }
  }
}
```

## Error Handling

All endpoints return standardized error responses:

```json
{
  "status": "error",
  "error": {
    "code": "DATA_SOURCE_UNAVAILABLE",
    "message": "Primary data source temporarily unavailable",
    "details": "CDC API is currently down, using fallback sources",
    "timestamp": "2025-09-15T10:30:00Z",
    "request_id": "req_123456789"
  },
  "fallback_used": true,
  "partial_data": true
}
```

## Rate Limiting

- **Standard Access**: 100 requests/minute
- **Enhanced Access**: 500 requests/minute
- **Premium Access**: 2000 requests/minute

Rate limit headers included in all responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1631715000
```

## Data Quality & Reliability

### Quality Scores

All data includes quality assessment:
- **0.9-1.0**: Excellent (real-time, authoritative sources)
- **0.7-0.9**: Good (reliable with minor delays)
- **0.5-0.7**: Fair (some data gaps or delays)
- **0.3-0.5**: Poor (significant limitations)
- **0.0-0.3**: Very Poor (use with extreme caution)

### Source Reliability

Data sources ranked by reliability:
1. **WHO** (0.95) - Global authoritative source
2. **CDC** (0.98) - US authoritative source
3. **ECDC** (0.92) - EU authoritative source
4. **Disease.sh** (0.85) - Reliable aggregator
5. **State Health Depts** (0.80) - Regional authorities

## Configuration

### Access Levels

The system supports three access tiers:

#### Standard (No API Keys Required)
- Disease.sh integration
- Basic outbreak detection
- Limited data sources
- 100 requests/minute

#### Enhanced (1+ API Keys)
- CDC or WHO integration
- Advanced analytics
- Improved data quality
- 500 requests/minute

#### Premium (Multiple API Keys)
- All data sources
- Real-time monitoring
- Full ML capabilities
- 2000 requests/minute

### Environment Configuration

Required environment variables:

```bash
# Core Configuration
API_ACCESS_LEVEL=standard
ENABLE_DISEASE_SH=true
ENABLE_CDC_DATA=true
ENABLE_WHO_DATA=false

# API Keys (Optional)
CDC_API_KEY=your_cdc_key
WHO_API_KEY=your_who_key
ECDC_API_KEY=your_ecdc_key

# Rate Limiting
API_RATE_LIMIT_ENABLED=true
API_REQUESTS_PER_MINUTE=100

# Caching
DATA_CACHE_ENABLED=true
CACHE_EXPIRY_MINUTES=60
```

## SDK Examples

### Node.js/JavaScript

```javascript
const axios = require('axios');

class GlobalHealthAPI {
  constructor(baseURL, apiKey) {
    this.baseURL = baseURL;
    this.apiKey = apiKey;
  }

  async getGlobalAggregation(options = {}) {
    const response = await axios.get(`${this.baseURL}/global/aggregate`, {
      headers: { 'X-API-Key': this.apiKey },
      params: options
    });
    return response.data;
  }

  async detectOutbreaks(config) {
    const response = await axios.post(`${this.baseURL}/global/outbreak-detection`, config, {
      headers: { 'X-API-Key': this.apiKey }
    });
    return response.data;
  }
}

// Usage
const api = new GlobalHealthAPI('http://localhost:3000', 'your_api_key');
const data = await api.getGlobalAggregation({ regions: ['US'], timeframe: '7d' });
```

### Python

```python
import requests

class GlobalHealthAPI:
    def __init__(self, base_url, api_key):
        self.base_url = base_url
        self.api_key = api_key
        self.headers = {'X-API-Key': api_key}

    def get_global_aggregation(self, **kwargs):
        response = requests.get(
            f"{self.base_url}/global/aggregate",
            headers=self.headers,
            params=kwargs
        )
        return response.json()

    def detect_outbreaks(self, config):
        response = requests.post(
            f"{self.base_url}/global/outbreak-detection",
            headers=self.headers,
            json=config
        )
        return response.json()

# Usage
api = GlobalHealthAPI('http://localhost:3000', 'your_api_key')
data = api.get_global_aggregation(regions=['US'], timeframe='7d')
```

## Support

For technical support or questions about the Global Health Intelligence API:

- **Documentation**: This guide covers all endpoints and features
- **Issues**: Report bugs via GitHub Issues
- **Medical Accuracy**: Report clinical or epidemiological concerns
- **Contact**: api-support@disease.zone

## Changelog

### Version 3.0.0 (2025-09-15)
- Initial release of Global Health Intelligence Platform
- 15+ data source integrations
- Advanced outbreak detection and data fusion
- Comprehensive STI/STD surveillance
- Real-time monitoring and analytics capabilities