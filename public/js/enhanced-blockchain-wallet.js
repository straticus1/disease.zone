/**
 * Enhanced Blockchain Wallet with Testnet/Mainnet Toggle
 * Safe blockchain interaction with comprehensive warnings and mode switching
 */

class EnhancedBlockchainWallet {
    constructor() {
        this.currentMode = 'testnet'; // Start in safe testnet mode
        this.currentNetwork = 'polygon';
        this.networkConfig = null;
        this.availableNetworks = [];
        this.isConnected = false;
        this.connectedAddress = null;
        
        this.init();
    }

    async init() {
        try {
            // Load network configuration from API
            await this.loadNetworkConfig();
            await this.loadWallets();
            
            // Create UI elements
            this.createWalletInterface();
            
            // Check if wallet is already connected
            if (window.ethereum && window.ethereum.selectedAddress) {
                await this.handleWalletConnection();
            }
        } catch (error) {
            console.error('Failed to initialize enhanced blockchain wallet:', error);
            this.showError('Failed to initialize wallet interface');
        }
    }

    async loadNetworkConfig() {
        try {
            const response = await fetch('/api/wallet/network-config');
            const data = await response.json();
            
            if (data.success) {
                this.networkConfig = data.data.current;
                this.availableNetworks = data.data.available;
                this.currentMode = this.networkConfig.mode;
                this.currentNetwork = this.networkConfig.network;
            }
        } catch (error) {
            console.error('Error loading network configuration:', error);
        }
    }

    async loadWallets() {
        try {
            const response = await fetch('/api/wallet/all');
            const data = await response.json();
            
            if (data.success) {
                this.wallets = data.data.wallets;
                this.activeWalletId = data.data.activeWallet;
                
                // Find active wallet for display
                for (const [walletId, wallet] of Object.entries(this.wallets)) {
                    if (wallet.isActive) {
                        this.connectedAddress = wallet.address;
                        this.isConnected = true;
                        break;
                    }
                }
            }
        } catch (error) {
            console.error('Error loading wallets:', error);
            this.wallets = {};
        }
    }

