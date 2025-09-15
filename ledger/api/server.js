const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const fabricRoutes = require('./routes/fabricRoutes');
const sidechainRoutes = require('./routes/sidechainRoutes');
const bridgeRoutes = require('./routes/bridgeRoutes');
const healthTokenRoutes = require('./routes/healthTokenRoutes');
const marketplaceRoutes = require('./routes/marketplaceRoutes');
const integrationRoutes = require('./routes/integrationRoutes');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(helmet());
app.use(cors({
    origin: [
        'http://localhost:3000',
        'https://disease.zone',
        'https://ledger.disease.zone'
    ],
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/v1/fabric', fabricRoutes);
app.use('/api/v1/sidechain', sidechainRoutes);
app.use('/api/v1/bridge', bridgeRoutes);
app.use('/api/v1/token', healthTokenRoutes);
app.use('/api/v1/marketplace', marketplaceRoutes);
app.use('/api/v1/integration', integrationRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'ledger.disease.zone',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        components: {
            hyperledger_fabric: 'operational',
            polygon_supernet: 'operational',
            cross_chain_bridge: 'operational',
            health_token: 'operational',
            data_marketplace: 'operational'
        }
    });
});

// API status endpoint
app.get('/api/v1/status', (req, res) => {
    res.json({
        blockchain_services: {
            hyperledger_fabric: {
                status: 'running',
                peers_connected: 6,
                channels: ['healthdata-channel', 'outbreak-alerts-channel', 'research-data-channel'],
                chaincode_deployed: ['health-records']
            },
            polygon_supernet: {
                status: 'running',
                chain_id: 1337,
                validators: 5,
                current_block: 12345,
                gas_price: '0.001'
            },
            cross_chain_bridge: {
                status: 'operational',
                supported_chains: ['ethereum', 'polygon', 'health-supernet'],
                pending_proofs: 3,
                validated_proofs: 567
            },
            smart_contracts: {
                health_token: {
                    address: process.env.HEALTH_TOKEN_ADDRESS || 'pending_deployment',
                    total_supply: '100000000',
                    holders: 1234
                },
                data_marketplace: {
                    address: process.env.DATA_MARKETPLACE_ADDRESS || 'pending_deployment',
                    active_datasets: 45,
                    total_licenses: 234
                }
            }
        },
        integration: {
            main_disease_zone: {
                connected: true,
                api_url: process.env.MAIN_API_URL,
                last_sync: new Date().toISOString()
            }
        }
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Blockchain API Error:', err);
    res.status(500).json({
        error: 'Internal blockchain service error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        message: 'The requested blockchain API endpoint does not exist',
        available_endpoints: [
            '/api/v1/fabric',
            '/api/v1/sidechain',
            '/api/v1/bridge',
            '/api/v1/token',
            '/api/v1/marketplace',
            '/api/v1/integration'
        ]
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🔗 Blockchain API server running on port ${PORT}`);
    console.log(`🏥 Hyperledger Fabric network: ${process.env.FABRIC_NETWORK_PATH}`);
    console.log(`⛓️  Polygon Supernet chain: ${process.env.SUPERNET_CHAIN_ID}`);
    console.log(`🌉 Cross-chain bridge: operational`);
    console.log(`💰 HEALTH token: ${process.env.HEALTH_TOKEN_ADDRESS || 'pending'}`);
    console.log(`🏪 Data marketplace: ${process.env.DATA_MARKETPLACE_ADDRESS || 'pending'}`);
});

module.exports = app;