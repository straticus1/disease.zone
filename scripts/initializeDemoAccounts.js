#!/usr/bin/env node

const DemoAccountService = require('../services/demoAccountService');

async function initializeDemoAccounts() {
    console.log('🎯 Initializing Disease.Zone Demo Accounts...');
    
    try {
        const demoService = new DemoAccountService();
        
        // This will create the accounts if they don't exist
        await demoService.loadAccounts();
        
        const accounts = await demoService.getAllUsers();
        
        console.log('\n✅ Demo Accounts Initialized Successfully!');
        console.log('\n📋 Available Demo Accounts:');
        console.log('=' .repeat(60));
        
        accounts.forEach(account => {
            console.log(`\n👤 ${account.userType.toUpperCase()} ACCOUNT`);
            console.log(`   Name: ${account.name}`);
            console.log(`   Email: ${account.email}`);
            console.log(`   Institution: ${account.institution}`);
            console.log(`   Permissions: ${account.permissions.join(', ')}`);
            
            // Don't log passwords in production
            const password = account.userType === 'admin' ? 'admin123' : 
                           account.userType === 'researcher' ? 'demo123' :
                           account.userType === 'insurance' ? 'insurance123' : 'provider123';
            console.log(`   Password: ${password}`);
        });
        
        console.log('\n🌐 Login URLs:');
        console.log('   Local: https://www.disease.zone/#');
        console.log('   Demo API: /api/demo/login');
        
        console.log('\n📊 Dashboard Features by User Type:');
        accounts.forEach(account => {
            const config = demoService.getDashboardConfig(account.userType);
            console.log(`\n   ${account.userType.toUpperCase()}:`);
            console.log(`   - Views: ${config.views.join(', ')}`);
            console.log(`   - Default View: ${config.defaultView}`);
        });
        
        console.log('\n🔧 API Endpoints:');
        console.log('   GET  /api/demo/accounts        - List all demo accounts');
        console.log('   POST /api/demo/login           - Demo login');
        console.log('   POST /api/demo/reset           - Reset accounts');
        console.log('   GET  /api/demo/user/:email     - Get user details');
        console.log('   GET  /api/demo/dashboard/:type - Get dashboard config');
        
        console.log('\n🎉 Ready for testing! Users can now log in with the above credentials.');
        
    } catch (error) {
        console.error('❌ Failed to initialize demo accounts:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    initializeDemoAccounts();
}

module.exports = initializeDemoAccounts;