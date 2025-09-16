/**
 * Enhanced Blockchain Wallet Service
 * Real balance checking and improved security for DiseaseZone platform
 */

const { ethers } = require('ethers');
const axios = require('axios');
const { BLOCKCHAIN_NETWORKS, TOKEN_CONTRACTS, SAFETY_WARNINGS, DEFAULT_CONFIG } = require('../config/blockchain');

class WalletService {
    constructor() {
        // Start in safe testnet mode by default
        this.currentMode = DEFAULT_CONFIG.mode;
        this.currentNetwork = DEFAULT_CONFIG.network;
        
        // Initialize providers based on current mode
        this.initializeProviders();
        
        // Initialize network configurations
        this.networkConfig = BLOCKCHAIN_NETWORKS;
        this.tokenConfig = TOKEN_CONTRACTS;
        this.safetyWarnings = SAFETY_WARNINGS;

        // Initialize other properties
        this.initializeProperties();
    }

    initializeProviders() {
        const networks = this.networkConfig || BLOCKCHAIN_NETWORKS;
        const currentNetworks = networks[this.currentMode];
        
        this.providers = {};
        
        for (const [networkName, config] of Object.entries(currentNetworks)) {
            try {
                let rpcUrl = config.rpcUrl;
                if (rpcUrl.includes('${INFURA_KEY}')) {
                    rpcUrl = rpcUrl.replace('${INFURA_KEY}', process.env.INFURA_KEY || 'demo');
                }
                
                this.providers[networkName] = new ethers.JsonRpcProvider(rpcUrl);
                console.log(`✅ Initialized ${config.name} provider (${this.currentMode} mode)`);
            } catch (error) {
                console.error(`❌ Failed to initialize ${networkName} provider:`, error.message);
            }
        }
    }

    initializeProperties() {
        // Token contracts based on current mode and network
        this.tokenContracts = this.tokenConfig[this.currentMode] || {};

        // ERC-20 ABI for token balance checking
        this.erc20Abi = [
            'function balanceOf(address owner) view returns (uint256)',
            'function decimals() view returns (uint8)',
            'function symbol() view returns (string)',
            'function name() view returns (string)'
        ];

        // Cache for performance
        this.balanceCache = new Map();
        this.cacheTimeout = 60000; // 1 minute cache
    }