    createWalletInterface() {
        // Find existing wallet elements or create container
        let walletContainer = document.getElementById('walletContainer');
        if (!walletContainer) {
            walletContainer = document.createElement('div');
            walletContainer.id = 'walletContainer';
            document.body.appendChild(walletContainer);
        }

        const walletHTML = `
            <div class="enhanced-wallet-interface" style="
                position: fixed; top: 20px; right: 20px; 
                background: white; border-radius: 12px; 
                box-shadow: 0 8px 32px rgba(0,0,0,0.1); 
                padding: 1.5rem; min-width: 320px; 
                border-left: 4px solid ${this.currentMode === 'testnet' ? '#10b981' : '#ef4444'};
                z-index: 1000;
            ">
                <!-- Mode Toggle Section -->
                <div class="mode-section" style="margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid #e5e7eb;">
                    <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 0.5rem;">
                        <h4 style="margin: 0; font-size: 1rem;">Blockchain Mode</h4>
                        <div class="mode-indicator" style="
                            padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.8rem; font-weight: 600;
                            background: ${this.currentMode === 'testnet' ? '#d1fae5' : '#fee2e2'};
                            color: ${this.currentMode === 'testnet' ? '#059669' : '#dc2626'};
                        ">
                            ${this.currentMode === 'testnet' ? '🧪 TESTNET (Safe)' : '💰 MAINNET (Real Money)'}
                        </div>
                    </div>
                    
                    <div class="mode-controls" style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
                        <button id="testnetModeBtn" class="mode-btn ${this.currentMode === 'testnet' ? 'active' : ''}" 
                                onclick="blockchainWallet.switchMode('testnet')" style="
                            flex: 1; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 6px; 
                            background: ${this.currentMode === 'testnet' ? '#10b981' : 'white'};
                            color: ${this.currentMode === 'testnet' ? 'white' : '#374151'};
                            font-weight: 500; cursor: pointer; transition: all 0.2s;
                        ">
                            🧪 Testnet
                        </button>
                        <button id="mainnetModeBtn" class="mode-btn ${this.currentMode === 'mainnet' ? 'active' : ''}" 
                                onclick="blockchainWallet.switchMode('mainnet')" style="
                            flex: 1; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 6px;
                            background: ${this.currentMode === 'mainnet' ? '#ef4444' : 'white'};
                            color: ${this.currentMode === 'mainnet' ? 'white' : '#374151'};
                            font-weight: 500; cursor: pointer; transition: all 0.2s;
                        ">
                            💰 Mainnet
                        </button>
                    </div>

                    <div class="mode-info" style="font-size: 0.8rem; color: #6b7280;">
                        ${this.getModeInfoText()}
                    </div>
                </div>

                <!-- Network Selection -->
                <div class="network-section" style="margin-bottom: 1rem;">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Network:</label>
                    <select id="networkSelect" onchange="blockchainWallet.switchNetwork(this.value)" style="
                        width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 6px;
                    ">
                        ${this.availableNetworks.map(network => `
                            <option value="${network.name}" ${network.name === this.currentNetwork ? 'selected' : ''}>
                                ${network.displayName} ${network.warningLevel === 'safe' ? '🧪' : '⚠️'}
                            </option>
                        `).join('')}
                    </select>
                </div>

                <!-- Wallet Management -->
                <div class="wallet-section">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Active Wallet:</label>
                    <select id="walletSelect" onchange="blockchainWallet.setActiveWallet(this.value)" style="
                        width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 6px;
                        margin-bottom: 0.5rem;
                    ">
                        <option value="">Select a wallet...</option>
                        ${Object.entries(this.wallets || {}).map(([walletId, wallet]) => `
                            <option value="${walletId}" ${wallet.isActive ? 'selected' : ''}>
                                ${wallet.name} (${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)})
                            </option>
                        `).join('')}
                    </select>
                    
                    <div id="walletStatus" class="wallet-status">
                        ${this.isConnected ? 
                            `<div style="color: #10b981; margin-bottom: 0.5rem;">
                                ✅ Active: ${this.connectedAddress?.slice(0, 6)}...${this.connectedAddress?.slice(-4)}
                            </div>` :
                            `<div style="color: #6b7280; margin-bottom: 0.5rem;">❌ No Active Wallet</div>`
                        }
                    </div>
                    
                    <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
                        <button onclick="blockchainWallet.openWalletDashboard()" 
                                class="connect-btn" style="
                            flex: 1; padding: 0.5rem; background: #2563eb; color: white; 
                            border: none; border-radius: 6px; font-weight: 500; cursor: pointer;
                            transition: background 0.2s; font-size: 0.9rem;
                        ">
                            🏦 Manage Wallets
                        </button>
                        <button onclick="blockchainWallet.connectWallet()" 
                                class="connect-btn" style="
                            flex: 1; padding: 0.5rem; background: #059669; color: white; 
                            border: none; border-radius: 6px; font-weight: 500; cursor: pointer;
                            transition: background 0.2s; font-size: 0.9rem;
                        ">
                            ${this.isConnected ? '🔄 MetaMask' : '🦊 MetaMask'}
                        </button>
                    </div>

                    ${this.currentMode === 'testnet' ? `
                        <div style="margin-top: 0.5rem;">
                            <a href="${this.networkConfig?.faucetUrl || '#'}" target="_blank" 
                               style="color: #059669; font-size: 0.8rem; text-decoration: none;">
                                💧 Get Test Tokens
                            </a>
                        </div>
                    ` : ''}
                </div>

                <!-- Quick Actions -->
                <div class="actions-section" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #e5e7eb;">
                    <div class="quick-actions" style="display: flex; gap: 0.5rem;">
                        <button onclick="blockchainWallet.checkBalance()" style="
                            flex: 1; padding: 0.5rem; background: #f3f4f6; border: 1px solid #d1d5db;
                            border-radius: 6px; cursor: pointer; font-size: 0.8rem;
                        ">
                            💰 Balance
                        </button>
                        <button onclick="blockchainWallet.showTransactionForm()" style="
                            flex: 1; padding: 0.5rem; background: #f3f4f6; border: 1px solid #d1d5db;
                            border-radius: 6px; cursor: pointer; font-size: 0.8rem;
                        ">
                            📤 Send
                        </button>
                    </div>
                </div>
            </div>

            <!-- Modal for confirmations and warnings -->
            <div id="walletModal" class="wallet-modal" style="display: none;"></div>
        `;

