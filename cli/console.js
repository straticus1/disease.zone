/**
 * Interactive REPL Console for diseaseZone
 *
 * Provides a continuous, interactive command-line interface for:
 * - Support staff real-time assistance
 * - Researchers interactive data exploration
 * - Medical professionals dynamic patient management
 * - System administrators live debugging and maintenance
 */

const readline = require('readline');
const chalk = require('chalk');
const { program } = require('commander');
const path = require('path');
const fs = require('fs');

// Import all command modules for REPL execution
const AuthCommands = require('./auth');
const UserCommands = require('./user');
const DiseaseCommands = require('./diseases');
const FamilyCommands = require('./family');
const SymptomAnalysisCommands = require('./commands/symptom-analysis');
const ApiKeyCommands = require('./apikeys');
const BatchCommands = require('./batch');
const ConfigCommands = require('./config');

class DiseaseZoneConsole {
    constructor(config) {
        this.config = config;
        this.history = [];
        this.historyIndex = -1;
        this.commands = new Map();
        this.aliases = new Map();
        this.session = {
            startTime: new Date(),
            commandCount: 0,
            user: null,
            context: {}
        };

        this.setupCommands();
        this.setupReadline();
    }

    /**
     * Setup command registry with all available commands
     */
    setupCommands() {
        // Authentication commands
        this.registerCommand('login', 'Authenticate with diseaseZone platform', AuthCommands.login);
        this.registerCommand('register', 'Register new user account', AuthCommands.register);
        this.registerCommand('logout', 'Logout from platform', AuthCommands.logout);
        this.registerCommand('whoami', 'Show current user status', AuthCommands.status);

        // User management commands
        this.registerCommand('profile', 'Show user profile', UserCommands.profile);
        this.registerCommand('update-profile', 'Update user profile', UserCommands.update);

        // Disease registry commands
        this.registerCommand('diseases', 'List all diseases', DiseaseCommands.list);
        this.registerCommand('disease-info', 'Get disease information', DiseaseCommands.info);
        this.registerCommand('disease-categories', 'List disease categories', DiseaseCommands.categories);
        this.registerCommand('search-diseases', 'Search diseases', DiseaseCommands.search);

        // Family disease tracking commands
        this.registerCommand('family-list', 'List family diseases', FamilyCommands.list);
        this.registerCommand('family-add', 'Add family disease record', FamilyCommands.add);
        this.registerCommand('family-update', 'Update family disease record', FamilyCommands.update);
        this.registerCommand('family-delete', 'Delete family disease record', FamilyCommands.delete);
        this.registerCommand('family-info', 'Get family disease info', FamilyCommands.info);

        // AI Symptom Analysis commands
        this.registerCommand('symptom-start', 'Start symptom analysis', this.createSymptomCommand('startAnalysis'));
        this.registerCommand('symptom-history', 'View analysis history', this.createSymptomCommand('viewHistory'));
        this.registerCommand('symptom-view', 'View analysis session', this.createSymptomCommand('viewSession'));
        this.registerCommand('symptom-delete', 'Delete analysis session', this.createSymptomCommand('deleteSession'));
        this.registerCommand('symptom-export', 'Export analysis results', this.createSymptomCommand('exportAnalysis'));

        // API key management commands
        this.registerCommand('apikeys', 'List API keys', ApiKeyCommands.list);
        this.registerCommand('apikey-create', 'Create API key', ApiKeyCommands.create);
        this.registerCommand('apikey-revoke', 'Revoke API key', ApiKeyCommands.revoke);
        this.registerCommand('apikey-info', 'Get API key info', ApiKeyCommands.info);

        // Batch operations commands
        this.registerCommand('batch-import', 'Import data from file', BatchCommands.import);
        this.registerCommand('batch-export', 'Export data to file', BatchCommands.export);
        this.registerCommand('batch-template', 'Generate import template', BatchCommands.template);

        // Configuration commands
        this.registerCommand('config-show', 'Show configuration', ConfigCommands.show);
        this.registerCommand('config-set', 'Set configuration value', ConfigCommands.set);
        this.registerCommand('config-reset', 'Reset configuration', ConfigCommands.reset);

        // REPL-specific commands
        this.registerCommand('help', 'Show available commands', this.showHelp.bind(this));
        this.registerCommand('?', 'Show available commands', this.showHelp.bind(this));
        this.registerCommand('clear', 'Clear the console', this.clearConsole.bind(this));
        this.registerCommand('cls', 'Clear the console', this.clearConsole.bind(this));
        this.registerCommand('history', 'Show command history', this.showHistory.bind(this));
        this.registerCommand('session', 'Show session information', this.showSession.bind(this));
        this.registerCommand('exit', 'Exit the console', this.exit.bind(this));
        this.registerCommand('quit', 'Exit the console', this.exit.bind(this));

        // Setup command aliases for convenience
        this.addAlias('q', 'quit');
        this.addAlias('h', 'help');
        this.addAlias('ls', 'diseases');
        this.addAlias('pwd', 'session');
        this.addAlias('who', 'whoami');
        this.addAlias('fam', 'family-list');
        this.addAlias('sym', 'symptom-start');
        this.addAlias('keys', 'apikeys');
    }

