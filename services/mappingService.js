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
      // Google uses static map API differently
      const center = options.center || '0,0';
      const zoom = options.zoom || z;
      const size = options.size || '640x640';
      url = `${providerConfig.baseUrl}?center=${center}&zoom=${zoom}&size=${size}`;
      if (this.apiKeys.google) {
        url += `&key=${this.apiKeys.google}`;
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
}

module.exports = MappingService;