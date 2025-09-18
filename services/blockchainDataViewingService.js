const crypto = require('crypto');

/**
 * Blockchain Data Viewing Service with Grant Options
 * Provides secure access to blockchain-stored health data with permission management
 */
class BlockchainDataViewingService {
    constructor(blockchainIntegrationService, permissionsService, auditLoggingService, secondaryAuthService) {
        this.blockchain = blockchainIntegrationService;
        this.permissions = permissionsService;
        this.auditLogger = auditLoggingService;
        this.secondaryAuth = secondaryAuthService;
        
        this.BLOCKCHAIN_DATA_TYPES = {
            HEALTH_RECORDS: 'health_records',
            MEDICAL_IMAGES: 'medical_images',
            PRESCRIPTIONS: 'prescriptions',
            LAB_RESULTS: 'lab_results',
            OUTBREAK_DATA: 'outbreak_data',
            STI_DATA: 'sti_data',
            VACCINATION_RECORDS: 'vaccination_records'
        };

        this.ACCESS_LEVELS = {
            READ: 'read',
            VIEW_METADATA: 'view_metadata',
            EXPORT: 'export',
            FULL_ACCESS: 'full_access'
        };
    }

    /**
     * View blockchain data with permission checks and grant options
     */
    async viewBlockchainData(userId, dataType, dataId, requestedAccess = 'read') {
        try {
            // Log the access attempt
            await this.auditLogger.logOperation(userId, 'blockchain_data_access_attempt', {
                data_type: dataType,
                data_id: dataId,
                requested_access: requestedAccess
            });

            // Check if user has permission to access this data type
            const permissionCheck = await this.permissions.checkPermission(
                userId, dataType, requestedAccess, dataId
            );

            if (!permissionCheck.allowed) {
                await this.auditLogger.logOperation(userId, 'blockchain_data_access_denied', {
                    data_type: dataType,
                    data_id: dataId,
                    reason: permissionCheck.reason
                });
                
                return {
                    success: false,
                    error: 'Access denied',
                    reason: permissionCheck.reason,
                    grantOptions: await this.getAvailableGrantOptions(userId, dataType, dataId)
                };
            }

            // If secondary authentication is required, create challenge
            if (permissionCheck.requiresSecondaryAuth) {
                const challenge = await this.secondaryAuth.createAuthChallenge(
                    userId,
                    'blockchain_data_access',
                    { dataType, dataId, requestedAccess }
                );

                return {
                    success: false,
                    requiresSecondaryAuth: true,
                    challenge: challenge,
                    message: 'Secondary authentication required'
                };
            }

            // Retrieve blockchain data
            const blockchainData = await this.getBlockchainData(dataType, dataId);

            if (!blockchainData) {
                return {
                    success: false,
                    error: 'Data not found on blockchain'
                };
            }

            // Filter data based on access level and user permissions
            const filteredData = await this.filterDataByPermissions(
                blockchainData, userId, requestedAccess, permissionCheck
            );

            // Log successful access
            await this.auditLogger.logOperation(userId, 'blockchain_data_access_granted', {
                data_type: dataType,
                data_id: dataId,
                access_level: requestedAccess,
                blockchain_hash: blockchainData.hash
            });

            return {
                success: true,
                data: filteredData,
                metadata: {
                    dataType: dataType,
                    dataId: dataId,
                    blockchainHash: blockchainData.hash,
                    lastModified: blockchainData.timestamp,
                    accessLevel: requestedAccess
                },
                grantOptions: await this.getAvailableGrantOptions(userId, dataType, dataId)
            };

        } catch (error) {
            console.error('Error viewing blockchain data:', error);
            await this.auditLogger.logOperation(userId, 'blockchain_data_access_error', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Grant access to blockchain data
     */
    async grantDataAccess(granterId, granteeId, dataType, dataId, accessLevel, options = {}) {
        try {
            // Verify granter has authority to grant access
            const granterPermission = await this.permissions.checkPermission(
                granterId, dataType, 'grant_access', dataId
            );

            if (!granterPermission.allowed) {
                throw new Error('Insufficient authority to grant access');
            }

            // If secondary authentication required, create challenge
            if (granterPermission.requiresSecondaryAuth && !options.challengeCompleted) {
                const challenge = await this.secondaryAuth.createAuthChallenge(
                    granterId,
                    'permission_grant',
                    { granteeId, dataType, dataId, accessLevel }
                );

                return {
                    success: false,
                    requiresSecondaryAuth: true,
                    challenge: challenge
                };
            }

            // Create permission grant
            const grantResult = await this.permissions.grantPermission(
                granterId, granteeId, dataType, accessLevel, {
                    resourceId: dataId,
                    expiresAt: options.expiresAt,
                    conditions: options.conditions,
                    requiresSecondaryAuth: options.requiresSecondaryAuth || false
                }
            );

            // Record grant on blockchain for immutable audit trail
            const blockchainGrant = await this.recordGrantOnBlockchain({
                granterId,
                granteeId,
                dataType,
                dataId,
                accessLevel,
                permissionId: grantResult.permissionId,
                timestamp: new Date().toISOString(),
                conditions: options.conditions
            });

            // Log the grant
            await this.auditLogger.logOperation(granterId, 'blockchain_data_grant', {
                grantee_id: granteeId,
                data_type: dataType,
                data_id: dataId,
                access_level: accessLevel,
                blockchain_hash: blockchainGrant?.hash
            });

            return {
                success: true,
                permissionId: grantResult.permissionId,
                blockchainHash: blockchainGrant?.hash,
                message: 'Access granted successfully'
            };

        } catch (error) {
            console.error('Error granting data access:', error);
            await this.auditLogger.logOperation(granterId, 'blockchain_data_grant_error', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Revoke access to blockchain data
     */
    async revokeDataAccess(revokerId, permissionId, reason = '') {
        try {
            // Revoke the permission
            const revokeResult = await this.permissions.revokePermission(
                revokerId, permissionId, reason
            );

            // Record revocation on blockchain
            const blockchainRevocation = await this.recordRevocationOnBlockchain({
                revokerId,
                permissionId,
                reason,
                timestamp: new Date().toISOString()
            });

            return {
                success: true,
                blockchainHash: blockchainRevocation?.hash,
                message: 'Access revoked successfully'
            };

        } catch (error) {
            console.error('Error revoking data access:', error);
            throw error;
        }
    }

    /**
     * Get user's blockchain data grants
     */
    async getUserBlockchainGrants(userId) {
        try {
            // Get permissions from database
            const permissions = await this.permissions.getUserEffectivePermissions(userId);

            // Get blockchain grant records
            const blockchainGrants = await this.getBlockchainGrantsForUser(userId);

            // Combine and format grants
            const grants = [];
            
            for (const permission of permissions.directPermissions) {
                const blockchainGrant = blockchainGrants.find(g => g.permissionId === permission.id);
                
                grants.push({
                    permissionId: permission.id,
                    dataType: permission.permission_type,
                    dataId: permission.resource_id,
                    accessLevel: permission.access_level,
                    grantedAt: permission.granted_at,
                    expiresAt: permission.expires_at,
                    grantedBy: permission.granted_by,
                    blockchainHash: blockchainGrant?.hash,
                    status: permission.is_active ? 'active' : 'inactive'
                });
            }

            return {
                success: true,
                grants: grants,
                summary: {
                    totalGrants: grants.length,
                    activeGrants: grants.filter(g => g.status === 'active').length,
                    expiringGrants: grants.filter(g => 
                        g.expiresAt && new Date(g.expiresAt) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                    ).length
                }
            };

        } catch (error) {
            console.error('Error getting user blockchain grants:', error);
            throw error;
        }
    }

    /**
     * View blockchain transaction history for data
     */
    async viewBlockchainHistory(userId, dataType, dataId) {
        try {
            // Check permission to view history
            const permissionCheck = await this.permissions.checkPermission(
                userId, dataType, 'view_history', dataId
            );

            if (!permissionCheck.allowed) {
                return {
                    success: false,
                    error: 'Access denied to view blockchain history'
                };
            }

            // Get blockchain transaction history
            const history = await this.getBlockchainHistory(dataType, dataId);

            // Log the history access
            await this.auditLogger.logOperation(userId, 'blockchain_history_access', {
                data_type: dataType,
                data_id: dataId
            });

            return {
                success: true,
                history: history,
                metadata: {
                    totalTransactions: history.length,
                    firstTransaction: history.length > 0 ? history[0].timestamp : null,
                    lastTransaction: history.length > 0 ? history[history.length - 1].timestamp : null
                }
            };

        } catch (error) {
            console.error('Error viewing blockchain history:', error);
            throw error;
        }
    }

    /**
     * Export blockchain data (with additional security)
     */
    async exportBlockchainData(userId, dataType, dataId, exportFormat = 'json') {
        try {
            // Check export permission
            const permissionCheck = await this.permissions.checkPermission(
                userId, dataType, 'export', dataId
            );

            if (!permissionCheck.allowed) {
                return {
                    success: false,
                    error: 'Export access denied'
                };
            }

            // Always require secondary auth for exports
            if (!permissionCheck.challengeCompleted) {
                const challenge = await this.secondaryAuth.createAuthChallenge(
                    userId,
                    'data_export',
                    { dataType, dataId, exportFormat }
                );

                return {
                    success: false,
                    requiresSecondaryAuth: true,
                    challenge: challenge
                };
            }

            // Get blockchain data
            const blockchainData = await this.getBlockchainData(dataType, dataId);
            
            if (!blockchainData) {
                return {
                    success: false,
                    error: 'Data not found'
                };
            }

            // Format export data
            const exportData = await this.formatExportData(blockchainData, exportFormat);

            // Log the export
            await this.auditLogger.logOperation(userId, 'blockchain_data_export', {
                data_type: dataType,
                data_id: dataId,
                export_format: exportFormat,
                blockchain_hash: blockchainData.hash
            });

            return {
                success: true,
                exportData: exportData,
                metadata: {
                    format: exportFormat,
                    exportedAt: new Date().toISOString(),
                    dataHash: blockchainData.hash
                }
            };

        } catch (error) {
            console.error('Error exporting blockchain data:', error);
            throw error;
        }
    }

    // Private helper methods

    /**
     * Get available grant options for user
     */
    async getAvailableGrantOptions(userId, dataType, dataId) {
        // This would check what grant options are available to the user
        // For now, return basic options
        return {
            canRequestAccess: true,
            canGrantToOthers: false, // Would need to check user's permissions
            availableAccessLevels: [
                this.ACCESS_LEVELS.VIEW_METADATA,
                this.ACCESS_LEVELS.READ,
                this.ACCESS_LEVELS.EXPORT
            ]
        };
    }

    /**
     * Get blockchain data
     */
    async getBlockchainData(dataType, dataId) {
        try {
            // Use blockchain integration service to retrieve data
            const response = await this.blockchain.makeRequest('GET', `/api/v1/data/${dataType}/${dataId}`);
            return response.data;
        } catch (error) {
            console.error('Error retrieving blockchain data:', error);
            return null;
        }
    }

    /**
     * Filter data based on permissions
     */
    async filterDataByPermissions(data, userId, accessLevel, permissionCheck) {
        // Apply filtering based on user's specific permissions
        const filtered = { ...data };

        if (accessLevel === this.ACCESS_LEVELS.VIEW_METADATA) {
            // Return only metadata, not actual data
            return {
                id: filtered.id,
                type: filtered.type,
                timestamp: filtered.timestamp,
                hash: filtered.hash,
                metadata: filtered.metadata
            };
        }

        // Apply any condition-based filtering
        const conditions = permissionCheck.conditions || {};
        if (conditions.fieldRestrictions) {
            for (const field of conditions.fieldRestrictions) {
                delete filtered[field];
            }
        }

        return filtered;
    }

    /**
     * Record grant on blockchain
     */
    async recordGrantOnBlockchain(grantData) {
        try {
            const response = await this.blockchain.makeRequest('POST', '/api/v1/grants/record', {
                grant_data: grantData
            });
            return response;
        } catch (error) {
            console.error('Error recording grant on blockchain:', error);
            return null;
        }
    }

    /**
     * Record revocation on blockchain
     */
    async recordRevocationOnBlockchain(revocationData) {
        try {
            const response = await this.blockchain.makeRequest('POST', '/api/v1/grants/revoke', {
                revocation_data: revocationData
            });
            return response;
        } catch (error) {
            console.error('Error recording revocation on blockchain:', error);
            return null;
        }
    }

    /**
     * Get blockchain grants for user
     */
    async getBlockchainGrantsForUser(userId) {
        try {
            const response = await this.blockchain.makeRequest('GET', `/api/v1/grants/user/${userId}`);
            return response.grants || [];
        } catch (error) {
            console.error('Error getting blockchain grants:', error);
            return [];
        }
    }

    /**
     * Get blockchain history
     */
    async getBlockchainHistory(dataType, dataId) {
        try {
            const response = await this.blockchain.makeRequest('GET', `/api/v1/history/${dataType}/${dataId}`);
            return response.history || [];
        } catch (error) {
            console.error('Error getting blockchain history:', error);
            return [];
        }
    }

    /**
     * Format export data
     */
    async formatExportData(data, format) {
        switch (format.toLowerCase()) {
            case 'json':
                return JSON.stringify(data, null, 2);
            case 'csv':
                // Convert to CSV format (simplified)
                return this.jsonToCsv(data);
            case 'xml':
                // Convert to XML format (simplified)
                return this.jsonToXml(data);
            default:
                return data;
        }
    }

    /**
     * Convert JSON to CSV (simplified)
     */
    jsonToCsv(data) {
        if (!data || typeof data !== 'object') return '';
        
        const keys = Object.keys(data);
        const csvHeader = keys.join(',');
        const csvRow = keys.map(key => JSON.stringify(data[key])).join(',');
        
        return `${csvHeader}\n${csvRow}`;
    }

    /**
     * Convert JSON to XML (simplified)
     */
    jsonToXml(data, rootTag = 'data') {
        if (!data || typeof data !== 'object') return '';
        
        let xml = `<${rootTag}>`;
        for (const [key, value] of Object.entries(data)) {
            xml += `<${key}>${typeof value === 'object' ? this.jsonToXml(value, key) : value}</${key}>`;
        }
        xml += `</${rootTag}>`;
        
        return xml;
    }
}

module.exports = BlockchainDataViewingService;