const chalk = require('chalk');
const axios = require('axios');
const readline = require('readline');

function getServerUrl() {
    return global.dzConfig.server_url || 'http://localhost:3000';
}

function requireAuth() {
    if (!global.dzConfig.auth_token) {
        console.error(chalk.red('✗ Authentication required'));
        console.log(chalk.gray('Use "diseasezone auth login" to log in'));
        process.exit(1);
    }
}

function requireMedicalProfessional() {
    requireAuth();
    if (global.dzConfig.user_role !== 'medical_professional') {
        console.error(chalk.red('✗ Medical professional account required'));
        console.log(chalk.gray('API key management is only available for medical professionals'));
        process.exit(1);
    }
}

function getAuthHeaders() {
    return {
        'Authorization': `Bearer ${global.dzConfig.auth_token}`
    };
}

function formatTable(data, columns) {
    if (!data || data.length === 0) {
        console.log(chalk.gray('No API keys found'));
        return;
    }

    const format = global.dzConfig.output_format || 'table';

    if (format === 'json') {
        console.log(JSON.stringify(data, null, 2));
        return;
    }

    if (format === 'csv') {
        console.log(columns.map(col => col.header).join(','));
        data.forEach(row => {
            console.log(columns.map(col => {
                const value = col.key.split('.').reduce((obj, key) => obj?.[key], row) || '';
                return `"${String(value).replace(/"/g, '""')}"`;
            }).join(','));
        });
        return;
    }

    // Table format (default)
    const colWidths = columns.map(col => {
        const headerWidth = col.header.length;
        const maxDataWidth = Math.max(...data.map(row => {
            const value = col.key.split('.').reduce((obj, key) => obj?.[key], row) || '';
            return String(value).length;
        }));
        return Math.min(Math.max(headerWidth, maxDataWidth), col.maxWidth || 50);
    });

    // Header
    const headerRow = columns.map((col, i) =>
        chalk.cyan.bold(col.header.padEnd(colWidths[i]))
    ).join(' │ ');
    console.log(headerRow);
    console.log(chalk.gray('─'.repeat(headerRow.length - headerRow.replace(/\u001b\[[0-9;]*m/g, '').length + headerRow.replace(/\u001b\[[0-9;]*m/g, '').length)));

    // Data rows
    data.forEach(row => {
        const dataRow = columns.map((col, i) => {
            const value = col.key.split('.').reduce((obj, key) => obj?.[key], row) || '';
            let displayValue = String(value);
            if (displayValue.length > colWidths[i]) {
                displayValue = displayValue.slice(0, colWidths[i] - 3) + '...';
            }
            return displayValue.padEnd(colWidths[i]);
        }).join(' │ ');
        console.log(dataRow);
    });
}

async function list() {
    requireMedicalProfessional();

    try {
        const response = await axios.get(`${getServerUrl()}/api/user/api-keys`, {
            headers: getAuthHeaders()
        });

        if (response.data.success) {
            const apiKeys = response.data.api_keys;

            console.log(chalk.cyan.bold(`🔑 API Keys (${apiKeys.length} keys)`));
            console.log(chalk.gray('━'.repeat(60)));

            if (apiKeys.length === 0) {
                console.log(chalk.gray('No API keys found'));
                console.log(chalk.gray('Use "diseasezone apikeys create" to create your first API key'));
                return;
            }

            // Format API keys for display
            const formattedKeys = apiKeys.map(key => ({
                ...key,
                status: key.is_active ? 'Active' : 'Revoked',
                permissions_display: Array.isArray(key.permissions) ? key.permissions.join(', ') : key.permissions,
                created_at_display: new Date(key.created_at).toLocaleDateString(),
                last_used_display: key.last_used ? new Date(key.last_used).toLocaleDateString() : 'Never'
            }));

            formatTable(formattedKeys, [
                { header: 'ID', key: 'id', maxWidth: 5 },
                { header: 'Name', key: 'name', maxWidth: 20 },
                { header: 'Status', key: 'status', maxWidth: 8 },
                { header: 'Rate Limit', key: 'rate_limit_per_hour', maxWidth: 10 },
                { header: 'Created', key: 'created_at_display', maxWidth: 12 },
                { header: 'Last Used', key: 'last_used_display', maxWidth: 12 }
            ]);

            console.log(chalk.gray('\nUse "diseasezone apikeys info <key-id>" for detailed information'));
            console.log(chalk.gray('Use "diseasezone apikeys create" to create a new API key'));
        }
    } catch (error) {
        if (error.response && error.response.status === 401) {
            console.error(chalk.red('✗ Authentication token invalid'));
            console.log(chalk.gray('Use "diseasezone auth login" to log in again'));
        } else if (error.response && error.response.status === 403) {
            console.error(chalk.red('✗ Access denied'));
            console.log(chalk.gray('API key management is only available for medical professionals'));
        } else if (error.response) {
            console.error(chalk.red('✗ Error:'), error.response.data.error || error.response.data.message);
        } else {
            console.error(chalk.red('✗ Error:'), error.message);
        }
        process.exit(1);
    }
}

async function create(options) {
    requireMedicalProfessional();

    try {
        const keyData = {
            name: options.name,
            permissions: options.permissions ? options.permissions.split(',').map(p => p.trim()) : ['read_all_data'],
            rate_limit: options.rateLimit ? parseInt(options.rateLimit) : 1000
        };

        console.log(chalk.cyan('Creating new API key...'));
        console.log(chalk.gray('Name:'), keyData.name);
        console.log(chalk.gray('Permissions:'), keyData.permissions.join(', '));
        console.log(chalk.gray('Rate Limit:'), keyData.rate_limit, 'requests/hour');

        const response = await axios.post(`${getServerUrl()}/api/user/api-keys`, keyData, {
            headers: getAuthHeaders()
        });

        if (response.data.success) {
            const apiKey = response.data.api_key;

            console.log(chalk.green('✓ API key created successfully'));
            console.log(chalk.gray('━'.repeat(50)));
            console.log(chalk.white('Key ID:'), apiKey.id);
            console.log(chalk.white('Name:'), apiKey.name);
            console.log(chalk.yellow.bold('API Key:'), apiKey.key);
            console.log(chalk.white('Permissions:'), apiKey.permissions.join(', '));
            console.log(chalk.white('Rate Limit:'), apiKey.rate_limit_per_hour, 'requests/hour');

            console.log(chalk.yellow('\n⚠️  IMPORTANT: Save this API key now!'));
            console.log(chalk.gray('You will not be able to see the full key again.'));
            console.log(chalk.gray('Use this key in your API requests as a Bearer token.'));

            console.log(chalk.cyan('\nExample usage:'));
            console.log(chalk.gray('curl -H "Authorization: Bearer ' + apiKey.key + '" \\'));
            console.log(chalk.gray('     ' + getServerUrl() + '/api/diseases'));
        }
    } catch (error) {
        if (error.response && error.response.status === 401) {
            console.error(chalk.red('✗ Authentication token invalid'));
            console.log(chalk.gray('Use "diseasezone auth login" to log in again'));
        } else if (error.response && error.response.status === 403) {
            console.error(chalk.red('✗ Access denied'));
            console.log(chalk.gray('API key management is only available for medical professionals'));
        } else if (error.response) {
            console.error(chalk.red('✗ Error:'), error.response.data.error || error.response.data.message);
        } else {
            console.error(chalk.red('✗ Error:'), error.message);
        }
        process.exit(1);
    }
}

async function revoke(keyId, options) {
    requireMedicalProfessional();

    try {
        if (!options.yes) {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            const answer = await new Promise(resolve => {
                rl.question(chalk.yellow(`Are you sure you want to revoke API key #${keyId}? This action cannot be undone. (y/N): `), resolve);
            });

            rl.close();

            if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
                console.log(chalk.gray('Revocation cancelled'));
                return;
            }
        }

        const response = await axios.delete(`${getServerUrl()}/api/user/api-keys/${keyId}`, {
            headers: getAuthHeaders()
        });

        if (response.data.success) {
            console.log(chalk.green(`✓ API key #${keyId} revoked successfully`));
            console.log(chalk.gray('The API key is now inactive and cannot be used for API requests'));
        }
    } catch (error) {
        if (error.response && error.response.status === 401) {
            console.error(chalk.red('✗ Authentication token invalid'));
            console.log(chalk.gray('Use "diseasezone auth login" to log in again'));
        } else if (error.response && error.response.status === 403) {
            console.error(chalk.red('✗ Access denied'));
            console.log(chalk.gray('API key management is only available for medical professionals'));
        } else if (error.response && error.response.status === 404) {
            console.error(chalk.red('✗ API key not found'));
        } else if (error.response) {
            console.error(chalk.red('✗ Error:'), error.response.data.error || error.response.data.message);
        } else {
            console.error(chalk.red('✗ Error:'), error.message);
        }
        process.exit(1);
    }
}

async function info(keyId) {
    requireMedicalProfessional();

    try {
        const response = await axios.get(`${getServerUrl()}/api/user/api-keys`, {
            headers: getAuthHeaders()
        });

        if (!response.data.success) {
            throw new Error('Failed to fetch API keys');
        }

        const apiKey = response.data.api_keys.find(key => key.id == keyId);
        if (!apiKey) {
            console.error(chalk.red('✗ API key not found'));
            process.exit(1);
        }

        console.log(chalk.cyan.bold(`🔑 API Key #${apiKey.id} Information`));
        console.log(chalk.gray('━'.repeat(50)));

        console.log(chalk.white('Name:'), apiKey.name);
        console.log(chalk.white('Status:'), apiKey.is_active ? chalk.green('Active') : chalk.red('Revoked'));
        console.log(chalk.white('Key Preview:'), apiKey.key_prefix + '...' + apiKey.key_suffix);

        console.log(chalk.white('Permissions:'));
        const permissions = Array.isArray(apiKey.permissions) ? apiKey.permissions : [apiKey.permissions];
        permissions.forEach(permission => {
            console.log(chalk.gray(`  • ${permission}`));
        });

        console.log(chalk.white('Rate Limit:'), apiKey.rate_limit_per_hour, 'requests/hour');
        console.log(chalk.white('Usage Count:'), apiKey.usage_count || 0, 'requests');

        console.log(chalk.gray('\nCreated:'), new Date(apiKey.created_at).toLocaleString());
        console.log(chalk.gray('Last Used:'), apiKey.last_used ? new Date(apiKey.last_used).toLocaleString() : 'Never');

        if (apiKey.last_used_ip) {
            console.log(chalk.gray('Last Used IP:'), apiKey.last_used_ip);
        }

        if (!apiKey.is_active) {
            console.log(chalk.gray('Revoked:'), apiKey.revoked_at ? new Date(apiKey.revoked_at).toLocaleString() : 'Unknown');
        }

        // Show usage statistics if available
        if (apiKey.usage_count > 0) {
            console.log(chalk.cyan('\nUsage Statistics:'));
            console.log(chalk.white('Total Requests:'), apiKey.usage_count);
            if (apiKey.last_used) {
                const daysSinceLastUse = Math.floor((Date.now() - new Date(apiKey.last_used)) / (1000 * 60 * 60 * 24));
                console.log(chalk.white('Days Since Last Use:'), daysSinceLastUse);
            }
        }

        console.log(chalk.cyan('\nExample Usage:'));
        console.log(chalk.gray('curl -H "Authorization: Bearer YOUR_API_KEY" \\'));
        console.log(chalk.gray('     ' + getServerUrl() + '/api/diseases'));

    } catch (error) {
        if (error.response && error.response.status === 401) {
            console.error(chalk.red('✗ Authentication token invalid'));
            console.log(chalk.gray('Use "diseasezone auth login" to log in again'));
        } else if (error.response && error.response.status === 403) {
            console.error(chalk.red('✗ Access denied'));
            console.log(chalk.gray('API key management is only available for medical professionals'));
        } else if (error.response) {
            console.error(chalk.red('✗ Error:'), error.response.data.error || error.response.data.message);
        } else {
            console.error(chalk.red('✗ Error:'), error.message);
        }
        process.exit(1);
    }
}

module.exports = {
    list,
    create,
    revoke,
    info
};