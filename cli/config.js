const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const CLI_CONFIG_PATH = path.join(require('os').homedir(), '.diseasezone');

function show() {
    console.log(chalk.cyan.bold('⚙️  CLI Configuration'));
    console.log(chalk.gray('━'.repeat(40)));

    const config = global.dzConfig;

    console.log(chalk.white('Server URL:'), config.server_url);
    console.log(chalk.white('Output Format:'), config.output_format);
    console.log(chalk.white('Verbose Mode:'), config.verbose ? chalk.green('Enabled') : chalk.gray('Disabled'));
    console.log(chalk.white('Authenticated:'), config.auth_token ? chalk.green('Yes') : chalk.red('No'));

    if (config.auth_token) {
        console.log(chalk.white('User Email:'), config.user_email || 'Unknown');
        console.log(chalk.white('User Role:'), config.user_role || 'Unknown');
    }

    if (config.api_key) {
        console.log(chalk.white('API Key:'), 'Set (hidden)');
    }

    console.log(chalk.gray('\nConfig file:'), CLI_CONFIG_PATH);
    console.log(chalk.gray('File exists:'), fs.existsSync(CLI_CONFIG_PATH) ? chalk.green('Yes') : chalk.red('No'));
}

function set(key, value) {
    const validKeys = [
        'server_url',
        'output_format',
        'verbose'
    ];

    if (!validKeys.includes(key)) {
        console.error(chalk.red('✗ Invalid configuration key:'), key);
        console.log(chalk.gray('Valid keys:'), validKeys.join(', '));
        process.exit(1);
    }

    // Validate values
    if (key === 'output_format' && !['table', 'json', 'csv'].includes(value)) {
        console.error(chalk.red('✗ Invalid output format:'), value);
        console.log(chalk.gray('Valid formats: table, json, csv'));
        process.exit(1);
    }

    if (key === 'verbose') {
        value = ['true', '1', 'yes'].includes(value.toLowerCase());
    }

    if (key === 'server_url') {
        // Validate URL format
        try {
            new URL(value);
        } catch (error) {
            console.error(chalk.red('✗ Invalid URL format:'), value);
            process.exit(1);
        }
    }

    global.dzConfig[key] = value;
    global.dzSaveConfig();

    console.log(chalk.green('✓ Configuration updated'));
    console.log(chalk.white(`${key}:`), value);
}

async function reset(options) {
    if (!options.yes) {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const answer = await new Promise(resolve => {
            rl.question(chalk.yellow('Are you sure you want to reset all configuration to defaults? This will log you out. (y/N): '), resolve);
        });

        rl.close();

        if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
            console.log(chalk.gray('Reset cancelled'));
            return;
        }
    }

    // Reset to defaults
    const defaultConfig = {
        server_url: 'http://localhost:3000',
        output_format: 'table',
        verbose: false,
        auth_token: null,
        user_email: null,
        user_role: null,
        api_key: null
    };

    global.dzConfig = defaultConfig;

    // Delete config file
    try {
        if (fs.existsSync(CLI_CONFIG_PATH)) {
            fs.unlinkSync(CLI_CONFIG_PATH);
        }
    } catch (error) {
        console.error(chalk.red('Warning: Could not delete config file:'), error.message);
    }

    // Save new defaults
    global.dzSaveConfig();

    console.log(chalk.green('✓ Configuration reset to defaults'));
    console.log(chalk.gray('You will need to log in again to use authenticated features'));
}

module.exports = {
    show,
    set,
    reset
};