const axios = require('axios');
const cheerio = require('cheerio');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

/**
 * Violation Data Service
 * 
 * Aggregates healthcare provider violation data from multiple sources:
 * - State medical board websites
 * - Nursing board disciplinary actions
 * - Public records databases
 * - DocInfo.org integration
 */
class ViolationDataService {
    constructor() {
        this.dbPath = path.join(__dirname, '../data/violations.db');
        this.cacheExpiration = 7 * 24 * 60 * 60 * 1000; // 7 days
        
        // State board configurations
        this.stateBoardConfigs = {
            // California Medical Board
            'CA-medical': {
                name: 'California Medical Board',
                baseUrl: 'https://www.mbc.ca.gov',
                searchUrl: 'https://www.mbc.ca.gov/License-Verification/',
                disciplinaryUrl: 'https://www.mbc.ca.gov/Enforcement/Decisions/',
                type: 'medical',
                scrapeMethod: 'california_medical'
            },
            
            // California Nursing Board
            'CA-nursing': {
                name: 'California Board of Registered Nursing',
                baseUrl: 'https://www.rn.ca.gov',
                searchUrl: 'https://www.rn.ca.gov/online/verify.shtml',
                disciplinaryUrl: 'https://www.rn.ca.gov/enforcement/',
                type: 'nursing',
                scrapeMethod: 'california_nursing'
            },
            
            // Texas Medical Board
            'TX-medical': {
                name: 'Texas Medical Board',
                baseUrl: 'https://www.tmb.state.tx.us',
                searchUrl: 'https://www.tmb.state.tx.us/page/lookup-a-license',
                disciplinaryUrl: 'https://www.tmb.state.tx.us/page/disciplinary-actions',
                type: 'medical',
                scrapeMethod: 'texas_medical'
            },
            
            // Florida Health Department
            'FL-medical': {
                name: 'Florida Department of Health',
                baseUrl: 'https://mqa-internet.doh.state.fl.us',
                searchUrl: 'https://mqa-internet.doh.state.fl.us/mqasearchservices/healthcareproviders',
                disciplinaryUrl: 'https://mqa-internet.doh.state.fl.us/mqasearchservices/disciplinaryactions',
                type: 'medical',
                scrapeMethod: 'florida_health'
            }
        };

        this.initializeDatabase();
    }

    /**
     * Initialize database for violation data
     */
    initializeDatabase() {
        this.db = new sqlite3.Database(this.dbPath);
        
        this.db.serialize(() => {
            // Violation records table
            this.db.run(`
                CREATE TABLE IF NOT EXISTS violation_records (
                    id TEXT PRIMARY KEY,
                    provider_name TEXT NOT NULL,
                    license_number TEXT,
                    state TEXT NOT NULL,
                    violation_type TEXT,
                    violation_description TEXT,
                    date_reported TEXT,
                    date_occurred TEXT,
                    board_action TEXT,
                    penalty TEXT,
                    status TEXT DEFAULT 'active',
                    source_board TEXT NOT NULL,
                    source_url TEXT,
                    document_url TEXT,
                    case_number TEXT,
                    cached_at INTEGER NOT NULL,
                    last_verified INTEGER NOT NULL
                )
            `);

            // Provider violation summary
            this.db.run(`
                CREATE TABLE IF NOT EXISTS provider_violation_summary (
                    provider_id TEXT PRIMARY KEY,
                    provider_name TEXT NOT NULL,
                    state TEXT NOT NULL,
                    license_number TEXT,
                    total_violations INTEGER DEFAULT 0,
                    active_violations INTEGER DEFAULT 0,
                    most_recent_violation TEXT,
                    risk_score INTEGER DEFAULT 0,
                    last_updated INTEGER NOT NULL
                )
            `);

            // Violation categories for classification
            this.db.run(`
                CREATE TABLE IF NOT EXISTS violation_categories (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    category_name TEXT NOT NULL,
                    keywords TEXT NOT NULL,
                    severity_level INTEGER NOT NULL,
                    description TEXT
                )
            `);

            // Insert default violation categories
            this.insertDefaultCategories();
        });
    }

