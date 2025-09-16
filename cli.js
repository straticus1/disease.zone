#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

// Import command modules
const AuthCommands = require('./cli/auth');
const UserCommands = require('./cli/user');
const DiseaseCommands = require('./cli/diseases');
const FamilyCommands = require('./cli/family');
const SymptomAnalysisCommands = require('./cli/commands/symptom-analysis');
const ApiKeyCommands = require('./cli/apikeys');
const BatchCommands = require('./cli/batch');
const ConfigCommands = require('./cli/config');
const FHIRBlockchainCommands = require('./cli/fhir-blockchain');
const DiseaseZoneConsole = require('./cli/console');

// CLI Configuration
const CLI_CONFIG_PATH = path.join(require('os').homedir(), '.diseasezone');
const CLI_VERSION = require('./package.json').version;

// Global CLI state
let config = {};

// Load CLI configuration
function loadConfig() {
    try {
        if (fs.existsSync(CLI_CONFIG_PATH)) {
            config = JSON.parse(fs.readFileSync(CLI_CONFIG_PATH, 'utf8'));
        }
    } catch (error) {
        // Silent fail, use defaults
    }

    // Set defaults
    config = {
        server_url: config.server_url || 'http://localhost:3000',
        auth_token: config.auth_token || null,
        api_key: config.api_key || null,
        output_format: config.output_format || 'table',
        ...config
    };
}

// Save CLI configuration
function saveConfig() {
    try {
        fs.writeFileSync(CLI_CONFIG_PATH, JSON.stringify(config, null, 2));
    } catch (error) {
        console.error(chalk.red('Error saving configuration:'), error.message);
    }
}

