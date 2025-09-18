const crypto = require('crypto');

/**
 * Advanced Permissions Service for Medical Data Access Control
 * Implements role-based access control with granular permissions for HIPAA compliance
 */
class PermissionsService {
    constructor(databaseService, auditLoggingService, mfaService) {
        this.db = databaseService;
        this.auditLogger = auditLoggingService;
        this.mfa = mfaService;
        
        // User archetypes with their base permissions
        this.USER_ARCHETYPES = {
            'insurance': {
                name: 'Insurance Companies',
                description: 'Insurance companies - need to know, granular access',
                basePermissions: ['view_claims', 'view_risk_data', 'view_aggregated_health_data'],
                restrictions: ['no_delete', 'log_all_operations', 'need_to_know_basis'],
                requiresSecondaryAuth: true
            },
            'medical_professional': {
                name: 'Medical Professionals (Doctors)',
                description: 'Doctors - all access, need to know, granular',
                basePermissions: ['view_all_medical_data', 'edit_medical_records', 'create_prescriptions', 'view_patient_history'],
                restrictions: ['no_delete', 'log_all_operations', 'need_to_know_basis'],
                requiresSecondaryAuth: true
            },
            'nurse': {
                name: 'Nurses',
                description: 'Nurses - need to know, granular access',
                basePermissions: ['view_patient_care_data', 'update_care_notes', 'view_medications', 'view_vitals'],
                restrictions: ['no_delete', 'log_all_operations', 'need_to_know_basis'],
                requiresSecondaryAuth: true
            },
            'patient': {
                name: 'Patients',
                description: 'Patients - read access to own data',
                basePermissions: ['view_own_data', 'export_own_data', 'manage_data_sharing'],
                restrictions: ['no_delete', 'log_all_operations', 'own_data_only'],
                requiresSecondaryAuth: false
            },
            'researcher': {
                name: 'Researchers',
                description: 'Research professionals with dataset access',
                basePermissions: ['view_anonymized_data', 'export_research_data', 'statistical_analysis'],
                restrictions: ['no_delete', 'log_all_operations', 'anonymized_only'],
                requiresSecondaryAuth: true
            },
            'admin': {
                name: 'System Administrators',
                description: 'Full system access for administration',
                basePermissions: ['full_system_access', 'user_management', 'audit_access'],
                restrictions: ['log_all_operations'],
                requiresSecondaryAuth: true
            }
        };

        // Permission types for medical data
        this.PERMISSION_TYPES = {
            'prescriptions': {
                name: 'Prescription Data',
                description: 'Access to prescription and medication data',
                sensitivity: 'high',
                requiredRoles: ['medical_professional', 'nurse', 'patient', 'admin'],
                operations: ['read', 'write', 'create']
            },
            'medical_reports': {
                name: 'Medical Reports',
                description: 'Access to diagnostic reports and test results',
                sensitivity: 'high',
                requiredRoles: ['medical_professional', 'nurse', 'patient', 'admin'],
                operations: ['read', 'write', 'create']
            },
            'visit_notes': {
                name: 'Visit Notes',
                description: 'Clinical visit notes and observations',
                sensitivity: 'high',
                requiredRoles: ['medical_professional', 'nurse', 'patient', 'admin'],
                operations: ['read', 'write', 'create']
            },
            'medical_scans': {
                name: 'Medical Scans',
                description: 'Medical imaging and scan results (if permitted)',
                sensitivity: 'very_high',
                requiredRoles: ['medical_professional', 'patient', 'admin'],
                operations: ['read', 'view'],
                specialRequirements: ['imaging_license']
            },
            'lab_results': {
                name: 'Laboratory Results',
                description: 'Laboratory test results and values',
                sensitivity: 'high',
                requiredRoles: ['medical_professional', 'nurse', 'patient', 'admin'],
                operations: ['read', 'create']
            },
            'insurance_claims': {
                name: 'Insurance Claims',
                description: 'Insurance claim data and processing',
                sensitivity: 'high',
                requiredRoles: ['insurance', 'medical_professional', 'patient', 'admin'],
                operations: ['read', 'create', 'process']
            }
        };

        this.initializeDatabase();
    }

