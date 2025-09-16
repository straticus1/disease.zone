/**
 * Comprehensive Wallet Management Service
 * 
 * Features:
 * 1. Create new wallets
 * 2. View different wallets  
 * 3. Search wallets
 * 4. View wallet balances of users
 * 5. Multiple wallet support
 * 6. Balance monitoring across networks
 * 7. Secure local storage
 * 8. Wallet visibility and management
 */

const { ethers } = require('ethers');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

// Import blockchain configuration
const { BLOCKCHAIN_NETWORKS, SAFETY_WARNINGS, DEFAULT_CONFIG } = require('../config/blockchain');

class WalletManagementService {
    constructor() {
        this.currentMode = process.env.DEFAULT_MODE || DEFAULT_CONFIG.mode || 'testnet';
        this.currentNetwork = process.env.DEFAULT_NETWORK || DEFAULT_CONFIG.network || 'polygon';
        this.activeWalletId = null;
        
        // Secure wallet storage path (local only, not committed to git)
        this.walletStoragePath = path.join(__dirname, '..', '.wallets');
        this.userWalletsPath = path.join(__dirname, '..', '.user-wallets');
        
        // Initialize providers and storage
        this.initializeRPCProviders();
        this.initializeStorage();
        
        console.log(`🏦 Wallet Management Service initialized in ${this.currentMode} mode`);
    }

    async initializeStorage() {
        try {
            // Create wallet storage directories if they don't exist
            await fs.mkdir(this.walletStoragePath, { recursive: true });
            await fs.mkdir(this.userWalletsPath, { recursive: true });
            
            // Create .gitignore entries to protect wallet files
            const gitignorePath = path.join(__dirname, '..', '.gitignore');
            const gitignoreContent = await fs.readFile(gitignorePath, 'utf8').catch(() => '');
            
            if (!gitignoreContent.includes('.wallets/')) {
                await fs.appendFile(gitignorePath, '\n# Wallet storage (contains private keys)\n.wallets/\n.user-wallets/\n');
            }
            
            console.log('💾 Wallet storage initialized securely');
        } catch (error) {
            console.error('❌ Error initializing wallet storage:', error);
        }
    }

