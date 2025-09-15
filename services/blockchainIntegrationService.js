const axios = require('axios');
const crypto = require('crypto');

/**
 * Blockchain Integration Service for disease.zone
 *
 * Integrates main disease.zone platform with ledger.disease.zone blockchain infrastructure
 * Handles data synchronization, verification, and cross-chain operations
 */
class BlockchainIntegrationService {
    constructor() {
        this.ledgerApiUrl = process.env.LEDGER_API_URL || 'http://localhost:4000';
        this.ledgerApiKey = process.env.LEDGER_API_KEY;
        this.isEnabled = process.env.BLOCKCHAIN_INTEGRATION_ENABLED === 'true';
        this.batchSize = parseInt(process.env.BLOCKCHAIN_BATCH_SIZE || '50');
        this.retryAttempts = parseInt(process.env.BLOCKCHAIN_RETRY_ATTEMPTS || '3');
    }

    /**
     * Initialize blockchain integration
     */
    async initialize() {
        if (!this.isEnabled) {
            console.log('🔗 Blockchain integration disabled');
            return false;
        }

        try {
            // Test connection to ledger API
            const response = await this.makeRequest('GET', '/health');
            if (response.status === 'healthy') {
                console.log('🔗 Blockchain integration initialized successfully');
                console.log(`   Ledger API: ${this.ledgerApiUrl}`);
                console.log(`   Components: ${Object.keys(response.components).join(', ')}`);
                return true;
            }
        } catch (error) {
            console.error('❌ Blockchain integration initialization failed:', error.message);
            return false;
        }
    }

    /**
     * Sync outbreak detection data to blockchain
     */
    async syncOutbreakData(outbreakData) {
        if (!this.isEnabled) return null;

        try {
            const response = await this.makeRequest('POST', '/api/v1/integration/sync/outbreak-detection', {
                outbreak_data: {
                    id: outbreakData.id || this.generateId(),
                    disease: outbreakData.disease,
                    location: outbreakData.location,
                    severity: outbreakData.severity,
                    affected_population: outbreakData.affectedPopulation,
                    detection_method: outbreakData.detectionMethod,
                    confidence: outbreakData.confidence,
                    timestamp: outbreakData.timestamp || new Date().toISOString(),
                    source: 'disease.zone-outbreak-detection'
                }
            });

            console.log(`✅ Outbreak data synced to blockchain: ${response.blockchain_result?.fabric_tx_id}`);
            return response;

        } catch (error) {
            console.error('❌ Failed to sync outbreak data to blockchain:', error.message);
            return this.handleSyncError(error, 'outbreak', outbreakData);
        }
    }

    /**
     * Sync STI surveillance data to blockchain
     */
    async syncSTIData(stiData) {
        if (!this.isEnabled) return null;

        try {
            const response = await this.makeRequest('POST', '/api/v1/integration/sync/sti-surveillance', {
                sti_data: {
                    id: stiData.id || this.generateId(),
                    disease_type: stiData.diseaseType,
                    demographics: stiData.demographics,
                    geographic_data: stiData.geographicData,
                    case_count: stiData.caseCount,
                    data_source: stiData.dataSource,
                    timestamp: stiData.timestamp || new Date().toISOString(),
                    quality_score: stiData.qualityScore || 0.8,
                    source: 'disease.zone-sti-surveillance'
                }
            });

            console.log(`✅ STI data synced to blockchain: ${response.blockchain_result?.fabric_tx_id}`);
            return response;

        } catch (error) {
            console.error('❌ Failed to sync STI data to blockchain:', error.message);
            return this.handleSyncError(error, 'sti', stiData);
        }
    }

    /**
     * Sync global health intelligence data to blockchain
     */
    async syncGlobalHealthData(healthData) {
        if (!this.isEnabled) return null;

        try {
            const response = await this.makeRequest('POST', '/api/v1/integration/sync/global-health', {
                health_data: {
                    id: healthData.id || this.generateId(),
                    data_sources: healthData.dataSources,
                    aggregated_data: healthData.aggregatedData,
                    fusion_method: healthData.fusionMethod,
                    confidence_score: healthData.confidenceScore,
                    regions: healthData.regions,
                    diseases: healthData.diseases,
                    timestamp: healthData.timestamp || new Date().toISOString(),
                    source: 'disease.zone-global-health'
                }
            });

            console.log(`✅ Global health data synced to blockchain: ${response.blockchain_result?.fabric_tx_id}`);
            return response;

        } catch (error) {
            console.error('❌ Failed to sync global health data to blockchain:', error.message);
            return this.handleSyncError(error, 'global-health', healthData);
        }
    }

    /**
     * Send real-time health alerts to blockchain network
     */
    async sendRealTimeAlert(alertData) {
        if (!this.isEnabled) return null;

        try {
            const response = await this.makeRequest('POST', '/api/v1/integration/alert/real-time', {
                alert_data: {
                    id: alertData.id || this.generateId(),
                    alert_type: alertData.alertType,
                    severity: alertData.severity,
                    disease: alertData.disease,
                    location: alertData.location,
                    description: alertData.description,
                    recommended_actions: alertData.recommendedActions,
                    timestamp: new Date().toISOString(),
                    priority: 'HIGH',
                    source: 'disease.zone-real-time-alerts'
                }
            });

            console.log(`🚨 Real-time alert sent to blockchain network`);
            return response;

        } catch (error) {
            console.error('❌ Failed to send real-time alert:', error.message);
            throw error; // Don't handle silently for critical alerts
        }
    }

