#!/usr/bin/env node

/**
 * Disease.Zone CLI Configuration Tool
 * Command-line interface for managing platform configuration
 */

const platformConfig = require('./config/platformConfig');
const fs = require('fs');
const path = require('path');

// Command line argument parsing
const args = process.argv.slice(2);
const command = args[0];
const subcommand = args[1];
const value = args[2];

// Color codes for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function colorize(text, color) {
    return `${colors[color]}${text}${colors.reset}`;
}

function printHeader() {
    console.log(colorize('\n╔══════════════════════════════════════════════════════════════╗', 'cyan'));
    console.log(colorize('║                    Disease.Zone CLI Config                  ║', 'cyan'));
    console.log(colorize('║                  Platform Configuration Tool               ║', 'cyan'));
    console.log(colorize('╚══════════════════════════════════════════════════════════════╝\n', 'cyan'));
}

function printUsage() {
    console.log(colorize('Usage:', 'bright'));
    console.log('  ./cli-config.js <command> [subcommand] [value]\n');
    
    console.log(colorize('Commands:', 'bright'));
    console.log('  get <path>              Get configuration value');
    console.log('  set <path> <value>      Set configuration value');
    console.log('  list [section]          List configuration sections');
    console.log('  features                Manage feature flags');
    console.log('  pricing                 Manage pricing configuration');
    console.log('  packages                Manage vertical packages');
    console.log('  webhooks                Manage webhook configuration');
    console.log('  export <file>           Export configuration to file');
    console.log('  import <file>           Import configuration from file');
    console.log('  validate                Validate current configuration');
    console.log('  reset                   Reset to default configuration');
    console.log('  status                  Show configuration status');
    console.log('  help                    Show this help message\n');
    
    console.log(colorize('Examples:', 'bright'));
    console.log('  ./cli-config.js get features.professionalTier');
    console.log('  ./cli-config.js set features.professionalTier true');
    console.log('  ./cli-config.js features enable professionalTier');
    console.log('  ./cli-config.js pricing list');
    console.log('  ./cli-config.js export config-backup.json');
    console.log('  ./cli-config.js validate\n');
}

// Configuration value getter with formatted output
function getConfigValue(configPath) {
    try {
        const value = platformConfig.get(configPath);
        
        if (value === null || value === undefined) {
            console.log(colorize(`Configuration path '${configPath}' not found`, 'red'));
            return;
        }
        
        console.log(colorize(`Configuration: ${configPath}`, 'cyan'));
        
        if (typeof value === 'object') {
            console.log(JSON.stringify(value, null, 2));
        } else {
            console.log(colorize(String(value), 'green'));
        }
    } catch (error) {
        console.log(colorize(`Error getting configuration: ${error.message}`, 'red'));
    }
}

// Configuration value setter
function setConfigValue(configPath, newValue) {
    try {
        // Parse value based on type
        let parsedValue = newValue;
        
        if (newValue === 'true') parsedValue = true;
        else if (newValue === 'false') parsedValue = false;
        else if (!isNaN(newValue) && !isNaN(parseFloat(newValue))) parsedValue = parseFloat(newValue);
        else if (newValue.startsWith('{') || newValue.startsWith('[')) {
            try {
                parsedValue = JSON.parse(newValue);
            } catch (e) {
                // Keep as string if JSON parse fails
            }
        }
        
        platformConfig.set(configPath, parsedValue);
        console.log(colorize(`✓ Set ${configPath} = ${newValue}`, 'green'));
        
    } catch (error) {
        console.log(colorize(`Error setting configuration: ${error.message}`, 'red'));
    }
}

// List configuration sections
function listConfiguration(section) {
    try {
        let config;
        
        if (section) {
            config = platformConfig.get(section);
            if (!config) {
                console.log(colorize(`Section '${section}' not found`, 'red'));
                return;
            }
            console.log(colorize(`Configuration Section: ${section}`, 'cyan'));
        } else {
            config = platformConfig.getFullConfig();
            console.log(colorize('Full Configuration:', 'cyan'));
        }
        
        if (typeof config === 'object') {
            printConfigTree(config, 0);
        } else {
            console.log(colorize(String(config), 'green'));
        }
        
    } catch (error) {
        console.log(colorize(`Error listing configuration: ${error.message}`, 'red'));
    }
}

