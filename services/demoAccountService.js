const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

class DemoAccountService {
    constructor() {
        this.accountsFile = path.join(__dirname, '../data/demo_accounts.json');
        this.accounts = new Map();
        this.loadAccounts();
    }

    async loadAccounts() {
        try {
            const data = await fs.readFile(this.accountsFile, 'utf8');
            const accounts = JSON.parse(data);
            accounts.forEach(account => {
                this.accounts.set(account.email, account);
            });
            console.log(`📋 Loaded ${this.accounts.size} demo accounts`);
        } catch (error) {
            console.log('📋 Creating new demo accounts file');
            await this.createDefaultAccounts();
        }
    }

    async saveAccounts() {
        try {
            const accountsArray = Array.from(this.accounts.values());
            await fs.writeFile(this.accountsFile, JSON.stringify(accountsArray, null, 2));
            console.log(`💾 Saved ${accountsArray.length} demo accounts`);
        } catch (error) {
            console.error('❌ Failed to save demo accounts:', error);
        }
    }

    async createDefaultAccounts() {
        const defaultAccounts = [
            {
                id: this.generateId(),
                email: 'researcher@disease.zone',
                password: 'demo123', // In production, this would be hashed
                name: 'Dr. Sarah Research',
                userType: 'researcher',
                institution: 'Global Health Research Institute',
                specialization: 'Epidemiology',
                permissions: [
                    'view_surveillance_data',
                    'export_data',
                    'access_api',
                    'create_reports'
                ],
                createdAt: new Date().toISOString(),
                lastLogin: null,
                profile: {
                    title: 'Senior Epidemiologist',
                    department: 'Infectious Disease Research',
                    phone: '+1-555-0123',
                    researchAreas: ['Respiratory diseases', 'Outbreak modeling', 'Public health surveillance']
                }
            },
            {
                id: this.generateId(),
                email: 'admin@disease.zone',
                password: 'admin123', // In production, this would be hashed
                name: 'Admin User',
                userType: 'admin',
                institution: 'Disease.Zone Platform',
                specialization: 'System Administration',
                permissions: [
                    'full_access',
                    'user_management',
                    'system_config',
                    'data_management',
                    'audit_logs',
                    'integration_management'
                ],
                createdAt: new Date().toISOString(),
                lastLogin: null,
                profile: {
                    title: 'Platform Administrator',
                    department: 'Technical Operations',
                    phone: '+1-555-0100',
                    responsibilities: ['System monitoring', 'User support', 'Data integrity', 'Security oversight']
                }
            },
            {
                id: this.generateId(),
                email: 'insurance@disease.zone',
                password: 'insurance123', // In production, this would be hashed
                name: 'Insurance Analytics Team',
                userType: 'insurance',
                institution: 'HealthGuard Insurance',
                specialization: 'Risk Assessment',
                permissions: [
                    'view_aggregated_data',
                    'risk_analytics',
                    'claims_analysis',
                    'population_health_insights'
                ],
                createdAt: new Date().toISOString(),
                lastLogin: null,
                profile: {
                    title: 'Senior Actuarial Analyst',
                    department: 'Population Health Analytics',
                    phone: '+1-555-0156',
                    focusAreas: ['Risk modeling', 'Claims prediction', 'Population health trends', 'Cost analysis']
                }
            },
            {
                id: this.generateId(),
                email: 'provider@disease.zone',
                password: 'provider123', // In production, this would be hashed
                name: 'Dr. Michael Provider',
                userType: 'provider',
                institution: 'Metro General Hospital',
                specialization: 'Internal Medicine',
                permissions: [
                    'patient_data_access',
                    'clinical_alerts',
                    'reporting_tools',
                    'ehr_integration'
                ],
                createdAt: new Date().toISOString(),
                lastLogin: null,
                profile: {
                    title: 'Chief Medical Officer',
                    department: 'Internal Medicine',
                    phone: '+1-555-0178',
                    npi: '1234567890',
                    specialties: ['Internal Medicine', 'Infectious Diseases', 'Hospital Medicine']
                }
            }
        ];

        defaultAccounts.forEach(account => {
            this.accounts.set(account.email, account);
        });

        await this.saveAccounts();
        console.log('✅ Created default demo accounts');
        return defaultAccounts;
    }

    generateId() {
        return crypto.randomUUID();
    }

    async authenticateUser(email, password) {
        const account = this.accounts.get(email);
        if (!account) {
            throw new Error('Account not found');
        }

        // In production, compare hashed passwords
        if (account.password !== password) {
            throw new Error('Invalid credentials');
        }

        // Update last login
        account.lastLogin = new Date().toISOString();
        await this.saveAccounts();

        // Return account without password
        const { password: _, ...safeAccount } = account;
        return safeAccount;
    }

