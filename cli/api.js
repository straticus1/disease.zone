const axios = require('axios');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

/**
 * Comprehensive API Commands for diseaseZone CLI
 * Supports all platform features with JSON file input/output
 */
class ApiCommands {
    constructor() {
        this.config = global.dzConfig || {};
        this.baseURL = this.config.server_url || 'http://localhost:3000';
        this.outputFormat = this.config.output_format || 'table';
    }

    /**
     * Get authentication headers
     */
    getHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };

        if (this.config.auth_token) {
            headers['Authorization'] = `Bearer ${this.config.auth_token}`;
        }

        if (this.config.api_key) {
            headers['X-API-Key'] = this.config.api_key;
        }

        return headers;
    }

    /**
     * Make API request
     */
    async makeRequest(method, endpoint, data = null, customHeaders = {}) {
        try {
            const config = {
                method,
                url: `${this.baseURL}${endpoint}`,
                headers: { ...this.getHeaders(), ...customHeaders },
                timeout: 30000
            };

            if (data) {
                config.data = data;
            }

            const response = await axios(config);
            return response.data;

        } catch (error) {
            if (error.response) {
                throw new Error(`API Error: ${error.response.status} - ${error.response.data?.message || error.response.statusText}`);
            } else if (error.request) {
                throw new Error('Network Error: Could not reach server');
            } else {
                throw new Error(`Request Error: ${error.message}`);
            }
        }
    }

    /**
     * Format and display output
     */
    displayOutput(data, title = null) {
        if (title) {
            console.log(chalk.cyan.bold(title));
            console.log(chalk.gray('━'.repeat(50)));
        }

        switch (this.outputFormat) {
            case 'json':
                console.log(JSON.stringify(data, null, 2));
                break;
            case 'csv':
                this.displayCSV(data);
                break;
            default:
                this.displayTable(data);
        }
    }

    /**
     * Display data as table
     */
    displayTable(data) {
        if (Array.isArray(data)) {
            if (data.length === 0) {
                console.log(chalk.gray('No data available'));
                return;
            }

            const headers = Object.keys(data[0]);
            console.log(chalk.white.bold(headers.join('\t')));
            console.log(chalk.gray('─'.repeat(headers.join('\t').length)));

            data.forEach(row => {
                const values = headers.map(header => row[header] || '');
                console.log(values.join('\t'));
            });
        } else if (typeof data === 'object') {
            Object.entries(data).forEach(([key, value]) => {
                console.log(`${chalk.blue(key)}: ${value}`);
            });
        } else {
            console.log(data);
        }
    }

    /**
     * Display data as CSV
     */
    displayCSV(data) {
        if (Array.isArray(data) && data.length > 0) {
            const headers = Object.keys(data[0]);
            console.log(headers.join(','));
            data.forEach(row => {
                const values = headers.map(header => `"${row[header] || ''}"`);
                console.log(values.join(','));
            });
        }
    }

    /**
     * Load data from JSON file
     */
    loadJsonFile(filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                throw new Error(`File not found: ${filePath}`);
            }

            const content = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(content);

        } catch (error) {
            throw new Error(`Error loading JSON file: ${error.message}`);
        }
    }

    /**
     * Save data to JSON file
     */
    saveJsonFile(filePath, data) {
        try {
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            console.log(chalk.green(`✓ Data saved to ${filePath}`));

        } catch (error) {
            throw new Error(`Error saving JSON file: ${error.message}`);
        }
    }

    // ===========================================
    // USER MANAGEMENT API COMMANDS
    // ===========================================

    /**
     * Search users
     */
    async searchUsers(options) {
        try {
            const params = new URLSearchParams();
            if (options.search) params.append('search', options.search);
            if (options.role) params.append('role', options.role);
            if (options.limit) params.append('limit', options.limit);

            const data = await this.makeRequest('GET', `/api/admin/users/search?${params}`);
            
            if (options.file) {
                this.saveJsonFile(options.file, data);
            } else {
                this.displayOutput(data.users, '👥 User Search Results');
            }

        } catch (error) {
            console.error(chalk.red('Error searching users:'), error.message);
            process.exit(1);
        }
    }

    /**
     * Get user profile
     */
    async getUserProfile(userId, options) {
        try {
            const endpoint = userId === 'me' ? '/api/user/profile' : `/api/admin/users/${userId}`;
            const data = await this.makeRequest('GET', endpoint);
            
            if (options.file) {
                this.saveJsonFile(options.file, data);
            } else {
                this.displayOutput(data.user, '👤 User Profile');
            }

        } catch (error) {
            console.error(chalk.red('Error getting user profile:'), error.message);
            process.exit(1);
        }
    }

    /**
     * Update user role
     */
    async updateUserRole(userId, options) {
        try {
            const requestData = options.file ? this.loadJsonFile(options.file) : { role: options.role };
            
            const data = await this.makeRequest('PUT', `/api/admin/users/${userId}/role`, requestData);
            
            console.log(chalk.green('✓ User role updated successfully'));
            this.displayOutput(data, 'Updated User');

        } catch (error) {
            console.error(chalk.red('Error updating user role:'), error.message);
            process.exit(1);
        }
    }

    /**
     * Tag user
     */
    async tagUser(userId, options) {
        try {
            const requestData = options.file ? this.loadJsonFile(options.file) : { tag: options.tag };
            
            const data = await this.makeRequest('POST', `/api/admin/users/${userId}/tag`, requestData);
            
            console.log(chalk.green('✓ User tagged successfully'));
            this.displayOutput(data);

        } catch (error) {
            console.error(chalk.red('Error tagging user:'), error.message);
            process.exit(1);
        }
    }

    /**
     * Remove user tag
     */
    async removeUserTag(userId, options) {
        try {
            const requestData = options.file ? this.loadJsonFile(options.file) : { tag: options.tag };
            
            const data = await this.makeRequest('DELETE', `/api/admin/users/${userId}/tag`, requestData);
            
            console.log(chalk.green('✓ User tag removed successfully'));
            this.displayOutput(data);

        } catch (error) {
            console.error(chalk.red('Error removing user tag:'), error.message);
            process.exit(1);
        }
    }

    // ===========================================
    // PERMISSIONS API COMMANDS
    // ===========================================

    /**
     * Grant permission
     */
    async grantPermission(options) {
        try {
            const requestData = options.file ? this.loadJsonFile(options.file) : {
                userId: options.userId,
                permissionType: options.permissionType,
                accessLevel: options.accessLevel,
                resourceId: options.resourceId,
                expiresAt: options.expiresAt
            };
            
            const data = await this.makeRequest('POST', '/api/admin/permissions/grant', requestData);
            
            console.log(chalk.green('✓ Permission granted successfully'));
            this.displayOutput(data);

        } catch (error) {
            console.error(chalk.red('Error granting permission:'), error.message);
            process.exit(1);
        }
    }

    /**
     * Revoke permission
     */
    async revokePermission(permissionId, options) {
        try {
            const requestData = options.file ? this.loadJsonFile(options.file) : { 
                reason: options.reason 
            };
            
            const data = await this.makeRequest('DELETE', `/api/admin/permissions/${permissionId}`, requestData);
            
            console.log(chalk.green('✓ Permission revoked successfully'));
            this.displayOutput(data);

        } catch (error) {
            console.error(chalk.red('Error revoking permission:'), error.message);
            process.exit(1);
        }
    }

    /**
     * Get user permissions
     */
    async getUserPermissions(userId, options) {
        try {
            const data = await this.makeRequest('GET', `/api/admin/users/${userId}/permissions`);
            
            if (options.file) {
                this.saveJsonFile(options.file, data);
            } else {
                this.displayOutput(data.permissions, '🔐 User Permissions');
            }

        } catch (error) {
            console.error(chalk.red('Error getting user permissions:'), error.message);
            process.exit(1);
        }
    }

    // ===========================================
    // GROUP MANAGEMENT API COMMANDS
    // ===========================================

    /**
     * Search groups
     */
    async searchGroups(options) {
        try {
            const params = new URLSearchParams();
            if (options.search) params.append('search', options.search);
            if (options.status) params.append('status', options.status);
            if (options.limit) params.append('limit', options.limit);

            const data = await this.makeRequest('GET', `/api/admin/groups/search?${params}`);
            
            if (options.file) {
                this.saveJsonFile(options.file, data);
            } else {
                this.displayOutput(data.groups, '👥 Group Search Results');
            }

        } catch (error) {
            console.error(chalk.red('Error searching groups:'), error.message);
            process.exit(1);
        }
    }

    /**
     * Create group
     */
    async createGroup(options) {
        try {
            const requestData = options.file ? this.loadJsonFile(options.file) : {
                name: options.name,
                description: options.description,
                type: options.type || 'standard'
            };
            
            const data = await this.makeRequest('POST', '/api/admin/groups/create', requestData);
            
            console.log(chalk.green('✓ Group created successfully'));
            this.displayOutput(data);

        } catch (error) {
            console.error(chalk.red('Error creating group:'), error.message);
            process.exit(1);
        }
    }

    /**
     * Add user to group
     */
    async addUserToGroup(groupId, options) {
        try {
            const requestData = options.file ? this.loadJsonFile(options.file) : {
                userId: options.userId,
                role: options.role || 'member'
            };
            
            const data = await this.makeRequest('POST', `/api/admin/groups/${groupId}/members`, requestData);
            
            console.log(chalk.green('✓ User added to group successfully'));
            this.displayOutput(data);

        } catch (error) {
            console.error(chalk.red('Error adding user to group:'), error.message);
            process.exit(1);
        }
    }

    /**
     * Remove user from group
     */
    async removeUserFromGroup(groupId, userId, options) {
        try {
            const data = await this.makeRequest('DELETE', `/api/admin/groups/${groupId}/members/${userId}`);
            
            console.log(chalk.green('✓ User removed from group successfully'));
            this.displayOutput(data);

        } catch (error) {
            console.error(chalk.red('Error removing user from group:'), error.message);
            process.exit(1);
        }
    }

    // ===========================================
    // BLOCKCHAIN API COMMANDS
    // ===========================================

    /**
     * View blockchain data
     */
    async viewBlockchainData(dataType, dataId, options) {
        try {
            const params = new URLSearchParams();
            if (options.accessLevel) params.append('access', options.accessLevel);

            const data = await this.makeRequest('GET', `/api/blockchain/data/${dataType}/${dataId}?${params}`);
            
            if (options.file) {
                this.saveJsonFile(options.file, data);
            } else {
                this.displayOutput(data.data, '🔗 Blockchain Data');
            }

        } catch (error) {
            console.error(chalk.red('Error viewing blockchain data:'), error.message);
            process.exit(1);
        }
    }

    /**
     * Grant blockchain data access
     */
    async grantBlockchainAccess(options) {
        try {
            const requestData = options.file ? this.loadJsonFile(options.file) : {
                granteeId: options.granteeId,
                dataType: options.dataType,
                dataId: options.dataId,
                accessLevel: options.accessLevel,
                expiresAt: options.expiresAt
            };
            
            const data = await this.makeRequest('POST', '/api/blockchain/grant', requestData);
            
            console.log(chalk.green('✓ Blockchain access granted successfully'));
            this.displayOutput(data);

        } catch (error) {
            console.error(chalk.red('Error granting blockchain access:'), error.message);
            process.exit(1);
        }
    }

    /**
     * Get blockchain grants
     */
    async getBlockchainGrants(userId, options) {
        try {
            const data = await this.makeRequest('GET', `/api/blockchain/grants/${userId}`);
            
            if (options.file) {
                this.saveJsonFile(options.file, data);
            } else {
                this.displayOutput(data.grants, '🔗 Blockchain Grants');
            }

        } catch (error) {
            console.error(chalk.red('Error getting blockchain grants:'), error.message);
            process.exit(1);
        }
    }

    // ===========================================
    // MESSAGING API COMMANDS
    // ===========================================

    /**
     * Send message
     */
    async sendMessage(options) {
        try {
            const requestData = options.file ? this.loadJsonFile(options.file) : {
                recipientId: options.recipientId,
                content: options.content,
                messageType: options.type || 'direct_message'
            };
            
            const data = await this.makeRequest('POST', '/api/messaging/send', requestData);
            
            console.log(chalk.green('✓ Message sent successfully'));
            this.displayOutput(data);

        } catch (error) {
            console.error(chalk.red('Error sending message:'), error.message);
            process.exit(1);
        }
    }

    /**
     * Get conversations
     */
    async getConversations(options) {
        try {
            const data = await this.makeRequest('GET', '/api/messaging/conversations');
            
            if (options.file) {
                this.saveJsonFile(options.file, data);
            } else {
                this.displayOutput(data.conversations, '💬 Conversations');
            }

        } catch (error) {
            console.error(chalk.red('Error getting conversations:'), error.message);
            process.exit(1);
        }
    }

    /**
     * Get messages
     */
    async getMessages(conversationId, options) {
        try {
            const params = new URLSearchParams();
            if (options.limit) params.append('limit', options.limit);
            if (options.offset) params.append('offset', options.offset);

            const data = await this.makeRequest('GET', `/api/messaging/conversations/${conversationId}/messages?${params}`);
            
            if (options.file) {
                this.saveJsonFile(options.file, data);
            } else {
                this.displayOutput(data.messages, '💬 Messages');
            }

        } catch (error) {
            console.error(chalk.red('Error getting messages:'), error.message);
            process.exit(1);
        }
    }

    // ===========================================
    // AUDIT & COMPLIANCE API COMMANDS
    // ===========================================

    /**
     * Generate audit report
     */
    async generateAuditReport(options) {
        try {
            const requestData = options.file ? this.loadJsonFile(options.file) : {
                startDate: options.startDate,
                endDate: options.endDate,
                complianceFramework: options.framework,
                format: options.format || 'detailed'
            };
            
            const data = await this.makeRequest('POST', '/api/admin/audit/report', requestData);
            
            if (options.output) {
                this.saveJsonFile(options.output, data);
            } else {
                this.displayOutput(data, '📊 Audit Report');
            }

        } catch (error) {
            console.error(chalk.red('Error generating audit report:'), error.message);
            process.exit(1);
        }
    }

    /**
     * Get audit logs
     */
    async getAuditLogs(options) {
        try {
            const params = new URLSearchParams();
            if (options.userId) params.append('user', options.userId);
            if (options.eventType) params.append('event', options.eventType);
            if (options.startDate) params.append('start', options.startDate);
            if (options.endDate) params.append('end', options.endDate);
            if (options.limit) params.append('limit', options.limit);

            const data = await this.makeRequest('GET', `/api/admin/audit/logs?${params}`);
            
            if (options.file) {
                this.saveJsonFile(options.file, data);
            } else {
                this.displayOutput(data.logs, '📋 Audit Logs');
            }

        } catch (error) {
            console.error(chalk.red('Error getting audit logs:'), error.message);
            process.exit(1);
        }
    }

    // ===========================================
    // SECONDARY AUTHENTICATION API COMMANDS
    // ===========================================

    /**
     * Setup secondary authentication
     */
    async setupSecondaryAuth(options) {
        try {
            const requestData = options.file ? this.loadJsonFile(options.file) : {
                authMethod: options.method || 'secondary_password',
                password: options.password
            };
            
            const data = await this.makeRequest('POST', '/api/auth/secondary/setup', requestData);
            
            console.log(chalk.green('✓ Secondary authentication setup successfully'));
            console.log(chalk.yellow('⚠️  Please save your backup codes:'));
            if (data.backupCodes) {
                data.backupCodes.forEach((code, index) => {
                    console.log(chalk.cyan(`${index + 1}. ${code}`));
                });
            }

        } catch (error) {
            console.error(chalk.red('Error setting up secondary auth:'), error.message);
            process.exit(1);
        }
    }

    /**
     * Create authentication challenge
     */
    async createAuthChallenge(options) {
        try {
            const requestData = options.file ? this.loadJsonFile(options.file) : {
                challengeType: options.type,
                contextData: options.context ? JSON.parse(options.context) : {}
            };
            
            const data = await this.makeRequest('POST', '/api/auth/challenge/create', requestData);
            
            console.log(chalk.green('✓ Authentication challenge created'));
            this.displayOutput(data);

        } catch (error) {
            console.error(chalk.red('Error creating auth challenge:'), error.message);
            process.exit(1);
        }
    }

    // ===========================================
    // GENERIC API COMMANDS
    // ===========================================

    /**
     * Generic GET request
     */
    async apiGet(endpoint, options) {
        try {
            const data = await this.makeRequest('GET', endpoint);
            
            if (options.file) {
                this.saveJsonFile(options.file, data);
            } else {
                this.displayOutput(data, `GET ${endpoint}`);
            }

        } catch (error) {
            console.error(chalk.red('API GET Error:'), error.message);
            process.exit(1);
        }
    }

    /**
     * Generic POST request
     */
    async apiPost(endpoint, options) {
        try {
            const requestData = options.file ? this.loadJsonFile(options.file) : 
                               options.data ? JSON.parse(options.data) : {};
            
            const data = await this.makeRequest('POST', endpoint, requestData);
            
            console.log(chalk.green(`✓ POST ${endpoint} successful`));
            this.displayOutput(data);

        } catch (error) {
            console.error(chalk.red('API POST Error:'), error.message);
            process.exit(1);
        }
    }

    /**
     * Generic PUT request
     */
    async apiPut(endpoint, options) {
        try {
            const requestData = options.file ? this.loadJsonFile(options.file) : 
                               options.data ? JSON.parse(options.data) : {};
            
            const data = await this.makeRequest('PUT', endpoint, requestData);
            
            console.log(chalk.green(`✓ PUT ${endpoint} successful`));
            this.displayOutput(data);

        } catch (error) {
            console.error(chalk.red('API PUT Error:'), error.message);
            process.exit(1);
        }
    }

    /**
     * Generic DELETE request
     */
    async apiDelete(endpoint, options) {
        try {
            const requestData = options.file ? this.loadJsonFile(options.file) : 
                               options.data ? JSON.parse(options.data) : {};
            
            const data = await this.makeRequest('DELETE', endpoint, requestData);
            
            console.log(chalk.green(`✓ DELETE ${endpoint} successful`));
            this.displayOutput(data);

        } catch (error) {
            console.error(chalk.red('API DELETE Error:'), error.message);
            process.exit(1);
        }
    }
}

module.exports = ApiCommands;