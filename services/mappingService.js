class MappingService {
  constructor() {
    // Service tiers configuration
    this.tiers = {
      free: {
        name: 'Free Tier',
        providers: ['openstreetmap'],
        maxRequests: 1000,
        features: ['basic_maps', 'geocoding']
      },
      silver: {
        name: 'Silver Tier',
        providers: ['openstreetmap', 'mapbox'],
        maxRequests: 10000,
        features: ['basic_maps', 'geocoding', 'satellite', 'custom_styles']
      },
      gold: {
        name: 'Gold Tier',
        providers: ['openstreetmap', 'mapbox', 'google'],
        maxRequests: 100000,
        features: ['basic_maps', 'geocoding', 'satellite', 'custom_styles', 'street_view', 'premium_data']
      }
    };

    // Provider configurations
    this.providers = {
      openstreetmap: {
        name: 'OpenStreetMap',
        baseUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        geocodingUrl: 'https://nominatim.openstreetmap.org/search',
        requiresApiKey: false,
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
        tileSize: 256,
        format: 'png'
      },
      mapbox: {
        name: 'Mapbox',
        baseUrl: 'https://api.mapbox.com/styles/v1/mapbox/{style}/tiles/{z}/{x}/{y}',
        geocodingUrl: 'https://api.mapbox.com/geocoding/v5/mapbox.places',
        requiresApiKey: true,
        attribution: '© Mapbox © OpenStreetMap contributors',
        maxZoom: 22,
        tileSize: 512,
        format: 'vector',
        styles: ['streets-v11', 'outdoors-v11', 'light-v10', 'dark-v10', 'satellite-v9', 'satellite-streets-v11']
      },
      google: {
        name: 'Google Maps',
        baseUrl: 'https://maps.googleapis.com/maps/api/staticmap',
        geocodingUrl: 'https://maps.googleapis.com/maps/api/geocode/json',
        streetViewUrl: 'https://maps.googleapis.com/maps/api/streetview',
        requiresApiKey: true,
        attribution: '© Google',
        maxZoom: 21,
        tileSize: 256,
        format: 'png'
      }
    };

    // Load balancing strategies
    this.loadBalancingStrategies = {
      failover: 'failover',
      roundRobin: 'round_robin',
      weighted: 'weighted'
    };

    // Current strategy and state
    this.currentStrategy = this.loadBalancingStrategies.failover;
    this.roundRobinIndex = 0;
    this.providerWeights = {
      openstreetmap: 50,
      mapbox: 30,
      google: 20
    };

    // Request tracking for rate limiting
    this.requestCounts = new Map();
    this.resetRequestCounts();

    // API keys (loaded from environment or configuration)
    this.apiKeys = {
      mapbox: process.env.MAPBOX_API_KEY || null,
      google: process.env.GOOGLE_MAPS_API_KEY || null
    };
  }

  // Get available providers for a given tier
  getAvailableProviders(tier = 'free') {
    const tierConfig = this.tiers[tier];
    if (!tierConfig) {
      throw new Error(`Invalid tier: ${tier}`);
    }

    return tierConfig.providers.filter(provider => {
      const providerConfig = this.providers[provider];
      if (!providerConfig.requiresApiKey) return true;
      return this.apiKeys[provider] !== null;
    });
  }

  // Select provider based on load balancing strategy
  selectProvider(tier = 'free', strategy = null) {
    const availableProviders = this.getAvailableProviders(tier);
    if (availableProviders.length === 0) {
      throw new Error(`No available providers for tier: ${tier}`);
    }

    const selectedStrategy = strategy || this.currentStrategy;

    switch (selectedStrategy) {
      case this.loadBalancingStrategies.failover:
        return this.selectFailoverProvider(availableProviders);

      case this.loadBalancingStrategies.roundRobin:
        return this.selectRoundRobinProvider(availableProviders);

      case this.loadBalancingStrategies.weighted:
        return this.selectWeightedProvider(availableProviders);

      default:
        return availableProviders[0];
    }
  }

  selectFailoverProvider(providers) {
    // Return first available provider (failover order)
    return providers[0];
  }

  selectRoundRobinProvider(providers) {
    const provider = providers[this.roundRobinIndex % providers.length];
    this.roundRobinIndex = (this.roundRobinIndex + 1) % providers.length;
    return provider;
  }

  selectWeightedProvider(providers) {
    const weights = providers.map(p => this.providerWeights[p] || 10);
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < providers.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return providers[i];
      }
    }

    return providers[0];
  }

  // Generate tile URL for a given provider
  getTileUrl(provider, z, x, y, options = {}) {
    const providerConfig = this.providers[provider];
    if (!providerConfig) {
      throw new Error(`Unknown provider: ${provider}`);
    }

    let url = providerConfig.baseUrl;

    // Replace template variables
    url = url.replace(/{z}/g, z);
    url = url.replace(/{x}/g, x);
    url = url.replace(/{y}/g, y);

    // Provider-specific URL handling
    if (provider === 'mapbox') {
      const style = options.style || 'streets-v11';
      url = url.replace(/{style}/g, style);
      if (this.apiKeys.mapbox) {
        url += `?access_token=${this.apiKeys.mapbox}`;
      }
    } else if (provider === 'google') {
      // Google Maps tile URL construction
      if (this.apiKeys.google) {
        url = `https://maps.googleapis.com/maps/api/staticmap?center=${options.center || '0,0'}&zoom=${z}&size=640x640&maptype=roadmap&key=${this.apiKeys.google}`;
      } else {
        // Fallback to Google's tile server format (may require additional auth)
        url = `https://mt1.google.com/vt/lyrs=m&x=${x}&y=${y}&z=${z}`;
      }
    }

    return url;
  }

  // Get map configuration for frontend
  getMapConfig(tier = 'free', options = {}) {
    const {
      provider = null,
      strategy = null,
      style = 'streets-v11',
      zoom = 10,
      center = [40.7128, -74.0060] // NYC default
    } = options;

    const selectedProvider = provider || this.selectProvider(tier, strategy);
    const providerConfig = this.providers[selectedProvider];
    const tierConfig = this.tiers[tier];

    const config = {
      provider: selectedProvider,
      providerName: providerConfig.name,
      tier: tier,
      tierName: tierConfig.name,
      attribution: providerConfig.attribution,
      maxZoom: providerConfig.maxZoom,
      tileSize: providerConfig.tileSize,
      format: providerConfig.format,
      center: center,
      zoom: zoom,
      features: tierConfig.features,
      maxRequests: tierConfig.maxRequests,
      currentRequests: this.requestCounts.get(selectedProvider) || 0
    };

    // Add provider-specific configuration
    if (selectedProvider === 'mapbox') {
      config.style = style;
      config.styles = providerConfig.styles;
      config.accessToken = this.apiKeys.mapbox ? '[CONFIGURED]' : null;
    } else if (selectedProvider === 'google') {
      config.apiKey = this.apiKeys.google ? '[CONFIGURED]' : null;
    }

    return config;
  }

  // Geocoding service
  async geocode(address, tier = 'free', provider = null) {
    const selectedProvider = provider || this.selectProvider(tier);
    const providerConfig = this.providers[selectedProvider];

    this.incrementRequestCount(selectedProvider);

    try {
      if (selectedProvider === 'openstreetmap') {
        return await this.geocodeOpenStreetMap(address);
      } else if (selectedProvider === 'mapbox') {
        return await this.geocodeMapbox(address);
      } else if (selectedProvider === 'google') {
        return await this.geocodeGoogle(address);
      }
    } catch (error) {
      console.error(`Geocoding failed for provider ${selectedProvider}:`, error);

      // Try failover if current provider fails
      if (tier === 'gold' && selectedProvider !== 'openstreetmap') {
        console.log('Attempting failover to OpenStreetMap...');
        return await this.geocodeOpenStreetMap(address);
      }

      throw error;
    }
  }

  async geocodeOpenStreetMap(address) {
    const { default: fetch } = await import('node-fetch');
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=5`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'STD Surveillance Mapping Service (respectful usage)'
      }
    });

    if (!response.ok) {
      throw new Error(`OpenStreetMap geocoding error: ${response.status}`);
    }

    const data = await response.json();
    return {
      provider: 'openstreetmap',
      results: data.map(result => ({
        address: result.display_name,
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
        type: result.type,
        importance: parseFloat(result.importance || 0)
      }))
    };
  }

  async geocodeMapbox(address) {
    if (!this.apiKeys.mapbox) {
      throw new Error('Mapbox API key not configured');
    }

    const { default: fetch } = await import('node-fetch');
    const url = `${this.providers.mapbox.geocodingUrl}/${encodeURIComponent(address)}.json?access_token=${this.apiKeys.mapbox}&limit=5`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Mapbox geocoding error: ${response.status}`);
    }

    const data = await response.json();
    return {
      provider: 'mapbox',
      results: data.features.map(feature => ({
        address: feature.place_name,
        latitude: feature.center[1],
        longitude: feature.center[0],
        type: feature.place_type[0],
        relevance: feature.relevance
      }))
    };
  }

  async geocodeGoogle(address) {
    if (!this.apiKeys.google) {
      throw new Error('Google Maps API key not configured');
    }

    const { default: fetch } = await import('node-fetch');
    const url = `${this.providers.google.geocodingUrl}?address=${encodeURIComponent(address)}&key=${this.apiKeys.google}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Google geocoding error: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== 'OK') {
      throw new Error(`Google geocoding API error: ${data.status}`);
    }

    return {
      provider: 'google',
      results: data.results.map(result => ({
        address: result.formatted_address,
        latitude: result.geometry.location.lat,
        longitude: result.geometry.location.lng,
        type: result.types[0],
        accuracy: result.geometry.location_type
      }))
    };
  }

  // Request counting for rate limiting
  incrementRequestCount(provider) {
    const current = this.requestCounts.get(provider) || 0;
    this.requestCounts.set(provider, current + 1);
  }

  resetRequestCounts() {
    this.requestCounts.clear();
    // Reset counts daily
    setInterval(() => {
      this.requestCounts.clear();
    }, 24 * 60 * 60 * 1000);
  }

  // Service status and health check
  getServiceStatus() {
    const status = {
      service: 'Mapping Service',
      timestamp: new Date().toISOString(),
      tiers: this.tiers,
      providers: {},
      loadBalancing: {
        strategy: this.currentStrategy,
        roundRobinIndex: this.roundRobinIndex
      },
      requestCounts: Object.fromEntries(this.requestCounts)
    };

    // Check provider availability
    Object.keys(this.providers).forEach(provider => {
      const providerConfig = this.providers[provider];
      status.providers[provider] = {
        name: providerConfig.name,
        available: !providerConfig.requiresApiKey || this.apiKeys[provider] !== null,
        apiKeyConfigured: this.apiKeys[provider] !== null,
        attribution: providerConfig.attribution
      };
    });

    return status;
  }

  // Update API keys (for runtime configuration)
  updateApiKey(provider, apiKey) {
    if (this.providers[provider] && this.providers[provider].requiresApiKey) {
      this.apiKeys[provider] = apiKey;
      return true;
    }
    return false;
  }

  // Update load balancing strategy
  setLoadBalancingStrategy(strategy) {
    if (Object.values(this.loadBalancingStrategies).includes(strategy)) {
      this.currentStrategy = strategy;
      return true;
    }
    return false;
  }

  // Production disease overlay methods
  generateDiseaseOverlay(diseaseData, overlayType = 'circles', options = {}) {
    const {
      colorScheme = 'red-yellow-green',
      sizeMetric = 'rate',
      intensityMetric = 'cases',
      bounds = null,
      clustering = false
    } = options;

    if (!Array.isArray(diseaseData) || diseaseData.length === 0) {
      throw new Error('Disease data must be a non-empty array');
    }

    // Validate required fields
    const requiredFields = ['latitude', 'longitude'];
    const hasRequiredFields = diseaseData.every(item => 
      requiredFields.every(field => item.hasOwnProperty(field) && typeof item[field] === 'number')
    );

    if (!hasRequiredFields) {
      throw new Error('Disease data must contain latitude and longitude fields');
    }

    switch (overlayType) {
      case 'circles':
        return this.generateCircleOverlay(diseaseData, colorScheme, sizeMetric, options);
      case 'heatmap':
        return this.generateHeatmapOverlay(diseaseData, intensityMetric, options);
      case 'choropleth':
        return this.generateChoroplethOverlay(diseaseData, colorScheme, options);
      case 'markers':
        return this.generateMarkerOverlay(diseaseData, options);
      default:
        throw new Error(`Unsupported overlay type: ${overlayType}`);
    }
  }

  generateCircleOverlay(data, colorScheme, sizeMetric, options = {}) {
    const { minRadius = 5, maxRadius = 30, opacity = 0.7 } = options;
    
    // Calculate min/max values for scaling
    const values = data.map(item => item[sizeMetric] || 0).filter(v => !isNaN(v));
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue || 1;

    return data.map(item => {
      const value = item[sizeMetric] || 0;
      const normalizedValue = (value - minValue) / range;
      
      return {
        type: 'circle',
        coordinates: [item.latitude, item.longitude],
        properties: {
          radius: minRadius + (normalizedValue * (maxRadius - minRadius)),
          fillColor: this.getColorForValue(normalizedValue, colorScheme),
          color: '#333333',
          weight: 2,
          opacity: 1,
          fillOpacity: opacity
        },
        data: item,
        popupContent: this.generatePopupContent(item)
      };
    });
  }

  generateHeatmapOverlay(data, intensityMetric, options = {}) {
    const { radius = 25, blur = 15, gradient = null } = options;
    
    // Calculate min/max for intensity scaling
    const values = data.map(item => item[intensityMetric] || 0).filter(v => !isNaN(v));
    const maxValue = Math.max(...values);
    
    return {
      type: 'heatmap',
      data: data.map(item => {
        const intensity = (item[intensityMetric] || 0) / maxValue;
        return [item.latitude, item.longitude, intensity];
      }),
      options: {
        radius,
        blur,
        maxZoom: 17,
        gradient: gradient || {
          0.0: 'green',
          0.2: 'yellow',
          0.4: 'orange', 
          0.6: 'red',
          1.0: 'darkred'
        }
      }
    };
  }

  generateChoroplethOverlay(data, colorScheme, options = {}) {
    const { valueField = 'rate', boundaryField = 'state' } = options;
    
    // Group data by boundary (e.g., state)
    const groupedData = data.reduce((acc, item) => {
      const boundary = item[boundaryField];
      if (!acc[boundary]) acc[boundary] = [];
      acc[boundary].push(item);
      return acc;
    }, {});

    // Calculate aggregate values for each boundary
    const boundaryData = Object.entries(groupedData).map(([boundary, items]) => {
      const totalCases = items.reduce((sum, item) => sum + (item.cases || 0), 0);
      const avgRate = items.reduce((sum, item) => sum + (item[valueField] || 0), 0) / items.length;
      
      return {
        boundary,
        value: avgRate,
        totalCases,
        itemCount: items.length,
        items
      };
    });

    // Calculate min/max for color scaling
    const values = boundaryData.map(item => item.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue || 1;

    return boundaryData.map(boundary => {
      const normalizedValue = (boundary.value - minValue) / range;
      
      return {
        type: 'choropleth',
        boundary: boundary.boundary,
        properties: {
          fillColor: this.getColorForValue(normalizedValue, colorScheme),
          color: '#333333',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.6
        },
        data: boundary,
        popupContent: this.generateBoundaryPopupContent(boundary)
      };
    });
  }

  generateMarkerOverlay(data, options = {}) {
    const { icon = 'default', clustering = false } = options;
    
    return data.map(item => ({
      type: 'marker',
      coordinates: [item.latitude, item.longitude],
      properties: {
        icon: this.getMarkerIcon(item, icon),
        title: item.location || item.city || 'Disease Location'
      },
      data: item,
      popupContent: this.generatePopupContent(item)
    }));
  }

  getColorForValue(normalizedValue, colorScheme) {
    // Clamp value between 0 and 1
    const value = Math.max(0, Math.min(1, normalizedValue));
    
    switch (colorScheme) {
      case 'red-yellow-green':
        if (value < 0.33) return this.interpolateColor('#00ff00', '#ffff00', value * 3);
        if (value < 0.67) return this.interpolateColor('#ffff00', '#ff8800', (value - 0.33) * 3);
        return this.interpolateColor('#ff8800', '#ff0000', (value - 0.67) * 3);
      
      case 'blue-red':
        return this.interpolateColor('#0000ff', '#ff0000', value);
      
      case 'heat':
        if (value < 0.25) return this.interpolateColor('#000080', '#0000ff', value * 4);
        if (value < 0.5) return this.interpolateColor('#0000ff', '#00ffff', (value - 0.25) * 4);
        if (value < 0.75) return this.interpolateColor('#00ffff', '#ffff00', (value - 0.5) * 4);
        return this.interpolateColor('#ffff00', '#ff0000', (value - 0.75) * 4);
      
      default:
        return this.interpolateColor('#00ff00', '#ff0000', value);
    }
  }

  interpolateColor(color1, color2, factor) {
    const hex2rgb = (hex) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return [r, g, b];
    };
    
    const [r1, g1, b1] = hex2rgb(color1);
    const [r2, g2, b2] = hex2rgb(color2);
    
    const r = Math.round(r1 + (r2 - r1) * factor);
    const g = Math.round(g1 + (g2 - g1) * factor);
    const b = Math.round(b1 + (b2 - b1) * factor);
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  generatePopupContent(item) {
    const location = item.location || item.city || 'Unknown Location';
    const state = item.state ? `, ${item.state}` : '';
    const disease = item.disease || 'Disease';
    const cases = item.cases ? item.cases.toLocaleString() : 'N/A';
    const rate = item.rate ? `${item.rate.toFixed(1)} per 100k` : 'N/A';
    const lastUpdated = item.lastUpdated ? new Date(item.lastUpdated).toLocaleDateString() : 'Unknown';
    
    return `
      <div class="disease-popup">
        <h4>${location}${state}</h4>
        <div class="disease-info">
          <strong>Disease:</strong> ${disease}<br>
          <strong>Cases:</strong> ${cases}<br>
          <strong>Rate:</strong> ${rate}<br>
          <strong>Last Updated:</strong> ${lastUpdated}
        </div>
      </div>
    `;
  }

  generateBoundaryPopupContent(boundaryData) {
    const { boundary, value, totalCases, itemCount } = boundaryData;
    
    return `
      <div class="boundary-popup">
        <h4>${boundary}</h4>
        <div class="summary-info">
          <strong>Average Rate:</strong> ${value.toFixed(1)} per 100k<br>
          <strong>Total Cases:</strong> ${totalCases.toLocaleString()}<br>
          <strong>Reporting Areas:</strong> ${itemCount}<br>
        </div>
      </div>
    `;
  }

  getMarkerIcon(item, iconType) {
    const severity = this.calculateSeverity(item);
    
    switch (iconType) {
      case 'alert':
        return {
          type: 'alert',
          color: severity === 'high' ? 'red' : severity === 'medium' ? 'orange' : 'yellow',
          size: severity === 'high' ? 'large' : 'medium'
        };
      
      case 'circle':
        return {
          type: 'circle',
          color: severity === 'high' ? '#ff0000' : severity === 'medium' ? '#ff8800' : '#ffff00',
          radius: severity === 'high' ? 12 : severity === 'medium' ? 8 : 6
        };
      
      default:
        return {
          type: 'default',
          color: '#ff0000'
        };
    }
  }

  calculateSeverity(item) {
    const rate = item.rate || 0;
    const cases = item.cases || 0;
    
    // Define thresholds based on disease type or use defaults
    const highRateThreshold = item.highThreshold || 500;
    const mediumRateThreshold = item.mediumThreshold || 100;
    
    if (rate > highRateThreshold || cases > 10000) return 'high';
    if (rate > mediumRateThreshold || cases > 1000) return 'medium';
    return 'low';
  }

  // Production health check for mapping with disease data
  async performHealthCheck() {
    const results = {
      service: 'Mapping Service with Disease Overlays',
      timestamp: new Date().toISOString(),
      status: 'healthy',
      checks: {}
    };

    try {
      // Test OpenStreetMap connectivity
      const osmTest = await this.testProviderConnectivity('openstreetmap');
      results.checks.openstreetmap = osmTest;

      // Test geocoding
      const geocodingTest = await this.testGeocoding();
      results.checks.geocoding = geocodingTest;

      // Test overlay generation
      const overlayTest = this.testOverlayGeneration();
      results.checks.overlays = overlayTest;

      // Determine overall status
      const allHealthy = Object.values(results.checks).every(check => check.status === 'healthy');
      results.status = allHealthy ? 'healthy' : 'degraded';

    } catch (error) {
      results.status = 'unhealthy';
      results.error = error.message;
    }

    return results;
  }

  async testProviderConnectivity(provider) {
    try {
      const config = this.providers[provider];
      if (!config) {
        return { status: 'unhealthy', message: 'Provider not configured' };
      }

      // Test with a simple tile request
      const testUrl = config.baseUrl.replace(/{z}/g, '1').replace(/{x}/g, '1').replace(/{y}/g, '1');
      const { default: fetch } = await import('node-fetch');
      
      const response = await fetch(testUrl, {
        timeout: 5000,
        headers: { 'User-Agent': 'diseaseZone Health Check' }
      });

      return {
        status: response.ok ? 'healthy' : 'degraded',
        responseTime: response.headers.get('x-response-time') || 'unknown',
        message: response.ok ? 'Provider accessible' : `HTTP ${response.status}`
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error.message
      };
    }
  }

  async testGeocoding() {
    try {
      const result = await this.geocodeOpenStreetMap('New York City');
      return {
        status: result.results.length > 0 ? 'healthy' : 'degraded',
        message: `Geocoding returned ${result.results.length} results`
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error.message
      };
    }
  }

  testOverlayGeneration() {
    try {
      // Test with sample data
      const sampleData = [
        { latitude: 40.7128, longitude: -74.0060, cases: 1000, rate: 150, disease: 'Test' },
        { latitude: 34.0522, longitude: -118.2437, cases: 800, rate: 120, disease: 'Test' }
      ];

      const circleOverlay = this.generateDiseaseOverlay(sampleData, 'circles');
      const heatmapOverlay = this.generateDiseaseOverlay(sampleData, 'heatmap');
      
      return {
        status: 'healthy',
        message: `Generated ${circleOverlay.length} circle overlays and heatmap data`
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error.message
      };
    }
  }
}

module.exports = MappingService;
