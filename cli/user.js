const chalk = require('chalk');
const axios = require('axios');

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

function getAuthHeaders() {
    return {
        'Authorization': `Bearer ${global.dzConfig.auth_token}`
    };
}

async function profile() {
    requireAuth();

    try {
        const response = await axios.get(`${getServerUrl()}/api/user/profile`, {
            headers: getAuthHeaders()
        });

        if (response.data.success) {
            const user = response.data.user;

            console.log(chalk.cyan.bold('👤 User Profile'));
            console.log(chalk.gray('━'.repeat(40)));
            console.log(chalk.white('Name:'), user.first_name, user.last_name);
            console.log(chalk.white('Email:'), user.email);
            console.log(chalk.white('Role:'), user.role);
            console.log(chalk.white('User ID:'), user.id);
            console.log(chalk.white('Created:'), new Date(user.created_at).toLocaleDateString());
            console.log(chalk.white('Last Login:'), user.last_login ? new Date(user.last_login).toLocaleString() : 'Never');

            if (user.role === 'medical_professional') {
                console.log(chalk.gray('━'.repeat(40)));
                console.log(chalk.cyan('🩺 Medical Professional Details'));
                console.log(chalk.white('License Number:'), user.medical_license_number || 'Not specified');
                console.log(chalk.white('Specialty:'), user.medical_specialty || 'Not specified');
                console.log(chalk.white('Institution:'), user.institution_name || 'Not specified');
                console.log(chalk.white('Verification Status:'), user.is_verified ? chalk.green('Verified') : chalk.yellow('Pending'));
            }

            // Show API keys count if medical professional
            if (user.role === 'medical_professional') {
                try {
                    const apiKeysResponse = await axios.get(`${getServerUrl()}/api/user/api-keys`, {
                        headers: getAuthHeaders()
                    });
                    if (apiKeysResponse.data.success) {
                        console.log(chalk.white('Active API Keys:'), apiKeysResponse.data.api_keys.length);
                    }
                } catch (error) {
                    // Silent fail for API keys count
                }
            }

            // Show family disease records count
            try {
                const familyResponse = await axios.get(`${getServerUrl()}/api/user/family-diseases`, {
                    headers: getAuthHeaders()
                });
                if (familyResponse.data.success) {
                    console.log(chalk.white('Family Disease Records:'), familyResponse.data.family_diseases.length);
                }
            } catch (error) {
                // Silent fail for family diseases count
            }
        }
    } catch (error) {
        if (error.response && error.response.status === 401) {
            console.error(chalk.red('✗ Authentication token invalid'));
            console.log(chalk.gray('Use "diseasezone auth login" to log in again'));
        } else if (error.response) {
            console.error(chalk.red('✗ Error:'), error.response.data.error || error.response.data.message);
        } else {
            console.error(chalk.red('✗ Error:'), error.message);
        }
        process.exit(1);
    }
}

async function update(options) {
    requireAuth();

    try {
        const updateData = {};

        if (options.firstName) updateData.first_name = options.firstName;
        if (options.lastName) updateData.last_name = options.lastName;
        if (options.license) updateData.medical_license_number = options.license;
        if (options.specialty) updateData.medical_specialty = options.specialty;
        if (options.institution) updateData.institution_name = options.institution;

        if (Object.keys(updateData).length === 0) {
            console.error(chalk.red('✗ No update fields specified'));
            console.log(chalk.gray('Available options: --first-name, --last-name, --license, --specialty, --institution'));
            process.exit(1);
        }

        const response = await axios.put(`${getServerUrl()}/api/user/profile`, updateData, {
            headers: getAuthHeaders()
        });

        if (response.data.success) {
            console.log(chalk.green('✓ Profile updated successfully'));

            // Show updated fields
            console.log(chalk.gray('Updated fields:'));
            for (const [key, value] of Object.entries(updateData)) {
                const displayKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                console.log(chalk.white(`  ${displayKey}:`), value);
            }
        }
    } catch (error) {
        if (error.response && error.response.status === 401) {
            console.error(chalk.red('✗ Authentication token invalid'));
            console.log(chalk.gray('Use "diseasezone auth login" to log in again'));
        } else if (error.response) {
            console.error(chalk.red('✗ Error:'), error.response.data.error || error.response.data.message);
        } else {
            console.error(chalk.red('✗ Error:'), error.message);
        }
        process.exit(1);
    }
}

module.exports = {
    profile,
    update
};