const express = require('express');
const router = express.Router();

// HEALTH token routes

// Get token information
router.get('/info', async (req, res) => {
    try {
        const tokenInfo = {
            name: 'HealthToken',
            symbol: 'HEALTH',
            decimals: 18,
            total_supply: '100000000000000000000000000', // 100M tokens
            circulating_supply: '25000000000000000000000000', // 25M tokens
            contract_address: process.env.HEALTH_TOKEN_ADDRESS || '0x1000000000000000000000000000000000000001',
            holders: Math.floor(Math.random() * 2000) + 1000,
            market_cap_usd: '12500000' // $12.5M at $0.50 per token
        };

        res.json({ success: true, tokenInfo });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get token info', message: error.message });
    }
});

// Get token balance for address
router.get('/balance/:address', async (req, res) => {
    try {
        const { address } = req.params;

        const balance = {
            address,
            balance: (Math.random() * 10000).toFixed(2) + '000000000000000000', // Random balance
            formatted_balance: (Math.random() * 10000).toFixed(2),
            rewards_earned: (Math.random() * 1000).toFixed(2),
            research_purchases: (Math.random() * 500).toFixed(2)
        };

        res.json({ success: true, balance });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get balance', message: error.message });
    }
});

// Reward data contribution
router.post('/reward', async (req, res) => {
    try {
        const { recipient, amount, dataType } = req.body;

        const result = {
            txHash: '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
            recipient,
            amount,
            dataType,
            timestamp: new Date().toISOString(),
            blockNumber: Math.floor(Math.random() * 100000) + 10000
        };

        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ error: 'Failed to process reward', message: error.message });
    }
});

// Process research payment
router.post('/payment', async (req, res) => {
    try {
        const { payer, amount, datasetId } = req.body;

        const result = {
            txHash: '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
            payer,
            amount,
            datasetId,
            timestamp: new Date().toISOString(),
            blockNumber: Math.floor(Math.random() * 100000) + 10000,
            tokens_burned: amount // Deflationary mechanism
        };

        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ error: 'Failed to process payment', message: error.message });
    }
});

// Get token statistics
router.get('/stats', async (req, res) => {
    try {
        const stats = {
            total_rewards_distributed: '5000000000000000000000000', // 5M tokens
            total_research_payments: '2000000000000000000000000', // 2M tokens burned
            active_contributors: Math.floor(Math.random() * 500) + 200,
            active_researchers: Math.floor(Math.random() * 100) + 50,
            average_reward_per_contribution: '100000000000000000000', // 100 tokens
            average_dataset_price: '500000000000000000000', // 500 tokens
            governance_participation: {
                active_voters: Math.floor(Math.random() * 300) + 100,
                proposals_active: Math.floor(Math.random() * 5) + 1,
                voting_power_distributed: '15000000000000000000000000' // 15M tokens
            }
        };

        res.json({ success: true, stats });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get token stats', message: error.message });
    }
});

// Get transaction history for address
router.get('/transactions/:address', async (req, res) => {
    try {
        const { address } = req.params;
        const limit = parseInt(req.query.limit) || 10;

        const transactions = [];
        for (let i = 0; i < Math.min(limit, 20); i++) {
            transactions.push({
                txHash: '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
                type: Math.random() > 0.5 ? 'reward' : 'payment',
                amount: (Math.random() * 1000).toFixed(2) + '000000000000000000',
                timestamp: new Date(Date.now() - i * 86400000).toISOString(), // Last i days
                blockNumber: Math.floor(Math.random() * 100000) + 10000 - i
            });
        }

        res.json({ success: true, transactions });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get transactions', message: error.message });
    }
});

module.exports = router;