    /**
     * Insert default violation categories for classification
     */
    insertDefaultCategories() {
        const categories = [
            {
                category_name: 'Patient Care Violations',
                keywords: JSON.stringify(['patient care', 'negligence', 'malpractice', 'standard of care', 'patient safety']),
                severity_level: 8,
                description: 'Violations related to quality of patient care'
            },
            {
                category_name: 'Substance Abuse',
                keywords: JSON.stringify(['substance abuse', 'drug abuse', 'alcohol', 'addiction', 'substance use disorder']),
                severity_level: 9,
                description: 'Violations related to substance abuse by healthcare provider'
            },
            {
                category_name: 'Professional Misconduct',
                keywords: JSON.stringify(['misconduct', 'unprofessional', 'ethics', 'boundary violation', 'inappropriate']),
                severity_level: 7,
                description: 'General professional misconduct violations'
            },
            {
                category_name: 'Criminal Convictions',
                keywords: JSON.stringify(['criminal', 'conviction', 'felony', 'arrest', 'charged']),
                severity_level: 10,
                description: 'Criminal convictions or charges'
            },
            {
                category_name: 'Administrative Violations',
                keywords: JSON.stringify(['administrative', 'licensing', 'documentation', 'reporting', 'renewal']),
                severity_level: 3,
                description: 'Administrative and licensing violations'
            },
            {
                category_name: 'Prescription Violations',
                keywords: JSON.stringify(['prescription', 'controlled substance', 'DEA', 'prescribing', 'pharmacy']),
                severity_level: 8,
                description: 'Violations related to prescription practices'
            }
        ];

        categories.forEach(category => {
            this.db.run(
                'INSERT OR IGNORE INTO violation_categories (category_name, keywords, severity_level, description) VALUES (?, ?, ?, ?)',
                [category.category_name, category.keywords, category.severity_level, category.description]
            );
        });
    }

    /**
     * Search for violations by provider information
     * @param {Object} provider - Provider information
     * @returns {Promise<Array>} Array of violation records
     */
    async getProviderViolations(provider) {
        const { name, state, licenseNumber, npiNumber } = provider;
        
        try {
            // Check cache first
            const cached = await this.getCachedViolations(name, state, licenseNumber);
            if (cached && cached.length > 0) {
                return cached;
            }

            // Search multiple sources
            const violations = [];

            // Search state medical board
            if (provider.providerType === 'doctor' || !provider.providerType) {
                const medicalViolations = await this.searchStateMedicalBoard(name, state, licenseNumber);
                violations.push(...medicalViolations);
            }

            // Search state nursing board
            if (provider.providerType === 'nurse' || !provider.providerType) {
                const nursingViolations = await this.searchStateNursingBoard(name, state, licenseNumber);
                violations.push(...nursingViolations);
            }

            // Cache results
            for (const violation of violations) {
                await this.cacheViolation(violation);
            }

            // Update provider summary
            await this.updateProviderSummary(provider, violations);

            return violations;

        } catch (error) {
            console.error('Error fetching violations:', error);
            return [];
        }
    }

    /**
     * Search state medical board for violations
     */
    async searchStateMedicalBoard(name, state, licenseNumber) {
        const boardKey = `${state}-medical`;
        const config = this.stateBoardConfigs[boardKey];
        
        if (!config) {
            console.log(`No configuration for ${state} medical board`);
            return [];
        }

        try {
            switch (config.scrapeMethod) {
                case 'california_medical':
                    return await this.scrapeCaliforMedical(name, licenseNumber);
                case 'texas_medical':
                    return await this.scrapeTexasMedical(name, licenseNumber);
                case 'florida_health':
                    return await this.scrapeFloridaHealth(name, licenseNumber);
                default:
                    return await this.genericBoardScrape(config, name, licenseNumber);
            }
        } catch (error) {
            console.error(`Error scraping ${config.name}:`, error);
            return [];
        }
    }

