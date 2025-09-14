const chalk = require('chalk');
const axios = require('axios');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

function getServerUrl() {
    return global.dzConfig.server_url || 'http://localhost:3000';
}

async function login(options) {
    try {
        let email = options.email;
        let password = options.password;

        // Interactive input if not provided
        if (!email) {
            email = await question('Email: ');
        }
        if (!password) {
            process.stdout.write('Password: ');
            process.stdin.setRawMode(true);
            password = '';
            for await (const chunk of process.stdin) {
                const char = chunk.toString();
                if (char === '\r' || char === '\n') {
                    break;
                } else if (char === '\b' || char === '\x7f') {
                    if (password.length > 0) {
                        password = password.slice(0, -1);
                        process.stdout.write('\b \b');
                    }
                } else {
                    password += char;
                    process.stdout.write('*');
                }
            }
            process.stdin.setRawMode(false);
            console.log('');
        }

        const response = await axios.post(`${getServerUrl()}/api/auth/login`, {
            email,
            password
        });

        if (response.data.success) {
            global.dzConfig.auth_token = response.data.token;
            global.dzConfig.user_email = email;
            global.dzConfig.user_role = response.data.user.role;
            global.dzSaveConfig();

            console.log(chalk.green('✓ Login successful!'));
            console.log(chalk.white('User:', response.data.user.first_name, response.data.user.last_name));
            console.log(chalk.white('Role:', response.data.user.role));
            if (response.data.user.role === 'medical_professional') {
                console.log(chalk.white('Specialty:', response.data.user.medical_specialty || 'Not specified'));
            }
        }
    } catch (error) {
        if (error.response) {
            console.error(chalk.red('✗ Login failed:'), error.response.data.error || error.response.data.message);
        } else {
            console.error(chalk.red('✗ Login failed:'), error.message);
        }
        process.exit(1);
    } finally {
        rl.close();
    }
}

async function register(options) {
    try {
        let userData = {};

        // Interactive input for missing fields
        userData.first_name = options.firstName || await question('First Name: ');
        userData.last_name = options.lastName || await question('Last Name: ');
        userData.email = options.email || await question('Email: ');

        if (!options.password) {
            process.stdout.write('Password: ');
            process.stdin.setRawMode(true);
            userData.password = '';
            for await (const chunk of process.stdin) {
                const char = chunk.toString();
                if (char === '\r' || char === '\n') {
                    break;
                } else if (char === '\b' || char === '\x7f') {
                    if (userData.password.length > 0) {
                        userData.password = userData.password.slice(0, -1);
                        process.stdout.write('\b \b');
                    }
                } else {
                    userData.password += char;
                    process.stdout.write('*');
                }
            }
            process.stdin.setRawMode(false);
            console.log('');
        } else {
            userData.password = options.password;
        }

        if (!options.role) {
            console.log(chalk.cyan('Account Types:'));
            console.log('1. User - Track family health');
            console.log('2. Medical Professional - Update disease data');
            const roleChoice = await question('Choose account type (1-2): ');
            userData.role = roleChoice === '2' ? 'medical_professional' : 'user';
        } else {
            userData.role = options.role;
        }

        // Medical professional fields
        if (userData.role === 'medical_professional') {
            userData.medical_license_number = options.license || await question('Medical License Number: ');
            userData.medical_specialty = options.specialty || await question('Medical Specialty: ');
            userData.institution_name = options.institution || await question('Institution/Hospital: ');
        }

        const response = await axios.post(`${getServerUrl()}/api/auth/register`, userData);

        if (response.data.success) {
            global.dzConfig.auth_token = response.data.token;
            global.dzConfig.user_email = userData.email;
            global.dzConfig.user_role = userData.role;
            global.dzSaveConfig();

            console.log(chalk.green('✓ Registration successful!'));
            console.log(chalk.white('Welcome to diseaseZone,'), userData.first_name + '!');
            console.log(chalk.white('Role:', userData.role));
        }
    } catch (error) {
        if (error.response) {
            console.error(chalk.red('✗ Registration failed:'), error.response.data.error || error.response.data.message);
        } else {
            console.error(chalk.red('✗ Registration failed:'), error.message);
        }
        process.exit(1);
    } finally {
        rl.close();
    }
}

async function logout() {
    try {
        if (!global.dzConfig.auth_token) {
            console.log(chalk.yellow('⚠ Not currently logged in'));
            return;
        }

        await axios.post(`${getServerUrl()}/api/auth/logout`, {}, {
            headers: {
                'Authorization': `Bearer ${global.dzConfig.auth_token}`
            }
        });

        global.dzConfig.auth_token = null;
        global.dzConfig.user_email = null;
        global.dzConfig.user_role = null;
        global.dzSaveConfig();

        console.log(chalk.green('✓ Logged out successfully'));
    } catch (error) {
        // Clear local session even if server request fails
        global.dzConfig.auth_token = null;
        global.dzConfig.user_email = null;
        global.dzConfig.user_role = null;
        global.dzSaveConfig();

        console.log(chalk.green('✓ Local session cleared'));
    }
}

async function status() {
    if (!global.dzConfig.auth_token) {
        console.log(chalk.red('✗ Not authenticated'));
        console.log(chalk.gray('Use "diseasezone auth login" to log in'));
        return;
    }

    try {
        const response = await axios.get(`${getServerUrl()}/api/user/profile`, {
            headers: {
                'Authorization': `Bearer ${global.dzConfig.auth_token}`
            }
        });

        if (response.data.success) {
            const user = response.data.user;
            console.log(chalk.green('✓ Authenticated'));
            console.log(chalk.gray('━'.repeat(30)));
            console.log(chalk.white('Name:'), user.first_name, user.last_name);
            console.log(chalk.white('Email:'), user.email);
            console.log(chalk.white('Role:'), user.role);
            if (user.role === 'medical_professional') {
                console.log(chalk.white('License:'), user.medical_license_number || 'Not specified');
                console.log(chalk.white('Specialty:'), user.medical_specialty || 'Not specified');
                console.log(chalk.white('Institution:'), user.institution_name || 'Not specified');
            }
            console.log(chalk.white('Created:'), new Date(user.created_at).toLocaleDateString());
        }
    } catch (error) {
        console.log(chalk.red('✗ Authentication token invalid'));
        console.log(chalk.gray('Use "diseasezone auth login" to log in again'));

        // Clear invalid token
        global.dzConfig.auth_token = null;
        global.dzConfig.user_email = null;
        global.dzConfig.user_role = null;
        global.dzSaveConfig();
    }
}

module.exports = {
    login,
    register,
    logout,
    status
};