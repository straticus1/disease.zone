# Multi-Provider Mapping System

## Overview

diseaseZone's mapping system provides comprehensive geographic visualization capabilities with support for multiple mapping providers, tiered access levels, and specialized disease surveillance overlays.

## 🌐 Supported Mapping Providers

### OpenStreetMap (OSM) - Free Tier
- **No API key required** - Production-ready without external dependencies
- **Full tile serving** via `https://tile.openstreetmap.org/{z}/{x}/{y}.png`
- **Nominatim geocoding** for address resolution
- **Attribution**: © OpenStreetMap contributors
- **Max zoom**: 19 levels
- **Format**: PNG tiles (256x256)

### MapBox - Silver & Gold Tiers
- **Vector tiles** with custom styling options
- **Styles available**: streets-v11, outdoors-v11, light-v10, dark-v10, satellite-v9, satellite-streets-v11
- **Enhanced geocoding** with relevance scoring
- **Max zoom**: 22 levels
- **Format**: Vector tiles (512x512)
- **Requires**: `MAPBOX_API_KEY` environment variable

### Google Maps - Gold Tier Only
- **Static Maps API** integration
- **Street View support** (future enhancement)
- **High-accuracy geocoding** with location type classification
- **Max zoom**: 21 levels  
- **Format**: PNG tiles (256x256)
- **Requires**: `GOOGLE_MAPS_API_KEY` environment variable

## 🎯 Service Tiers

### Free Tier (1,000 requests/day)
- **OpenStreetMap only**
- **Features**: Basic maps, geocoding
- **Perfect for**: Individual users, basic disease tracking

### Silver Tier (10,000 requests/day)  
- **OpenStreetMap + MapBox**
- **Features**: Basic maps, geocoding, satellite imagery, custom styles
- **Perfect for**: Medical professionals, research organizations

### Gold Tier (100,000 requests/day)
- **OpenStreetMap + MapBox + Google Maps**
- **Features**: All mapping features, street view, premium data access
- **Perfect for**: Healthcare institutions, large-scale surveillance

## 🗺️ Disease Visualization Overlays

### Circle Markers
- **Color-coded severity** based on disease incidence rates
- **Scalable radius** proportional to case counts
- **Interactive popups** with detailed disease information
- **Click-to-zoom** functionality for area investigation

### Heatmaps
- **Intensity-based visualization** with gradient coloring
- **Customizable gradients**: Green→Yellow→Orange→Red→DarkRed
- **Radius and blur controls** for visualization tuning
- **Real-time data integration** from surveillance systems

### Choropleth Maps
- **Boundary-based overlays** for state/county level data
- **Aggregate statistics** with average rates and total cases
- **Color scaling** based on data distribution
- **Geographic boundary integration**

### Point Markers
- **Individual location markers** with custom icons
- **Severity-based styling** (high/medium/low risk)
- **Detailed popups** with disease-specific information
- **Clustering support** for dense data areas

## 🚀 API Endpoints

### Mapping Service Status
```http
GET /api/maps/status
```

**Response:**
```json
{
  "service": "Mapping Service",
  "timestamp": "2025-09-16T05:00:00.000Z",
  "providers": {
    "openstreetmap": {
      "name": "OpenStreetMap",
      "available": true,
      "apiKeyConfigured": true
    },
    "mapbox": {
      "name": "Mapbox", 
      "available": false,
      "apiKeyConfigured": false
    },
    "google": {
      "name": "Google Maps",
      "available": false,
      "apiKeyConfigured": false
    }
  },
  "loadBalancing": {
    "strategy": "failover",
    "roundRobinIndex": 0
  }
}
```

### Map Configuration
```http
GET /api/maps/config?tier=free&zoom=10&centerLat=40.7128&centerLng=-74.0060
```

**Response:**
```json
{
  "success": true,
  "config": {
    "provider": "openstreetmap",
    "providerName": "OpenStreetMap",
    "tier": "free",
    "tierName": "Free Tier",
    "attribution": "© OpenStreetMap contributors",
    "maxZoom": 19,
    "center": [-74.0060, 40.7128],
    "zoom": 10,
    "features": ["basic_maps", "geocoding"],
    "maxRequests": 1000,
    "currentRequests": 0
  }
}
```