    /**
     * Search state nursing board for violations
     */
    async searchStateNursingBoard(name, state, licenseNumber) {
        const boardKey = `${state}-nursing`;
        const config = this.stateBoardConfigs[boardKey];
        
        if (!config) {
            console.log(`No configuration for ${state} nursing board`);
            return [];
        }

        try {
            switch (config.scrapeMethod) {
                case 'california_nursing':
                    return await this.scrapeCaliforNursing(name, licenseNumber);
                default:
                    return await this.genericBoardScrape(config, name, licenseNumber);
            }
        } catch (error) {
            console.error(`Error scraping ${config.name}:`, error);
            return [];
        }
    }

    /**
     * Generic board scraper for basic violation lookup
     */
    async genericBoardScrape(config, name, licenseNumber) {
        // This would implement a generic web scraping approach
        // For now, return placeholder data indicating manual verification needed
        
        return [{
            id: `generic-${config.type}-${name}-${Date.now()}`,
            provider_name: name,
            license_number: licenseNumber,
            state: config.name.split(' ').pop(), // Extract state from board name
            violation_type: 'Manual Verification Required',
            violation_description: `Please check ${config.name} directly for complete disciplinary records`,
            source_board: config.name,
            source_url: config.disciplinaryUrl,
            status: 'requires_verification',
            cached_at: Date.now(),
            last_verified: Date.now()
        }];
    }

    /**
     * Scrape California Medical Board (placeholder)
     */
    async scrapeCaliforMedical(name, licenseNumber) {
        // Note: Real implementation would require careful web scraping
        // and compliance with robots.txt and terms of service
        
        return [{
            id: `ca-med-${name}-${Date.now()}`,
            provider_name: name,
            license_number: licenseNumber,
            state: 'CA',
            violation_type: 'Check Required',
            violation_description: 'Please verify at California Medical Board website',
            source_board: 'California Medical Board',
            source_url: 'https://www.mbc.ca.gov/License-Verification/',
            status: 'requires_manual_check',
            cached_at: Date.now(),
            last_verified: Date.now()
        }];
    }

    /**
     * Scrape California Nursing Board (placeholder)
     */
    async scrapeCaliforNursing(name, licenseNumber) {
        return [{
            id: `ca-nurse-${name}-${Date.now()}`,
            provider_name: name,
            license_number: licenseNumber,
            state: 'CA',
            violation_type: 'Check Required',
            violation_description: 'Please verify at California Board of Registered Nursing website',
            source_board: 'California Board of Registered Nursing',
            source_url: 'https://www.rn.ca.gov/online/verify.shtml',
            status: 'requires_manual_check',
            cached_at: Date.now(),
            last_verified: Date.now()
        }];
    }

    /**
     * Scrape Texas Medical Board (placeholder)
     */
    async scrapeTexasMedical(name, licenseNumber) {
        return [{
            id: `tx-med-${name}-${Date.now()}`,
            provider_name: name,
            license_number: licenseNumber,
            state: 'TX',
            violation_type: 'Check Required',
            violation_description: 'Please verify at Texas Medical Board website',
            source_board: 'Texas Medical Board',
            source_url: 'https://www.tmb.state.tx.us/page/lookup-a-license',
            status: 'requires_manual_check',
            cached_at: Date.now(),
            last_verified: Date.now()
        }];
    }

    /**
     * Scrape Florida Health Department (placeholder)
     */
    async scrapeFloridaHealth(name, licenseNumber) {
        return [{
            id: `fl-health-${name}-${Date.now()}`,
            provider_name: name,
            license_number: licenseNumber,
            state: 'FL',
            violation_type: 'Check Required',
            violation_description: 'Please verify at Florida Department of Health website',
            source_board: 'Florida Department of Health',
            source_url: 'https://mqa-internet.doh.state.fl.us/mqasearchservices/healthcareproviders',
            status: 'requires_manual_check',
            cached_at: Date.now(),
            last_verified: Date.now()
        }];
    }

