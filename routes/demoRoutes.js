const express = require('express');
const router = express.Router();
const DemoAccountService = require('../services/demoAccountService');

// Initialize demo account service
const demoService = new DemoAccountService();

/**
 * POST /api/demo/login
 * Demo account login
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                error: 'Email and password required'
            });
        }

        const user = await demoService.authenticateUser(email, password);
        const dashboardConfig = demoService.getDashboardConfig(user.userType);
        const mockData = demoService.generateMockData(user.userType);

        res.json({
            success: true,
            user,
            dashboard: dashboardConfig,
            data: mockData,
            message: `Welcome ${user.name}! This is a demo account.`
        });

    } catch (error) {
        console.error('Demo login error:', error);
        res.status(401).json({
            error: 'Invalid credentials',
            message: error.message
        });
    }
});

/**
 * GET /api/demo/accounts
 * List all demo accounts (for testing)
 */
router.get('/accounts', async (req, res) => {
    try {
        const accounts = await demoService.getAllUsers();
        
        res.json({
            success: true,
            accounts: accounts.map(account => ({
                email: account.email,
                name: account.name,
                userType: account.userType,
                institution: account.institution,
                lastLogin: account.lastLogin
            })),
            instructions: {
                researcher: 'Email: researcher@disease.zone, Password: demo123',
                admin: 'Email: admin@disease.zone, Password: admin123',
                insurance: 'Email: insurance@disease.zone, Password: insurance123',
                provider: 'Email: provider@disease.zone, Password: provider123'
            }
        });

    } catch (error) {
        console.error('Demo accounts list error:', error);
        res.status(500).json({
            error: 'Failed to retrieve demo accounts',
            message: error.message
        });
    }
});

/**
 * POST /api/demo/reset
 * Reset all demo accounts to default state
 */
router.post('/reset', async (req, res) => {
    try {
        await demoService.createDefaultAccounts();
        
        res.json({
            success: true,
            message: 'Demo accounts reset to default state',
            accounts: [
                'researcher@disease.zone (demo123)',
                'admin@disease.zone (admin123)', 
                'insurance@disease.zone (insurance123)',
                'provider@disease.zone (provider123)'
            ]
        });

    } catch (error) {
        console.error('Demo reset error:', error);
        res.status(500).json({
            error: 'Failed to reset demo accounts',
            message: error.message
        });
    }
});

/**
 * GET /api/demo/user/:email
 * Get demo user details
 */
router.get('/user/:email', async (req, res) => {
    try {
        const { email } = req.params;
        const user = await demoService.getUserByEmail(email);
        
        if (!user) {
            return res.status(404).json({
                error: 'User not found'
            });
        }

        const dashboardConfig = demoService.getDashboardConfig(user.userType);
        const mockData = demoService.generateMockData(user.userType);

        res.json({
            success: true,
            user,
            dashboard: dashboardConfig,
            data: mockData
        });

    } catch (error) {
        console.error('Demo user details error:', error);
        res.status(500).json({
            error: 'Failed to retrieve user details',
            message: error.message
        });
    }
});

/**
 * GET /api/demo/dashboard/:userType
 * Get dashboard configuration for user type
 */
router.get('/dashboard/:userType', async (req, res) => {
    try {
        const { userType } = req.params;
        const dashboardConfig = demoService.getDashboardConfig(userType);
        const mockData = demoService.generateMockData(userType);

        res.json({
            success: true,
            userType,
            dashboard: dashboardConfig,
            data: mockData,
            message: `Dashboard configuration for ${userType} user type`
        });

    } catch (error) {
        console.error('Demo dashboard config error:', error);
        res.status(500).json({
            error: 'Failed to retrieve dashboard configuration',
            message: error.message
        });
    }
});

/**
 * POST /api/demo/messaging/send
 * Demo messaging functionality
 */
router.post('/messaging/send', async (req, res) => {
    try {
        const { to, subject, message, priority = 'normal' } = req.body;

        // Mock message sending
        const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        res.json({
            success: true,
            messageId,
            message: 'Message sent successfully (demo mode)',
            details: {
                to,
                subject,
                priority,
                sentAt: new Date().toISOString(),
                deliveryStatus: 'delivered'
            }
        });

    } catch (error) {
        console.error('Demo messaging error:', error);
        res.status(500).json({
            error: 'Failed to send message',
            message: error.message
        });
    }
});

/**
 * GET /api/demo/messaging/inbox
 * Get demo inbox messages
 */
router.get('/messaging/inbox', async (req, res) => {
    try {
        const { userType = 'researcher' } = req.query;

        // Mock inbox messages based on user type
        const messages = generateMockMessages(userType);

        res.json({
            success: true,
            inbox: messages,
            unreadCount: messages.filter(msg => !msg.read).length,
            totalCount: messages.length
        });

    } catch (error) {
        console.error('Demo inbox error:', error);
        res.status(500).json({
            error: 'Failed to retrieve inbox',
            message: error.message
        });
    }
});

// Helper function to generate mock messages
function generateMockMessages(userType) {
    const baseMessages = [
        {
            id: 'msg_001',
            from: 'system@disease.zone',
            subject: 'Welcome to Disease.Zone',
            preview: 'Welcome to your Disease.Zone dashboard...',
            timestamp: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
            read: true,
            priority: 'normal',
            type: 'system'
        },
        {
            id: 'msg_002',
            from: 'alerts@disease.zone',
            subject: 'Weekly Surveillance Report',
            preview: 'Your weekly surveillance report is ready...',
            timestamp: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
            read: false,
            priority: 'high',
            type: 'alert'
        }
    ];

    const typeSpecificMessages = {
        admin: [
            {
                id: 'msg_admin_001',
                from: 'security@disease.zone',
                subject: 'Security Alert: Multiple Login Attempts',
                preview: 'We detected multiple failed login attempts...',
                timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
                read: false,
                priority: 'high',
                type: 'security'
            }
        ],
        researcher: [
            {
                id: 'msg_research_001',
                from: 'data@disease.zone',
                subject: 'New Dataset Available',
                preview: 'A new research dataset has been published...',
                timestamp: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
                read: false,
                priority: 'medium',
                type: 'data'
            }
        ],
        insurance: [
            {
                id: 'msg_insurance_001',
                from: 'analytics@disease.zone',
                subject: 'Risk Assessment Update',
                preview: 'Updated risk assessment report available...',
                timestamp: new Date(Date.now() - 10800000).toISOString(), // 3 hours ago
                read: false,
                priority: 'medium',
                type: 'analytics'
            }
        ],
        provider: [
            {
                id: 'msg_provider_001',
                from: 'clinical@disease.zone',
                subject: 'Patient Alert: Lab Results',
                preview: 'Critical lab results require your attention...',
                timestamp: new Date(Date.now() - 1800000).toISOString(), // 30 minutes ago
                read: false,
                priority: 'urgent',
                type: 'clinical'
            }
        ]
    };

    return [...baseMessages, ...(typeSpecificMessages[userType] || [])];
}

module.exports = router;