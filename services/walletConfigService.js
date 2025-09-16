/**
 * Secure Wallet Configuration Service
 * 
 * This service ONLY provides:
 * 1. Network configurations
 * 2. RPC endpoints  
 * 3. Transaction validation
 * 4. Balance checking via RPC
 * 
 * It NEVER handles:
 * - Private keys
 * - Wallet creation
 * - Transaction signing
 * - Direct fund management
 * 
 * All actual wallet operations happen client-side via MetaMask/Web3
 */

const { ethers } = require('ethers');
require('dotenv').config();

// Import blockchain configuration
const { BLOCKCHAIN_NETWORKS, SAFETY_WARNINGS, DEFAULT_CONFIG } = require('../config/blockchain');

class WalletConfigService {
    constructor() {
        // Start in safe testnet mode by default
        this.currentMode = process.env.DEFAULT_MODE || DEFAULT_CONFIG.mode || 'testnet';
        this.currentNetwork = process.env.DEFAULT_NETWORK || DEFAULT_CONFIG.network || 'polygon';
        
        // Initialize RPC providers for balance checking only
        this.initializeRPCProviders();
        
        // Load development wallet addresses from environment
        this.loadDevelopmentAddresses();
        
        console.log(`🔧 Wallet Config Service initialized in ${this.currentMode} mode`);
    }

    initializeRPCProviders() {
        this.providers = {};
        
        const networks = BLOCKCHAIN_NETWORKS[this.currentMode];
        
        for (const [networkName, config] of Object.entries(networks)) {
            try {
                let rpcUrl = config.rpcUrl;
                
                // Replace placeholder keys with environment variables
                if (rpcUrl.includes('${INFURA_KEY}') && process.env.INFURA_KEY) {
                    rpcUrl = rpcUrl.replace('${INFURA_KEY}', process.env.INFURA_KEY);
                } else if (rpcUrl.includes('${ALCHEMY_KEY}') && process.env.ALCHEMY_KEY) {
                    rpcUrl = rpcUrl.replace('${ALCHEMY_KEY}', process.env.ALCHEMY_KEY);
                }
                
                this.providers[networkName] = new ethers.JsonRpcProvider(rpcUrl);
                console.log(`✅ RPC provider initialized for ${config.name}`);
            } catch (error) {
                console.error(`❌ Failed to initialize ${networkName} RPC provider:`, error.message);
            }
        }
    }

    loadDevelopmentAddresses() {
        // Load development wallet addresses from environment
        // These are just addresses, not private keys!
        this.devAddresses = {
            ethereum: process.env.DEV_ETHEREUM_WALLET || null,
            polygon: process.env.DEV_POLYGON_WALLET || null,
            arbitrum: process.env.DEV_ARBITRUM_WALLET || null,
            optimism: process.env.DEV_OPTIMISM_WALLET || null,
            faucet: process.env.TESTNET_FAUCET_WALLET || null
        };
    }

    /**
     * Get current network configuration
     */
    getCurrentNetworkConfig() {
        const networks = BLOCKCHAIN_NETWORKS[this.currentMode];
        const currentNetwork = networks[this.currentNetwork];
        
        return {
            mode: this.currentMode,
            network: this.currentNetwork,
            config: currentNetwork,
            isTestnet: this.currentMode === 'testnet',
            isMainnet: this.currentMode === 'mainnet',
            warningLevel: currentNetwork?.warningLevel || 'unknown',
            gasCostWarning: currentNetwork?.gasCostWarning,
            faucetUrl: currentNetwork?.faucetUrl,
            explorerUrl: currentNetwork?.blockExplorerUrls?.[0],
            nativeCurrency: currentNetwork?.nativeCurrency
        };
    }

    /**
     * Get available networks for current mode
     */
    getAvailableNetworks() {
        const networks = BLOCKCHAIN_NETWORKS[this.currentMode];
        return Object.keys(networks).map(networkName => ({
            name: networkName,
            displayName: networks[networkName].name,
            chainId: networks[networkName].chainId,
            warningLevel: networks[networkName].warningLevel,
            gasCostWarning: networks[networkName].gasCostWarning,
            faucetUrl: networks[networkName].faucetUrl,
            nativeCurrency: networks[networkName].nativeCurrency
        }));
    }

    /**
     * Switch between testnet and mainnet modes
     */
    switchMode(newMode, confirmRealMoney = false) {
        if (newMode === this.currentMode) {
            return {
                success: true,
                message: `Already in ${newMode} mode`,
                currentMode: this.currentMode
            };
        }

        // Safety check: switching to mainnet requires confirmation
        if (newMode === 'mainnet' && !confirmRealMoney) {
            return {
                success: false,
                requiresConfirmation: true,
                warning: SAFETY_WARNINGS.testnet_to_mainnet,
                currentMode: this.currentMode
            };
        }

        const oldMode = this.currentMode;
        this.currentMode = newMode;
        
        try {
            // Reinitialize RPC providers for new mode
            this.initializeRPCProviders();
            
            console.log(`🔄 Switched from ${oldMode} to ${newMode} mode`);
            
            return {
                success: true,
                message: `Switched to ${newMode} mode`,
                previousMode: oldMode,
                currentMode: this.currentMode,
                warning: newMode === 'mainnet' 
                    ? 'You are now using REAL money networks!' 
                    : 'Safe testnet mode active'
            };
        } catch (error) {
            // Revert on error
            this.currentMode = oldMode;
            this.initializeRPCProviders();
            
            return {
                success: false,
                error: `Failed to switch to ${newMode} mode: ${error.message}`,
                currentMode: this.currentMode
            };
        }
    }