    /**
     * Create symptom analysis command wrapper
     */
    createSymptomCommand(method) {
        return async (args, options) => {
            try {
                const analysisService = new SymptomAnalysisCommands({
                    baseURL: this.config.server_url,
                    authToken: this.config.auth_token,
                    outputFormat: this.config.output_format
                });

                if (method === 'viewSession' || method === 'deleteSession' || method === 'exportAnalysis') {
                    const sessionId = args[0];
                    if (!sessionId) {
                        console.log(chalk.red('Error: Session ID required'));
                        return;
                    }

                    if (method === 'exportAnalysis') {
                        const outputFile = args[1];
                        if (!outputFile) {
                            console.log(chalk.red('Error: Output file required'));
                            return;
                        }
                        await analysisService[method](sessionId, outputFile, options);
                    } else {
                        await analysisService[method](sessionId, options);
                    }
                } else {
                    await analysisService[method](options);
                }
            } catch (error) {
                console.log(chalk.red(`Error: ${error.message}`));
            }
        };
    }

    /**
     * Setup readline interface with enhanced features
     */
    setupReadline() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: this.getPrompt(),
            completer: this.completer.bind(this),
            historySize: 1000
        });

        // Setup event handlers
        this.rl.on('line', this.handleLine.bind(this));
        this.rl.on('close', this.exit.bind(this));
        this.rl.on('SIGINT', this.handleSigInt.bind(this));

        // Setup history navigation
        this.rl.input.on('keypress', this.handleKeypress.bind(this));
    }

    /**
     * Register a command in the console
     */
    registerCommand(name, description, handler) {
        this.commands.set(name, {
            name,
            description,
            handler
        });
    }

    /**
     * Add command alias
     */
    addAlias(alias, command) {
        this.aliases.set(alias, command);
    }

    /**
     * Get console prompt with context
     */
    getPrompt() {
        const user = this.config.auth_token ?
            chalk.green(`[${this.session.user || 'authenticated'}]`) :
            chalk.red('[anonymous]');

        const server = chalk.blue(new URL(this.config.server_url).hostname);

        return `${user}@${server} ${chalk.yellow('>'))} `;
    }

    /**
     * Handle command line input
     */
    async handleLine(line) {
        const input = line.trim();

        if (!input) {
            this.rl.prompt();
            return;
        }

        // Add to history
        this.history.push(input);
        this.historyIndex = this.history.length;
        this.session.commandCount++;

        // Parse command and arguments
        const parts = this.parseCommand(input);
        const commandName = parts[0];
        const args = parts.slice(1);

        try {
            await this.executeCommand(commandName, args);
        } catch (error) {
            console.log(chalk.red(`Error executing command: ${error.message}`));
        }

        this.rl.prompt();
    }

    /**
     * Parse command line into command and arguments
     */
    parseCommand(input) {
        // Simple parser - could be enhanced for complex argument handling
        const parts = input.split(/\s+/);
        return parts.filter(part => part.length > 0);
    }

    /**
     * Execute a command
     */
    async executeCommand(commandName, args) {
        // Check for alias
        const actualCommand = this.aliases.get(commandName) || commandName;

        // Get command
        const command = this.commands.get(actualCommand);

        if (!command) {
            console.log(chalk.red(`Unknown command: ${commandName}`));
            console.log(chalk.yellow('Type "help" to see available commands'));
            return;
        }

        // Parse arguments into options (simple implementation)
        const options = this.parseOptions(args);

        // Execute command
        try {
            await command.handler(args, options);
        } catch (error) {
            console.log(chalk.red(`Command failed: ${error.message}`));
        }
    }

    /**
     * Simple option parsing
     */
    parseOptions(args) {
        const options = {};
        const positionalArgs = [];

        for (let i = 0; i < args.length; i++) {
            const arg = args[i];

            if (arg.startsWith('--')) {
                const key = arg.substring(2);
                const nextArg = args[i + 1];

                if (nextArg && !nextArg.startsWith('-')) {
                    options[key] = nextArg;
                    i++; // Skip next argument
                } else {
                    options[key] = true;
                }
            } else if (arg.startsWith('-')) {
                const key = arg.substring(1);
                options[key] = true;
            } else {
                positionalArgs.push(arg);
            }
        }

        return options;
    }

    /**
     * Tab completion
     */
    completer(line) {
        const parts = line.split(/\s+/);
        const isFirstWord = parts.length <= 1;

        if (isFirstWord) {
            // Complete command names
            const commands = Array.from(this.commands.keys());
            const aliases = Array.from(this.aliases.keys());
            const allCommands = [...commands, ...aliases];

            const hits = allCommands.filter(cmd => cmd.startsWith(line));
            return [hits, line];
        }

        // Could add more sophisticated completion for arguments
        return [[], line];
    }

    /**
     * Handle keypress for history navigation
     */
    handleKeypress(str, key) {
        if (!key) return;

        // Up arrow - previous command
        if (key.name === 'up') {
            if (this.historyIndex > 0) {
                this.historyIndex--;
                const command = this.history[this.historyIndex];
                this.rl.line = command;
                this.rl.cursor = command.length;
                this.rl._refreshLine();
            }
        }

        // Down arrow - next command
        else if (key.name === 'down') {
            if (this.historyIndex < this.history.length - 1) {
                this.historyIndex++;
                const command = this.history[this.historyIndex];
                this.rl.line = command;
                this.rl.cursor = command.length;
                this.rl._refreshLine();
            } else if (this.historyIndex === this.history.length - 1) {
                this.historyIndex = this.history.length;
                this.rl.line = '';
                this.rl.cursor = 0;
                this.rl._refreshLine();
            }
        }
    }

    /**
     * Handle Ctrl+C
     */
    handleSigInt() {
        console.log('\nPress Ctrl+C again to exit, or type "exit" to quit gracefully');
        this.rl.prompt();
    }

    /**
     * Show help information
     */
    async showHelp() {
        console.log(chalk.blue.bold('\n🧬 diseaseZone Interactive Console'));
        console.log(chalk.blue('=====================================\n'));

        console.log(chalk.yellow.bold('AUTHENTICATION:'));
        console.log('  login              Authenticate with platform');
        console.log('  register           Register new user account');
        console.log('  logout             Logout from platform');
        console.log('  whoami (who)       Show current user status\n');

        console.log(chalk.yellow.bold('USER MANAGEMENT:'));
        console.log('  profile            Show user profile');
        console.log('  update-profile     Update user profile\n');

        console.log(chalk.yellow.bold('DISEASE REGISTRY:'));
        console.log('  diseases (ls)      List all diseases');
        console.log('  disease-info       Get disease information');
        console.log('  disease-categories List disease categories');
        console.log('  search-diseases    Search diseases\n');

        console.log(chalk.yellow.bold('FAMILY TRACKING:'));
        console.log('  family-list (fam)  List family diseases');
        console.log('  family-add         Add family disease record');
        console.log('  family-update      Update family disease record');
        console.log('  family-delete      Delete family disease record');
        console.log('  family-info        Get family disease info\n');

        console.log(chalk.yellow.bold('AI SYMPTOM ANALYSIS:'));
        console.log('  symptom-start (sym) Start symptom analysis');
        console.log('  symptom-history     View analysis history');
        console.log('  symptom-view        View analysis session');
        console.log('  symptom-delete      Delete analysis session');
        console.log('  symptom-export      Export analysis results\n');

        console.log(chalk.yellow.bold('API KEYS:'));
        console.log('  apikeys (keys)     List API keys');
        console.log('  apikey-create      Create API key');
        console.log('  apikey-revoke      Revoke API key');
        console.log('  apikey-info        Get API key info\n');

        console.log(chalk.yellow.bold('BATCH OPERATIONS:'));
        console.log('  batch-import       Import data from file');
        console.log('  batch-export       Export data to file');
        console.log('  batch-template     Generate import template\n');

        console.log(chalk.yellow.bold('CONFIGURATION:'));
        console.log('  config-show        Show configuration');
        console.log('  config-set         Set configuration value');
        console.log('  config-reset       Reset configuration\n');

        console.log(chalk.yellow.bold('CONSOLE:'));
        console.log('  help (h, ?)        Show this help');
        console.log('  clear (cls)        Clear the console');
        console.log('  history            Show command history');
        console.log('  session (pwd)      Show session information');
        console.log('  exit (quit, q)     Exit the console\n');

        console.log(chalk.green.bold('TIPS:'));
        console.log('  - Use Tab for command completion');
        console.log('  - Use Up/Down arrows for command history');
        console.log('  - Commands support --flags and arguments');
        console.log('  - Type Ctrl+C twice to force exit\n');
    }

    /**
     * Clear console
     */
    async clearConsole() {
        console.clear();
        this.showWelcome();
    }

    /**
     * Show command history
     */
    async showHistory() {
        console.log(chalk.blue.bold('\n📚 Command History\n'));

        if (this.history.length === 0) {
            console.log(chalk.yellow('No commands executed yet.'));
            return;
        }

        this.history.slice(-20).forEach((command, index) => {
            const num = this.history.length - 20 + index + 1;
            console.log(`${chalk.gray(num.toString().padStart(3))} ${command}`);
        });
        console.log();
    }

    /**
     * Show session information
     */
    async showSession() {
        const uptime = Math.floor((new Date() - this.session.startTime) / 1000);
        const minutes = Math.floor(uptime / 60);
        const seconds = uptime % 60;

        console.log(chalk.blue.bold('\n📊 Session Information\n'));
        console.log(`Server:           ${this.config.server_url}`);
        console.log(`Authentication:   ${this.config.auth_token ? chalk.green('✓ Authenticated') : chalk.red('✗ Not authenticated')}`);
        console.log(`Output Format:    ${this.config.output_format}`);
        console.log(`Session Started:  ${this.session.startTime.toLocaleString()}`);
        console.log(`Session Uptime:   ${minutes}m ${seconds}s`);
        console.log(`Commands Run:     ${this.session.commandCount}`);
        console.log(`History Size:     ${this.history.length}`);
        console.log();
    }

    /**
     * Show welcome message
     */
    showWelcome() {
        console.log(chalk.blue.bold('\n🧬 Welcome to diseaseZone Interactive Console'));
        console.log(chalk.blue('============================================\n'));
        console.log(chalk.white('Interactive REPL interface for comprehensive disease tracking and analysis.\n'));

        if (this.config.auth_token) {
            console.log(chalk.green('✓ You are authenticated and ready to use all features.'));
        } else {
            console.log(chalk.yellow('⚠ You are not authenticated. Use "login" to access personal features.'));
        }

        console.log(chalk.cyan('\nType "help" or "?" to see available commands.'));
        console.log(chalk.cyan('Use Tab for completion and Up/Down arrows for history.\n'));
    }

    /**
     * Start the console
     */
    start() {
        console.clear();
        this.showWelcome();

        // Update session with user info if authenticated
        if (this.config.auth_token) {
            // Could make API call to get user info
            this.session.user = 'user';
        }

        this.rl.prompt();
    }

    /**
     * Exit the console
     */
    exit() {
        console.log(chalk.blue('\n👋 Thanks for using diseaseZone Console!'));
        console.log(chalk.gray(`Session lasted ${Math.floor((new Date() - this.session.startTime) / 1000 / 60)} minutes`));
        console.log(chalk.gray(`Commands executed: ${this.session.commandCount}\n`));

        this.rl.close();
        process.exit(0);
    }
}

module.exports = DiseaseZoneConsole;