// Print configuration in tree format
function printConfigTree(obj, depth = 0) {
    const indent = '  '.repeat(depth);
    
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            console.log(`${indent}${colorize(key, 'yellow')}:`);
            printConfigTree(value, depth + 1);
        } else {
            const displayValue = Array.isArray(value) ? `[${value.length} items]` : String(value);
            const color = typeof value === 'boolean' ? (value ? 'green' : 'red') : 'white';
            console.log(`${indent}${colorize(key, 'yellow')}: ${colorize(displayValue, color)}`);
        }
    }
}

// Feature flags management
function manageFeatures(action, feature) {
    try {
        switch (action) {
            case 'list':
                const features = platformConfig.get('features');
                console.log(colorize('Feature Flags:', 'cyan'));
                for (const [name, enabled] of Object.entries(features)) {
                    const status = enabled ? colorize('ENABLED', 'green') : colorize('DISABLED', 'red');
                    console.log(`  ${colorize(name, 'yellow')}: ${status}`);
                }
                break;
                
            case 'enable':
                if (!feature) {
                    console.log(colorize('Feature name required for enable command', 'red'));
                    return;
                }
                platformConfig.setFeatureEnabled(feature, true);
                console.log(colorize(`✓ Enabled feature: ${feature}`, 'green'));
                break;
                
            case 'disable':
                if (!feature) {
                    console.log(colorize('Feature name required for disable command', 'red'));
                    return;
                }
                platformConfig.setFeatureEnabled(feature, false);
                console.log(colorize(`✓ Disabled feature: ${feature}`, 'red'));
                break;
                
            case 'status':
                if (!feature) {
                    console.log(colorize('Feature name required for status command', 'red'));
                    return;
                }
                const isEnabled = platformConfig.isFeatureEnabled(feature);
                const status = isEnabled ? colorize('ENABLED', 'green') : colorize('DISABLED', 'red');
                console.log(`Feature ${colorize(feature, 'yellow')}: ${status}`);
                break;
                
            default:
                console.log(colorize('Available feature commands:', 'cyan'));
                console.log('  features list              List all feature flags');
                console.log('  features enable <name>     Enable a feature');
                console.log('  features disable <name>    Disable a feature');
                console.log('  features status <name>     Check feature status');
        }
    } catch (error) {
        console.log(colorize(`Error managing features: ${error.message}`, 'red'));
    }
}

// Pricing management
function managePricing(action, service) {
    try {
        switch (action) {
            case 'list':
                console.log(colorize('Pricing Configuration:', 'cyan'));
                
                const apiTiers = platformConfig.getAllTiers('apiTiers');
                console.log(colorize('\nAPI Tiers:', 'yellow'));
                for (const [tierName, config] of Object.entries(apiTiers)) {
                    console.log(`  ${colorize(tierName, 'blue')}: $${config.price}/month - ${config.requestsPerDay} requests/day`);
                }
                
                const licenseTiers = platformConfig.getAllTiers('licenseValidationTiers');
                console.log(colorize('\nLicense Validation Tiers:', 'yellow'));
                for (const [tierName, config] of Object.entries(licenseTiers)) {
                    const limit = config.dailySearchLimit === 'unlimited' ? 'unlimited' : `${config.dailySearchLimit} searches/day`;
                    console.log(`  ${colorize(tierName, 'blue')}: $${config.price}/month - ${limit}`);
                }
                break;
                
            case 'api':
                if (service) {
                    const tier = platformConfig.getTier('apiTiers', service);
                    if (tier) {
                        console.log(colorize(`API Tier: ${service}`, 'cyan'));
                        console.log(JSON.stringify(tier, null, 2));
                    } else {
                        console.log(colorize(`API tier '${service}' not found`, 'red'));
                    }
                } else {
                    const tiers = platformConfig.getAllTiers('apiTiers');
                    console.log(colorize('API Pricing Tiers:', 'cyan'));
                    console.log(JSON.stringify(tiers, null, 2));
                }
                break;
                
            case 'license':
                if (service) {
                    const tier = platformConfig.getTier('licenseValidationTiers', service);
                    if (tier) {
                        console.log(colorize(`License Validation Tier: ${service}`, 'cyan'));
                        console.log(JSON.stringify(tier, null, 2));
                    } else {
                        console.log(colorize(`License validation tier '${service}' not found`, 'red'));
                    }
                } else {
                    const tiers = platformConfig.getAllTiers('licenseValidationTiers');
                    console.log(colorize('License Validation Pricing Tiers:', 'cyan'));
                    console.log(JSON.stringify(tiers, null, 2));
                }
                break;
                
            default:
                console.log(colorize('Available pricing commands:', 'cyan'));
                console.log('  pricing list               List all pricing tiers');
                console.log('  pricing api [tier]         Show API pricing tiers');
                console.log('  pricing license [tier]     Show license validation pricing');
        }
    } catch (error) {
        console.log(colorize(`Error managing pricing: ${error.message}`, 'red'));
    }
}