### Geocoding Service
```http
GET /api/maps/geocode?address=New York City&tier=free
```

**Response:**
```json
{
  "success": true,
  "query": "New York City",
  "tier": "free",
  "provider": "openstreetmap",
  "results": [
    {
      "address": "City of New York, New York, United States",
      "latitude": 40.7127281,
      "longitude": -74.0060152,
      "type": "administrative",
      "importance": 0.8716708671039277
    }
  ]
}
```

### Disease Overlays
```http
GET /api/maps/overlays/disease?disease=chlamydia&overlayType=circles&colorScheme=red-yellow-green
```

**Response:**
```json
{
  "success": true,
  "disease": "chlamydia",
  "overlayType": "circles",
  "dataPoints": 11,
  "overlays": [
    {
      "type": "circle",
      "coordinates": [40.7128, -74.0060],
      "properties": {
        "radius": 23.5,
        "fillColor": "#ff6b00",
        "color": "#333333",
        "weight": 2,
        "opacity": 1,
        "fillOpacity": 0.7
      },
      "data": {
        "location": "New York City",
        "state": "NY",
        "cases": 15420,
        "rate": 182.5
      },
      "popupContent": "HTML popup content..."
    }
  ]
}
```

### Geographic Disease Data (GeoJSON)
```http
GET /api/maps/data/disease/gonorrhea?format=geojson&state=CA
```

**Response:**
```json
{
  "success": true,
  "disease": "gonorrhea",
  "format": "geojson",
  "totalFeatures": 2,
  "data": {
    "type": "FeatureCollection",
    "features": [
      {
        "type": "Feature",
        "geometry": {
          "type": "Point",
          "coordinates": [-118.2437, 34.0522]
        },
        "properties": {
          "location": "Los Angeles",
          "state": "CA",
          "cases": 7650,
          "rate": 192.3,
          "popupContent": "HTML content..."
        }
      }
    ]
  }
}
```

## 🔧 Load Balancing Strategies

### Failover Strategy (Default)
- **Primary**: Best available provider for user's tier
- **Secondary**: Fallback if primary fails
- **Tertiary**: OpenStreetMap as guaranteed fallback
- **Use case**: Maximum reliability with graceful degradation

### Round Robin Strategy
- **Equal distribution** across all available providers
- **Automatic rotation** for balanced load
- **Request tracking** per provider
- **Use case**: Load distribution across premium providers

### Weighted Strategy  
- **Custom distribution** based on provider preferences
- **Default weights**: OSM=50%, MapBox=30%, Google=20%
- **Configurable** via service settings
- **Use case**: Preferred provider with fallback options

## 💻 Frontend Integration

### Leaflet.js Integration
```javascript
// Initialize mapping client
const mappingClient = new MappingClient('/api/maps');

// Create disease surveillance map
const mapResult = await mappingClient.initDiseaseMap('mapContainer', 'chlamydia', {
  tier: 'free',
  center: [39.8283, -98.5795], // Center of US
  zoom: 4,
  overlayType: 'circles',
  colorScheme: 'red-yellow-green'
});

console.log('Map initialized:', mapResult);
```

### Manual Leaflet Integration
```javascript
// Get map configuration
const config = await fetch('/api/maps/config?tier=free').then(r => r.json());

// Initialize Leaflet map
const map = L.map('mapContainer', {
  center: [config.config.center[1], config.config.center[0]],
  zoom: config.config.zoom,
  maxZoom: config.config.maxZoom
});

// Add OpenStreetMap tiles
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: config.config.attribution,
  maxZoom: config.config.maxZoom
}).addTo(map);

// Add disease overlays
const overlayData = await fetch('/api/maps/overlays/disease?disease=syphilis&overlayType=circles')
  .then(r => r.json());

overlayData.overlays.forEach(overlay => {
  if (overlay.type === 'circle') {
    const circle = L.circleMarker(overlay.coordinates, overlay.properties);
    if (overlay.popupContent) {
      circle.bindPopup(overlay.popupContent);
    }
    circle.addTo(map);
  }
});
```