    async getUserByEmail(email) {
        const account = this.accounts.get(email);
        if (!account) {
            return null;
        }

        const { password: _, ...safeAccount } = account;
        return safeAccount;
    }

    async getAllUsers() {
        const users = Array.from(this.accounts.values()).map(account => {
            const { password: _, ...safeAccount } = account;
            return safeAccount;
        });
        return users;
    }

    async getUsersByType(userType) {
        const users = Array.from(this.accounts.values())
            .filter(account => account.userType === userType)
            .map(account => {
                const { password: _, ...safeAccount } = account;
                return safeAccount;
            });
        return users;
    }

    async createUser(userData) {
        if (this.accounts.has(userData.email)) {
            throw new Error('User already exists');
        }

        const newUser = {
            id: this.generateId(),
            ...userData,
            createdAt: new Date().toISOString(),
            lastLogin: null
        };

        this.accounts.set(userData.email, newUser);
        await this.saveAccounts();

        const { password: _, ...safeUser } = newUser;
        return safeUser;
    }

    async updateUser(email, updates) {
        const account = this.accounts.get(email);
        if (!account) {
            throw new Error('User not found');
        }

        const updatedAccount = { ...account, ...updates };
        this.accounts.set(email, updatedAccount);
        await this.saveAccounts();

        const { password: _, ...safeAccount } = updatedAccount;
        return safeAccount;
    }

    async deleteUser(email) {
        if (!this.accounts.has(email)) {
            throw new Error('User not found');
        }

        this.accounts.delete(email);
        await this.saveAccounts();
        return true;
    }

    // Get dashboard configuration based on user type
    getDashboardConfig(userType) {
        const configs = {
            admin: {
                views: ['dashboard', 'messaging', 'hospital-connect', 'record-review', 'lab-translator', 'users', 'analytics', 'system'],
                permissions: ['full_access'],
                defaultView: 'dashboard'
            },
            researcher: {
                views: ['dashboard', 'messaging', 'record-review', 'lab-translator', 'analytics'],
                permissions: ['view_surveillance_data', 'export_data', 'access_api'],
                defaultView: 'dashboard'
            },
            insurance: {
                views: ['dashboard', 'messaging', 'analytics'],
                permissions: ['view_aggregated_data', 'risk_analytics'],
                defaultView: 'dashboard'
            },
            provider: {
                views: ['dashboard', 'messaging', 'hospital-connect', 'record-review', 'lab-translator'],
                permissions: ['patient_data_access', 'clinical_alerts'],
                defaultView: 'dashboard'
            }
        };

        return configs[userType] || configs.researcher;
    }

    // Mock data generation for different user types
    generateMockData(userType) {
        const mockData = {
            admin: {
                systemStats: {
                    totalUsers: 1247,
                    activeConnections: 89,
                    dataProcessed: '2.4TB',
                    systemUptime: '99.9%'
                },
                recentAlerts: [
                    { type: 'security', message: 'Failed login attempts detected', severity: 'medium' },
                    { type: 'system', message: 'Database maintenance scheduled', severity: 'low' }
                ]
            },
            researcher: {
                recentStudies: [
                    { title: 'COVID-19 Variant Analysis', status: 'active', lastUpdated: '2025-09-18' },
                    { title: 'Influenza Surveillance 2025', status: 'completed', lastUpdated: '2025-09-15' }
                ],
                dataAccess: {
                    totalRecords: 125000,
                    lastSync: '2025-09-18 14:30',
                    exportQuota: '75% used'
                }
            },
            insurance: {
                riskMetrics: {
                    populationRiskScore: 6.7,
                    claimsPrediction: '+12% next quarter',
                    costImpact: '$2.4M estimated'
                },
                trends: [
                    { condition: 'Respiratory Infections', trend: 'increasing', impact: 'medium' },
                    { condition: 'Cardiovascular Events', trend: 'stable', impact: 'low' }
                ]
            },
            provider: {
                patientAlerts: [
                    { patient: 'J. Doe', alert: 'Lab results ready', priority: 'high' },
                    { patient: 'M. Smith', alert: 'Follow-up due', priority: 'medium' }
                ],
                hospitalStats: {
                    connectedSystems: 3,
                    lastDataSync: '2025-09-18 15:45',
                    pendingReviews: 12
                }
            }
        };

        return mockData[userType] || {};
    }
}

module.exports = DemoAccountService;