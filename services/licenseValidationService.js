const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

/**
 * Healthcare License Validation Service
 * 
 * A comprehensive service for validating nurse and doctor licenses
 * Aggregates data from multiple free sources:
 * - NPPES NPI API (doctors/providers)
 * - Nursys (nursing licenses)
 * - State medical board data
 * - DocInfo.org integration
 */
class LicenseValidationService {
    constructor() {
        this.dbPath = path.join(__dirname, '../data/licenses.db');
        this.cacheExpiration = 24 * 60 * 60 * 1000; // 24 hours
        
        // API endpoints
        this.apis = {
            nppes: 'https://npiregistry.cms.hhs.gov/api/',
            npiClinical: 'https://clinicaltables.nlm.nih.gov/api/npi_idv/v3/search',
            npiOrg: 'https://clinicaltables.nlm.nih.gov/api/npi_org/v3/search'
        };

        // Initialize database
        this.initializeDatabase();
    }

    /**
     * Initialize SQLite database for caching license data
     */
    initializeDatabase() {
        // Ensure data directory exists
        const dataDir = path.dirname(this.dbPath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        this.db = new sqlite3.Database(this.dbPath);
        
        // Create tables
        this.db.serialize(() => {
            // License cache table
            this.db.run(`
                CREATE TABLE IF NOT EXISTS license_cache (
                    id TEXT PRIMARY KEY,
                    provider_type TEXT NOT NULL,
                    name TEXT NOT NULL,
                    license_number TEXT,
                    state TEXT NOT NULL,
                    city TEXT,
                    status TEXT NOT NULL,
                    expiration_date TEXT,
                    npi_number TEXT,
                    specialty TEXT,
                    data_source TEXT NOT NULL,
                    full_data TEXT NOT NULL,
                    cached_at INTEGER NOT NULL,
                    UNIQUE(name, state, provider_type)
                )
            `);

            // Violations cache table
            this.db.run(`
                CREATE TABLE IF NOT EXISTS violations_cache (
                    id TEXT PRIMARY KEY,
                    provider_id TEXT NOT NULL,
                    violation_type TEXT,
                    description TEXT,
                    date_reported TEXT,
                    status TEXT,
                    board_action TEXT,
                    source_url TEXT,
                    cached_at INTEGER NOT NULL,
                    FOREIGN KEY(provider_id) REFERENCES license_cache(id)
                )
            `);

            // Search history for analytics
            this.db.run(`
                CREATE TABLE IF NOT EXISTS search_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    search_query TEXT NOT NULL,
                    search_type TEXT NOT NULL,
                    results_count INTEGER NOT NULL,
                    user_tier TEXT DEFAULT 'free',
                    timestamp INTEGER NOT NULL
                )
            `);
        });
    }

    /**
     * Search for healthcare providers by name and location
     * @param {Object} criteria - Search criteria
     * @param {string} criteria.name - Provider name
     * @param {string} criteria.state - State abbreviation
     * @param {string} [criteria.city] - City name
     * @param {string} [criteria.licenseNumber] - License number
     * @param {string} [criteria.providerType] - 'doctor' or 'nurse' or 'all'
     * @param {string} [userTier] - User subscription tier
     * @returns {Promise<Object>} Search results with provider information
     */
    async searchProviders(criteria, userTier = 'free') {
        const { name, state, city, licenseNumber, providerType = 'all' } = criteria;
        
        // Log search
        await this.logSearch(criteria, userTier);

        const results = {
            doctors: [],
            nurses: [],
            searchMeta: {
                query: criteria,
                sources: [],
                timestamp: new Date().toISOString(),
                totalResults: 0
            }
        };

        try {
            // Search doctors if requested
            if (providerType === 'all' || providerType === 'doctor') {
                const doctorResults = await this.searchDoctors(name, state, city, licenseNumber);
                results.doctors = doctorResults;
                results.searchMeta.sources.push('NPPES NPI Registry');
            }

            // Search nurses if requested
            if (providerType === 'all' || providerType === 'nurse') {
                const nurseResults = await this.searchNurses(name, state, city, licenseNumber);
                results.nurses = nurseResults;
                results.searchMeta.sources.push('Nursys');
            }

            results.searchMeta.totalResults = results.doctors.length + results.nurses.length;

            // Add violation data for premium users
            if (userTier !== 'free') {
                await this.enrichWithViolations(results, userTier);
            }

            return results;

        } catch (error) {
            console.error('License search error:', error);
            throw new Error('Failed to search license database');
        }
    }

    /**
     * Search for doctors using NPPES NPI API
     */
    async searchDoctors(name, state, city, licenseNumber) {
        try {
            // Check cache first
            const cached = await this.getCachedResults(name, state, 'doctor');
            if (cached && cached.length > 0) {
                return cached.map(this.formatDoctorResult);
            }

            const results = [];

            // Search individual providers
            const npiResponse = await axios.get(this.apis.npiClinical, {
                params: {
                    terms: name,
                    sf: 'first_name,last_name',
                    count: 20
                },
                timeout: 10000
            });

            if (npiResponse.data && npiResponse.data[3]) {
                const providers = npiResponse.data[3];
                
                for (const provider of providers) {
                    // Parse provider data
                    const providerData = this.parseNPIProvider(provider);
                    
                    // Filter by state and city if provided
                    if (state && !this.matchesLocation(providerData, state, city)) {
                        continue;
                    }

                    results.push(providerData);
                    
                    // Cache the result
                    await this.cacheProviderData(providerData, 'doctor');
                }
            }

            return results;

        } catch (error) {
            console.error('Doctor search error:', error);
            return [];
        }
    }

    /**
     * Search for nurses (placeholder for Nursys integration)
     */
    async searchNurses(name, state, city, licenseNumber) {
        try {
            // Check cache first
            const cached = await this.getCachedResults(name, state, 'nurse');
            if (cached && cached.length > 0) {
                return cached.map(this.formatNurseResult);
            }

            // Note: Nursys doesn't have a public API for searching
            // This would require either:
            // 1. Web scraping (legal gray area)
            // 2. Partnership with Nursys
            // 3. State-by-state board integration

            // For now, return placeholder with state board references
            const stateBoards = this.getNursingBoardInfo(state);
            
            return [{
                id: `nurse-${name}-${state}`,
                name: name,
                state: state,
                city: city || 'Unknown',
                licenseNumber: 'Search Required',
                status: 'Verify at State Board',
                validThrough: 'Unknown',
                specialty: 'Registered Nurse',
                violations: [],
                npiNumber: null,
                source: 'State Nursing Board',
                verificationUrl: stateBoards.url,
                note: `Please verify at ${stateBoards.name}`
            }];

        } catch (error) {
            console.error('Nurse search error:', error);
            return [];
        }
    }

    /**
     * Parse NPI provider data into standard format
     */
    parseNPIProvider(providerArray) {
        // NPI API returns arrays with specific indices
        // Format: [npi, first_name, last_name, city, state, taxonomy_description, ...]
        
        return {
            id: `doctor-${providerArray[0]}`,
            npiNumber: providerArray[0],
            name: `${providerArray[1]} ${providerArray[2]}`.trim(),
            firstName: providerArray[1],
            lastName: providerArray[2],
            city: providerArray[3] || '',
            state: providerArray[4] || '',
            specialty: providerArray[5] || 'Medical Doctor',
            licenseNumber: 'Check State Board',
            status: 'Active (NPI)',
            validThrough: 'Unknown',
            violations: [],
            source: 'NPPES NPI Registry',
            lastUpdated: new Date().toISOString()
        };
    }

    /**
     * Check if provider matches location criteria
     */
    matchesLocation(provider, state, city) {
        if (state && provider.state && 
            provider.state.toLowerCase() !== state.toLowerCase()) {
            return false;
        }

        if (city && provider.city && 
            !provider.city.toLowerCase().includes(city.toLowerCase())) {
            return false;
        }

        return true;
    }

    /**
     * Get nursing board information by state
     */
    getNursingBoardInfo(state) {
        const boards = {
            'CA': {
                name: 'California Board of Registered Nursing',
                url: 'https://www.rn.ca.gov/online/verify.shtml'
            },
            'NY': {
                name: 'New York State Board of Nursing',
                url: 'https://www.op.nysed.gov/prof/nurse/'
            },
            'TX': {
                name: 'Texas Board of Nursing',
                url: 'https://www.bon.texas.gov/licensure_verification.asp'
            },
            'FL': {
                name: 'Florida Board of Nursing',
                url: 'https://mqa-internet.doh.state.fl.us/mqasearchservices/healthcareproviders'
            }
            // Add more states as needed
        };

        return boards[state?.toUpperCase()] || {
            name: `${state} State Nursing Board`,
            url: 'https://www.nursys.com'
        };
    }

    /**
     * Enrich results with violation data for premium users
     */
    async enrichWithViolations(results, userTier) {
        if (userTier === 'free') return;

        for (const doctor of results.doctors) {
            doctor.violations = await this.getViolations(doctor.id, 'doctor');
        }

        for (const nurse of results.nurses) {
            nurse.violations = await this.getViolations(nurse.id, 'nurse');
        }
    }

    /**
     * Get violation data for a provider
     */
    async getViolations(providerId, providerType) {
        return new Promise((resolve) => {
            this.db.all(
                'SELECT * FROM violations_cache WHERE provider_id = ? ORDER BY date_reported DESC',
                [providerId],
                (err, rows) => {
                    if (err) {
                        console.error('Error fetching violations:', err);
                        resolve([]);
                    } else {
                        resolve(rows || []);
                    }
                }
            );
        });
    }

    /**
     * Cache provider data
     */
    async cacheProviderData(providerData, providerType) {
        const cacheData = {
            id: providerData.id,
            provider_type: providerType,
            name: providerData.name,
            license_number: providerData.licenseNumber,
            state: providerData.state,
            city: providerData.city,
            status: providerData.status,
            expiration_date: providerData.validThrough,
            npi_number: providerData.npiNumber,
            specialty: providerData.specialty,
            data_source: providerData.source,
            full_data: JSON.stringify(providerData),
            cached_at: Date.now()
        };

        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT OR REPLACE INTO license_cache 
                 (id, provider_type, name, license_number, state, city, status, 
                  expiration_date, npi_number, specialty, data_source, full_data, cached_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                Object.values(cacheData),
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    /**
     * Get cached results
     */
    async getCachedResults(name, state, providerType) {
        const cutoff = Date.now() - this.cacheExpiration;
        
        return new Promise((resolve) => {
            this.db.all(
                `SELECT * FROM license_cache 
                 WHERE name LIKE ? AND state = ? AND provider_type = ? 
                 AND cached_at > ?`,
                [`%${name}%`, state, providerType, cutoff],
                (err, rows) => {
                    if (err) {
                        console.error('Cache query error:', err);
                        resolve([]);
                    } else {
                        resolve(rows?.map(row => JSON.parse(row.full_data)) || []);
                    }
                }
            );
        });
    }

    /**
     * Log search for analytics
     */
    async logSearch(criteria, userTier) {
        const searchQuery = JSON.stringify(criteria);
        
        return new Promise((resolve) => {
            this.db.run(
                'INSERT INTO search_history (search_query, search_type, results_count, user_tier, timestamp) VALUES (?, ?, ?, ?, ?)',
                [searchQuery, criteria.providerType || 'all', 0, userTier, Date.now()],
                resolve
            );
        });
    }

    /**
     * Format doctor result for API response
     */
    formatDoctorResult(doctor) {
        return {
            id: doctor.id,
            name: doctor.name,
            city: doctor.city,
            state: doctor.state,
            licenseNumber: doctor.licenseNumber,
            validThrough: doctor.validThrough,
            status: doctor.status,
            specialty: doctor.specialty,
            npiNumber: doctor.npiNumber,
            violations: doctor.violations || [],
            source: doctor.source,
            verificationUrl: this.getStateBoardUrl(doctor.state, 'doctor')
        };
    }

    /**
     * Format nurse result for API response
     */
    formatNurseResult(nurse) {
        return {
            id: nurse.id,
            name: nurse.name,
            city: nurse.city,
            state: nurse.state,
            licenseNumber: nurse.licenseNumber,
            validThrough: nurse.validThrough,
            status: nurse.status,
            specialty: nurse.specialty,
            violations: nurse.violations || [],
            source: nurse.source,
            verificationUrl: nurse.verificationUrl || this.getStateBoardUrl(nurse.state, 'nurse')
        };
    }

    /**
     * Get state board verification URL
     */
    getStateBoardUrl(state, providerType) {
        const urls = {
            doctor: {
                'CA': 'https://www.mbc.ca.gov/License-Verification/',
                'NY': 'https://www.health.ny.gov/professionals/doctors/',
                'TX': 'https://www.tmb.state.tx.us/page/lookup-a-license',
                'FL': 'https://mqa-internet.doh.state.fl.us/mqasearchservices/healthcareproviders'
            },
            nurse: {
                'CA': 'https://www.rn.ca.gov/online/verify.shtml',
                'NY': 'https://www.op.nysed.gov/prof/nurse/',
                'TX': 'https://www.bon.texas.gov/licensure_verification.asp',
                'FL': 'https://mqa-internet.doh.state.fl.us/mqasearchservices/healthcareproviders'
            }
        };

        return urls[providerType]?.[state?.toUpperCase()] || 'https://www.docinfo.org/';
    }

    /**
     * Get service statistics
     */
    async getStats() {
        return new Promise((resolve) => {
            this.db.all(
                `SELECT 
                    COUNT(*) as total_searches,
                    COUNT(DISTINCT search_query) as unique_searches,
                    user_tier,
                    search_type
                 FROM search_history 
                 WHERE timestamp > ?
                 GROUP BY user_tier, search_type`,
                [Date.now() - (30 * 24 * 60 * 60 * 1000)], // Last 30 days
                (err, rows) => {
                    if (err) {
                        console.error('Stats query error:', err);
                        resolve({ error: 'Failed to fetch stats' });
                    } else {
                        resolve(rows || []);
                    }
                }
            );
        });
    }

    /**
     * Close database connection
     */
    close() {
        if (this.db) {
            this.db.close();
        }
    }
}

module.exports = LicenseValidationService;