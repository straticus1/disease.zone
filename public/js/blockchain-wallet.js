/**
 * Ledger Wallet Integration for diseaseZone
 * Handles wallet connections, HEALTH credit management, and Web3 interactions
 */

class LedgerWallet {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.userAddress = null;
        this.healthCreditBalance = '0';
        this.networkConfig = {
            // Testnet configuration for demo
            chainId: '0x89', // Polygon Mainnet
            chainName: 'Polygon Mainnet',
            nativeCurrency: {
                name: 'MATIC',
                symbol: 'MATIC',
                decimals: 18
            },
            rpcUrls: ['https://polygon-rpc.com/'],
            blockExplorerUrls: ['https://polygonscan.com/']
        };
        // Note: This is a demo contract address - real HEALTH credit needs to be deployed
        this.healthCreditContract = '0x1000000000000000000000000000000000000001'; // Mock address for demo
        this.realHealthCreditContract = null; // Will be set when real credit is deployed
    }

    // Initialize wallet connection
    async init() {
        if (typeof window.ethereum !== 'undefined') {
            console.log('MetaMask is installed!');
            this.provider = window.ethereum;

            // Listen for account changes
            this.provider.on('accountsChanged', (accounts) => {
                if (accounts.length === 0) {
                    this.handleDisconnect();
                } else {
                    this.userAddress = accounts[0];
                    this.updateWalletDisplay();
                    this.updateWalletAddressDisplay();
                    this.loadHealthCreditBalance();
                }
            });

            // Listen for chain changes
            this.provider.on('chainChanged', () => {
                window.location.reload();
            });

            return true;
        } else {
            console.log('MetaMask is not installed');
            return false;
        }
    }

    // Connect to user's wallet
    async connectWallet() {
        try {
            if (!this.provider) {
                throw new Error('No wallet provider found');
            }

            // Request account access
            const accounts = await this.provider.request({
                method: 'eth_requestAccounts'
            });

            if (accounts.length === 0) {
                throw new Error('No accounts found');
            }

            this.userAddress = accounts[0];

            // Switch to Polygon network if needed
            await this.ensureCorrectNetwork();

            // Load credit balance
            await this.loadHealthCreditBalance();

            this.updateWalletDisplay();
            this.showWalletConnectedMessage();

            return true;
        } catch (error) {
            console.error('Error connecting wallet:', error);
            this.showWalletError(error.message);
            return false;
        }
    }

    // Ensure user is on the correct network
    async ensureCorrectNetwork() {
        try {
            const chainId = await this.provider.request({ method: 'eth_chainId' });

            if (chainId !== this.networkConfig.chainId) {
                // Try to switch to Polygon
                await this.provider.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: this.networkConfig.chainId }]
                });
            }
        } catch (switchError) {
            // Network doesn't exist, add it
            if (switchError.code === 4902) {
                await this.provider.request({
                    method: 'wallet_addEthereumChain',
                    params: [this.networkConfig]
                });
            } else {
                throw switchError;
            }
        }
    }

    // Load HEALTH credit balance (simulated for demo)
    async loadHealthCreditBalance() {
        try {
            if (!this.userAddress) return;

            // In a real implementation, this would call the actual token contract
            // For demo purposes, we'll simulate the balance
            const simulatedBalance = this.generateRealisticBalance();
            this.healthCreditBalance = simulatedBalance;

            this.updateTokenDisplay();
        } catch (error) {
            console.error('Error loading token balance:', error);
            this.healthCreditBalance = '0';
        }
    }

    // Generate realistic demo balance
    generateRealisticBalance() {
        // Simulate different user types
        const userTypes = [
            { balance: '0', probability: 0.3 }, // New users
            { balance: (Math.random() * 100 + 50).toFixed(2), probability: 0.4 }, // Active users
            { balance: (Math.random() * 500 + 200).toFixed(2), probability: 0.25 }, // Power users
            { balance: (Math.random() * 2000 + 1000).toFixed(2), probability: 0.05 } // Super users
        ];

        const rand = Math.random();
        let cumulativeProbability = 0;

        for (const userType of userTypes) {
            cumulativeProbability += userType.probability;
            if (rand <= cumulativeProbability) {
                return userType.balance;
            }
        }

        return '0';
    }

    // Simulate earning credits for health data contribution
    async earnCredits(amount, dataType) {
        try {
            const currentBalance = parseFloat(this.healthCreditBalance);
            const newBalance = (currentBalance + amount).toFixed(2);
            this.healthCreditBalance = newBalance;

            this.updateTokenDisplay();
            this.showCreditEarnedMessage(amount, dataType);

            // Store in local storage for demo persistence
            localStorage.setItem(`healthCredits_${this.userAddress}`, newBalance);

            return true;
        } catch (error) {
            console.error('Error earning tokens:', error);
            return false;
        }
    }

    // Simulate spending credits for research access
    async spendCredits(amount, purpose) {
        try {
            const currentBalance = parseFloat(this.healthCreditBalance);

            if (currentBalance < amount) {
                throw new Error('Insufficient HEALTH credit balance');
            }

            const newBalance = (currentBalance - amount).toFixed(2);
            this.healthCreditBalance = newBalance;

            this.updateTokenDisplay();
            this.showCreditSpentMessage(amount, purpose);

            // Store in local storage for demo persistence
            localStorage.setItem(`healthCredits_${this.userAddress}`, newBalance);

            return true;
        } catch (error) {
            console.error('Error spending tokens:', error);
            this.showWalletError(error.message);
            return false;
        }
    }

    // Update wallet display in UI
    updateWalletDisplay() {
        const walletStatus = document.getElementById('walletStatus');
        const connectButton = document.getElementById('connectWalletBtn');
        const connectedWalletInfo = document.getElementById('connectedWalletInfo');
        const currentWalletAddress = document.getElementById('currentWalletAddress');

        // Top navigation elements
        const topConnectButton = document.getElementById('topConnectWalletBtn');
        const topWalletStatus = document.getElementById('topWalletStatus');
        const topWalletAddress = document.getElementById('topWalletAddress');

        if (this.userAddress) {
            const shortAddress = `${this.userAddress.substring(0, 6)}...${this.userAddress.substring(this.userAddress.length - 4)}`;

            // Update main blockchain page
            if (walletStatus) {
                walletStatus.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 10px; color: #059669;">
                        <div style="width: 8px; height: 8px; background: #10b981; border-radius: 50%;"></div>
                        <span><strong>✅ Wallet Connected</strong></span>
                    </div>
                `;
            }

            if (connectedWalletInfo) {
                connectedWalletInfo.style.display = 'block';
            }

            if (currentWalletAddress) {
                currentWalletAddress.textContent = shortAddress;
            }

            if (connectButton) {
                connectButton.style.display = 'none';
            }

            // Update top navigation
            if (topConnectButton) {
                topConnectButton.style.display = 'none';
            }

            if (topWalletStatus) {
                topWalletStatus.style.display = 'block';
            }

            if (topWalletAddress) {
                topWalletAddress.textContent = shortAddress;
            }

        } else {
            // Update main blockchain page
            if (walletStatus) {
                walletStatus.innerHTML = `
                    <div style="color: #6b7280;">
                        <span>Wallet not connected</span>
                    </div>
                `;
            }

            if (connectedWalletInfo) {
                connectedWalletInfo.style.display = 'none';
            }

            if (currentWalletAddress) {
                currentWalletAddress.textContent = 'Not connected';
            }

            if (connectButton) {
                connectButton.style.display = 'inline-block';
            }

            // Update top navigation
            if (topConnectButton) {
                topConnectButton.style.display = 'inline-block';
            }

            if (topWalletStatus) {
                topWalletStatus.style.display = 'none';
            }

            if (topWalletAddress) {
                topWalletAddress.textContent = 'Connected';
            }
        }
    }

    // Update credit balance display
    updateTokenDisplay() {
        const tokenBalance = document.getElementById('healthCreditBalance');
        if (tokenBalance) {
            tokenBalance.textContent = this.healthCreditBalance;
        }

        const tokenBalanceFormatted = document.getElementById('healthCreditBalanceFormatted');
        if (tokenBalanceFormatted) {
            tokenBalanceFormatted.textContent = `${this.healthCreditBalance} HEALTH`;
        }
    }

    // Disconnect wallet
    async disconnectWallet() {
        this.userAddress = null;
        this.healthCreditBalance = '0';
        this.updateWalletDisplay();
        this.updateTokenDisplay();
        this.showWalletDisconnectedMessage();
    }

    // Handle wallet disconnect event
    handleDisconnect() {
        this.disconnectWallet();
    }

    // Show success messages
    showWalletConnectedMessage() {
        this.showNotification('✅ Wallet connected successfully!', 'success');
    }

    showWalletDisconnectedMessage() {
        this.showNotification('👋 Wallet disconnected', 'info');
    }

    showCreditEarnedMessage(amount, dataType) {
        this.showNotification(`🪙 Earned ${amount} HEALTH credits for ${dataType} contribution!`, 'success');
    }

    showCreditSpentMessage(amount, purpose) {
        this.showNotification(`💸 Spent ${amount} HEALTH credits for ${purpose}`, 'info');
    }

    // Show error messages
    showWalletError(message) {
        this.showNotification(`❌ Wallet Error: ${message}`, 'error');
    }

    // Generic notification system
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            max-width: 400px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            backdrop-filter: blur(10px);
            transition: all 0.3s ease;
        `;

        switch (type) {
            case 'success':
                notification.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
                break;
            case 'error':
                notification.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
                break;
            case 'info':
            default:
                notification.style.background = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
        }

        notification.textContent = message;
        document.body.appendChild(notification);

        // Auto remove after 4 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100px)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 4000);
    }

    // Validate HEALTH credit on public ledger
    async validateHealthToken() {
        try {
            if (!this.provider) {
                throw new Error('No ledger provider available');
            }

            // Check if we're on the correct network
            const chainId = await this.provider.request({ method: 'eth_chainId' });
            if (chainId !== this.networkConfig.chainId) {
                throw new Error('Please switch to Polygon Mainnet to validate HEALTH credits');
            }

            // For demo purposes, we'll simulate credit validation
            // In a real implementation, this would query the actual deployed contract
            const simulatedCreditInfo = {
                name: 'HEALTH Credit',
                symbol: 'HLTH',
                totalSupply: '1000000000', // 1 billion credits
                decimals: 18,
                contractAddress: this.healthCreditContract,
                isReal: false, // This indicates it's a mock for demo
                deploymentStatus: 'Demo Mode - Credit not yet deployed on Polygon Mainnet',
                verifiedOnPolygonScan: false
            };

            // Check PolygonScan for real contract (this would be done server-side in production)
            const polygonScanUrl = `https://api.polygonscan.com/api?module=contract&action=getsourcecode&address=${this.healthCreditContract}&apikey=demo`;

            this.showNotification(
                `📊 Credit Validation: ${simulatedCreditInfo.deploymentStatus}`,
                'info'
            );

            return simulatedCreditInfo;

        } catch (error) {
            console.error('Error validating HEALTH credit:', error);
            this.showNotification(`❌ Credit validation failed: ${error.message}`, 'error');
            return null;
        }
    }

    // Check credit balance via ledger (for when real credit is deployed)
    async getActualTokenBalance() {
        try {
            if (!this.userAddress || !this.provider) {
                return '0';
            }

            // This would query the real credit contract when deployed
            // For now, return simulated balance
            return this.healthCreditBalance;

        } catch (error) {
            console.error('Error getting actual credit balance:', error);
            return '0';
        }
    }

    // Get wallet info for display
    getWalletInfo() {
        return {
            connected: !!this.userAddress,
            address: this.userAddress,
            balance: this.healthCreditBalance,
            network: 'Polygon Mainnet',
            creditContract: this.healthCreditContract,
            isDemo: true // Indicates this is demo mode
        };
    }

    // Load persisted balance from localStorage
    loadPersistedBalance() {
        if (this.userAddress) {
            const savedBalance = localStorage.getItem(`healthCredits_${this.userAddress}`);
            if (savedBalance) {
                this.healthCreditBalance = savedBalance;
                this.updateTokenDisplay();
            }
        }
    }

    // Update wallet address display
    updateWalletAddressDisplay() {
        const addressElement = document.getElementById('userWalletAddress');
        if (addressElement && this.userAddress) {
            const shortAddress = `${this.userAddress.substring(0, 8)}...${this.userAddress.substring(this.userAddress.length - 8)}`;
            addressElement.textContent = shortAddress;
        } else if (addressElement) {
            addressElement.textContent = 'Not connected';
        }
    }
}

// Global functions for HTML onclick events
function viewOnBlockExplorer() {
    if (ledger.userAddress) {
        const url = `https://polygonscan.com/address/${ledger.userAddress}`;
        window.open(url, '_blank');
    } else {
        ledger.showNotification('Please connect your wallet first', 'warning');
    }
}

// Initialize global ledger wallet instance
window.ledger = new LedgerWallet();

// Backward compatibility aliases
window.blockchain = window.ledger;
window.BlockchainWallet = LedgerWallet;

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    const initialized = await ledger.init();
    if (!initialized) {
        console.log('Ledger wallet not available - using demo mode');
    }
});