    /**
     * Verify data integrity using blockchain
     */
    async verifyDataIntegrity(recordId, expectedHash) {
        if (!this.isEnabled) return { verified: false, reason: 'blockchain_disabled' };

        try {
            const response = await this.makeRequest('POST', '/api/v1/integration/verify/data-integrity', {
                record_id: recordId,
                expected_hash: expectedHash
            });

            return {
                verified: response.verification?.overall_status === 'VERIFIED',
                fabric_verified: response.verification?.fabric?.is_valid,
                sidechain_verified: response.verification?.sidechain?.cross_chain_verified,
                timestamp: response.verification?.verified_at
            };

        } catch (error) {
            console.error('❌ Data integrity verification failed:', error.message);
            return { verified: false, error: error.message };
        }
    }

    /**
     * Batch sync historical data to blockchain
     */
    async batchSyncHistoricalData(historicalDataArray) {
        if (!this.isEnabled) return null;

        try {
            // Process in chunks to avoid overwhelming the blockchain network
            const chunks = this.chunkArray(historicalDataArray, this.batchSize);
            const results = [];

            for (let i = 0; i < chunks.length; i++) {
                console.log(`📦 Processing batch ${i + 1}/${chunks.length} (${chunks[i].length} records)`);

                const response = await this.makeRequest('POST', '/api/v1/integration/sync/batch-historical', {
                    historical_data: chunks[i],
                    batch_size: this.batchSize
                });

                results.push(response);

                // Small delay between batches to prevent overwhelming the network
                if (i < chunks.length - 1) {
                    await this.delay(1000);
                }
            }

            const totalRecords = historicalDataArray.length;
            const successCount = results.reduce((sum, r) => sum + r.successful_syncs, 0);
            const failureCount = results.reduce((sum, r) => sum + r.failed_syncs, 0);

            console.log(`✅ Historical data sync completed: ${successCount}/${totalRecords} successful`);

            return {
                total_records: totalRecords,
                successful_syncs: successCount,
                failed_syncs: failureCount,
                batches_processed: results.length,
                results: results
            };

        } catch (error) {
            console.error('❌ Batch historical sync failed:', error.message);
            throw error;
        }
    }

    /**
     * Get blockchain metrics for dashboard
     */
    async getBlockchainMetrics() {
        if (!this.isEnabled) return null;

        try {
            const response = await this.makeRequest('GET', '/api/v1/integration/metrics');
            return response.metrics;

        } catch (error) {
            console.error('❌ Failed to fetch blockchain metrics:', error.message);
            return null;
        }
    }

    /**
     * Create blockchain-verified health record
     */
    async createVerifiedHealthRecord(recordData) {
        if (!this.isEnabled) {
            return { ...recordData, blockchain_verified: false };
        }

        try {
            // Generate hash of the record
            const recordHash = this.generateDataHash(recordData);

            // Sync to blockchain first
            const blockchainResult = await this.syncHealthRecord({
                ...recordData,
                hash: recordHash
            });

            if (blockchainResult?.success) {
                return {
                    ...recordData,
                    blockchain_verified: true,
                    blockchain_tx_id: blockchainResult.blockchain_result?.fabric_tx_id,
                    blockchain_hash: recordHash,
                    verified_at: new Date().toISOString()
                };
            }

            return { ...recordData, blockchain_verified: false };

        } catch (error) {
            console.error('❌ Failed to create verified health record:', error.message);
            return { ...recordData, blockchain_verified: false, error: error.message };
        }
    }

    /**
     * Enhanced logging with blockchain context
     */
    async logWithBlockchainContext(logData) {
        if (!this.isEnabled) return logData;

        try {
            // Add blockchain verification to logs for audit trails
            const logHash = this.generateDataHash(logData);

            const verifiedLog = {
                ...logData,
                blockchain_hash: logHash,
                blockchain_timestamp: new Date().toISOString(),
                verification_source: 'disease.zone-main'
            };

            // Async sync to blockchain (don't wait)
            this.syncHealthRecord(verifiedLog).catch(error => {
                console.error('Background blockchain log sync failed:', error.message);
            });

            return verifiedLog;

        } catch (error) {
            console.error('❌ Blockchain log context failed:', error.message);
            return logData;
        }
    }

    // Helper methods
    async makeRequest(method, endpoint, data = null) {
        const config = {
            method,
            url: `${this.ledgerApiUrl}${endpoint}`,
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 30000
        };

        if (this.ledgerApiKey) {
            config.headers['Authorization'] = `Bearer ${this.ledgerApiKey}`;
        }

        if (data && (method === 'POST' || method === 'PUT')) {
            config.data = data;
        }

        let lastError;
        for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
            try {
                const response = await axios(config);
                return response.data;
            } catch (error) {
                lastError = error;
                if (attempt < this.retryAttempts - 1) {
                    const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
                    console.log(`Blockchain API retry ${attempt + 1}/${this.retryAttempts} after ${delay}ms`);
                    await this.delay(delay);
                }
            }
        }

        throw lastError;
    }

    generateId() {
        return 'dz_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    generateDataHash(data) {
        return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
    }

    chunkArray(array, chunkSize) {
        const chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    handleSyncError(error, dataType, data) {
        // Log error but don't fail the main operation
        console.error(`Blockchain sync failed for ${dataType}:`, error.message);

        // Could implement retry queue or fallback storage here
        return {
            success: false,
            error: error.message,
            data_type: dataType,
            fallback_stored: false,
            timestamp: new Date().toISOString()
        };
    }

    async syncHealthRecord(recordData) {
        // Generic health record sync method
        try {
            const response = await this.makeRequest('POST', '/api/v1/integration/sync/health-record', {
                health_record: recordData
            });
            return response;
        } catch (error) {
            return this.handleSyncError(error, 'health-record', recordData);
        }
    }
}

module.exports = BlockchainIntegrationService;