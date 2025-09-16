/**
 * Multi-Provider Mapping Service Client
 * Supports OpenStreetMap, Mapbox, and Google Maps with tiered access
 */
class MappingClient {
  constructor(apiBaseUrl = '/api/maps', options = {}) {
    this.apiBaseUrl = apiBaseUrl;
    this.tier = options.tier || 'free';
    this.provider = options.provider || null;
    this.strategy = options.strategy || null;
    this.cache = new Map();
    this.cacheExpiry = options.cacheExpiry || 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get service status and available providers
   */
  async getStatus() {
    const response = await fetch(`${this.apiBaseUrl}/status`);
    if (!response.ok) {
      throw new Error(`Failed to get service status: ${response.statusText}`);
    }
    return await response.json();
  }

  /**
   * Get available tiers and their features
   */
  async getTiers() {
    const response = await fetch(`${this.apiBaseUrl}/tiers`);
    if (!response.ok) {
      throw new Error(`Failed to get tiers: ${response.statusText}`);
    }
    return await response.json();
  }

  /**
   * Get map configuration for frontend integration
   */
  async getMapConfig(options = {}) {
    const params = new URLSearchParams({
      tier: options.tier || this.tier,
      ...(options.provider && { provider: options.provider }),
      ...(options.strategy && { strategy: options.strategy }),
      ...(options.style && { style: options.style }),
      ...(options.zoom && { zoom: options.zoom.toString() }),
      ...(options.center && {
        centerLat: options.center[1].toString(),
        centerLng: options.center[0].toString()
      })
    });

    const response = await fetch(`${this.apiBaseUrl}/config?${params}`);
    if (!response.ok) {
      throw new Error(`Failed to get map config: ${response.statusText}`);
    }
    return await response.json();
  }

  /**
   * Geocode an address using the selected provider
   */
  async geocode(address, options = {}) {
    const cacheKey = `geocode-${address}-${options.tier || this.tier}`;

    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheExpiry) {
        return cached.data;
      }
    }

    const params = new URLSearchParams({
      address,
      tier: options.tier || this.tier,
      ...(options.provider && { provider: options.provider })
    });

    const response = await fetch(`${this.apiBaseUrl}/geocode?${params}`);
    if (!response.ok) {
      throw new Error(`Geocoding failed: ${response.statusText}`);
    }

    const result = await response.json();