// Package management
function managePackages(action, packageName) {
    try {
        switch (action) {
            case 'list':
                const packages = platformConfig.get('verticalPackages');
                console.log(colorize('Vertical Packages:', 'cyan'));
                for (const [name, config] of Object.entries(packages)) {
                    console.log(`  ${colorize(name, 'blue')}: $${config.price}/month - ${config.description}`);
                    console.log(`    Includes: ${config.includes.join(', ')}`);
                }
                break;
                
            case 'show':
                if (!packageName) {
                    console.log(colorize('Package name required for show command', 'red'));
                    return;
                }
                const packageConfig = platformConfig.getVerticalPackage(packageName);
                if (packageConfig) {
                    console.log(colorize(`Package: ${packageName}`, 'cyan'));
                    console.log(JSON.stringify(packageConfig, null, 2));
                } else {
                    console.log(colorize(`Package '${packageName}' not found`, 'red'));
                }
                break;
                
            default:
                console.log(colorize('Available package commands:', 'cyan'));
                console.log('  packages list              List all vertical packages');
                console.log('  packages show <name>       Show package details');
        }
    } catch (error) {
        console.log(colorize(`Error managing packages: ${error.message}`, 'red'));
    }
}

// Webhook management
function manageWebhooks(action) {
    try {
        switch (action) {
            case 'config':
                const webhookConfig = platformConfig.getWebhookConfig();
                console.log(colorize('Webhook Configuration:', 'cyan'));
                console.log(JSON.stringify(webhookConfig, null, 2));
                break;
                
            case 'events':
                const eventTypes = platformConfig.get('webhooks.eventTypes');
                console.log(colorize('Supported Event Types:', 'cyan'));
                eventTypes.forEach(event => {
                    console.log(`  ${colorize(event, 'yellow')}`);
                });
                break;
                
            case 'limits':
                const limits = platformConfig.get('webhooks.maxWebhooksPerTier');
                console.log(colorize('Webhook Limits by Tier:', 'cyan'));
                for (const [tier, limit] of Object.entries(limits)) {
                    const displayLimit = limit === 'unlimited' ? 'unlimited' : `${limit} webhooks`;
                    console.log(`  ${colorize(tier, 'blue')}: ${displayLimit}`);
                }
                break;
                
            default:
                console.log(colorize('Available webhook commands:', 'cyan'));
                console.log('  webhooks config            Show webhook configuration');
                console.log('  webhooks events            List supported event types');
                console.log('  webhooks limits            Show webhook limits by tier');
        }
    } catch (error) {
        console.log(colorize(`Error managing webhooks: ${error.message}`, 'red'));
    }
}

// Export configuration
function exportConfiguration(filename) {
    try {
        const config = platformConfig.exportConfig();
        const filepath = path.resolve(filename);
        
        fs.writeFileSync(filepath, JSON.stringify(config, null, 2));
        console.log(colorize(`✓ Configuration exported to: ${filepath}`, 'green'));
        
    } catch (error) {
        console.log(colorize(`Error exporting configuration: ${error.message}`, 'red'));
    }
}

// Import configuration
function importConfiguration(filename) {
    try {
        const filepath = path.resolve(filename);
        
        if (!fs.existsSync(filepath)) {
            console.log(colorize(`File not found: ${filepath}`, 'red'));
            return;
        }
        
        const configData = JSON.parse(fs.readFileSync(filepath, 'utf8'));
        const success = platformConfig.importConfig(configData);
        
        if (success) {
            console.log(colorize(`✓ Configuration imported from: ${filepath}`, 'green'));
        } else {
            console.log(colorize('Failed to import configuration', 'red'));
        }
        
    } catch (error) {
        console.log(colorize(`Error importing configuration: ${error.message}`, 'red'));
    }
}