    /**
     * Initialize database tables for permissions system
     */
    async initializeDatabase() {
        try {
            await this.db.run(`
                CREATE TABLE IF NOT EXISTS user_permissions (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    permission_type TEXT NOT NULL,
                    resource_id TEXT,
                    access_level TEXT NOT NULL,
                    granted_by TEXT NOT NULL,
                    granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    expires_at DATETIME,
                    conditions TEXT,
                    is_active BOOLEAN DEFAULT 1,
                    secondary_auth_required BOOLEAN DEFAULT 0,
                    FOREIGN KEY (user_id) REFERENCES users(id),
                    FOREIGN KEY (granted_by) REFERENCES users(id)
                )
            `);

            await this.db.run(`
                CREATE TABLE IF NOT EXISTS permission_requests (
                    id TEXT PRIMARY KEY,
                    requester_id TEXT NOT NULL,
                    target_user_id TEXT NOT NULL,
                    permission_type TEXT NOT NULL,
                    resource_id TEXT,
                    justification TEXT NOT NULL,
                    status TEXT DEFAULT 'pending',
                    approved_by TEXT,
                    approved_at DATETIME,
                    expires_at DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (requester_id) REFERENCES users(id),
                    FOREIGN KEY (target_user_id) REFERENCES users(id),
                    FOREIGN KEY (approved_by) REFERENCES users(id)
                )
            `);

            await this.db.run(`
                CREATE TABLE IF NOT EXISTS data_access_grants (
                    id TEXT PRIMARY KEY,
                    grantor_id TEXT NOT NULL,
                    grantee_id TEXT NOT NULL,
                    data_type TEXT NOT NULL,
                    access_level TEXT NOT NULL,
                    conditions TEXT,
                    granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    expires_at DATETIME,
                    revoked_at DATETIME,
                    is_active BOOLEAN DEFAULT 1,
                    blockchain_hash TEXT,
                    FOREIGN KEY (grantor_id) REFERENCES users(id),
                    FOREIGN KEY (grantee_id) REFERENCES users(id)
                )
            `);

            await this.db.run(`
                CREATE TABLE IF NOT EXISTS user_groups (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL UNIQUE,
                    description TEXT,
                    group_type TEXT NOT NULL,
                    created_by TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    is_active BOOLEAN DEFAULT 1,
                    is_hidden BOOLEAN DEFAULT 0,
                    FOREIGN KEY (created_by) REFERENCES users(id)
                )
            `);

            await this.db.run(`
                CREATE TABLE IF NOT EXISTS user_group_memberships (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    group_id TEXT NOT NULL,
                    role TEXT DEFAULT 'member',
                    added_by TEXT NOT NULL,
                    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    removed_at DATETIME,
                    is_active BOOLEAN DEFAULT 1,
                    FOREIGN KEY (user_id) REFERENCES users(id),
                    FOREIGN KEY (group_id) REFERENCES user_groups(id),
                    FOREIGN KEY (added_by) REFERENCES users(id),
                    UNIQUE(user_id, group_id)
                )
            `);

            console.log('✅ Permissions database tables initialized successfully');
        } catch (error) {
            console.error('❌ Error initializing permissions database:', error);
            throw error;
        }
    }

