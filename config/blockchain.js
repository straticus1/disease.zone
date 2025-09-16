/**
 * Blockchain Network Configuration
 * Safe testnet/mainnet toggle system to protect against losing real funds
 */

const BLOCKCHAIN_NETWORKS = {
    // TESTNET NETWORKS (Safe for testing)
    testnet: {
        ethereum: {
            name: 'Ethereum Sepolia Testnet',
            chainId: '0xaa36a7', // 11155111
            rpcUrl: 'https://sepolia.infura.io/v3/${INFURA_KEY}',
            explorerUrl: 'https://sepolia.etherscan.io',
            nativeCurrency: {
                name: 'SepoliaETH',
                symbol: 'ETH',
                decimals: 18
            },
            faucetUrl: 'https://sepoliafaucet.com/',
            warningLevel: 'safe'
        },
        polygon: {
            name: 'Polygon Mumbai Testnet',
            chainId: '0x13881', // 80001
            rpcUrl: 'https://rpc-mumbai.matic.today',
            explorerUrl: 'https://mumbai.polygonscan.com',
            nativeCurrency: {
                name: 'MATIC',
                symbol: 'MATIC',
                decimals: 18
            },
            faucetUrl: 'https://faucet.polygon.technology/',
            warningLevel: 'safe'
        },
        arbitrum: {
            name: 'Arbitrum Sepolia',
            chainId: '0x66eeb', // 421614
            rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
            explorerUrl: 'https://sepolia.arbiscan.io',
            nativeCurrency: {
                name: 'Ethereum',
                symbol: 'ETH',
                decimals: 18
            },
            faucetUrl: 'https://bridge.arbitrum.io/',
            warningLevel: 'safe'
        },
        optimism: {
            name: 'Optimism Sepolia',
            chainId: '0xaa37dc', // 11155420
            rpcUrl: 'https://sepolia.optimism.io',
            explorerUrl: 'https://sepolia-optimism.etherscan.io',
            nativeCurrency: {
                name: 'Ethereum',
                symbol: 'ETH',
                decimals: 18
            },
            faucetUrl: 'https://app.optimism.io/faucet',
            warningLevel: 'safe'
        }
    },

    // MAINNET NETWORKS (Real money - Use with caution!)
    mainnet: {
        ethereum: {
            name: 'Ethereum Mainnet',
            chainId: '0x1', // 1
            rpcUrl: 'https://mainnet.infura.io/v3/${INFURA_KEY}',
            explorerUrl: 'https://etherscan.io',
            nativeCurrency: {
                name: 'Ethereum',
                symbol: 'ETH',
                decimals: 18
            },
            warningLevel: 'high-risk',
            gasCostWarning: 'Ethereum gas fees can be very expensive ($10-100+ per transaction)'
        },
        polygon: {
            name: 'Polygon Mainnet',
            chainId: '0x89', // 137
            rpcUrl: 'https://polygon-rpc.com',
            explorerUrl: 'https://polygonscan.com',
            nativeCurrency: {
                name: 'MATIC',
                symbol: 'MATIC',
                decimals: 18
            },
            warningLevel: 'medium-risk',
            gasCostWarning: 'Polygon gas fees are usually low ($0.01-1 per transaction)'
        },
        arbitrum: {
            name: 'Arbitrum One',
            chainId: '0xa4b1', // 42161
            rpcUrl: 'https://arb1.arbitrum.io/rpc',
            explorerUrl: 'https://arbiscan.io',
            nativeCurrency: {
                name: 'Ethereum',
                symbol: 'ETH',
                decimals: 18
            },
            warningLevel: 'medium-risk',
            gasCostWarning: 'Arbitrum gas fees are moderate ($1-10 per transaction)'
        },
        optimism: {
            name: 'Optimism',
            chainId: '0xa', // 10
            rpcUrl: 'https://mainnet.optimism.io',
            explorerUrl: 'https://optimistic.etherscan.io',
            nativeCurrency: {
                name: 'Ethereum',
                symbol: 'ETH',
                decimals: 18
            },
            warningLevel: 'medium-risk',
            gasCostWarning: 'Optimism gas fees are moderate ($1-10 per transaction)'
        }
    }
};

// Token contracts for each network
const TOKEN_CONTRACTS = {
    testnet: {
        polygon: {
            USDC: '0x2058A9D7613eEE744279e3856Ef0eAda5FCbaA7e', // Mumbai USDC
            WMATIC: '0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889', // Mumbai WMATIC
            HEALTH: '0x0000000000000000000000000000000000000000' // Deploy our own testnet token
        },
        ethereum: {
            USDC: '0xA0b86a33E6411C7d1E0D8e8f55B33F8e1E6cE7CB', // Sepolia USDC
            WETH: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14', // Sepolia WETH
            HEALTH: '0x0000000000000000000000000000000000000000' // Deploy our own testnet token
        }
    },
    mainnet: {
        polygon: {
            USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // Polygon USDC
            WMATIC: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // Polygon WMATIC
            HEALTH: '0x0000000000000000000000000000000000000000' // Deploy our mainnet token
        },
        ethereum: {
            USDC: '0xA0b86a33E6411C7d1E0D8e8f55B33F8e1E6cE7CB', // Ethereum USDC
            WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // Ethereum WETH
            HEALTH: '0x0000000000000000000000000000000000000000' // Deploy our mainnet token
        }
    }
};

// Safety warnings and confirmations
const SAFETY_WARNINGS = {
    testnet_to_mainnet: {
        title: '⚠️ SWITCHING TO REAL MONEY MODE',
        message: 'You are switching from TESTNET (safe) to MAINNET (real money). All transactions will use REAL cryptocurrency and cost REAL money. Are you sure you want to proceed?',
        confirmText: 'I understand I will be using real money',
        severity: 'high'
    },
    mainnet_transaction: {
        title: '💰 REAL MONEY TRANSACTION',
        message: 'This transaction will cost REAL money and cannot be reversed. Please double-check all details before confirming.',
        confirmText: 'I confirm this real money transaction',
        severity: 'high'
    },
    testnet_mode: {
        title: '🧪 TESTNET MODE ACTIVE',
        message: 'You are in TESTNET mode. All transactions are FREE and use test tokens with no real value. Perfect for testing!',
        confirmText: 'Continue in safe testnet mode',
        severity: 'safe'
    }
};

// Default configuration
const DEFAULT_CONFIG = {
    mode: 'testnet', // Start in safe testnet mode by default
    network: 'polygon', // Default to Polygon (low fees)
    autoSwitchToMainnet: false, // Never auto-switch to mainnet
    confirmBeforeMainnetTx: true, // Always confirm mainnet transactions
    showWarnings: true // Show all safety warnings
};

module.exports = {
    BLOCKCHAIN_NETWORKS,
    TOKEN_CONTRACTS,
    SAFETY_WARNINGS,
    DEFAULT_CONFIG
};