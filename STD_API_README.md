# STD Surveillance Data API

This document provides comprehensive information about the STD (Sexually Transmitted Disease) surveillance data API implementation.

## Overview

The STD API provides access to surveillance data for sexually transmitted diseases including Chlamydia, Gonorrhea, and Syphilis. The implementation includes both mock data for immediate use and a framework for CDC WONDER API integration.

## Current Status: Partially Operational ⚠️

- **Mock Data**: ✅ Fully functional
- **Real CDC Data**: 🔄 Under development
- **Data Coverage**: 2008-2014 (CDC WONDER limitation)

## API Endpoints

### Core Endpoints

#### `GET /api/std/data`
Retrieve STD surveillance data with optional filtering.

**Query Parameters:**
- `disease` (string): `chlamydia`, `gonorrhea`, `syphilis`, or `all` (default: `all`)
- `year` (string): Year from 2008-2014 (default: `2014`)
- `state` (string): State code (`ny`, `ca`, `tx`, `fl`) or `all` (default: `all`)
- `ageGroup` (string): Age group (`15-19`, `20-24`, `25-29`, `30-34`) or `all` (default: `all`)

**Example:**
```bash
curl "http://localhost:3000/api/std/data?disease=chlamydia&year=2014&state=ny"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "disease": "chlamydia",
      "year": "2014",
      "state": "NY",
      "cases": 125000,
      "rate": 400.5
    }
  ],
  "totalRecords": 1,
  "timestamp": "2025-09-14T16:00:00.000Z",
  "note": "Mock data - CDC WONDER API integration in progress"
}
```

#### `GET /api/std/summary`
Get aggregated STD statistics by year.

**Query Parameters:**
- `year` (string): Year from 2008-2014 (default: `2014`)

**Example:**
```bash
curl "http://localhost:3000/api/std/summary?year=2014"
```

**Response:**
```json
{
  "success": true,
  "year": "2014",
  "summary": {
    "chlamydia": {
      "totalCases": 1640000,
      "states": 50,
      "avgRate": 495.1
    },
    "gonorrhea": {
      "totalCases": 710000,
      "states": 50,
      "avgRate": 214.8
    },
    "syphilis": {
      "totalCases": 176000,
      "states": 50,
      "avgRate": 53.2
    }
  },
  "timestamp": "2025-09-14T16:00:00.000Z"
}
```

#### `GET /api/std/diseases`
List available diseases, states, age groups, and years.

**Response:**
```json
{
  "diseases": [
    {"code": "chlamydia", "name": "Chlamydia"},
    {"code": "gonorrhea", "name": "Gonorrhea"},
    {"code": "syphilis", "name": "Syphilis"}
  ],
  "states": [
    {"code": "ny", "name": "New York"},
    {"code": "ca", "name": "California"}
  ],
  "ageGroups": [
    {"code": "15-19", "name": "15-19 years"}
  ],
  "availableYears": ["2008", "2009", "2010", "2011", "2012", "2013", "2014"],
  "note": "CDC WONDER STD data available through 2014 only"
}
```

#### `GET /api/std/status`
API status and comprehensive documentation.

### Development Endpoints

#### `GET /api/std/test-real`
Test endpoint for real CDC WONDER integration (currently non-functional).

**Response:**
```json
{
  "error": "CDC WONDER STD API integration temporarily unavailable",
  "reason": "XML parameter structure requires further research",
  "status": "under_development"
}
```

## Data Sources & Limitations

### CDC WONDER Database
- **Database ID**: `STD`
- **Data Range**: 1996-2014 only
- **Rate Limiting**: 2+ minutes between requests (recommended)
- **Coverage**: All US states, territories
- **Diseases**: Chlamydia, Gonorrhea, Primary & Secondary Syphilis

### Current Limitations
1. **Outdated Data**: CDC WONDER STD data only available through 2014
2. **API Complexity**: XML request format requires extensive parameter research
3. **Rate Limiting**: CDC enforces strict request spacing
4. **Geographic Restrictions**: Location-based queries may be limited

## Alternative Data Sources

For recent STD surveillance data (2015+), consider:

1. **CDC STI Statistics**
   - URL: https://www.cdc.gov/sti-statistics/
   - Format: Annual reports, downloadable datasets
   - Coverage: 2015-present

2. **State Health Department APIs**
   - Direct state-level surveillance systems
   - Often more current than federal sources

3. **CDC Data.gov Portal**
   - URL: https://data.cdc.gov/
   - Search: "STI", "STD", "sexually transmitted"

## Technical Implementation

### Architecture
```
├── server.js              # Express server with API endpoints
├── services/
│   └── stdService.js      # STD data service with CDC WONDER integration
└── STD_API_README.md      # This documentation
```

### Key Features
- **Rate Limiting**: Built-in 2-minute request spacing
- **Error Handling**: Comprehensive error messages and logging
- **Data Validation**: Year range and parameter validation
- **Fallback System**: Mock data while real integration develops
- **Extensible Design**: Easy to add new data sources

### Service Class Methods
```javascript
class STDService {
  async querySTDData(options)     // Main data query method
  async getSTDSummary(year)       // Aggregate statistics
  buildXMLRequest(params)         // CDC WONDER XML builder
  parseXMLResponse(xml)           // Response parser
}
```

## Development Roadmap

### Phase 1: ✅ Complete
- [x] Basic API structure
- [x] Mock data endpoints
- [x] Error handling and validation
- [x] Rate limiting implementation
- [x] Documentation

### Phase 2: 🔄 In Progress
- [ ] CDC WONDER XML parameter research
- [ ] Working real data integration
- [ ] Automated testing suite

### Phase 3: 📋 Planned
- [ ] Alternative data source integrations
- [ ] Data visualization endpoints
- [ ] Caching layer implementation
- [ ] Real-time data updates

## Usage Examples

### Basic Query
```javascript
// Get chlamydia data for New York in 2014
const response = await fetch('/api/std/data?disease=chlamydia&state=ny&year=2014');
const data = await response.json();
```

### Summary Statistics
```javascript
// Get all STD summary for 2014
const response = await fetch('/api/std/summary?year=2014');
const summary = await response.json();
```

### Check API Status
```javascript
// Get current API status and documentation
const response = await fetch('/api/std/status');
const status = await response.json();
```

## Error Handling

The API returns standard HTTP status codes:
- `200` - Success
- `400` - Bad Request (invalid parameters)
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error
- `503` - Service Unavailable

Error responses include descriptive messages:
```json
{
  "error": "STD data only available through 2014. For recent data, use alternative CDC sources.",
  "status": "validation_error"
}
```

## Support & Contributing

- Check `/api/std/status` for current operational status
- Review server logs for detailed error information
- Mock data provides realistic STD surveillance numbers for testing
- Real CDC integration requires additional XML format research

## Security & Compliance

- No authentication required for public health surveillance data
- Rate limiting respects CDC WONDER usage guidelines
- Error logs exclude sensitive information
- CORS enabled for cross-origin requests