// Initialize CLI
function initializeCLI() {
    loadConfig();

    // Set global config for command modules
    global.dzConfig = config;
    global.dzSaveConfig = saveConfig;

    program
        .name('diseasezone')
        .description('🧬 diseaseZone CLI - Comprehensive family disease tracking platform')
        .version(CLI_VERSION)
        .option('-s, --server <url>', 'Server URL (default: http://localhost:3000)')
        .option('-f, --format <type>', 'Output format: table, json, csv (default: table)')
        .option('-v, --verbose', 'Verbose output')
        .hook('preAction', (thisCommand, actionCommand) => {
            // Update config with command line options
            if (thisCommand.opts().server) {
                config.server_url = thisCommand.opts().server;
            }
            if (thisCommand.opts().format) {
                config.output_format = thisCommand.opts().format;
            }
            if (thisCommand.opts().verbose) {
                config.verbose = true;
            }

            // Update global config
            global.dzConfig = config;
        });

    // Authentication commands
    const auth = program.command('auth').description('🔐 Authentication and session management');
    auth.command('login')
        .description('Login to diseaseZone platform')
        .option('-e, --email <email>', 'Email address')
        .option('-p, --password <password>', 'Password')
        .action(AuthCommands.login);

    auth.command('register')
        .description('Register new user account')
        .option('-f, --first-name <name>', 'First name')
        .option('-l, --last-name <name>', 'Last name')
        .option('-e, --email <email>', 'Email address')
        .option('-p, --password <password>', 'Password')
        .option('-r, --role <role>', 'Account role: user, medical_professional')
        .option('--license <number>', 'Medical license number (medical professionals)')
        .option('--specialty <specialty>', 'Medical specialty (medical professionals)')
        .option('--institution <institution>', 'Institution name (medical professionals)')
        .action(AuthCommands.register);

    auth.command('logout')
        .description('Logout and clear session')
        .action(AuthCommands.logout);

    auth.command('status')
        .description('Show authentication status')
        .action(AuthCommands.status);

    // User profile commands
    const user = program.command('user').description('👤 User profile management');
    user.command('profile')
        .description('View user profile')
        .action(UserCommands.profile);

    user.command('update')
        .description('Update user profile')
        .option('-f, --first-name <name>', 'First name')
        .option('-l, --last-name <name>', 'Last name')
        .option('--license <number>', 'Medical license number')
        .option('--specialty <specialty>', 'Medical specialty')
        .option('--institution <institution>', 'Institution name')
        .action(UserCommands.update);

    // Disease registry commands
    const diseases = program.command('diseases').description('🦠 Disease registry and information');
    diseases.command('list')
        .description('List all diseases in registry')
        .option('-c, --category <category>', 'Filter by category')
        .option('-s, --search <term>', 'Search disease names')
        .option('--limit <number>', 'Limit results')
        .action(DiseaseCommands.list);

    diseases.command('info')
        .description('Get detailed disease information')
        .argument('<disease-id>', 'Disease ID or name')
        .action(DiseaseCommands.info);

    diseases.command('categories')
        .description('List disease categories')
        .action(DiseaseCommands.categories);

    diseases.command('search')
        .description('Advanced disease search')
        .option('-q, --query <query>', 'Search query')
        .option('-c, --category <category>', 'Category filter')
        .option('--icd10 <code>', 'ICD-10 code filter')
        .option('--inheritance <pattern>', 'Inheritance pattern filter')
        .action(DiseaseCommands.search);

    // Family disease management
    const family = program.command('family').description('👨‍👩‍👧‍👦 Family disease tracking');
    family.command('list')
        .description('List family disease records')
        .option('-m, --member <member>', 'Filter by family member')
        .option('-d, --disease <disease>', 'Filter by disease')
        .action(FamilyCommands.list);

    family.command('add')
        .description('Add family disease record')
        .requiredOption('-d, --disease-id <id>', 'Disease ID')
        .requiredOption('-m, --member <member>', 'Family member (mother, father, sibling, etc.)')
        .option('-n, --name <name>', 'Family member name')
        .option('--has-disease <boolean>', 'Family member has disease (true/false)')
        .option('--confirmed <boolean>', 'Diagnosis confirmed (true/false)')
        .option('--date <date>', 'Diagnosis date (YYYY-MM-DD)')
        .option('--symptoms <symptoms>', 'Current symptoms (comma-separated)')
        .option('--past-symptoms <symptoms>', 'Past symptoms (comma-separated)')
        .option('--has-children <boolean>', 'Family member has children (true/false)')
        .option('--children-count <number>', 'Number of children')
        .option('--children-affected <boolean>', 'Children have disease (true/false)')
        .option('--notes <notes>', 'Additional notes')
        .option('--treatments <treatments>', 'Treatment history (comma-separated)')
        .action(FamilyCommands.add);

    family.command('update')
        .description('Update family disease record')
        .argument('<record-id>', 'Record ID to update')
        .option('-m, --member <member>', 'Family member')
        .option('-n, --name <name>', 'Family member name')
        .option('--has-disease <boolean>', 'Family member has disease (true/false)')
        .option('--confirmed <boolean>', 'Diagnosis confirmed (true/false)')
        .option('--date <date>', 'Diagnosis date (YYYY-MM-DD)')
        .option('--symptoms <symptoms>', 'Current symptoms (comma-separated)')
        .option('--past-symptoms <symptoms>', 'Past symptoms (comma-separated)')
        .option('--has-children <boolean>', 'Family member has children (true/false)')
        .option('--children-count <number>', 'Number of children')
        .option('--children-affected <boolean>', 'Children have disease (true/false)')
        .option('--notes <notes>', 'Additional notes')
        .option('--treatments <treatments>', 'Treatment history (comma-separated)')
        .action(FamilyCommands.update);

    family.command('delete')
        .description('Delete family disease record')
        .argument('<record-id>', 'Record ID to delete')
        .option('-y, --yes', 'Skip confirmation prompt')
        .action(FamilyCommands.delete);

    family.command('info')
        .description('Get detailed family disease record')
        .argument('<record-id>', 'Record ID')
        .action(FamilyCommands.info);

    // AI Symptom Analysis
    const symptom = program.command('symptom').description('🧠 AI-powered symptom analysis');

    symptom.command('start')
        .description('Start interactive symptom analysis')
        .action(async (options) => {
            const analysisService = new SymptomAnalysisCommands({
                baseURL: config.server_url,
                authToken: config.auth_token,
                outputFormat: config.output_format
            });
            await analysisService.startAnalysis(options);
        });

    symptom.command('history')
        .description('View analysis history')
        .option('-l, --limit <number>', 'Number of sessions to show', '10')
        .action(async (options) => {
            const analysisService = new SymptomAnalysisCommands({
                baseURL: config.server_url,
                authToken: config.auth_token,
                outputFormat: config.output_format
            });
            await analysisService.viewHistory(options);
        });

    symptom.command('view')
        .description('View specific analysis session')
        .argument('<session-id>', 'Session ID')
        .action(async (sessionId, options) => {
            const analysisService = new SymptomAnalysisCommands({
                baseURL: config.server_url,
                authToken: config.auth_token,
                outputFormat: config.output_format
            });
            await analysisService.viewSession(sessionId, options);
        });

    symptom.command('delete')
        .description('Delete analysis session')
        .argument('<session-id>', 'Session ID')
        .option('-f, --force', 'Force deletion without confirmation')
        .action(async (sessionId, options) => {
            const analysisService = new SymptomAnalysisCommands({
                baseURL: config.server_url,
                authToken: config.auth_token,
                outputFormat: config.output_format
            });
            await analysisService.deleteSession(sessionId, options);
        });

    symptom.command('export')
        .description('Export analysis results to file')
        .argument('<session-id>', 'Session ID')
        .argument('<output-file>', 'Output file path')
        .option('--format <format>', 'Export format: text, json', 'text')
        .action(async (sessionId, outputFile, options) => {
            const analysisService = new SymptomAnalysisCommands({
                baseURL: config.server_url,
                authToken: config.auth_token,
                outputFormat: config.output_format
            });
            await analysisService.exportAnalysis(sessionId, outputFile, options);
        });

    // API key management (medical professionals)
    const apikeys = program.command('apikeys').description('🔑 API key management (medical professionals only)');
    apikeys.command('list')
        .description('List API keys')
        .action(ApiKeyCommands.list);

    apikeys.command('create')
        .description('Create new API key')
        .requiredOption('-n, --name <name>', 'API key name')
        .option('-p, --permissions <permissions>', 'Comma-separated permissions')
        .option('-r, --rate-limit <limit>', 'Rate limit per hour')
        .action(ApiKeyCommands.create);

    apikeys.command('revoke')
        .description('Revoke API key')
        .argument('<key-id>', 'API key ID')
        .option('-y, --yes', 'Skip confirmation prompt')
        .action(ApiKeyCommands.revoke);

    apikeys.command('info')
        .description('Get API key information')
        .argument('<key-id>', 'API key ID')
        .action(ApiKeyCommands.info);

    // FHIR-Blockchain bridge commands
    const fhir = program.command('fhir').description('🏥 FHIR-Blockchain bridge operations');

    fhir.command('status')
        .description('Check FHIR-Blockchain bridge status')
        .action(FHIRBlockchainCommands.status);

    fhir.command('hospitals')
        .description('List connected FHIR-enabled hospitals')
        .action(FHIRBlockchainCommands.listHospitals);

    fhir.command('connect')
        .description('Connect to a FHIR-enabled hospital')
        .action(FHIRBlockchainCommands.connectHospital);

    fhir.command('import')
        .description('Import FHIR data to blockchain')
        .option('--hospital-id <id>', 'Hospital ID')
        .option('--patient-id <id>', 'Patient ID')
        .option('--wallet <address>', 'Patient wallet address for rewards')
        .action(FHIRBlockchainCommands.importData);

    fhir.command('history')
        .description('View FHIR import history')
        .option('--limit <number>', 'Number of records to show', '10')
        .option('--hospital-id <id>', 'Filter by hospital')
        .action(FHIRBlockchainCommands.history);

    fhir.command('tokens')
        .description('Check HEALTH token balance from FHIR contributions')
        .argument('<wallet-address>', 'Ethereum wallet address')
        .action(FHIRBlockchainCommands.tokenBalance);

    fhir.command('sync')
        .description('Sync FHIR data across blockchain layers')
        .option('--hospital-id <id>', 'Sync specific hospital')
        .option('--force', 'Force resync all data')
        .action(FHIRBlockchainCommands.sync);

    // Experimental batch operations
    const batch = program.command('batch').description('🚀 Experimental batch operations');
    batch.command('import')
        .description('Import data from CSV or JSON file')
        .argument('<file>', 'Input file path (.csv or .json)')
        .option('-t, --type <type>', 'Data type: diseases, family-diseases')
        .option('--dry-run', 'Preview changes without applying')
        .option('--validate-only', 'Only validate data format')
        .action(BatchCommands.import);

    batch.command('export')
        .description('Export data to CSV or JSON file')
        .argument('<output-file>', 'Output file path')
        .option('-t, --type <type>', 'Data type: diseases, family-diseases, profile')
        .option('-f, --format <format>', 'Output format: csv, json')
        .action(BatchCommands.export);

    batch.command('template')
        .description('Generate import template')
        .argument('<type>', 'Template type: family-diseases')
        .argument('<output-file>', 'Output file path')
        .option('-f, --format <format>', 'Template format: csv, json')
        .action(BatchCommands.template);

    // Configuration management
    const config_cmd = program.command('config').description('⚙️  CLI configuration management');
    config_cmd.command('show')
        .description('Show current configuration')
        .action(ConfigCommands.show);

    config_cmd.command('set')
        .description('Set configuration value')
        .argument('<key>', 'Configuration key')
        .argument('<value>', 'Configuration value')
        .action(ConfigCommands.set);

    config_cmd.command('reset')
        .description('Reset configuration to defaults')
        .option('-y, --yes', 'Skip confirmation prompt')
        .action(ConfigCommands.reset);

    // Interactive Console
    program.command('console')
        .description('🖥️  Start interactive REPL console for continuous platform access')
        .action(() => {
            console.log(chalk.blue.bold('Starting diseaseZone Interactive Console...'));
            console.log(chalk.gray('Perfect for support staff, researchers, and power users\n'));

            const console_instance = new DiseaseZoneConsole({
                server_url: config.server_url,
                auth_token: config.auth_token,
                api_key: config.api_key,
                output_format: config.output_format,
                verbose: config.verbose
            });

            console_instance.start();
        });

    // Help and information
    program.command('info')
        .description('Show platform information and statistics')
        .action(() => {
            console.log(chalk.cyan.bold('🧬 diseaseZone Platform Information'));
            console.log(chalk.gray('━'.repeat(50)));
            console.log(chalk.white('Family Disease Tracking & Medical Research Platform'));
            console.log(chalk.white('Server:', config.server_url));
            console.log(chalk.white('CLI Version:', CLI_VERSION));
            if (config.auth_token) {
                console.log(chalk.green('✓ Authenticated'));
            } else {
                console.log(chalk.red('✗ Not authenticated'));
            }
        });

    // Global error handler
    program.exitOverride();

    try {
        program.parse();
    } catch (error) {
        if (error.code === 'commander.help') {
            process.exit(0);
        } else if (error.code === 'commander.version') {
            process.exit(0);
        } else {
            console.error(chalk.red('Error:'), error.message);
            process.exit(1);
        }
    }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error(chalk.red('Unhandled Rejection:'), reason);
    process.exit(1);
});

// Initialize and run CLI
initializeCLI();