    /**
     * Cache violation data
     */
    async cacheViolation(violation) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT OR REPLACE INTO violation_records 
                 (id, provider_name, license_number, state, violation_type, violation_description,
                  date_reported, date_occurred, board_action, penalty, status, source_board,
                  source_url, document_url, case_number, cached_at, last_verified)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    violation.id,
                    violation.provider_name,
                    violation.license_number,
                    violation.state,
                    violation.violation_type,
                    violation.violation_description,
                    violation.date_reported,
                    violation.date_occurred,
                    violation.board_action,
                    violation.penalty,
                    violation.status,
                    violation.source_board,
                    violation.source_url,
                    violation.document_url,
                    violation.case_number,
                    violation.cached_at,
                    violation.last_verified
                ],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    /**
     * Get cached violations
     */
    async getCachedViolations(name, state, licenseNumber) {
        const cutoff = Date.now() - this.cacheExpiration;
        
        return new Promise((resolve) => {
            this.db.all(
                `SELECT * FROM violation_records 
                 WHERE provider_name LIKE ? AND state = ? 
                 AND (license_number = ? OR license_number IS NULL)
                 AND cached_at > ?
                 ORDER BY date_reported DESC`,
                [`%${name}%`, state, licenseNumber, cutoff],
                (err, rows) => {
                    if (err) {
                        console.error('Cache query error:', err);
                        resolve([]);
                    } else {
                        resolve(rows || []);
                    }
                }
            );
        });
    }

    /**
     * Update provider violation summary
     */
    async updateProviderSummary(provider, violations) {
        const activeViolations = violations.filter(v => v.status === 'active').length;
        const riskScore = this.calculateRiskScore(violations);
        const mostRecent = violations.length > 0 ? violations[0].date_reported : null;

        return new Promise((resolve) => {
            this.db.run(
                `INSERT OR REPLACE INTO provider_violation_summary
                 (provider_id, provider_name, state, license_number, total_violations,
                  active_violations, most_recent_violation, risk_score, last_updated)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    provider.id || `${provider.name}-${provider.state}`,
                    provider.name,
                    provider.state,
                    provider.licenseNumber,
                    violations.length,
                    activeViolations,
                    mostRecent,
                    riskScore,
                    Date.now()
                ],
                resolve
            );
        });
    }

    /**
     * Calculate risk score based on violations
     */
    calculateRiskScore(violations) {
        if (violations.length === 0) return 0;
        
        let score = 0;
        violations.forEach(violation => {
            // Base score for having a violation
            score += 10;
            
            // Additional score based on violation type
            if (violation.violation_type?.toLowerCase().includes('patient')) score += 20;
            if (violation.violation_type?.toLowerCase().includes('substance')) score += 25;
            if (violation.violation_type?.toLowerCase().includes('criminal')) score += 30;
            if (violation.violation_type?.toLowerCase().includes('sexual')) score += 35;
            
            // Reduce score for older violations
            if (violation.date_reported) {
                const yearsAgo = (Date.now() - new Date(violation.date_reported).getTime()) / (365 * 24 * 60 * 60 * 1000);
                if (yearsAgo > 5) score -= 5;
                if (yearsAgo > 10) score -= 10;
            }
        });
        
        return Math.min(Math.max(score, 0), 100); // Cap at 0-100
    }

    /**
     * Get violation statistics
     */
    async getViolationStats() {
        return new Promise((resolve) => {
            this.db.all(
                `SELECT 
                    state,
                    source_board,
                    COUNT(*) as total_violations,
                    COUNT(DISTINCT provider_name) as unique_providers,
                    AVG(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_rate
                 FROM violation_records 
                 WHERE cached_at > ?
                 GROUP BY state, source_board`,
                [Date.now() - (30 * 24 * 60 * 60 * 1000)],
                (err, rows) => {
                    if (err) {
                        console.error('Stats query error:', err);
                        resolve([]);
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

module.exports = ViolationDataService;