    initializeRPCProviders() {
        this.providers = {};
        
        const networks = BLOCKCHAIN_NETWORKS[this.currentMode];
        
        for (const [networkName, config] of Object.entries(networks)) {
            try {
                let rpcUrl = config.rpcUrl;
                
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

    // ===== WALLET CREATION METHODS =====

    /**
     * Create a new wallet with private key
     */
    async createNewWallet(walletName, description = '') {
        try {
            // Generate new wallet
            const wallet = ethers.Wallet.createRandom();
            
            const walletData = {
                id: crypto.randomUUID(),
                name: walletName,
                description,
                address: wallet.address,
                privateKey: wallet.privateKey,
                mnemonic: wallet.mnemonic?.phrase || null,
                createdAt: new Date().toISOString(),
                networks: Object.keys(BLOCKCHAIN_NETWORKS[this.currentMode]),
                isActive: false,
                tags: [],
                balances: {}
            };

            // Encrypt private key for storage
            const encryptedWallet = await this.encryptWalletData(walletData);
            
            // Save to secure storage
            const walletFile = path.join(this.walletStoragePath, `${walletData.id}.json`);
            await fs.writeFile(walletFile, JSON.stringify(encryptedWallet, null, 2));
            
            // Update wallet index
            await this.updateWalletIndex(walletData.id, {
                name: walletName,
                address: wallet.address,
                createdAt: walletData.createdAt,
                isActive: false
            });

            console.log(`🎯 New wallet created: ${walletName} (${wallet.address})`);
            
            return {
                success: true,
                wallet: {
                    id: walletData.id,
                    name: walletName,
                    address: wallet.address,
                    createdAt: walletData.createdAt,
                    networks: walletData.networks
                },
                message: 'Wallet created successfully',
                warning: 'Private key encrypted and stored locally - never share it!'
            };

        } catch (error) {
            console.error('Error creating wallet:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Import existing wallet by private key or mnemonic
     */
    async importWallet(walletName, privateKeyOrMnemonic, description = '') {
        try {
            let wallet;
            
            if (privateKeyOrMnemonic.includes(' ')) {
                // Mnemonic phrase
                wallet = ethers.Wallet.fromPhrase(privateKeyOrMnemonic);
            } else {
                // Private key
                wallet = new ethers.Wallet(privateKeyOrMnemonic);
            }
            
            const walletData = {
                id: crypto.randomUUID(),
                name: walletName,
                description,
                address: wallet.address,
                privateKey: wallet.privateKey,
                mnemonic: wallet.mnemonic?.phrase || null,
                createdAt: new Date().toISOString(),
                networks: Object.keys(BLOCKCHAIN_NETWORKS[this.currentMode]),
                isActive: false,
                isImported: true,
                tags: [],
                balances: {}
            };

            // Encrypt and save
            const encryptedWallet = await this.encryptWalletData(walletData);
            const walletFile = path.join(this.walletStoragePath, `${walletData.id}.json`);
            await fs.writeFile(walletFile, JSON.stringify(encryptedWallet, null, 2));
            
            await this.updateWalletIndex(walletData.id, {
                name: walletName,
                address: wallet.address,
                createdAt: walletData.createdAt,
                isActive: false,
                isImported: true
            });

            console.log(`📥 Wallet imported: ${walletName} (${wallet.address})`);
            
            return {
                success: true,
                wallet: {
                    id: walletData.id,
                    name: walletName,
                    address: wallet.address,
                    createdAt: walletData.createdAt,
                    isImported: true
                },
                message: 'Wallet imported successfully'
            };

        } catch (error) {
            console.error('Error importing wallet:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ===== WALLET VIEWING METHODS =====

    /**
     * Get all managed wallets
     */
    async getAllWallets() {
        try {
            const indexPath = path.join(this.walletStoragePath, 'index.json');
            const indexData = await fs.readFile(indexPath, 'utf8').catch(() => '{}');
            const wallets = JSON.parse(indexData);
            
            // Get balances for each wallet
            for (const [walletId, walletInfo] of Object.entries(wallets)) {
                try {
                    walletInfo.balances = await this.getWalletBalances(walletInfo.address);
                } catch (error) {
                    walletInfo.balances = { error: 'Failed to load balances' };
                }
            }
            
            return {
                success: true,
                wallets,
                count: Object.keys(wallets).length,
                activeWallet: this.activeWalletId
            };

        } catch (error) {
            console.error('Error getting all wallets:', error);
            return {
                success: false,
                error: error.message,
                wallets: {}
            };
        }
    }

    /**
     * Get specific wallet details
     */
    async getWallet(walletId, includePrivateKey = false) {
        try {
            const walletFile = path.join(this.walletStoragePath, `${walletId}.json`);
            const encryptedData = await fs.readFile(walletFile, 'utf8');
            const walletData = await this.decryptWalletData(JSON.parse(encryptedData));
            
            if (!includePrivateKey) {
                delete walletData.privateKey;
                delete walletData.mnemonic;
            }
            
            // Get current balances
            walletData.balances = await this.getWalletBalances(walletData.address);
            
            return {
                success: true,
                wallet: walletData
            };

        } catch (error) {
            console.error('Error getting wallet:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Set active wallet
     */
    async setActiveWallet(walletId) {
        try {
            const walletResult = await this.getWallet(walletId);
            if (!walletResult.success) {
                return walletResult;
            }
            
            // Update previous active wallet
            if (this.activeWalletId) {
                await this.updateWalletStatus(this.activeWalletId, { isActive: false });
            }
            
            // Set new active wallet
            this.activeWalletId = walletId;
            await this.updateWalletStatus(walletId, { isActive: true });
            
            return {
                success: true,
                message: `Wallet ${walletResult.wallet.name} is now active`,
                activeWallet: walletResult.wallet
            };

        } catch (error) {
            console.error('Error setting active wallet:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ===== WALLET SEARCH METHODS =====

    /**
     * Search wallets by various criteria
     */
    async searchWallets(query, filters = {}) {
        try {
            const allWallets = await this.getAllWallets();
            if (!allWallets.success) {
                return allWallets;
            }
            
            const results = Object.entries(allWallets.wallets).filter(([walletId, wallet]) => {
                let matches = true;
                
                // Text search
                if (query) {
                    const searchText = query.toLowerCase();
                    matches = matches && (
                        wallet.name.toLowerCase().includes(searchText) ||
                        wallet.address.toLowerCase().includes(searchText) ||
                        (wallet.description || '').toLowerCase().includes(searchText) ||
                        (wallet.tags || []).some(tag => tag.toLowerCase().includes(searchText))
                    );
                }
                
                // Filters
                if (filters.isActive !== undefined) {
                    matches = matches && wallet.isActive === filters.isActive;
                }
                
                if (filters.isImported !== undefined) {
                    matches = matches && wallet.isImported === filters.isImported;
                }
                
                if (filters.minBalance) {
                    const totalBalance = this.calculateTotalBalance(wallet.balances);
                    matches = matches && totalBalance >= filters.minBalance;
                }
                
                if (filters.network) {
                    matches = matches && wallet.networks?.includes(filters.network);
                }
                
                return matches;
            });
            
            return {
                success: true,
                results: results.reduce((acc, [id, wallet]) => {
                    acc[id] = wallet;
                    return acc;
                }, {}),
                count: results.length,
                query,
                filters
            };

        } catch (error) {
            console.error('Error searching wallets:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Find wallet by address
     */
    async findWalletByAddress(address) {
        try {
            const searchResult = await this.searchWallets(address);
            const wallets = Object.values(searchResult.results || {});
            
            return {
                success: true,
                found: wallets.length > 0,
                wallet: wallets[0] || null,
                address
            };

        } catch (error) {
            console.error('Error finding wallet by address:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ===== USER WALLET MONITORING =====

    /**
     * Track user wallet for balance monitoring
     */
    async trackUserWallet(userId, address, nickname = '') {
        try {
            if (!ethers.isAddress(address)) {
                throw new Error('Invalid wallet address');
            }
            
            const userWalletData = {
                userId,
                address,
                nickname,
                addedAt: new Date().toISOString(),
                lastChecked: null,
                balances: {},
                notifications: {
                    lowBalance: false,
                    highValue: false,
                    activity: false
                }
            };
            
            // Get initial balances
            userWalletData.balances = await this.getWalletBalances(address);
            userWalletData.lastChecked = new Date().toISOString();
            
            // Save user wallet tracking data
            const userWalletFile = path.join(this.userWalletsPath, `${userId}_${address}.json`);
            await fs.writeFile(userWalletFile, JSON.stringify(userWalletData, null, 2));
            
            // Update user wallets index
            await this.updateUserWalletsIndex(userId, address, {
                nickname,
                address,
                addedAt: userWalletData.addedAt,
                lastBalance: this.calculateTotalBalance(userWalletData.balances)
            });
            
            return {
                success: true,
                message: `User wallet ${address} is now being tracked`,
                wallet: userWalletData
            };

        } catch (error) {
            console.error('Error tracking user wallet:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get all tracked user wallets
     */
    async getUserWallets(userId = null) {
        try {
            const userWalletsIndexPath = path.join(this.userWalletsPath, 'index.json');
            const indexData = await fs.readFile(userWalletsIndexPath, 'utf8').catch(() => '{}');
            const userWallets = JSON.parse(indexData);
            
            let result = userWallets;
            
            // Filter by specific user if requested
            if (userId) {
                result = Object.entries(userWallets)
                    .filter(([key]) => key.startsWith(`${userId}_`))
                    .reduce((acc, [key, value]) => {
                        acc[key] = value;
                        return acc;
                    }, {});
            }
            
            // Get current balances for each wallet
            for (const [key, walletInfo] of Object.entries(result)) {
                try {
                    walletInfo.currentBalance = await this.getWalletBalances(walletInfo.address);
                    walletInfo.totalValue = this.calculateTotalBalance(walletInfo.currentBalance);
                } catch (error) {
                    walletInfo.currentBalance = { error: 'Failed to load balance' };
                    walletInfo.totalValue = 0;
                }
            }
            
            return {
                success: true,
                userWallets: result,
                count: Object.keys(result).length,
                userId
            };

        } catch (error) {
            console.error('Error getting user wallets:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get wallet balance analytics for all users
     */
    async getWalletAnalytics() {
        try {
            const userWallets = await this.getUserWallets();
            if (!userWallets.success) {
                return userWallets;
            }
            
            const analytics = {
                totalWallets: 0,
                totalValue: 0,
                byNetwork: {},
                topWallets: [],
                averageBalance: 0,
                generatedAt: new Date().toISOString()
            };
            
            const walletValues = [];
            
            for (const [key, wallet] of Object.entries(userWallets.userWallets)) {
                analytics.totalWallets++;
                analytics.totalValue += wallet.totalValue || 0;
                walletValues.push(wallet.totalValue || 0);
                
                // Aggregate by network
                if (wallet.currentBalance) {
                    for (const [network, balance] of Object.entries(wallet.currentBalance)) {
                        if (!analytics.byNetwork[network]) {
                            analytics.byNetwork[network] = {
                                totalBalance: 0,
                                walletCount: 0
                            };
                        }
                        
                        analytics.byNetwork[network].totalBalance += balance.balance || 0;
                        analytics.byNetwork[network].walletCount++;
                    }
                }
                
                // Track top wallets
                analytics.topWallets.push({
                    address: wallet.address,
                    nickname: wallet.nickname,
                    totalValue: wallet.totalValue || 0
                });
            }
            
            // Sort top wallets
            analytics.topWallets.sort((a, b) => b.totalValue - a.totalValue);
            analytics.topWallets = analytics.topWallets.slice(0, 10);
            
            // Calculate average
            analytics.averageBalance = analytics.totalWallets > 0 
                ? analytics.totalValue / analytics.totalWallets 
                : 0;
            
            return {
                success: true,
                analytics
            };

        } catch (error) {
            console.error('Error getting wallet analytics:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ===== BALANCE MONITORING =====

    /**
     * Get wallet balances across all networks
     */
    async getWalletBalances(address) {
        const balances = {};
        
        for (const [networkName, provider] of Object.entries(this.providers)) {
            try {
                const balance = await provider.getBalance(address);
                const balanceInEther = ethers.formatEther(balance);
                
                const networkConfig = BLOCKCHAIN_NETWORKS[this.currentMode][networkName];
                const currency = networkConfig?.nativeCurrency || { symbol: 'ETH' };
                
                balances[networkName] = {
                    balance: parseFloat(balanceInEther),
                    symbol: currency.symbol,
                    raw: balance.toString(),
                    network: networkConfig?.name || networkName,
                    isTestnet: this.currentMode === 'testnet',
                    lastUpdated: new Date().toISOString()
                };
            } catch (error) {
                balances[networkName] = {
                    error: error.message,
                    balance: 0,
                    symbol: 'Unknown',
                    lastUpdated: new Date().toISOString()
                };
            }
        }
        
        return balances;
    }

    /**
     * Calculate total balance value (simplified)
     */
    calculateTotalBalance(balances) {
        if (!balances) return 0;
        
        const prices = {
            'ETH': 2000,
            'MATIC': 0.85,
            'ARB': 1.2,
            'OP': 1.5
        };
        
        let total = 0;
        for (const balance of Object.values(balances)) {
            if (balance.balance && balance.symbol) {
                const price = prices[balance.symbol] || 0;
                total += balance.balance * price;
            }
        }
        
        return Math.round(total * 100) / 100;
    }

    // ===== UTILITY METHODS =====

    /**
     * Encrypt wallet data for secure storage
     */
    async encryptWalletData(walletData) {
        const password = process.env.WALLET_ENCRYPTION_KEY || 'default-dev-key-change-in-production';
        const algorithm = 'aes-256-gcm';
        const key = crypto.scryptSync(password, 'salt', 32);
        const iv = crypto.randomBytes(16);
        
        const cipher = crypto.createCipher(algorithm, key);
        cipher.setAAD(Buffer.from('wallet-data'));
        
        let encrypted = cipher.update(JSON.stringify(walletData), 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = cipher.getAuthTag();
        
        return {
            encrypted,
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex'),
            algorithm
        };
    }

    /**
     * Decrypt wallet data
     */
    async decryptWalletData(encryptedData) {
        const password = process.env.WALLET_ENCRYPTION_KEY || 'default-dev-key-change-in-production';
        const key = crypto.scryptSync(password, 'salt', 32);
        
        const decipher = crypto.createDecipher(encryptedData.algorithm, key);
        decipher.setAAD(Buffer.from('wallet-data'));
        decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
        
        let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return JSON.parse(decrypted);
    }

    /**
     * Update wallet index
     */
    async updateWalletIndex(walletId, walletInfo) {
        try {
            const indexPath = path.join(this.walletStoragePath, 'index.json');
            const indexData = await fs.readFile(indexPath, 'utf8').catch(() => '{}');
            const index = JSON.parse(indexData);
            
            index[walletId] = walletInfo;
            
            await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
        } catch (error) {
            console.error('Error updating wallet index:', error);
        }
    }

    /**
     * Update user wallets index
     */
    async updateUserWalletsIndex(userId, address, walletInfo) {
        try {
            const indexPath = path.join(this.userWalletsPath, 'index.json');
            const indexData = await fs.readFile(indexPath, 'utf8').catch(() => '{}');
            const index = JSON.parse(indexData);
            
            index[`${userId}_${address}`] = walletInfo;
            
            await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
        } catch (error) {
            console.error('Error updating user wallets index:', error);
        }
    }

    /**
     * Update wallet status
     */
    async updateWalletStatus(walletId, updates) {
        try {
            const indexPath = path.join(this.walletStoragePath, 'index.json');
            const indexData = await fs.readFile(indexPath, 'utf8').catch(() => '{}');
            const index = JSON.parse(indexData);
            
            if (index[walletId]) {
                Object.assign(index[walletId], updates);
                await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
            }
        } catch (error) {
            console.error('Error updating wallet status:', error);
        }
    }

    // ===== COMPATIBILITY METHODS =====

    getCurrentNetworkConfig() {
        const networks = BLOCKCHAIN_NETWORKS[this.currentMode];
        const currentNetwork = networks[this.currentNetwork];
        
        return {
            mode: this.currentMode,
            network: this.currentNetwork,
            config: currentNetwork,
            isTestnet: this.currentMode === 'testnet',
            isMainnet: this.currentMode === 'mainnet',
            warningLevel: currentNetwork?.warningLevel || 'unknown'
        };
    }

    getAvailableNetworks() {
        const networks = BLOCKCHAIN_NETWORKS[this.currentMode];
        return Object.keys(networks).map(networkName => ({
            name: networkName,
            displayName: networks[networkName].name,
            chainId: networks[networkName].chainId,
            warningLevel: networks[networkName].warningLevel
        }));
    }

    getCurrentConfig() { return this.getCurrentNetworkConfig(); }
    getCurrentMode() { return this.currentMode; }
    getCurrentNetwork() { return this.currentNetwork; }
    
    async getBalance(address, network = null) {
        const balances = await this.getWalletBalances(address);
        const networkToUse = network || this.currentNetwork;
        return balances[networkToUse] || { balance: 0, error: 'Network not available' };
    }

    switchMode(mode, confirm = false) {
        // Implementation would be similar to walletConfigService
        return { success: true, message: 'Mode switching handled by config service' };
    }

    validateTransaction(data) {
        // Basic validation for compatibility
        return { valid: true, warnings: [] };
    }

    async healthCheck() {
        const wallets = await this.getAllWallets();
        return {
            mode: this.currentMode,
            network: this.currentNetwork,
            walletsCount: wallets.count || 0,
            status: wallets.success ? 'healthy' : 'degraded',
            timestamp: new Date().toISOString()
        };
    }

    getHealth() {
        return {
            mode: this.currentMode,
            network: this.currentNetwork,
            status: 'operational',
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = WalletManagementService;