/**
 * Model Training Scheduler
 * Handles daily retraining of neural network models using cron jobs
 */

const cron = require('node-cron');
const fs = require('fs').promises;
const path = require('path');

class ModelTrainingScheduler {
    constructor(neuralSearchService, databaseService, comprehensiveSTIService = null) {
        this.neuralSearchService = neuralSearchService;
        this.databaseService = databaseService;
        this.comprehensiveSTIService = comprehensiveSTIService;
        this.isTraining = false;
        this.trainingHistory = [];
        this.logPath = path.join(__dirname, '../logs/training.log');

        // Ensure logs directory exists
        this.ensureLogDirectory();
    }

    async ensureLogDirectory() {
        const logsDir = path.dirname(this.logPath);
        try {
            await fs.access(logsDir);
        } catch {
            await fs.mkdir(logsDir, { recursive: true });
            console.log('📁 Created logs directory:', logsDir);
        }
    }

    /**
     * Start the daily training scheduler
     */
    start() {
        console.log('⏰ Starting daily model training scheduler...');

        // Schedule daily retraining at 2 AM
        cron.schedule('0 2 * * *', async () => {
            await this.performDailyTraining();
        }, {
            name: 'daily-model-training',
            timezone: 'America/New_York'
        });

        // Schedule weekly full retraining on Sundays at 3 AM
        cron.schedule('0 3 * * 0', async () => {
            await this.performWeeklyTraining();
        }, {
            name: 'weekly-model-training',
            timezone: 'America/New_York'
        });

        // Schedule hourly lightweight updates during business hours
        cron.schedule('0 9-17 * * 1-5', async () => {
            await this.performLightweightUpdate();
        }, {
            name: 'hourly-model-update',
            timezone: 'America/New_York'
        });

        // Schedule smart cache refresh every 15 minutes for critical diseases
        cron.schedule('*/15 * * * *', async () => {
            await this.performSmartCacheRefresh();
        }, {
            name: 'smart-cache-refresh',
            timezone: 'America/New_York'
        });

        console.log('✅ Model training scheduler started with following schedule:');
        console.log('  - Daily training: 2:00 AM EST');
        console.log('  - Weekly training: Sunday 3:00 AM EST');
        console.log('  - Hourly updates: 9 AM - 5 PM EST (weekdays)');
        console.log('  - Smart cache refresh: Every 15 minutes');
    }

    /**
     * Perform daily training with recent search data
     */
    async performDailyTraining() {
        if (this.isTraining) {
            console.log('⚠️ Training already in progress, skipping daily training');
            return;
        }

        try {
            this.isTraining = true;
            const startTime = Date.now();

            await this.log('🏋️ Starting daily model training...');

            // Collect search data from the last 24 hours
            const searchData = await this.collectRecentSearchData(24); // 24 hours

            if (searchData.queries.length === 0) {
                await this.log('📄 No new search data found for training');
                return;
            }

            // Retrain the neural network with new data
            await this.neuralSearchService.retrain(searchData.queries, searchData.results);

            // Update training statistics
            const endTime = Date.now();
            const trainingTime = endTime - startTime;

            const trainingRecord = {
                timestamp: new Date().toISOString(),
                type: 'daily',
                duration: trainingTime,
                dataPoints: searchData.queries.length,
                success: true
            };

            this.trainingHistory.push(trainingRecord);
            await this.saveTrainingHistory();

            await this.log(`✅ Daily training completed in ${trainingTime}ms with ${searchData.queries.length} data points`);

        } catch (error) {
            await this.log(`❌ Daily training failed: ${error.message}`);
            console.error('Daily training error:', error);

            // Record failed training
            this.trainingHistory.push({
                timestamp: new Date().toISOString(),
                type: 'daily',
                duration: 0,
                dataPoints: 0,
                success: false,
                error: error.message
            });

        } finally {
            this.isTraining = false;
        }
    }

    /**
     * Perform comprehensive weekly training
     */
    async performWeeklyTraining() {
        if (this.isTraining) {
            console.log('⚠️ Training already in progress, skipping weekly training');
            return;
        }

        try {
            this.isTraining = true;
            const startTime = Date.now();

            await this.log('🔄 Starting weekly comprehensive model training...');

            // Collect search data from the last 7 days
            const searchData = await this.collectRecentSearchData(168); // 7 days in hours

            // Also collect popular disease terms and trends
            const trendData = await this.collectTrendingTerms();

            // Perform comprehensive retraining
            await this.neuralSearchService.retrain(
                [...searchData.queries, ...trendData.queries],
                [...searchData.results, ...trendData.results]
            );

            // Clean up old training history (keep last 30 days)
            this.cleanupTrainingHistory();

            const endTime = Date.now();
            const trainingTime = endTime - startTime;

            const trainingRecord = {
                timestamp: new Date().toISOString(),
                type: 'weekly',
                duration: trainingTime,
                dataPoints: searchData.queries.length + trendData.queries.length,
                success: true
            };

            this.trainingHistory.push(trainingRecord);
            await this.saveTrainingHistory();

            await this.log(`✅ Weekly training completed in ${trainingTime}ms with ${trainingRecord.dataPoints} data points`);

        } catch (error) {
            await this.log(`❌ Weekly training failed: ${error.message}`);
            console.error('Weekly training error:', error);

        } finally {
            this.isTraining = false;
        }
    }

