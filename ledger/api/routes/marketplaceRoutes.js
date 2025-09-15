const express = require('express');
const router = express.Router();

// Data marketplace routes

// Get marketplace status
router.get('/status', async (req, res) => {
    try {
        const status = {
            marketplace_active: true,
            total_datasets: Math.floor(Math.random() * 100) + 50,
            active_datasets: Math.floor(Math.random() * 80) + 40,
            total_licenses_sold: Math.floor(Math.random() * 500) + 200,
            total_revenue: (Math.random() * 1000000).toFixed(0) + '000000000000000000', // In HEALTH tokens
            active_researchers: Math.floor(Math.random() * 150) + 50,
            active_providers: Math.floor(Math.random() * 20) + 10,
            contract_address: process.env.DATA_MARKETPLACE_ADDRESS || '0x1000000000000000000000000000000000000002'
        };

        res.json({ success: true, status });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get marketplace status', message: error.message });
    }
});

// Get available datasets
router.get('/datasets', async (req, res) => {
    try {
        const { dataType, limit = 20 } = req.query;

        const datasets = [];
        const count = Math.min(parseInt(limit), 50);

        for (let i = 0; i < count; i++) {
            const types = ['HIV', 'COVID', 'CANCER', 'DIABETES', 'HEART_DISEASE'];
            const selectedType = dataType || types[Math.floor(Math.random() * types.length)];

            datasets.push({
                id: i + 1,
                name: `${selectedType} Dataset ${i + 1}`,
                description: `Anonymized ${selectedType.toLowerCase()} patient data for research`,
                dataType: selectedType,
                provider: `0x${Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`,
                price: (Math.random() * 2000 + 100).toFixed(0) + '000000000000000000', // 100-2000 HEALTH tokens
                recordCount: Math.floor(Math.random() * 10000) + 1000,
                qualityScore: Math.floor(Math.random() * 30) + 70, // 70-100
                totalSales: Math.floor(Math.random() * 20),
                isActive: true,
                isCompliant: Math.random() > 0.1, // 90% compliant
                createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
                tags: ['anonymized', 'research-grade', selectedType.toLowerCase()]
            });
        }

        res.json({ success: true, datasets });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get datasets', message: error.message });
    }
});

// Get dataset details
router.get('/datasets/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const dataset = {
            id: parseInt(id),
            name: `Health Dataset ${id}`,
            description: 'Comprehensive anonymized health dataset for research purposes',
            dataType: 'COVID',
            ipfsHash: 'QmExampleHash' + id,
            provider: `0x${Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`,
            price: '1000000000000000000000', // 1000 HEALTH tokens
            qualityScore: 85,
            recordCount: 5000,
            totalSales: 15,
            totalRevenue: '15000000000000000000000', // 15000 HEALTH tokens
            isActive: true,
            isCompliant: true,
            createdAt: new Date().toISOString(),
            tags: ['covid-19', 'anonymized', 'research-grade'],
            complianceHash: 'compliance-hash-' + id,
            metadata: {
                timeRange: '2020-2023',
                geographicCoverage: 'Global',
                demographics: 'All age groups',
                dataFields: ['age', 'gender', 'symptoms', 'outcomes']
            }
        };

        res.json({ success: true, dataset });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get dataset', message: error.message });
    }
});

// Purchase dataset license
router.post('/datasets/:id/purchase', async (req, res) => {
    try {
        const { id } = req.params;
        const { researchPurpose, durationDays = 90, researcher } = req.body;

        if (!researchPurpose || !researcher) {
            return res.status(400).json({ error: 'Missing required fields: researchPurpose, researcher' });
        }

        const licenseId = Math.floor(Math.random() * 1000000) + 1;

        const result = {
            licenseId,
            datasetId: parseInt(id),
            researcher,
            purchasePrice: '1000000000000000000000', // 1000 HEALTH tokens
            purchasedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString(),
            researchPurpose,
            txHash: '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
            nftTokenId: licenseId,
            isActive: true
        };

        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ error: 'Failed to purchase dataset', message: error.message });
    }
});

// Get user's licenses
router.get('/licenses/:userAddress', async (req, res) => {
    try {
        const { userAddress } = req.params;

        const licenses = [];
        const count = Math.floor(Math.random() * 5) + 1;

        for (let i = 0; i < count; i++) {
            licenses.push({
                licenseId: i + 1,
                datasetId: Math.floor(Math.random() * 10) + 1,
                datasetName: `Dataset ${i + 1}`,
                purchasePrice: '1000000000000000000000',
                purchasedAt: new Date(Date.now() - i * 30 * 24 * 60 * 60 * 1000).toISOString(),
                expiresAt: new Date(Date.now() + (90 - i * 30) * 24 * 60 * 60 * 1000).toISOString(),
                researchPurpose: `Research purpose ${i + 1}`,
                isActive: Date.now() < (Date.now() + (90 - i * 30) * 24 * 60 * 60 * 1000),
                nftTokenId: i + 1
            });
        }

        res.json({ success: true, licenses });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get licenses', message: error.message });
    }
});

// Rate a dataset
router.post('/datasets/:id/rate', async (req, res) => {
    try {
        const { id } = req.params;
        const { rating, reviewer } = req.body;

        if (!rating || rating < 1 || rating > 10) {
            return res.status(400).json({ error: 'Rating must be between 1 and 10' });
        }

        const result = {
            datasetId: parseInt(id),
            rating,
            reviewer,
            timestamp: new Date().toISOString(),
            txHash: '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')
        };

        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ error: 'Failed to rate dataset', message: error.message });
    }
});

// Get marketplace statistics
router.get('/stats', async (req, res) => {
    try {
        const stats = {
            total_datasets: 67,
            active_datasets: 54,
            total_licenses_sold: 234,
            total_revenue: '567890000000000000000000', // In HEALTH tokens
            average_dataset_price: '1250000000000000000000', // 1250 HEALTH tokens
            top_categories: [
                { category: 'COVID', datasets: 15, sales: 89 },
                { category: 'CANCER', datasets: 12, sales: 67 },
                { category: 'DIABETES', datasets: 10, sales: 45 },
                { category: 'HIV', datasets: 8, sales: 33 }
            ],
            revenue_by_month: [
                { month: '2024-06', revenue: '45000000000000000000000' },
                { month: '2024-07', revenue: '52000000000000000000000' },
                { month: '2024-08', revenue: '67000000000000000000000' },
                { month: '2024-09', revenue: '73000000000000000000000' }
            ]
        };

        res.json({ success: true, stats });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get marketplace stats', message: error.message });
    }
});

module.exports = router;