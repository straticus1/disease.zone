/**
 * Simple In-Memory Cache
 * Zero-cost performance boost for existing services
 * Can easily scale to Redis later
 */

class SimpleCache {
    constructor(defaultTTL = 300000) { // 5 minutes default
        this.cache = new Map();
        this.timers = new Map();
        this.defaultTTL = defaultTTL;
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0
        };
    }

    set(key, value, ttl = this.defaultTTL) {
        // Clear existing timer if exists
        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
        }

        // Set the value
        this.cache.set(key, {
            value,
            timestamp: Date.now(),
            ttl,
            accessed: 0
        });

        // Set expiration timer
        const timer = setTimeout(() => {
            this.delete(key);
        }, ttl);

        this.timers.set(key, timer);
        this.stats.sets++;

        return true;
    }

    get(key) {
        const item = this.cache.get(key);

        if (!item) {
            this.stats.misses++;
            return null;
        }

        // Check if expired
        if (Date.now() - item.timestamp > item.ttl) {
            this.delete(key);
            this.stats.misses++;
            return null;
        }

        // Update access stats
        item.accessed++;
        this.stats.hits++;

        return item.value;
    }

    delete(key) {
        const deleted = this.cache.delete(key);

        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
            this.timers.delete(key);
        }

        if (deleted) {
            this.stats.deletes++;
        }

        return deleted;
    }

    has(key) {
        return this.cache.has(key) && this.get(key) !== null;
    }

    clear() {
        // Clear all timers
        for (const timer of this.timers.values()) {
            clearTimeout(timer);
        }

        this.cache.clear();
        this.timers.clear();

        // Reset stats
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0
        };
    }

    size() {
        return this.cache.size;
    }

    getStats() {
        const hitRate = this.stats.hits + this.stats.misses > 0
            ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
            : 0;

        return {
            ...this.stats,
            hitRate: `${hitRate}%`,
            size: this.size(),
            memoryUsage: this.estimateMemoryUsage()
        };
    }

    estimateMemoryUsage() {
        let bytes = 0;
        for (const [key, item] of this.cache.entries()) {
            bytes += key.length * 2; // Rough string size estimation
            bytes += JSON.stringify(item.value).length * 2;
            bytes += 100; // Overhead
        }
        return `${(bytes / 1024).toFixed(2)} KB`;
    }

    // Get all keys matching a pattern
    keys(pattern = '*') {
        if (pattern === '*') {
            return Array.from(this.cache.keys());
        }

        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return Array.from(this.cache.keys()).filter(key => regex.test(key));
    }

    // Get multiple values at once
    mget(keys) {
        const result = {};
        for (const key of keys) {
            result[key] = this.get(key);
        }
        return result;
    }

    // Set multiple values at once
    mset(keyValuePairs, ttl = this.defaultTTL) {
        for (const [key, value] of Object.entries(keyValuePairs)) {
            this.set(key, value, ttl);
        }
        return true;
    }

    // Cache decorator for functions
    wrap(fn, keyGenerator, ttl = this.defaultTTL) {
        return async (...args) => {
            const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);

            // Check cache first
            const cached = this.get(key);
            if (cached !== null) {
                return cached;
            }

            // Execute function and cache result
            const result = await fn(...args);
            this.set(key, result, ttl);

            return result;
        };
    }

    // Cleanup expired entries manually
    cleanup() {
        const now = Date.now();
        let cleaned = 0;

        for (const [key, item] of this.cache.entries()) {
            if (now - item.timestamp > item.ttl) {
                this.delete(key);
                cleaned++;
            }
        }

        return cleaned;
    }

    // Get cache info for monitoring
    info() {
        return {
            stats: this.getStats(),
            oldestEntry: this.getOldestEntry(),
            mostAccessed: this.getMostAccessed(),
            keys: this.cache.size < 50 ? Array.from(this.cache.keys()) : 'Too many to display'
        };
    }

    getOldestEntry() {
        let oldest = null;
        let oldestTime = Date.now();

        for (const [key, item] of this.cache.entries()) {
            if (item.timestamp < oldestTime) {
                oldestTime = item.timestamp;
                oldest = key;
            }
        }

        return oldest ? {
            key: oldest,
            age: Date.now() - oldestTime
        } : null;
    }

    getMostAccessed() {
        let mostAccessed = null;
        let maxAccess = 0;

        for (const [key, item] of this.cache.entries()) {
            if (item.accessed > maxAccess) {
                maxAccess = item.accessed;
                mostAccessed = key;
            }
        }

        return mostAccessed ? {
            key: mostAccessed,
            accessCount: maxAccess
        } : null;
    }
}

// Create global cache instances for different use cases
const apiCache = new SimpleCache(300000);      // 5 minutes for API responses
const dataCache = new SimpleCache(1800000);    // 30 minutes for processed data
const queryCache = new SimpleCache(600000);    // 10 minutes for database queries
const mlCache = new SimpleCache(3600000);      // 1 hour for ML model results

module.exports = {
    SimpleCache,
    apiCache,
    dataCache,
    queryCache,
    mlCache
};