    /**
     * Perform lightweight model updates during business hours
     */
    async performLightweightUpdate() {
        if (this.isTraining) {
            return; // Skip if major training is in progress
        }

        try {
            // Quick update with last hour's data
            const searchData = await this.collectRecentSearchData(1); // 1 hour

            if (searchData.queries.length > 5) { // Only update if significant activity
                await this.neuralSearchService.updateVocabulary(searchData.queries);
                await this.log(`📝 Lightweight update: processed ${searchData.queries.length} recent queries`);
            }

        } catch (error) {
            console.error('Lightweight update error:', error);
        }
    }

    /**
     * Collect recent search data from logs or database
     */
    async collectRecentSearchData(hours) {
        try {
            const since = new Date(Date.now() - hours * 60 * 60 * 1000);

            // Mock data for now - in production, this would query actual search logs
            const queries = [
                'covid symptoms',
                'diabetes treatment',
                'heart disease prevention',
                'cancer research',
                'influenza vaccine',
                'herpes outbreak',
                'hiv testing',
                'tuberculosis symptoms',
                'malaria prevention',
                'stroke risk factors'
            ];

            const results = queries.map(query => ({
                query,
                success: true,
                totalResults: Math.floor(Math.random() * 100) + 10,
                timestamp: since
            }));

            return { queries, results };

        } catch (error) {
            console.error('Error collecting search data:', error);
            return { queries: [], results: [] };
        }
    }

    /**
     * Collect trending disease terms and search patterns
     */
    async collectTrendingTerms() {
        try {
            // Mock trending terms - in production, this would analyze search patterns
            const trendingQueries = [
                'long covid symptoms',
                'monkeypox vaccine',
                'bird flu outbreak',
                'rsv children',
                'strep throat increase'
            ];

            const results = trendingQueries.map(query => ({
                query,
                success: true,
                totalResults: Math.floor(Math.random() * 200) + 50,
                trending: true
            }));

            return { queries: trendingQueries, results };

        } catch (error) {
            console.error('Error collecting trending terms:', error);
            return { queries: [], results: [] };
        }
    }

    /**
     * Log training activities
     */
    async log(message) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${message}\n`;

        try {
            await fs.appendFile(this.logPath, logEntry);
            console.log(logEntry.trim());
        } catch (error) {
            console.error('Logging error:', error);
        }
    }

    /**
     * Save training history to disk
     */
    async saveTrainingHistory() {
        try {
            const historyPath = path.join(__dirname, '../logs/training-history.json');
            await fs.writeFile(historyPath, JSON.stringify(this.trainingHistory, null, 2));
        } catch (error) {
            console.error('Error saving training history:', error);
        }
    }

    /**
     * Clean up old training history records
     */
    cleanupTrainingHistory() {
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

        this.trainingHistory = this.trainingHistory.filter(record => {
            const recordTime = new Date(record.timestamp).getTime();
            return recordTime > thirtyDaysAgo;
        });
    }

    /**
     * Get training status and statistics
     */
    getStatus() {
        const recentTraining = this.trainingHistory
            .filter(record => {
                const recordTime = new Date(record.timestamp).getTime();
                const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
                return recordTime > oneDayAgo;
            });

        return {
            isTraining: this.isTraining,
            totalTrainingSessions: this.trainingHistory.length,
            recentTrainingSessions: recentTraining.length,
            lastTraining: this.trainingHistory.length > 0
                ? this.trainingHistory[this.trainingHistory.length - 1]
                : null,
            scheduledJobs: [
                { name: 'daily-model-training', schedule: '0 2 * * *' },
                { name: 'weekly-model-training', schedule: '0 3 * * 0' },
                { name: 'hourly-model-update', schedule: '0 9-17 * * 1-5' }
            ]
        };
    }

    /**
     * Manually trigger training (for testing or emergency retraining)
     */
    async manualTraining(type = 'manual') {
        if (this.isTraining) {
            throw new Error('Training already in progress');
        }

        await this.log(`🔧 Manual training triggered (type: ${type})`);

        switch (type) {
            case 'daily':
                await this.performDailyTraining();
                break;
            case 'weekly':
                await this.performWeeklyTraining();
                break;
            default:
                await this.performDailyTraining();
        }
    }

    /**
     * Perform smart cache refresh for critical diseases
     */
    async performSmartCacheRefresh() {
        if (!this.comprehensiveSTIService) {
            return; // Skip if service not available
        }

        try {
            // Refresh critical diseases
            const criticalDiseases = ['covid', 'influenza', 'hiv', 'aids'];
            await this.comprehensiveSTIService.refreshCacheSelectively(criticalDiseases);
            
            // Log cache status
            const cacheStatus = this.comprehensiveSTIService.getCacheStatus();
            if (cacheStatus.totalEntries > 0) {
                await this.log(`📊 Cache status: ${cacheStatus.totalEntries} entries across ${Object.keys(cacheStatus.tiers).length} tiers`);
            }
        } catch (error) {
            console.error('Smart cache refresh error:', error);
        }
    }

    /**
     * Stop all scheduled training jobs
     */
    stop() {
        cron.getTasks().forEach((task, name) => {
            if (name.includes('model-training') || name.includes('model-update')) {
                task.stop();
                console.log(`⏹️ Stopped scheduled task: ${name}`);
            }
        });

        console.log('🛑 Model training scheduler stopped');
    }
}

module.exports = ModelTrainingScheduler;