    // Cache the result
    this.cache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    return result;
  }

  /**
   * Get tile URL for a specific provider and coordinates
   */
  async getTileUrl(provider, z, x, y, options = {}) {
    const params = new URLSearchParams({
      tier: options.tier || this.tier,
      ...(options.style && { style: options.style })
    });

    const response = await fetch(`${this.apiBaseUrl}/tile/${provider}/${z}/${x}/${y}?${params}`);
    if (!response.ok) {
      throw new Error(`Failed to get tile URL: ${response.statusText}`);
    }
    return await response.json();
  }

  /**
   * Update API key for a provider (requires appropriate permissions)
   */
  async updateApiKey(provider, apiKey) {
    const response = await fetch(`${this.apiBaseUrl}/config/api-key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ provider, apiKey })
    });

    if (!response.ok) {
      throw new Error(`Failed to update API key: ${response.statusText}`);
    }
    return await response.json();
  }

  /**
   * Update load balancing strategy
   */
  async updateStrategy(strategy) {
    const response = await fetch(`${this.apiBaseUrl}/config/strategy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ strategy })
    });

    if (!response.ok) {
      throw new Error(`Failed to update strategy: ${response.statusText}`);
    }
    return await response.json();
  }

  /**
   * Initialize a Leaflet map with the service configuration
   */
  async initLeafletMap(containerId, options = {}) {
    if (typeof L === 'undefined') {
      throw new Error('Leaflet library not loaded. Include Leaflet before using this method.');
    }

    const config = await this.getMapConfig(options);
    const mapConfig = config.config;

    // Create map
    const map = L.map(containerId, {
      center: [mapConfig.center[1], mapConfig.center[0]],
      zoom: mapConfig.zoom,
      maxZoom: mapConfig.maxZoom
    });

    // Add tile layer based on provider
    let tileUrl;
    let tileOptions = {
      attribution: mapConfig.attribution,
      maxZoom: mapConfig.maxZoom,
      tileSize: mapConfig.tileSize
    };

    if (mapConfig.provider === 'openstreetmap') {
      tileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    } else if (mapConfig.provider === 'mapbox') {
      tileUrl = `https://api.mapbox.com/styles/v1/mapbox/${mapConfig.style}/tiles/{z}/{x}/{y}?access_token=${mapConfig.accessToken}`;
      tileOptions.tileSize = 512;
      tileOptions.zoomOffset = -1;
    } else if (mapConfig.provider === 'google') {
      // Google Maps requires special handling
      console.warn('Google Maps integration requires Google Maps JavaScript API');
    }

    if (tileUrl) {
      L.tileLayer(tileUrl, tileOptions).addTo(map);
    }

    // Add service tier info
    const tierControl = L.control({ position: 'bottomleft' });
    tierControl.onAdd = function() {
      const div = L.DomUtil.create('div', 'tier-info');
      div.innerHTML = `
        <div style="background: rgba(255,255,255,0.8); padding: 5px; font-size: 12px; border-radius: 3px;">
          <strong>${mapConfig.tierName}</strong><br>
          Provider: ${mapConfig.providerName}<br>
          Requests: ${mapConfig.currentRequests}/${mapConfig.maxRequests}
        </div>
      `;
      return div;
    };
    tierControl.addTo(map);

    return { map, config: mapConfig };
  }

  /**
   * Initialize a Mapbox GL JS map
   */
  async initMapboxMap(containerId, options = {}) {
    if (typeof mapboxgl === 'undefined') {
      throw new Error('Mapbox GL JS library not loaded. Include Mapbox GL JS before using this method.');
    }

    const config = await this.getMapConfig({
      ...options,
      provider: 'mapbox'
    });
    const mapConfig = config.config;

    if (!mapConfig.accessToken || mapConfig.accessToken === '[CONFIGURED]') {
      throw new Error('Mapbox access token not configured');
    }

    mapboxgl.accessToken = mapConfig.accessToken;

    const map = new mapboxgl.Map({
      container: containerId,
      style: `mapbox://styles/mapbox/${mapConfig.style}`,
      center: mapConfig.center,
      zoom: mapConfig.zoom
    });

    // Add tier info control
    map.on('load', () => {
      const tierDiv = document.createElement('div');
      tierDiv.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
      tierDiv.innerHTML = `
        <div style="padding: 10px; font-size: 12px; background: white;">
          <strong>${mapConfig.tierName}</strong><br>
          Provider: ${mapConfig.providerName}<br>
          Requests: ${mapConfig.currentRequests}/${mapConfig.maxRequests}
        </div>
      `;
      map.getContainer().appendChild(tierDiv);
    });

    return { map, config: mapConfig };
  }

  /**
   * Create a data visualization overlay for STD surveillance data
   */
  async createDataOverlay(map, data, options = {}) {
    const overlayType = options.type || 'choropleth';
    const valueField = options.valueField || 'cases';

    if (overlayType === 'choropleth' && typeof L !== 'undefined') {
      // Leaflet choropleth implementation
      const geojsonLayer = L.geoJson(data, {
        style: (feature) => {
          const value = feature.properties[valueField];
          const intensity = this.getIntensityColor(value, data, valueField);
          return {
            fillColor: intensity.color,
            weight: 1,
            opacity: 1,
            color: 'white',
            fillOpacity: 0.7
          };
        },
        onEachFeature: (feature, layer) => {
          const props = feature.properties;
          layer.bindPopup(`
            <strong>${props.name || props.state}</strong><br>
            ${valueField}: ${props[valueField]}<br>
            Rate: ${props.rate || 'N/A'}
          `);
        }
      }).addTo(map);

      return geojsonLayer;
    } else if (overlayType === 'heatmap' && typeof L !== 'undefined') {
      // Heatmap implementation (requires leaflet-heat plugin)
      const heatData = data.map(item => [
        item.latitude,
        item.longitude,
        item[valueField]
      ]);

      if (typeof L.heatLayer !== 'undefined') {
        const heatLayer = L.heatLayer(heatData, {
          radius: options.radius || 25,
          blur: options.blur || 15,
          maxZoom: options.maxZoom || 17
        }).addTo(map);

        return heatLayer;
      }
    }

    throw new Error(`Overlay type '${overlayType}' not supported or required libraries not loaded`);
  }

  /**
   * Get color intensity based on data value
   */
  getIntensityColor(value, data, field) {
    const values = data.map(item => item.properties ? item.properties[field] : item[field]);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const normalized = (value - min) / (max - min);

    // Color scale from light to dark red
    const colors = [
      '#FFEDA0', '#FED976', '#FEB24C', '#FD8D3C',
      '#FC4E2A', '#E31A1C', '#BD0026', '#800026'
    ];

    const index = Math.floor(normalized * (colors.length - 1));
    return {
      color: colors[index] || colors[0],
      intensity: normalized
    };
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Set default tier
   */
  setTier(tier) {
    this.tier = tier;
  }

  /**
   * Set default provider
   */
  setProvider(provider) {
    this.provider = provider;
  }

  /**
   * Get disease overlay data for mapping
   */
  async getDiseaseOverlay(disease, options = {}) {
    const {
      overlayType = 'circles',
      colorScheme = 'red-yellow-green',
      state = null,
      year = new Date().getFullYear(),
      tier = this.tier
    } = options;

    const params = new URLSearchParams({
      disease,
      overlayType,
      colorScheme,
      ...(state && { state }),
      year: year.toString(),
      tier
    });

    const response = await fetch(`${this.apiBaseUrl}/overlays/disease?${params}`);
    if (!response.ok) {
      throw new Error(`Failed to get disease overlay: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get geographic disease data in various formats
   */
  async getDiseaseData(disease, options = {}) {
    const {
      state = null,
      year = new Date().getFullYear(),
      format = 'geojson'
    } = options;

    const params = new URLSearchParams({
      ...(state && { state }),
      year: year.toString(),
      format
    });

    const response = await fetch(`${this.apiBaseUrl}/data/disease/${disease}?${params}`);
    if (!response.ok) {
      throw new Error(`Failed to get disease data: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get mapping service health status
   */
  async getHealthStatus() {
    const response = await fetch(`${this.apiBaseUrl}/health`);
    if (!response.ok) {
      throw new Error(`Failed to get health status: ${response.statusText}`);
    }
    return await response.json();
  }

  /**
   * Add disease overlays to an existing Leaflet map
   */
  async addDiseaseOverlays(map, disease, options = {}) {
    if (typeof L === 'undefined') {
      throw new Error('Leaflet library not loaded');
    }

    try {
      const overlayData = await this.getDiseaseOverlay(disease, options);
      const layers = [];

      overlayData.overlays.forEach(overlay => {
        let layer;

        switch (overlay.type) {
          case 'circle':
            layer = L.circleMarker(overlay.coordinates, overlay.properties);
            if (overlay.popupContent) {
              layer.bindPopup(overlay.popupContent);
            }
            break;

          case 'marker':
            layer = L.marker(overlay.coordinates, {
              title: overlay.properties.title
            });
            if (overlay.popupContent) {
              layer.bindPopup(overlay.popupContent);
            }
            break;

          case 'heatmap':
            // Note: Requires leaflet-heat plugin
            if (typeof L.heatLayer !== 'undefined') {
              layer = L.heatLayer(overlay.data, overlay.options);
            } else {
              console.warn('Leaflet heat plugin not loaded, skipping heatmap');
              continue;
            }
            break;

          default:
            console.warn(`Unsupported overlay type: ${overlay.type}`);
            continue;
        }

        if (layer) {
          layer.addTo(map);
          layers.push(layer);
        }
      });

      return {
        layers,
        disease: overlayData.disease,
        dataPoints: overlayData.dataPoints,
        metadata: overlayData.metadata
      };
    } catch (error) {
      console.error('Error adding disease overlays:', error);
      throw error;
    }
  }

  /**
   * Create a production-ready disease surveillance map
   */
  async initDiseaseMap(containerId, disease, options = {}) {
    const {
      tier = this.tier,
      center = [39.8283, -98.5795], // Center of US
      zoom = 4,
      overlayType = 'circles',
      colorScheme = 'red-yellow-green',
      showControls = true
    } = options;

    try {
      // Initialize base map
      const mapResult = await this.initLeafletMap(containerId, {
        tier,
        center,
        zoom
      });

      // Add disease overlays
      const overlayResult = await this.addDiseaseOverlays(mapResult.map, disease, {
        overlayType,
        colorScheme,
        tier
      });

      // Add control panel if requested
      if (showControls) {
        this.addMapControls(mapResult.map, disease, overlayResult);
      }

      return {
        map: mapResult.map,
        config: mapResult.config,
        disease: overlayResult.disease,
        overlayLayers: overlayResult.layers,
        metadata: overlayResult.metadata
      };
    } catch (error) {
      console.error('Error initializing disease map:', error);
      throw error;
    }
  }

  /**
   * Add map controls for disease data
   */
  addMapControls(map, disease, overlayResult) {
    if (typeof L === 'undefined') return;

    const controlDiv = L.DomUtil.create('div', 'disease-map-controls');
    controlDiv.style.cssText = `
      background: white;
      padding: 10px;
      border-radius: 5px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      font-family: Arial, sans-serif;
      font-size: 12px;
      max-width: 200px;
    `;

    controlDiv.innerHTML = `
      <h4 style="margin: 0 0 5px 0; color: #333;">${disease.toUpperCase()} Surveillance</h4>
      <div><strong>Data Points:</strong> ${overlayResult.dataPoints}</div>
      <div><strong>Last Updated:</strong> ${new Date(overlayResult.metadata.timestamp).toLocaleDateString()}</div>
      <div style="margin-top: 8px; font-size: 10px; color: #666;">
        Source: ${overlayResult.metadata.dataSource}
      </div>
    `;

    const control = L.control({ position: 'bottomright' });
    control.onAdd = function() {
      return controlDiv;
    };
    control.addTo(map);

    return control;
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return {
      apiBaseUrl: this.apiBaseUrl,
      tier: this.tier,
      provider: this.provider,
      strategy: this.strategy,
      cacheSize: this.cache.size
    };
  }
}

// Export for use in both browser and Node.js environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MappingClient;
} else if (typeof window !== 'undefined') {
  window.MappingClient = MappingClient;
}