    /**
     * Check if user has permission for specific operation
     */
    async checkPermission(userId, permissionType, operation = 'read', resourceId = null) {
        try {
            // Log permission check
            await this.auditLogger.logOperation(userId, 'permission_check', {
                permission_type: permissionType,
                operation: operation,
                resource_id: resourceId
            });

            // Get user role and permissions
            const user = await this.db.get('SELECT * FROM users WHERE id = ?', [userId]);
            if (!user) {
                throw new Error('User not found');
            }

            const userArchetype = this.USER_ARCHETYPES[user.role];
            if (!userArchetype) {
                throw new Error('Invalid user role');
            }

            const permissionConfig = this.PERMISSION_TYPES[permissionType];
            if (!permissionConfig) {
                throw new Error('Invalid permission type');
            }

            // Check if user role is allowed for this permission type
            if (!permissionConfig.requiredRoles.includes(user.role)) {
                return { allowed: false, reason: 'Role not authorized for this permission type' };
            }

            // Check specific user permissions
            const userPermission = await this.db.get(`
                SELECT * FROM user_permissions 
                WHERE user_id = ? AND permission_type = ? AND is_active = 1 
                AND (expires_at IS NULL OR expires_at > datetime('now'))
                AND (resource_id IS NULL OR resource_id = ?)
            `, [userId, permissionType, resourceId]);

            if (!userPermission) {
                // Check if user has base permission through their role
                const hasBasePermission = this.checkBasePermission(userArchetype, permissionType, operation);
                if (!hasBasePermission) {
                    return { allowed: false, reason: 'No specific permission granted' };
                }
            }

            // Check if secondary authentication is required
            const requiresSecondaryAuth = userArchetype.requiresSecondaryAuth || 
                (userPermission && userPermission.secondary_auth_required);

            return {
                allowed: true,
                requiresSecondaryAuth: requiresSecondaryAuth,
                conditions: userPermission ? JSON.parse(userPermission.conditions || '{}') : {},
                permission: userPermission
            };

        } catch (error) {
            console.error('Error checking permission:', error);
            await this.auditLogger.logOperation(userId, 'permission_check_error', { error: error.message });
            throw error;
        }
    }

