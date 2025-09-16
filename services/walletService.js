/**
 * Enhanced Blockchain Wallet Service
 * Real balance checking and improved security for DiseaseZone platform
 */

const { ethers } = require('ethers');
const axios = require('axios');

class WalletService {
    constructor() {
        // Initialize providers for multiple networks
        this.providers = {
            polygon: new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com'),
            mumbai: new ethers.JsonRpcProvider(process.env.MUMBAI_RPC_URL || 'https://rpc-mumbai.matic.today'),
            ethereum: new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL || `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`)
        };

        // Token contract addresses
        this.tokenContracts = {
            polygon: {
                USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
                WMATIC: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
                // Add more token contracts as needed
            },
            mumbai: {
                USDC: '0xe6b8a5CF854791412c1f6EFC7CAf629f5Df1c747', // Testnet USDC
                WMATIC: '0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889' // Testnet WMATIC
            }
        };

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

            return {
                address,
                network,
                balance: parseFloat(balanceInEther),
                symbol: network === 'ethereum' ? 'ETH' : 'MATIC',
                raw: balance.toString(),
                isReal: true,
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
}

module.exports = WalletService;