// Validate configuration
function validateConfiguration() {
    try {
        const validation = platformConfig.validateConfig();
        
        console.log(colorize('Configuration Validation:', 'cyan'));
        
        if (validation.valid) {
            console.log(colorize('✓ Configuration is valid', 'green'));
        } else {
            console.log(colorize('✗ Configuration has errors:', 'red'));
            validation.errors.forEach(error => {
                console.log(`  ${colorize('•', 'red')} ${error}`);
            });
        }
        
    } catch (error) {
        console.log(colorize(`Error validating configuration: ${error.message}`, 'red'));
    }
}

// Reset configuration
function resetConfiguration() {
    try {
        console.log(colorize('⚠️  This will reset ALL configuration to defaults!', 'yellow'));
        console.log('Type "yes" to confirm: ');
        
        // In a real CLI, you'd use readline for interactive input
        // For now, we'll just show the command structure
        console.log(colorize('Reset cancelled - interactive confirmation needed', 'yellow'));
        console.log('To reset configuration, use: platformConfig.resetToDefaults()');
        
    } catch (error) {
        console.log(colorize(`Error resetting configuration: ${error.message}`, 'red'));
    }
}

// Show configuration status
function showStatus() {
    try {
        const config = platformConfig.getFullConfig();
        
        console.log(colorize('Configuration Status:', 'cyan'));
        console.log(`Version: ${colorize(config.version, 'green')}`);
        console.log(`Last Updated: ${colorize(new Date(config.lastUpdated).toLocaleString(), 'green')}`);
        
        // Count enabled features
        const features = config.features;
        const enabledCount = Object.values(features).filter(Boolean).length;
        const totalCount = Object.keys(features).length;
        
        console.log(`\nFeatures: ${colorize(enabledCount, 'green')}/${colorize(totalCount, 'blue')} enabled`);
        
        // Count pricing tiers
        const apiTierCount = Object.keys(config.apiTiers || {}).length;
        const licenseTierCount = Object.keys(config.licenseValidationTiers || {}).length;
        
        console.log(`API Tiers: ${colorize(apiTierCount, 'blue')}`);
        console.log(`License Tiers: ${colorize(licenseTierCount, 'blue')}`);
        
        // Count packages
        const packageCount = Object.keys(config.verticalPackages || {}).length;
        console.log(`Vertical Packages: ${colorize(packageCount, 'blue')}`);
        
        // Webhook configuration
        const webhooksEnabled = config.webhooks?.enabled ? 'enabled' : 'disabled';
        const webhookColor = config.webhooks?.enabled ? 'green' : 'red';
        console.log(`Webhooks: ${colorize(webhooksEnabled, webhookColor)}`);
        
    } catch (error) {
        console.log(colorize(`Error showing status: ${error.message}`, 'red'));
    }
}

// Main command router
function main() {
    if (args.length === 0 || command === 'help') {
        printHeader();
        printUsage();
        return;
    }
    
    switch (command) {
        case 'get':
            if (!subcommand) {
                console.log(colorize('Configuration path required for get command', 'red'));
                break;
            }
            getConfigValue(subcommand);
            break;
            
        case 'set':
            if (!subcommand || value === undefined) {
                console.log(colorize('Configuration path and value required for set command', 'red'));
                break;
            }
            setConfigValue(subcommand, value);
            break;
            
        case 'list':
            listConfiguration(subcommand);
            break;
            
        case 'features':
            manageFeatures(subcommand, value);
            break;
            
        case 'pricing':
            managePricing(subcommand, value);
            break;
            
        case 'packages':
            managePackages(subcommand, value);
            break;
            
        case 'webhooks':
            manageWebhooks(subcommand);
            break;
            
        case 'export':
            if (!subcommand) {
                console.log(colorize('Filename required for export command', 'red'));
                break;
            }
            exportConfiguration(subcommand);
            break;
            
        case 'import':
            if (!subcommand) {
                console.log(colorize('Filename required for import command', 'red'));
                break;
            }
            importConfiguration(subcommand);
            break;
            
        case 'validate':
            validateConfiguration();
            break;
            
        case 'reset':
            resetConfiguration();
            break;
            
        case 'status':
            showStatus();
            break;
            
        default:
            console.log(colorize(`Unknown command: ${command}`, 'red'));
            printUsage();
            break;
    }
}

// Run the CLI
main();