        walletContainer.innerHTML = walletHTML;
    }

    getModeInfoText() {
        if (this.currentMode === 'testnet') {
            return '✅ Safe mode: No real money, perfect for testing';
        } else {
            return '⚠️ Real money mode: All transactions cost real cryptocurrency';
        }
    }

    async switchMode(newMode) {
        if (newMode === this.currentMode) {
            return;
        }

        try {
            // Show loading
            this.showLoading('Switching mode...');

            const response = await fetch('/api/wallet/switch-mode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: newMode })
            });

            const result = await response.json();

            if (result.data?.requiresConfirmation) {
                // Show confirmation modal
                await this.showConfirmationModal(result.data.warning, async (confirmed) => {
                    if (confirmed) {
                        // Retry with confirmation
                        const confirmResponse = await fetch('/api/wallet/switch-mode', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ mode: newMode, confirmRealMoney: true })
                        });
                        
                        const confirmResult = await confirmResponse.json();
                        
                        if (confirmResult.success) {
                            await this.handleModeSwitch(confirmResult.data);
                        } else {
                            this.showError(confirmResult.data?.error || 'Failed to switch mode');
                        }
                    }
                });
            } else if (result.success) {
                await this.handleModeSwitch(result.data);
            } else {
                this.showError(result.data?.error || 'Failed to switch mode');
            }
        } catch (error) {
            console.error('Error switching mode:', error);
            this.showError('Network error while switching mode');
        } finally {
            this.hideLoading();
        }
    }

    async handleModeSwitch(switchResult) {
        this.currentMode = switchResult.currentMode;
        
        // Reload network config
        await this.loadNetworkConfig();
        
        // Recreate interface
        this.createWalletInterface();
        
        // Show success message
        this.showSuccess(`Switched to ${this.currentMode} mode. ${switchResult.warning || ''}`);
        
        // Reconnect wallet if necessary
        if (this.isConnected) {
            await this.handleWalletConnection();
        }
    }

    async switchNetwork(newNetwork) {
        if (newNetwork === this.currentNetwork) {
            return;
        }

        try {
            this.showLoading('Switching network...');

            const response = await fetch('/api/wallet/switch-network', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ network: newNetwork })
            });

            const result = await response.json();

            if (result.success) {
                this.currentNetwork = newNetwork;
                await this.loadNetworkConfig();
                this.createWalletInterface();
                this.showSuccess(`Switched to ${result.data.message}`);
                
                if (this.isConnected) {
                    await this.handleWalletConnection();
                }
            } else {
                this.showError(result.data?.error || 'Failed to switch network');
            }
        } catch (error) {
            console.error('Error switching network:', error);
            this.showError('Network error while switching network');
        } finally {
            this.hideLoading();
        }
    }

    async connectWallet() {
        if (!window.ethereum) {
            this.showError('MetaMask or compatible wallet not detected');
            return;
        }

        try {
            this.showLoading('Connecting wallet...');

            // Request account access
            const accounts = await window.ethereum.request({
                method: 'eth_requestAccounts'
            });

            if (accounts.length > 0) {
                this.connectedAddress = accounts[0];
                this.isConnected = true;
                
                await this.handleWalletConnection();
                this.showSuccess('Wallet connected successfully!');
            }
        } catch (error) {
            console.error('Error connecting wallet:', error);
            this.showError('Failed to connect wallet');
        } finally {
            this.hideLoading();
        }
    }

    async handleWalletConnection() {
        if (!this.isConnected || !this.networkConfig) return;

        try {
            // Check if user needs to switch network in their wallet
            const currentChainId = await window.ethereum.request({
                method: 'eth_chainId'
            });

            if (currentChainId !== this.networkConfig.config?.chainId) {
                await this.switchWalletNetwork();
            }

            // Update UI
            this.createWalletInterface();
        } catch (error) {
            console.error('Error handling wallet connection:', error);
        }
    }

    async switchWalletNetwork() {
        const networkConfig = this.networkConfig.config;
        
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: networkConfig.chainId }]
            });
        } catch (switchError) {
            // If network doesn't exist, add it
            if (switchError.code === 4902) {
                try {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [networkConfig]
                    });
                } catch (addError) {
                    console.error('Error adding network:', addError);
                    this.showError('Failed to add network to wallet');
                }
            } else {
                console.error('Error switching network:', switchError);
                this.showError('Failed to switch network in wallet');
            }
        }
    }

    async checkBalance() {
        if (!this.isConnected) {
            this.showError('Please connect your wallet first');
            return;
        }

        try {
            this.showLoading('Checking balance...');

            const response = await fetch(`/api/wallet/balance/${this.connectedAddress}?network=${this.currentNetwork}`);
            const result = await response.json();

            if (result.success) {
                const balance = result.data;
                this.showBalanceModal(balance);
            } else {
                this.showError('Failed to check balance');
            }
        } catch (error) {
            console.error('Error checking balance:', error);
            this.showError('Network error while checking balance');
        } finally {
            this.hideLoading();
        }
    }

    showBalanceModal(balance) {
        const modal = document.getElementById('walletModal');
        
        modal.innerHTML = `
            <div class="modal-overlay" style="
                position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
                background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;
                z-index: 10000;
            " onclick="this.parentElement.style.display='none'">
                <div class="modal-content" style="
                    background: white; padding: 2rem; border-radius: 12px; max-width: 400px; width: 90%;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.3);
                " onclick="event.stopPropagation()">
                    <h3 style="margin: 0 0 1rem 0;">💰 Wallet Balance</h3>
                    
                    <div class="balance-info" style="margin-bottom: 1rem;">
                        <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 0.5rem;">
                            <span style="font-weight: 600; font-size: 1.2rem;">
                                ${parseFloat(balance.balance).toFixed(4)} ${balance.symbol}
                            </span>
                            <div style="
                                padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8rem;
                                background: ${balance.isTestnet ? '#d1fae5' : '#fee2e2'};
                                color: ${balance.isTestnet ? '#059669' : '#dc2626'};
                            ">
                                ${balance.isTestnet ? 'Testnet' : 'Mainnet'}
                            </div>
                        </div>
                        
                        <div style="font-size: 0.9rem; color: #6b7280;">
                            Network: ${this.networkConfig.config?.name || 'Unknown'}
                        </div>
                        
                        ${balance.faucetUrl ? `
                            <div style="margin-top: 0.5rem;">
                                <a href="${balance.faucetUrl}" target="_blank" 
                                   style="color: #059669; font-size: 0.8rem; text-decoration: none;">
                                    💧 Get test tokens from faucet
                                </a>
                            </div>
                        ` : ''}
                    </div>
                    
                    <button onclick="document.getElementById('walletModal').style.display='none'" 
                            style="width: 100%; padding: 0.75rem; background: #059669; color: white; 
                                   border: none; border-radius: 6px; cursor: pointer;">
                        Close
                    </button>
                </div>
            </div>
        `;
        
        modal.style.display = 'block';
    }

    async showConfirmationModal(warning, callback) {
        const modal = document.getElementById('walletModal');
        
        modal.innerHTML = `
            <div class="modal-overlay" style="
                position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
                background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center;
                z-index: 10000;
            ">
                <div class="modal-content" style="
                    background: white; padding: 2rem; border-radius: 12px; max-width: 500px; width: 90%;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.3);
                    border-left: 4px solid #ef4444;
                ">
                    <h3 style="margin: 0 0 1rem 0; color: #ef4444;">${warning.title}</h3>
                    
                    <div style="margin-bottom: 1.5rem; color: #374151; line-height: 1.5;">
                        ${warning.message}
                    </div>
                    
                    <div style="display: flex; gap: 0.5rem;">
                        <button onclick="handleConfirmation(false)" 
                                style="flex: 1; padding: 0.75rem; background: #6b7280; color: white; 
                                       border: none; border-radius: 6px; cursor: pointer;">
                            Cancel
                        </button>
                        <button onclick="handleConfirmation(true)" 
                                style="flex: 1; padding: 0.75rem; background: #ef4444; color: white; 
                                       border: none; border-radius: 6px; cursor: pointer;">
                            ${warning.confirmText}
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Add temporary global function for confirmation
        window.handleConfirmation = (confirmed) => {
            modal.style.display = 'none';
            delete window.handleConfirmation;
            callback(confirmed);
        };
        
        modal.style.display = 'block';
    }

    showTransactionForm() {
        if (!this.isConnected) {
            this.showError('Please connect your wallet first');
            return;
        }

        const modal = document.getElementById('walletModal');
        
        modal.innerHTML = `
            <div class="modal-overlay" style="
                position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
                background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;
                z-index: 10000;
            " onclick="document.getElementById('walletModal').style.display='none'">
                <div class="modal-content" style="
                    background: white; padding: 2rem; border-radius: 12px; max-width: 500px; width: 90%;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.3);
                " onclick="event.stopPropagation()">
                    <h3 style="margin: 0 0 1rem 0;">📤 Send Transaction</h3>
                    
                    <div style="margin-bottom: 1rem; padding: 1rem; background: ${this.currentMode === 'testnet' ? '#f0fdf4' : '#fef2f2'}; border-radius: 6px; border-left: 4px solid ${this.currentMode === 'testnet' ? '#10b981' : '#ef4444'};">
                        <div style="font-weight: 600; margin-bottom: 0.5rem;">
                            ${this.currentMode === 'testnet' ? '🧪 Safe Testnet Mode' : '⚠️ Real Money Mode'}
                        </div>
                        <div style="font-size: 0.9rem; color: #6b7280;">
                            ${this.currentMode === 'testnet' 
                                ? 'This is a test transaction using fake tokens - completely safe!' 
                                : 'This will spend real cryptocurrency. Double-check all details!'}
                        </div>
                    </div>
                    
                    <form id="transactionForm" onsubmit="blockchainWallet.submitTransaction(event)">
                        <div style="margin-bottom: 1rem;">
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">To Address:</label>
                            <input type="text" id="toAddress" required 
                                   placeholder="0x..." 
                                   style="width: 100%; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; font-family: monospace;">
                        </div>
                        
                        <div style="margin-bottom: 1rem;">
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Amount:</label>
                            <div style="position: relative;">
                                <input type="number" id="amount" required step="0.000001" min="0" 
                                       placeholder="0.00" 
                                       style="width: 100%; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 6px;">
                                <div style="position: absolute; right: 0.75rem; top: 50%; transform: translateY(-50%); font-size: 0.9rem; color: #6b7280;">
                                    ${this.networkConfig?.config?.nativeCurrency?.symbol || 'ETH'}
                                </div>
                            </div>
                        </div>
                        
                        <div style="margin-bottom: 1.5rem;">
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Message (Optional):</label>
                            <input type="text" id="message" 
                                   placeholder="Transaction note..." 
                                   style="width: 100%; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 6px;">
                        </div>
                        
                        <div style="display: flex; gap: 0.5rem;">
                            <button type="button" onclick="document.getElementById('walletModal').style.display='none'" 
                                    style="flex: 1; padding: 0.75rem; background: #6b7280; color: white; 
                                           border: none; border-radius: 6px; cursor: pointer;">
                                Cancel
                            </button>
                            <button type="submit" 
                                    style="flex: 1; padding: 0.75rem; background: ${this.currentMode === 'testnet' ? '#059669' : '#ef4444'}; color: white; 
                                           border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                                ${this.currentMode === 'testnet' ? '🧪 Send Test Transaction' : '💰 Send Real Transaction'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        modal.style.display = 'block';
    }

    async submitTransaction(event) {
        event.preventDefault();
        
        const toAddress = document.getElementById('toAddress').value.trim();
        const amount = document.getElementById('amount').value;
        const message = document.getElementById('message').value.trim();
        
        if (!toAddress || !amount) {
            this.showError('Please fill in all required fields');
            return;
        }
        
        try {
            this.showLoading('Validating transaction...');
            
            // Validate transaction via API first
            const validateResponse = await fetch('/api/wallet/validate-transaction', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fromAddress: this.connectedAddress,
                    toAddress,
                    amount: parseFloat(amount),
                    network: this.currentNetwork,
                    mode: this.currentMode
                })
            });
            
            const validationResult = await validateResponse.json();
            
            if (!validationResult.success) {
                this.showError(validationResult.data?.error || 'Transaction validation failed');
                return;
            }
            
            const validation = validationResult.data;
            
            // Show confirmation if there are warnings
            if (validation.warnings && validation.warnings.length > 0) {
                await this.showTransactionConfirmation({
                    toAddress,
                    amount,
                    message,
                    warnings: validation.warnings,
                    gasEstimate: validation.gasEstimate
                }, (confirmed) => {
                    if (confirmed) {
                        this.executeTransaction(toAddress, amount, message, validation);
                    }
                });
            } else {
                // Execute directly if no warnings
                await this.executeTransaction(toAddress, amount, message, validation);
            }
        } catch (error) {
            console.error('Error submitting transaction:', error);
            this.showError('Network error while processing transaction');
        } finally {
            this.hideLoading();
        }
    }

    async executeTransaction(toAddress, amount, message, validation) {
        try {
            this.showLoading('Sending transaction...');
            
            // Convert amount to wei
            const amountWei = window.web3?.utils?.toWei(amount.toString(), 'ether') || 
                             (parseFloat(amount) * Math.pow(10, 18)).toString();
            
            const transactionParams = {
                from: this.connectedAddress,
                to: toAddress,
                value: '0x' + parseInt(amountWei).toString(16),
                gas: validation.gasEstimate?.gasLimit || '0x5208', // 21000 in hex
                gasPrice: validation.gasEstimate?.gasPrice || '0x174876e800' // 100 gwei
            };
            
            const txHash = await window.ethereum.request({
                method: 'eth_sendTransaction',
                params: [transactionParams]
            });
            
            // Close transaction form
            document.getElementById('walletModal').style.display = 'none';
            
            // Show success with transaction hash
            this.showTransactionSuccess(txHash, amount, toAddress);
            
        } catch (error) {
            console.error('Error executing transaction:', error);
            
            if (error.code === 4001) {
                this.showError('Transaction cancelled by user');
            } else {
                this.showError('Transaction failed: ' + (error.message || 'Unknown error'));
            }
        } finally {
            this.hideLoading();
        }
    }

    async showTransactionConfirmation(transactionData, callback) {
        const modal = document.getElementById('walletModal');
        
        const warningsHtml = transactionData.warnings.map(warning => `
            <div style="margin-bottom: 0.5rem; padding: 0.75rem; background: ${warning.level === 'danger' ? '#fee2e2' : '#fef3c7'}; border-radius: 6px; border-left: 3px solid ${warning.level === 'danger' ? '#ef4444' : '#f59e0b'};">
                <div style="font-weight: 600; color: ${warning.level === 'danger' ? '#dc2626' : '#d97706'}; margin-bottom: 0.25rem;">
                    ${warning.level === 'danger' ? '⚠️' : '💡'} ${warning.type}
                </div>
                <div style="font-size: 0.9rem; color: #374151;">
                    ${warning.message}
                </div>
            </div>
        `).join('');
        
        modal.innerHTML = `
            <div class="modal-overlay" style="
                position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
                background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center;
                z-index: 10000;
            ">
                <div class="modal-content" style="
                    background: white; padding: 2rem; border-radius: 12px; max-width: 600px; width: 90%;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.3);
                    border-left: 4px solid #ef4444;
                ">
                    <h3 style="margin: 0 0 1rem 0; color: #ef4444;">⚠️ Confirm Transaction</h3>
                    
                    <div style="margin-bottom: 1.5rem; padding: 1rem; background: #f9fafb; border-radius: 8px;">
                        <div style="display: grid; grid-template-columns: auto 1fr; gap: 0.5rem; font-size: 0.9rem;">
                            <strong>To:</strong> <span style="font-family: monospace;">${transactionData.toAddress}</span>
                            <strong>Amount:</strong> <span>${transactionData.amount} ${this.networkConfig?.config?.nativeCurrency?.symbol || 'ETH'}</span>
                            <strong>Network:</strong> <span>${this.networkConfig?.config?.name || 'Unknown'}</span>
                            ${transactionData.message ? `<strong>Message:</strong> <span>${transactionData.message}</span>` : ''}
                        </div>
                    </div>
                    
                    ${transactionData.warnings.length > 0 ? `
                        <div style="margin-bottom: 1.5rem;">
                            <h4 style="margin: 0 0 0.5rem 0; color: #ef4444;">Warnings:</h4>
                            ${warningsHtml}
                        </div>
                    ` : ''}
                    
                    <div style="display: flex; gap: 0.5rem;">
                        <button onclick="handleTransactionConfirmation(false)" 
                                style="flex: 1; padding: 0.75rem; background: #6b7280; color: white; 
                                       border: none; border-radius: 6px; cursor: pointer;">
                            Cancel
                        </button>
                        <button onclick="handleTransactionConfirmation(true)" 
                                style="flex: 1; padding: 0.75rem; background: #ef4444; color: white; 
                                       border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                            Proceed Anyway
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Add temporary global function for confirmation
        window.handleTransactionConfirmation = (confirmed) => {
            delete window.handleTransactionConfirmation;
            callback(confirmed);
        };
        
        modal.style.display = 'block';
    }

    showTransactionSuccess(txHash, amount, toAddress) {
        const modal = document.getElementById('walletModal');
        const explorerUrl = this.networkConfig?.config?.blockExplorerUrls?.[0];
        
        modal.innerHTML = `
            <div class="modal-overlay" style="
                position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
                background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;
                z-index: 10000;
            " onclick="this.parentElement.style.display='none'">
                <div class="modal-content" style="
                    background: white; padding: 2rem; border-radius: 12px; max-width: 500px; width: 90%;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.3);
                    border-left: 4px solid #10b981;
                ">
                    <h3 style="margin: 0 0 1rem 0; color: #10b981;">✅ Transaction Sent!</h3>
                    
                    <div style="margin-bottom: 1.5rem; padding: 1rem; background: #f0fdf4; border-radius: 8px;">
                        <div style="font-size: 0.9rem; color: #374151; margin-bottom: 1rem;">
                            <strong>Amount:</strong> ${amount} ${this.networkConfig?.config?.nativeCurrency?.symbol || 'ETH'}<br>
                            <strong>To:</strong> ${toAddress.slice(0, 10)}...${toAddress.slice(-8)}<br>
                            <strong>Status:</strong> ${this.currentMode === 'testnet' ? '🧪 Test Transaction' : '💰 Real Transaction'}
                        </div>
                        
                        <div style="font-family: monospace; font-size: 0.8rem; background: white; padding: 0.5rem; border-radius: 4px; word-break: break-all;">
                            <strong>Transaction Hash:</strong><br>
                            ${txHash}
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 0.5rem;">
                        ${explorerUrl ? `
                            <a href="${explorerUrl}/tx/${txHash}" target="_blank" 
                               style="flex: 1; padding: 0.75rem; background: #059669; color: white; 
                                      border: none; border-radius: 6px; cursor: pointer; text-decoration: none; text-align: center;">
                                🔍 View on Explorer
                            </a>
                        ` : ''}
                        <button onclick="document.getElementById('walletModal').style.display='none'" 
                                style="flex: 1; padding: 0.75rem; background: #6b7280; color: white; 
                                       border: none; border-radius: 6px; cursor: pointer;">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        modal.style.display = 'block';
    }

    async setActiveWallet(walletId) {
        if (!walletId) {
            return;
        }

        try {
            this.showLoading('Setting active wallet...');

            const response = await fetch('/api/wallet/set-active', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletId })
            });

            const result = await response.json();

            if (result.success) {
                // Reload wallets and update interface
                await this.loadWallets();
                this.createWalletInterface();
                this.showSuccess('Active wallet updated!');
            } else {
                this.showError(result.data?.error || 'Failed to set active wallet');
            }
        } catch (error) {
            console.error('Error setting active wallet:', error);
            this.showError('Network error while setting active wallet');
        } finally {
            this.hideLoading();
        }
    }

    openWalletDashboard() {
        // Open wallet dashboard in new tab
        window.open('/wallet-dashboard.html', '_blank');
    }

    async checkBalance() {
        if (!this.connectedAddress) {
            this.showError('No active wallet selected');
            return;
        }

        try {
            this.showLoading('Checking balance...');

            const response = await fetch(`/api/wallet/balance/${this.connectedAddress}?network=${this.currentNetwork}`);
            const result = await response.json();

            if (result.success) {
                const balance = result.data;
                this.showBalanceModal(balance);
            } else {
                this.showError('Failed to check balance');
            }
        } catch (error) {
            console.error('Error checking balance:', error);
            this.showError('Network error while checking balance');
        } finally {
            this.hideLoading();
        }
    }

    showLoading(message = 'Loading...') {
        // Implementation for loading indicator
        console.log('Loading:', message);
    }

    hideLoading() {
        // Implementation to hide loading indicator
        console.log('Loading complete');
    }

    showSuccess(message) {
        console.log('Success:', message);
        // Could show a toast notification
    }

    showError(message) {
        console.error('Error:', message);
        // Could show a toast notification
        alert('Error: ' + message); // Simple fallback
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.blockchainWallet = new EnhancedBlockchainWallet();
});

// Make it available globally
window.EnhancedBlockchainWallet = EnhancedBlockchainWallet;