### Mapping Client Methods
```javascript
// Available methods in MappingClient class
const client = new MappingClient('/api/maps');

// Basic mapping functions
await client.getStatus();
await client.getMapConfig({ tier: 'silver' });
await client.geocode('Houston, TX');

// Disease visualization functions  
await client.getDiseaseOverlay('hiv', { overlayType: 'heatmap' });
await client.getDiseaseData('gonorrhea', { state: 'TX', format: 'geojson' });
await client.addDiseaseOverlays(leafletMap, 'chlamydia');

// Complete disease surveillance map
await client.initDiseaseMap('container', 'syphilis', {
  tier: 'gold',
  overlayType: 'choropleth',
  showControls: true
});
```

## 🎨 Color Schemes & Styling

### Red-Yellow-Green Gradient (Default)
- **Green** (0.0-0.33): Low risk/incidence
- **Yellow** (0.33-0.67): Moderate risk/incidence  
- **Red** (0.67-1.0): High risk/incidence
- **Use case**: Intuitive risk visualization

### Blue-Red Intensity
- **Blue** (0.0): Minimum intensity
- **Red** (1.0): Maximum intensity
- **Linear interpolation** between extremes
- **Use case**: Simple intensity mapping

### Heat Gradient
- **Dark Blue** → **Blue** → **Cyan** → **Yellow** → **Red**
- **Four-stage progression** with smooth transitions
- **Maximum visual impact** for heatmaps
- **Use case**: Temperature-style visualization

## 🔒 Security & Rate Limiting

### Request Tracking
- **Daily limits** enforced per service tier
- **Provider-specific counting** for accurate limit tracking
- **Automatic reset** at midnight UTC
- **Grace period** handling for tier upgrades

### API Key Management
- **Environment variable** configuration
- **Runtime updates** via admin interface (future)
- **Secure storage** with no plaintext logging
- **Automatic validation** on service startup

### Error Handling
- **Graceful degradation** when providers fail
- **Automatic fallback** to OpenStreetMap
- **Comprehensive logging** for debugging
- **User-friendly error messages**

## 📊 Performance Optimization

### Caching Strategy
- **Client-side caching** with configurable expiry (5 minutes default)
- **Tile caching** via browser and CDN
- **Geocoding result caching** to reduce API calls
- **Configuration caching** for improved response times

### Request Optimization
- **Batch geocoding** for multiple addresses
- **Efficient tile loading** with viewport-based requests
- **Progressive enhancement** with fallback options
- **Connection pooling** for external API calls

## 🚧 Development Notes

### Environment Setup
```bash
# Optional API keys for enhanced functionality
export MAPBOX_API_KEY="your-mapbox-token"
export GOOGLE_MAPS_API_KEY="your-google-maps-key"

# No configuration required for OpenStreetMap
```

### Testing
```bash
# Test mapping service health
curl http://localhost:3000/api/maps/status

# Test geocoding (no API key required)
curl "http://localhost:3000/api/maps/geocode?address=Boston,MA&tier=free"

# Test disease overlays
curl "http://localhost:3000/api/maps/overlays/disease?disease=hiv&overlayType=circles"
```

### Production Deployment
- **CDN integration** for improved tile loading performance
- **Geographic load balancing** for regional optimization  
- **Monitoring setup** for API usage and error tracking
- **Backup providers** configuration for high availability

## 🌟 Future Enhancements

### Planned Features
- **Real-time data streaming** for live disease tracking
- **Custom boundary support** for health districts
- **3D visualization** for temporal disease patterns
- **Mobile-optimized** rendering and interactions
- **Offline mapping** support for remote areas

### Integration Opportunities
- **Hospital location overlays** from FHIR data
- **Public health facility mapping**
- **Transportation and risk factor correlation**
- **Social determinants of health visualization**

This comprehensive mapping system provides the foundation for sophisticated disease surveillance visualization while maintaining flexibility for various use cases and user tiers.