    // ===== NETWORK MANAGEMENT METHODS =====

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
                warning: this.safetyWarnings.testnet_to_mainnet,
                currentMode: this.currentMode
            };
        }

        const oldMode = this.currentMode;
        this.currentMode = newMode;
        
        try {
            // Reinitialize providers for new mode
            this.initializeProviders();
            this.initializeProperties();
            
            // Clear cache when switching modes
            this.balanceCache.clear();
            
            console.log(`🔄 Switched from ${oldMode} to ${newMode} mode`);
            
            return {
                success: true,
                message: `Switched to ${newMode} mode`,
                previousMode: oldMode,
                currentMode: this.currentMode,
                warning: newMode === 'mainnet' ? 'You are now using REAL money!' : 'Safe testnet mode active'
            };
        } catch (error) {
            // Revert on error
            this.currentMode = oldMode;
            this.initializeProviders();
            this.initializeProperties();
            
            return {
                success: false,
                error: `Failed to switch to ${newMode} mode: ${error.message}`,
                currentMode: this.currentMode
            };
        }
    }

    /**
     * Get current network configuration
     */
    getCurrentNetworkConfig() {
        const networks = this.networkConfig[this.currentMode];
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
            explorerUrl: currentNetwork?.explorerUrl
        };
    }

    /**
     * Get available networks for current mode
     */
    getAvailableNetworks() {
        const networks = this.networkConfig[this.currentMode];
        return Object.keys(networks).map(networkName => ({
            name: networkName,
            displayName: networks[networkName].name,
            chainId: networks[networkName].chainId,
            warningLevel: networks[networkName].warningLevel,
            gasCostWarning: networks[networkName].gasCostWarning,
            faucetUrl: networks[networkName].faucetUrl
        }));
    }

    /**
     * Switch to a different network within the current mode
     */
    switchNetwork(newNetwork) {
        const availableNetworks = this.networkConfig[this.currentMode];
        
        if (!availableNetworks[newNetwork]) {
            return {
                success: false,
                error: `Network ${newNetwork} not available in ${this.currentMode} mode`,
                availableNetworks: Object.keys(availableNetworks)
            };
        }

        const oldNetwork = this.currentNetwork;
        this.currentNetwork = newNetwork;
        
        // Clear cache when switching networks
        this.balanceCache.clear();
        
        return {
            success: true,
            message: `Switched to ${availableNetworks[newNetwork].name}`,
            previousNetwork: oldNetwork,
            currentNetwork: this.currentNetwork,
            networkConfig: this.getCurrentNetworkConfig()
        };
    }

    /**
     * Validate if a transaction is safe to execute
     */
    validateTransactionSafety(transactionData) {
        const warnings = [];
        const currentConfig = this.getCurrentNetworkConfig();
        
        // Check if we're on mainnet
        if (this.currentMode === 'mainnet') {
            warnings.push({
                type: 'mainnet_warning',
                severity: 'high',
                message: 'This transaction will use REAL money and cannot be reversed!',
                gasCostWarning: currentConfig.gasCostWarning
            });
        }
        
        // Check transaction amount
        if (transactionData.amount && parseFloat(transactionData.amount) > 1000) {
            warnings.push({
                type: 'large_amount',
                severity: 'high',
                message: `Large transaction amount: ${transactionData.amount} ${transactionData.symbol || 'tokens'}`
            });
        }
        
        return {
            isMainnet: this.currentMode === 'mainnet',
            isTestnet: this.currentMode === 'testnet',
            warningLevel: currentConfig.warningLevel,
            warnings,
            requiresConfirmation: this.currentMode === 'mainnet',
            currentNetwork: currentConfig
        };
    }

    /**
     * Get wallet balance (alias for getNativeBalance for frontend compatibility)
     */
    async getBalance(address, network = 'polygon') {
        return await this.getNativeBalance(address, network);
    }

    /**
     * Get real wallet balance for native token (MATIC/ETH)
     */
    async getNativeBalance(address, network = 'polygon') {
        try {
            if (!ethers.isAddress(address)) {
                throw new Error('Invalid wallet address');
            }

            const provider = this.providers[network];
            if (!provider) {
                throw new Error(`Unsupported network: ${network}`);
            }

            const balance = await provider.getBalance(address);
            const balanceInEther = ethers.formatEther(balance);

            const networkConfig = this.getCurrentNetworkConfig();
            
            return {
                address,
                network,
                balance: parseFloat(balanceInEther),
                symbol: network === 'ethereum' ? 'ETH' : 'MATIC',
                raw: balance.toString(),
                isReal: true,
                isTestnet: this.currentMode === 'testnet',
                isMainnet: this.currentMode === 'mainnet',
                mode: this.currentMode,
                warningLevel: networkConfig.warningLevel,
                faucetUrl: networkConfig.faucetUrl,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error(`Error fetching native balance for ${address}:`, error);
            return this.getSimulatedBalance(address, network, 'native');
        }
    }

    /**
     * Get real token balance (ERC-20)
     */
    async getTokenBalance(address, tokenSymbol, network = 'polygon') {
        try {
            if (!ethers.isAddress(address)) {
                throw new Error('Invalid wallet address');
            }

            const cacheKey = `${address}-${tokenSymbol}-${network}`;
            const cached = this.balanceCache.get(cacheKey);
            
            if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
                return cached.data;
            }

            const provider = this.providers[network];
            const tokenAddress = this.tokenContracts[network]?.[tokenSymbol];

            if (!provider || !tokenAddress) {
                throw new Error(`Token ${tokenSymbol} not supported on ${network}`);
            }

            const tokenContract = new ethers.Contract(tokenAddress, this.erc20Abi, provider);
            
            const [balance, decimals, name] = await Promise.all([
                tokenContract.balanceOf(address),
                tokenContract.decimals(),
                tokenContract.name()
            ]);

            const formattedBalance = ethers.formatUnits(balance, decimals);
            
            const result = {
                address,
                network,
                token: {
                    symbol: tokenSymbol,
                    name,
                    address: tokenAddress,
                    decimals: Number(decimals)
                },
                balance: parseFloat(formattedBalance),
                raw: balance.toString(),
                isReal: true,
                timestamp: new Date().toISOString()
            };

            // Cache the result
            this.balanceCache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });

            return result;

        } catch (error) {
            console.error(`Error fetching token balance for ${address}:`, error);
            return this.getSimulatedBalance(address, network, tokenSymbol);
        }
    }

    /**
     * Get portfolio overview with real balances
     */
    async getPortfolio(address, network = 'polygon') {
        try {
            const portfolio = {
                address,
                network,
                balances: [],
                totalValueUSD: 0,
                isReal: true,
                warnings: [],
                timestamp: new Date().toISOString()
            };

            // Get native balance
            const nativeBalance = await this.getNativeBalance(address, network);
            portfolio.balances.push(nativeBalance);

            if (!nativeBalance.isReal) {
                portfolio.warnings.push('Native token balance is simulated - real balance unavailable');
            }

            // Get token balances
            const supportedTokens = Object.keys(this.tokenContracts[network] || {});
            
            for (const token of supportedTokens) {
                const tokenBalance = await this.getTokenBalance(address, token, network);
                
                if (tokenBalance.balance > 0 || !tokenBalance.isReal) {
                    portfolio.balances.push(tokenBalance);
                    
                    if (!tokenBalance.isReal) {
                        portfolio.warnings.push(`${token} balance is simulated - real balance unavailable`);
                    }
                }
            }

            // Calculate total USD value (simplified - in production, use price oracle)
            portfolio.totalValueUSD = await this.calculatePortfolioValue(portfolio.balances);

            // Determine if entire portfolio data is real
            portfolio.isReal = portfolio.balances.every(balance => balance.isReal);

            return portfolio;

        } catch (error) {
            console.error(`Error fetching portfolio for ${address}:`, error);
            return this.getSimulatedPortfolio(address, network);
        }
    }

    /**
     * Validate transaction before execution
     */
    async validateTransaction(fromAddress, toAddress, amount, tokenSymbol = 'native', network = 'polygon') {
        try {
            // Validate addresses
            if (!ethers.isAddress(fromAddress) || !ethers.isAddress(toAddress)) {
                throw new Error('Invalid wallet address format');
            }

            // Get current balance
            const balance = tokenSymbol === 'native' 
                ? await this.getNativeBalance(fromAddress, network)
                : await this.getTokenBalance(fromAddress, tokenSymbol, network);

            // Check sufficient balance
            if (balance.balance < amount) {
                return {
                    valid: false,
                    error: 'Insufficient balance',
                    required: amount,
                    available: balance.balance,
                    isReal: balance.isReal
                };
            }

            // Estimate gas costs (simplified)
            const gasEstimate = await this.estimateGas(network, tokenSymbol === 'native');
            
            return {
                valid: true,
                balance: balance.balance,
                gasEstimate,
                isReal: balance.isReal,
                warnings: balance.isReal ? [] : ['Balance verification is simulated']
            };

        } catch (error) {
            console.error('Transaction validation error:', error);
            return {
                valid: false,
                error: error.message,
                isSimulated: true
            };
        }
    }

    /**
     * Estimate gas costs
     */
    async estimateGas(network = 'polygon', isNative = true) {
        try {
            const provider = this.providers[network];
            const feeData = await provider.getFeeData();
            
            const gasLimit = isNative ? 21000 : 65000; // Native transfer vs token transfer
            const gasPrice = feeData.gasPrice || ethers.parseUnits('30', 'gwei');
            
            const gasCost = gasLimit * Number(gasPrice);
            const gasCostEth = ethers.formatEther(gasCost.toString());
            
            return {
                gasLimit,
                gasPrice: ethers.formatUnits(gasPrice, 'gwei'),
                estimatedCost: parseFloat(gasCostEth),
                network
            };

        } catch (error) {
            console.error('Gas estimation error:', error);
            return {
                gasLimit: 21000,
                gasPrice: '30',
                estimatedCost: 0.001,
                network,
                isSimulated: true
            };
        }
    }

    /**
     * Get simulated balance when real data is unavailable
     */
    getSimulatedBalance(address, network, tokenSymbol) {
        const simulatedBalances = {
            'polygon': {
                'native': { balance: 25.5, symbol: 'MATIC' },
                'USDC': { balance: 1000.0, symbol: 'USDC' },
                'WMATIC': { balance: 50.0, symbol: 'WMATIC' }
            },
            'mumbai': {
                'native': { balance: 10.0, symbol: 'MATIC' },
                'USDC': { balance: 500.0, symbol: 'USDC' }
            },
            'ethereum': {
                'native': { balance: 0.5, symbol: 'ETH' }
            }
        };

        const simulated = simulatedBalances[network]?.[tokenSymbol] || { balance: 0, symbol: tokenSymbol };
        
        return {
            address,
            network,
            balance: simulated.balance,
            symbol: simulated.symbol,
            isReal: false,
            isSimulated: true,
            warning: 'This is simulated data - real balance unavailable',
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Get simulated portfolio
     */
    getSimulatedPortfolio(address, network) {
        const tokens = ['native', 'USDC', 'WMATIC'];
        const balances = tokens.map(token => this.getSimulatedBalance(address, network, token));

        return {
            address,
            network,
            balances,
            totalValueUSD: 2575.5, // Simulated total
            isReal: false,
            isSimulated: true,
            warnings: ['All balance data is simulated - real balances unavailable'],
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Calculate portfolio value in USD (simplified)
     */
    async calculatePortfolioValue(balances) {
        // Simplified price calculation - in production, integrate with price oracle
        const prices = {
            'MATIC': 0.85,
            'ETH': 2000,
            'USDC': 1.0,
            'WMATIC': 0.85
        };

        let totalValue = 0;
        
        for (const balance of balances) {
            const symbol = balance.symbol || balance.token?.symbol;
            const price = prices[symbol] || 0;
            totalValue += balance.balance * price;
        }

        return Math.round(totalValue * 100) / 100; // Round to 2 decimal places
    }

    /**
     * Health check for wallet service
     */
    async healthCheck() {
        const status = {
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
                    latency: 'good'
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

    /**
     * Get current configuration (frontend compatibility)
     */
    getCurrentConfig() {
        return this.getCurrentNetworkConfig();
    }

    /**
     * Get current mode (frontend compatibility)
     */
    getCurrentMode() {
        return this.currentMode;
    }

    /**
     * Get current network (frontend compatibility)
     */
    getCurrentNetwork() {
        return this.currentNetwork;
    }

    /**
     * Get health status (frontend compatibility)
     */
    getHealth() {
        return {
            mode: this.currentMode,
            network: this.currentNetwork,
            status: 'operational',
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Validate transaction with comprehensive safety checks
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
}

module.exports = WalletService;