    /**
     * Grant permission to user
     */
    async grantPermission(granterId, userId, permissionType, accessLevel = 'read', options = {}) {
        const permissionId = crypto.randomUUID();
        
        try {
            // Verify granter has authority
            const granter = await this.db.get('SELECT * FROM users WHERE id = ?', [granterId]);
            if (!granter || !['admin', 'medical_professional'].includes(granter.role)) {
                throw new Error('Insufficient authority to grant permissions');
            }

            // Log permission grant
            await this.auditLogger.logOperation(granterId, 'permission_grant', {
                target_user: userId,
                permission_type: permissionType,
                access_level: accessLevel,
                ...options
            });

            await this.db.run(`
                INSERT INTO user_permissions (
                    id, user_id, permission_type, resource_id, access_level, 
                    granted_by, expires_at, conditions, secondary_auth_required
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                permissionId, userId, permissionType, options.resourceId || null,
                accessLevel, granterId, options.expiresAt || null, 
                JSON.stringify(options.conditions || {}),
                options.requiresSecondaryAuth || false
            ]);

            return { success: true, permissionId };

        } catch (error) {
            console.error('Error granting permission:', error);
            await this.auditLogger.logOperation(granterId, 'permission_grant_error', { error: error.message });
            throw error;
        }
    }

    /**
     * Revoke permission from user
     */
    async revokePermission(revokerId, permissionId, reason = '') {
        try {
            // Verify revoker has authority
            const revoker = await this.db.get('SELECT * FROM users WHERE id = ?', [revokerId]);
            if (!revoker || !['admin', 'medical_professional'].includes(revoker.role)) {
                throw new Error('Insufficient authority to revoke permissions');
            }

            // Get permission details for logging
            const permission = await this.db.get('SELECT * FROM user_permissions WHERE id = ?', [permissionId]);
            if (!permission) {
                throw new Error('Permission not found');
            }

            // Log permission revocation
            await this.auditLogger.logOperation(revokerId, 'permission_revoke', {
                permission_id: permissionId,
                target_user: permission.user_id,
                reason: reason
            });

            await this.db.run('UPDATE user_permissions SET is_active = 0 WHERE id = ?', [permissionId]);

            return { success: true };

        } catch (error) {
            console.error('Error revoking permission:', error);
            await this.auditLogger.logOperation(revokerId, 'permission_revoke_error', { error: error.message });
            throw error;
        }
    }

    /**
     * Create user group
     */
    async createUserGroup(creatorId, groupData) {
        const groupId = crypto.randomUUID();
        
        try {
            await this.auditLogger.logOperation(creatorId, 'group_create', groupData);

            await this.db.run(`
                INSERT INTO user_groups (id, name, description, group_type, created_by)
                VALUES (?, ?, ?, ?, ?)
            `, [groupId, groupData.name, groupData.description, groupData.type, creatorId]);

            return { success: true, groupId };

        } catch (error) {
            console.error('Error creating user group:', error);
            throw error;
        }
    }

    /**
     * Add user to group
     */
    async addUserToGroup(adminId, userId, groupId, role = 'member') {
        const membershipId = crypto.randomUUID();
        
        try {
            await this.auditLogger.logOperation(adminId, 'group_member_add', {
                user_id: userId,
                group_id: groupId,
                role: role
            });

            await this.db.run(`
                INSERT INTO user_group_memberships (id, user_id, group_id, role, added_by)
                VALUES (?, ?, ?, ?, ?)
            `, [membershipId, userId, groupId, role, adminId]);

            return { success: true, membershipId };

        } catch (error) {
            console.error('Error adding user to group:', error);
            throw error;
        }
    }

    /**
     * Get user's effective permissions (including group permissions)
     */
    async getUserEffectivePermissions(userId) {
        try {
            // Get direct user permissions
            const directPermissions = await this.db.all(`
                SELECT * FROM user_permissions 
                WHERE user_id = ? AND is_active = 1 
                AND (expires_at IS NULL OR expires_at > datetime('now'))
            `, [userId]);

            // Get group memberships and their permissions
            const groupMemberships = await this.db.all(`
                SELECT g.*, ugm.role as membership_role
                FROM user_groups g
                JOIN user_group_memberships ugm ON g.id = ugm.group_id
                WHERE ugm.user_id = ? AND ugm.is_active = 1 AND g.is_active = 1
            `, [userId]);

            return {
                directPermissions,
                groupMemberships,
                effectivePermissions: this.calculateEffectivePermissions(directPermissions, groupMemberships)
            };

        } catch (error) {
            console.error('Error getting user effective permissions:', error);
            throw error;
        }
    }

    /**
     * Check base permission through user role
     */
    checkBasePermission(userArchetype, permissionType, operation) {
        const permissionConfig = this.PERMISSION_TYPES[permissionType];
        
        // Check if operation is allowed for this permission type
        if (!permissionConfig.operations.includes(operation)) {
            return false;
        }

        // Check if user's role has base permission
        return userArchetype.basePermissions.some(basePerm => {
            return this.matchesPermissionPattern(basePerm, permissionType, operation);
        });
    }

    /**
     * Match permission pattern
     */
    matchesPermissionPattern(basePermission, permissionType, operation) {
        // Simple pattern matching - could be more sophisticated
        const patterns = {
            'view_all_medical_data': ['prescriptions', 'medical_reports', 'visit_notes', 'lab_results'],
            'view_patient_care_data': ['visit_notes', 'prescriptions', 'lab_results'],
            'view_own_data': ['prescriptions', 'medical_reports', 'visit_notes', 'medical_scans', 'lab_results'],
            'view_claims': ['insurance_claims'],
            'full_system_access': Object.keys(this.PERMISSION_TYPES)
        };

        const allowedTypes = patterns[basePermission] || [];
        return allowedTypes.includes(permissionType);
    }

    /**
     * Calculate effective permissions from direct and group permissions
     */
    calculateEffectivePermissions(directPermissions, groupMemberships) {
        // Combine and deduplicate permissions
        const effective = [];
        const seen = new Set();

        directPermissions.forEach(perm => {
            const key = `${perm.permission_type}_${perm.resource_id || 'global'}`;
            if (!seen.has(key)) {
                effective.push(perm);
                seen.add(key);
            }
        });

        // Add group-based permissions (would need to be implemented based on group permission system)
        
        return effective;
    }
}

module.exports = PermissionsService;