    /**
     * Switch to a different network within the current mode
     */
    switchNetwork(newNetwork) {
        const availableNetworks = BLOCKCHAIN_NETWORKS[this.currentMode];
        
        if (!availableNetworks[newNetwork]) {
            return {
                success: false,
                error: `Network ${newNetwork} not available in ${this.currentMode} mode`,
                availableNetworks: Object.keys(availableNetworks)
            };
        }

        const oldNetwork = this.currentNetwork;
        this.currentNetwork = newNetwork;
        
        return {
            success: true,
            message: `Switched to ${availableNetworks[newNetwork].name}`,
            previousNetwork: oldNetwork,
            currentNetwork: this.currentNetwork,
            networkConfig: this.getCurrentNetworkConfig()
        };
    }

    /**
     * Check balance for any address (read-only RPC call)
     */
    async getBalance(address, network = null) {
        try {
            if (!ethers.isAddress(address)) {
                throw new Error('Invalid wallet address format');
            }

            const networkToUse = network || this.currentNetwork;
            const provider = this.providers[networkToUse];
            
            if (!provider) {
                throw new Error(`No RPC provider available for ${networkToUse}`);
            }

            const balance = await provider.getBalance(address);
            const balanceInEther = ethers.formatEther(balance);
            
            const networkConfig = this.getCurrentNetworkConfig();
            const currency = networkConfig.nativeCurrency || { symbol: 'ETH', decimals: 18 };
            
            return {
                address,
                network: networkToUse,
                balance: parseFloat(balanceInEther),
                symbol: currency.symbol,
                raw: balance.toString(),
                isTestnet: this.currentMode === 'testnet',
                isMainnet: this.currentMode === 'mainnet',
                mode: this.currentMode,
                warningLevel: networkConfig.warningLevel,
                faucetUrl: networkConfig.faucetUrl,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error(`Error fetching balance for ${address}:`, error);
            
            // Return simulated data as fallback
            return this.getSimulatedBalance(address, network || this.currentNetwork);
        }
    }

    /**
     * Validate transaction data (no actual signing/sending)
     */
    validateTransaction(transactionData) {
        const { fromAddress, toAddress, amount, network, mode } = transactionData;
        const warnings = [];
        
        // Basic validation
        if (!ethers.isAddress(fromAddress) || !ethers.isAddress(toAddress)) {
            throw new Error('Invalid wallet address format');
        }

        if (amount <= 0) {
            throw new Error('Transaction amount must be greater than zero');
        }

        // Mode-specific warnings
        if (mode === 'mainnet' || this.currentMode === 'mainnet') {
            warnings.push({
                type: 'Real Money Warning',
                level: 'danger',
                message: 'This transaction will use real cryptocurrency and cannot be undone!'
            });
        }

        // Large amount warning
        if (amount > 1.0) {
            warnings.push({
                type: 'Large Amount',
                level: 'warning',
                message: `You are about to send ${amount} tokens. Please verify this amount is correct.`
            });
        }

        // Network-specific warnings
        const networkConfig = this.getCurrentNetworkConfig();
        if (networkConfig.warningLevel === 'high') {
            warnings.push({
                type: 'Network Warning',
                level: 'warning',
                message: networkConfig.gasCostWarning || 'High gas fees expected on this network'
            });
        }

        return {
            valid: true,
            warnings,
            gasEstimate: {
                gasLimit: '0x5208', // 21000 for simple transfer
                gasPrice: '0x174876e800' // 100 gwei
            },
            networkConfig
        };
    }

    /**
     * Get simulated balance for testing when RPC fails
     */
    getSimulatedBalance(address, network) {
        const simulatedBalances = {
            'ethereum': { balance: 0.5, symbol: 'ETH' },
            'polygon': { balance: 25.5, symbol: 'MATIC' },
            'arbitrum': { balance: 0.3, symbol: 'ETH' },
            'optimism': { balance: 0.4, symbol: 'ETH' }
        };

        const simulated = simulatedBalances[network] || { balance: 0, symbol: 'ETH' };
        
        return {
            address,
            network,
            balance: simulated.balance,
            symbol: simulated.symbol,
            isTestnet: this.currentMode === 'testnet',
            isMainnet: this.currentMode === 'mainnet',
            mode: this.currentMode,
            isSimulated: true,
            warning: 'This is simulated data - real balance unavailable',
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Get development addresses for testing
     */
    getDevelopmentAddresses() {
        return {
            ...this.devAddresses,
            warning: 'These are development addresses from environment configuration'
        };
    }

    /**
     * Health check for RPC providers
     */
    async healthCheck() {
        const status = {
            mode: this.currentMode,
            network: this.currentNetwork,
            timestamp: new Date().toISOString(),
            providers: {},
            overall: 'healthy'
        };

        for (const [network, provider] of Object.entries(this.providers)) {
            try {
                const blockNumber = await provider.getBlockNumber();
                status.providers[network] = {
                    status: 'connected',
                    blockNumber,
                    rpcUrl: provider.url || 'configured'
                };
            } catch (error) {
                status.providers[network] = {
                    status: 'error',
                    error: error.message
                };
                status.overall = 'degraded';
            }
        }

        return status;
    }

    // Compatibility methods for existing code
    getCurrentConfig() { return this.getCurrentNetworkConfig(); }
    getCurrentMode() { return this.currentMode; }
    getCurrentNetwork() { return this.currentNetwork; }
    getHealth() {
        return {
            mode: this.currentMode,
            network: this.currentNetwork,
            status: 'operational',
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = WalletConfigService;