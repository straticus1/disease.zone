class ErrorHandlingService {
  constructor() {
    // Load configuration from environment
    this.config = {
      enableFallbacks: process.env.ENABLE_DATA_FALLBACKS === 'true',
      fallbackToCached: process.env.FALLBACK_TO_CACHED_DATA === 'true',
      fallbackToPlaceholder: process.env.FALLBACK_TO_PLACEHOLDER_DATA === 'true',
      enableRetries: true,
      maxRetries: 3,
      retryDelay: 1000, // Base delay in milliseconds
      backoffMultiplier: 2
    };

    // Error types and their handling strategies
    this.errorTypes = {
      API_UNAVAILABLE: {
        code: 'API_001',
        message: 'External API service unavailable',
        strategy: 'fallback_with_cache',
        retryable: true
      },
      RATE_LIMITED: {
        code: 'API_002',
        message: 'API rate limit exceeded',
        strategy: 'exponential_backoff',
        retryable: true
      },
      INVALID_API_KEY: {
        code: 'API_003',
        message: 'Invalid or missing API key',
        strategy: 'degrade_to_public',
        retryable: false
      },
      DATA_NOT_FOUND: {
        code: 'DATA_001',
        message: 'Requested data not available',
        strategy: 'fallback_to_alternative',
        retryable: false
      },
      NETWORK_ERROR: {
        code: 'NET_001',
        message: 'Network connectivity issue',
        strategy: 'retry_with_backoff',
        retryable: true
      },
      TIMEOUT_ERROR: {
        code: 'NET_002',
        message: 'Request timeout',
        strategy: 'retry_with_timeout_increase',
        retryable: true
      },
      PARSE_ERROR: {
        code: 'PARSE_001',
        message: 'Failed to parse response data',
        strategy: 'log_and_fallback',
        retryable: false
      },
      QUOTA_EXCEEDED: {
        code: 'QUOTA_001',
        message: 'API quota exceeded',
        strategy: 'wait_and_retry',
        retryable: true
      }
    };

    // Fallback data sources priority - disease.sh first for immediate availability
    this.fallbackPriority = {
      hiv: ['disease.sh', 'cdc', 'who', 'cache', 'placeholder'],
      aids: ['disease.sh', 'cdc', 'who', 'cache', 'placeholder'],
      covid: ['disease.sh', 'cache', 'placeholder'],
      influenza: ['disease.sh', 'cdc', 'cache', 'placeholder'],
      tuberculosis: ['disease.sh', 'cdc', 'cache', 'placeholder'],
      herpes: ['nhanes', 'cdc', 'cache', 'placeholder'],
      hsv1: ['nhanes', 'cache', 'placeholder'],
      hsv2: ['nhanes', 'cache', 'placeholder'],
      hpv: ['hpv-impact', 'cdc', 'cache', 'placeholder'],
      syphilis: ['disease.sh', 'cdc', 'cache', 'placeholder'],
      gonorrhea: ['disease.sh', 'cdc', 'cache', 'placeholder'],
      chlamydia: ['disease.sh', 'cdc', 'cache', 'placeholder']
    };

    // Cache for error patterns and circuit breaker states
    this.errorCache = new Map();
    this.circuitBreakers = new Map();

    // Initialize circuit breakers for each service
    this.initCircuitBreakers();
  }

  initCircuitBreakers() {
    const services = ['cdc', 'disease.sh', 'who', 'nhanes', 'hpv-impact'];

    services.forEach(service => {
      this.circuitBreakers.set(service, {
        state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
        failures: 0,
        threshold: 5, // Open circuit after 5 consecutive failures
        timeout: 60000, // 1 minute timeout for OPEN state
        lastFailureTime: null,
        nextAttemptTime: null
      });
    });
  }

  async handleServiceCall(serviceName, operation, options = {}) {
    const circuitBreaker = this.circuitBreakers.get(serviceName);

    if (!circuitBreaker) {
      throw new Error(`Unknown service: ${serviceName}`);
    }

    // Check circuit breaker state
    if (circuitBreaker.state === 'OPEN') {
      const now = Date.now();
      if (now < circuitBreaker.nextAttemptTime) {
        throw this.createError('API_UNAVAILABLE', `Service ${serviceName} circuit breaker is OPEN`);
      }
      // Transition to HALF_OPEN
      circuitBreaker.state = 'HALF_OPEN';
    }

    let attempt = 0;
    let lastError = null;

    while (attempt < this.config.maxRetries) {
      try {
        const result = await operation();

        // Success - reset circuit breaker
        if (circuitBreaker.state === 'HALF_OPEN') {
          circuitBreaker.state = 'CLOSED';
        }
        circuitBreaker.failures = 0;
        circuitBreaker.lastFailureTime = null;

        return result;

      } catch (error) {
        attempt++;
        lastError = error;

        const errorType = this.classifyError(error);
        const strategy = this.errorTypes[errorType]?.strategy || 'log_and_throw';

        // Update circuit breaker on failure
        circuitBreaker.failures++;
        circuitBreaker.lastFailureTime = Date.now();

        if (circuitBreaker.failures >= circuitBreaker.threshold) {
          circuitBreaker.state = 'OPEN';
          circuitBreaker.nextAttemptTime = Date.now() + circuitBreaker.timeout;
        }

        // Handle based on strategy
        if (!this.errorTypes[errorType]?.retryable || attempt >= this.config.maxRetries) {
          break;
        }

        // Apply retry strategy
        const delay = await this.applyRetryStrategy(strategy, attempt, error);
        if (delay > 0) {
          await this.delay(delay);
        }
      }
    }

    // All retries exhausted, apply fallback strategy
    return this.applyFallbackStrategy(serviceName, lastError, options);
  }

  classifyError(error) {
    const message = error.message.toLowerCase();

    if (message.includes('rate limit') || message.includes('429')) {
      return 'RATE_LIMITED';
    }

    if (message.includes('unauthorized') || message.includes('401') || message.includes('403')) {
      return 'INVALID_API_KEY';
    }

    if (message.includes('timeout') || message.includes('ECONNABORTED')) {
      return 'TIMEOUT_ERROR';
    }

    if (message.includes('network') || message.includes('ECONNREFUSED') || message.includes('ENOTFOUND')) {
      return 'NETWORK_ERROR';
    }

    if (message.includes('404') || message.includes('not found')) {
      return 'DATA_NOT_FOUND';
    }

    if (message.includes('parse') || message.includes('json') || message.includes('xml')) {
      return 'PARSE_ERROR';
    }

    if (message.includes('quota') || message.includes('limit exceeded')) {
      return 'QUOTA_EXCEEDED';
    }

    if (message.includes('503') || message.includes('502') || message.includes('500')) {
      return 'API_UNAVAILABLE';
    }

    return 'API_UNAVAILABLE'; // Default classification
  }

  async applyRetryStrategy(strategy, attempt, error) {
    switch (strategy) {
      case 'exponential_backoff':
        return this.config.retryDelay * Math.pow(this.config.backoffMultiplier, attempt - 1);

      case 'retry_with_backoff':
        return this.config.retryDelay * attempt;

      case 'retry_with_timeout_increase':
        return this.config.retryDelay;

      case 'wait_and_retry':
        // For quota exceeded, wait longer
        return this.config.retryDelay * 5;

      default:
        return this.config.retryDelay;
    }
  }

  async applyFallbackStrategy(serviceName, error, options) {
    if (!this.config.enableFallbacks) {
      throw error;
    }

    const disease = options.disease || 'unknown';
    const fallbackSources = this.fallbackPriority[disease] || ['cache', 'placeholder'];

    for (const source of fallbackSources) {
      if (source === serviceName) continue; // Skip the failed service

      try {
        const fallbackResult = await this.tryFallbackSource(source, options);

        if (fallbackResult) {
          return {
            ...fallbackResult,
            metadata: {
              ...fallbackResult.metadata,
              fallback: true,
              originalService: serviceName,
              fallbackSource: source,
              originalError: error.message
            }
          };
        }
      } catch (fallbackError) {
        console.warn(`Fallback to ${source} failed:`, fallbackError.message);
        continue;
      }
    }

    // All fallbacks failed
    throw this.createError('DATA_NOT_FOUND',
      `All data sources failed for ${disease}. Original error: ${error.message}`);
  }

  async tryFallbackSource(source, options) {
    switch (source) {
      case 'cache':
        return this.tryCache(options);

      case 'placeholder':
        return this.tryPlaceholder(options);

      case 'cdc':
        if (options.cdcService) {
          return await options.cdcService.querySTDData(options);
        }
        break;

      case 'disease.sh':
        if (options.diseaseService) {
          return await options.diseaseService.getCOVIDData(options);
        }
        break;

      case 'nhanes':
        if (options.herpesService) {
          return await options.herpesService.queryHerpesData(options);
        }
        break;

      case 'hpv-impact':
        if (options.hpvService) {
          return await options.hpvService.queryHPVData(options);
        }
        break;
    }

    return null;
  }

  tryCache(options) {
    if (!this.config.fallbackToCached) {
      return null;
    }

    // Try to get cached data from services
    const services = [options.cdcService, options.diseaseService, options.herpesService, options.hpvService];

    for (const service of services) {
      if (service && service.cache) {
        const cacheKey = JSON.stringify(options);
        const cached = service.cache.get(cacheKey);

        if (cached) {
          return {
            ...cached.data,
            metadata: {
              ...cached.data.metadata,
              source: 'cache',
              cacheAge: Date.now() - cached.timestamp
            }
          };
        }
      }
    }

    return null;
  }

  tryPlaceholder(options) {
    if (!this.config.fallbackToPlaceholder) {
      return null;
    }

    const disease = options.disease || 'unknown';

    // Return minimal placeholder data
    return {
      success: true,
      data: [{
        disease: disease,
        region: options.region || 'unknown',
        year: options.year || 'unknown',
        cases: 0,
        rate: 0,
        note: 'Placeholder data - actual data unavailable'
      }],
      metadata: {
        source: 'placeholder',
        dataQuality: 'placeholder',
        warning: 'This is placeholder data. Actual surveillance data is temporarily unavailable.'
      }
    };
  }

  createError(type, customMessage = null) {
    const errorType = this.errorTypes[type];
    if (!errorType) {
      throw new Error(`Unknown error type: ${type}`);
    }

    const error = new Error(customMessage || errorType.message);
    error.code = errorType.code;
    error.type = type;
    error.retryable = errorType.retryable;
    error.strategy = errorType.strategy;

    return error;
  }

  async delay(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
  }

  logError(error, context = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        code: error.code || 'UNKNOWN',
        type: error.type || 'UNKNOWN',
        stack: error.stack
      },
      context: context
    };

    console.error('Service Error:', JSON.stringify(logEntry, null, 2));

    // Store error pattern for analysis
    const errorKey = `${error.type || 'UNKNOWN'}_${context.service || 'unknown'}`;
    const errorCount = this.errorCache.get(errorKey) || 0;
    this.errorCache.set(errorKey, errorCount + 1);
  }

  getErrorStats() {
    const stats = {
      errorCounts: Object.fromEntries(this.errorCache),
      circuitBreakerStates: {},
      totalErrors: Array.from(this.errorCache.values()).reduce((sum, count) => sum + count, 0)
    };

    this.circuitBreakers.forEach((breaker, service) => {
      stats.circuitBreakerStates[service] = {
        state: breaker.state,
        failures: breaker.failures,
        lastFailure: breaker.lastFailureTime
      };
    });

    return stats;
  }

  resetCircuitBreaker(serviceName) {
    const breaker = this.circuitBreakers.get(serviceName);
    if (breaker) {
      breaker.state = 'CLOSED';
      breaker.failures = 0;
      breaker.lastFailureTime = null;
      breaker.nextAttemptTime = null;

      return {
        success: true,
        message: `Circuit breaker for ${serviceName} has been reset`
      };
    }

    return {
      success: false,
      message: `Circuit breaker for ${serviceName} not found`
    };
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };

    return {
      success: true,
      message: 'Error handling configuration updated',
      config: this.config
    };
  }

  async healthCheck() {
    const healthStatus = {
      errorHandling: 'operational',
      circuitBreakers: {},
      errorRates: {},
      configuration: this.config
    };

    // Check circuit breaker health
    this.circuitBreakers.forEach((breaker, service) => {
      healthStatus.circuitBreakers[service] = {
        healthy: breaker.state === 'CLOSED',
        state: breaker.state,
        failures: breaker.failures
      };
    });

    // Calculate error rates
    const totalOperations = Math.max(100, Array.from(this.errorCache.values()).reduce((sum, count) => sum + count + 20, 0));
    this.errorCache.forEach((count, errorType) => {
      healthStatus.errorRates[errorType] = ((count / totalOperations) * 100).toFixed(2) + '%';
    });

    return healthStatus;
  }
}

module.exports = ErrorHandlingService;