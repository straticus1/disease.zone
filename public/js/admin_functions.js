// Admin Panel JavaScript Functions

// User search and management
window.searchUsers = async function() {
    const searchTerm = document.getElementById('userSearch').value.trim();
    const roleFilter = document.getElementById('roleFilter').value;
    const resultsDiv = document.getElementById('userSearchResults');
    
    if (!searchTerm && !roleFilter) {
        resultsDiv.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">Enter a search term or select a role filter</p>';
        return;
    }

    resultsDiv.innerHTML = '<div style="text-align: center; padding: 2rem;"><i class="fas fa-spinner fa-spin"></i> Searching users...</div>';

    try {
        const params = new URLSearchParams();
        if (searchTerm) params.append('search', searchTerm);
        if (roleFilter) params.append('role', roleFilter);

        const response = await fetch(`${window.location.origin}/api/admin/users/search?${params}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('diseaseZoneToken')}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (data.success && data.users) {
            displayUserResults(data.users);
        } else {
            resultsDiv.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                <i class="fas fa-users"></i><br>
                No users found matching your criteria
            </div>`;
        }
    } catch (error) {
        console.error('Error searching users:', error);
        resultsDiv.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--error-color);">
            <i class="fas fa-exclamation-triangle"></i><br>
            Error searching users. Please try again.
        </div>`;
    }
};

function displayUserResults(users) {
    const resultsDiv = document.getElementById('userSearchResults');
    
    const html = `
        <div style="margin-bottom: 1rem; font-weight: 600; color: var(--text-primary);">
            Found ${users.length} user${users.length !== 1 ? 's' : ''}
        </div>
        <div style="max-height: 500px; overflow-y: auto;">
            ${users.map(user => `
                <div class="user-result-card" style="border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; margin-bottom: 1rem; background: white;">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.75rem;">
                        <div style="flex: 1;">
                            <h4 style="margin: 0; color: var(--primary-color); font-size: 1.1rem;">
                                ${user.first_name} ${user.last_name}
                            </h4>
                            <p style="margin: 0.25rem 0; color: var(--text-secondary);">${user.email}</p>
                            <div style="display: flex; gap: 1rem; margin-top: 0.5rem;">
                                <span style="background: ${getRoleColor(user.role)}; color: white; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.85rem; font-weight: 600;">
                                    ${formatRole(user.role)}
                                </span>
                                <span style="color: var(--text-secondary); font-size: 0.9rem;">
                                    Joined: ${new Date(user.created_at).toLocaleDateString()}
                                </span>
                            </div>
                        </div>
                        <div style="display: flex; gap: 0.5rem;">
                            <button onclick="viewUserProfile('${user.id}')" class="btn btn-sm btn-info">
                                <i class="fas fa-eye"></i> View
                            </button>
                            <button onclick="editUserRoles('${user.id}')" class="btn btn-sm btn-warning">
                                <i class="fas fa-user-cog"></i> Edit Roles
                            </button>
                        </div>
                    </div>
                    ${user.groups && user.groups.length > 0 ? `
                        <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--border-color);">
                            <strong style="font-size: 0.9rem; color: var(--text-primary);">Groups:</strong>
                            <div style="display: flex; gap: 0.5rem; margin-top: 0.25rem; flex-wrap: wrap;">
                                ${user.groups.map(group => `
                                    <span style="background: #e3f2fd; color: #1976d2; padding: 0.2rem 0.5rem; border-radius: 8px; font-size: 0.8rem;">
                                        ${group.name}
                                    </span>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            `).join('')}
        </div>
    `;
    
    resultsDiv.innerHTML = html;
}

function getRoleColor(role) {
    const colors = {
        'admin': '#dc3545',
        'medical_professional': '#28a745',
        'researcher': '#17a2b8',
        'insurance': '#ffc107',
        'user': '#6c757d'
    };
    return colors[role] || '#6c757d';
}

function formatRole(role) {
    const roleNames = {
        'admin': 'Admin',
        'medical_professional': 'Medical Professional',
        'researcher': 'Researcher',
        'insurance': 'Insurance',
        'user': 'Regular User'
    };
    return roleNames[role] || role;
}

// View user profile in modal
window.viewUserProfile = async function(userId) {
    try {
        const response = await fetch(`${window.location.origin}/api/admin/users/${userId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('diseaseZoneToken')}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (data.success && data.user) {
            displayUserProfileModal(data.user);
        } else {
            if (typeof showAlert === 'function') {
                showAlert('Failed to load user profile', 'error');
            } else {
                alert('Failed to load user profile');
            }
        }
    } catch (error) {
        console.error('Error loading user profile:', error);
        if (typeof showAlert === 'function') {
            showAlert('Error loading user profile', 'error');
        } else {
            alert('Error loading user profile');
        }
    }
};

function displayUserProfileModal(user) {
    const modalHtml = `
        <div class="modal active" id="userProfileModal">
            <div class="modal-overlay" onclick="closeModal('userProfileModal')">
                <div class="modal-content" onclick="event.stopPropagation()" style="max-width: 800px;">
                    <div class="modal-header">
                        <h3><i class="fas fa-user"></i> User Profile</h3>
                        <button class="modal-close" onclick="closeModal('userProfileModal')">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div style="display: grid; gap: 1.5rem;">
                            <!-- Basic Information -->
                            <div class="card">
                                <div class="card-header">
                                    <h4>Basic Information</h4>
                                </div>
                                <div class="card-body">
                                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem;">
                                        <div>
                                            <strong>Name:</strong> ${user.first_name} ${user.last_name}
                                        </div>
                                        <div>
                                            <strong>Email:</strong> ${user.email}
                                        </div>
                                        <div>
                                            <strong>Role:</strong> 
                                            <span style="background: ${getRoleColor(user.role)}; color: white; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.85rem;">
                                                ${formatRole(user.role)}
                                            </span>
                                        </div>
                                        <div>
                                            <strong>Status:</strong> 
                                            <span style="color: ${user.is_active ? '#28a745' : '#dc3545'};">
                                                ${user.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </div>
                                        <div>
                                            <strong>Joined:</strong> ${new Date(user.created_at).toLocaleDateString()}
                                        </div>
                                        <div>
                                            <strong>Last Login:</strong> ${user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Role Management -->
                            <div class="card">
                                <div class="card-header">
                                    <h4>Role Management</h4>
                                </div>
                                <div class="card-body">
                                    <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
                                        <select id="newUserRole" style="padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 6px;">
                                            <option value="user" ${user.role === 'user' ? 'selected' : ''}>Regular User</option>
                                            <option value="researcher" ${user.role === 'researcher' ? 'selected' : ''}>Researcher</option>
                                            <option value="medical_professional" ${user.role === 'medical_professional' ? 'selected' : ''}>Medical Professional</option>
                                            <option value="insurance" ${user.role === 'insurance' ? 'selected' : ''}>Insurance</option>
                                            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                                        </select>
                                        <button onclick="updateUserRole('${user.id}')" class="btn btn-primary">
                                            <i class="fas fa-save"></i> Update Role
                                        </button>
                                    </div>
                                    <div style="font-size: 0.9rem; color: var(--text-secondary);">
                                        <strong>Current permissions:</strong> ${getRolePermissions(user.role)}
                                    </div>
                                </div>
                            </div>

                            <!-- Groups -->
                            <div class="card">
                                <div class="card-header">
                                    <h4>Group Memberships</h4>
                                </div>
                                <div class="card-body">
                                    ${user.groups && user.groups.length > 0 ? `
                                        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem;">
                                            ${user.groups.map(group => `
                                                <span style="background: #e3f2fd; color: #1976d2; padding: 0.5rem 1rem; border-radius: 8px; display: flex; align-items: center; gap: 0.5rem;">
                                                    ${group.name}
                                                    <button onclick="removeUserFromGroup('${user.id}', '${group.id}')" style="background: none; border: none; color: #d32f2f; cursor: pointer;">
                                                        <i class="fas fa-times"></i>
                                                    </button>
                                                </span>
                                            `).join('')}
                                        </div>
                                    ` : '<p style="color: var(--text-secondary);">No group memberships</p>'}
                                    <button onclick="addUserToGroup('${user.id}')" class="btn btn-success">
                                        <i class="fas fa-plus"></i> Add to Group
                                    </button>
                                </div>
                            </div>

                            <!-- Health Data Access -->
                            ${user.health_data_summary ? `
                                <div class="card">
                                    <div class="card-header">
                                        <h4>Health Data & Permissions</h4>
                                    </div>
                                    <div class="card-body">
                                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
                                            <div>
                                                <strong>Data Points:</strong> ${user.health_data_summary.total_records || 0}
                                            </div>
                                            <div>
                                                <strong>Shared Datasets:</strong> ${user.health_data_summary.shared_datasets || 0}
                                            </div>
                                            <div>
                                                <strong>Access Grants:</strong> ${user.health_data_summary.access_grants || 0}
                                            </div>
                                            <div>
                                                <strong>Blockchain Records:</strong> ${user.health_data_summary.blockchain_records || 0}
                                            </div>
                                        </div>
                                        <div style="display: flex; gap: 1rem;">
                                            <button onclick="viewUserDataPermissions('${user.id}')" class="btn btn-info">
                                                <i class="fas fa-shield-alt"></i> View Data Permissions
                                            </button>
                                            <button onclick="viewBlockchainRecords('${user.id}')" class="btn btn-secondary">
                                                <i class="fas fa-link"></i> Blockchain Records
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Remove existing modal
    const existingModal = document.getElementById('userProfileModal');
    if (existingModal) {
        existingModal.remove();
    }

    // Add new modal to body
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function getRolePermissions(role) {
    const permissions = {
        'admin': 'Full system access, user management, data administration',
        'medical_professional': 'Patient data access, medical records, clinical tools',
        'researcher': 'Research data access, analysis tools, dataset permissions',
        'insurance': 'Claims data, risk assessment, policy management',
        'user': 'Personal health data, basic surveillance access'
    };
    return permissions[role] || 'Standard user permissions';
}

// Update user role
window.updateUserRole = async function(userId) {
    const newRole = document.getElementById('newUserRole').value;
    
    try {
        const response = await fetch(`${window.location.origin}/api/admin/users/${userId}/role`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('diseaseZoneToken')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ role: newRole })
        });

        const data = await response.json();

        if (data.success) {
            if (typeof showAlert === 'function') {
                showAlert('User role updated successfully', 'success');
            } else {
                alert('User role updated successfully');
            }
            // Refresh the modal
            closeModal('userProfileModal');
            setTimeout(() => viewUserProfile(userId), 100);
        } else {
            if (typeof showAlert === 'function') {
                showAlert(data.message || 'Failed to update user role', 'error');
            } else {
                alert(data.message || 'Failed to update user role');
            }
        }
    } catch (error) {
        console.error('Error updating user role:', error);
        if (typeof showAlert === 'function') {
            showAlert('Error updating user role', 'error');
        } else {
            alert('Error updating user role');
        }
    }
};

// Edit user roles (simplified interface)
window.editUserRoles = function(userId) {
    viewUserProfile(userId);
};

// Group search functionality
window.searchGroups = async function() {
    const searchTerm = document.getElementById('groupSearch').value.trim();
    const statusFilter = document.getElementById('groupStatusFilter').value;
    const resultsDiv = document.getElementById('groupSearchResults');
    
    if (!searchTerm && !statusFilter) {
        resultsDiv.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">Enter a search term or select a status filter</p>';
        return;
    }

    resultsDiv.innerHTML = '<div style="text-align: center; padding: 2rem;"><i class="fas fa-spinner fa-spin"></i> Searching groups...</div>';

    try {
        const params = new URLSearchParams();
        if (searchTerm) params.append('search', searchTerm);
        if (statusFilter) params.append('status', statusFilter);

        const response = await fetch(`${window.location.origin}/api/admin/groups/search?${params}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('diseaseZoneToken')}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (data.success && data.groups) {
            displayGroupResults(data.groups);
        } else {
            resultsDiv.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                <i class="fas fa-layer-group"></i><br>
                No groups found matching your criteria
            </div>`;
        }
    } catch (error) {
        console.error('Error searching groups:', error);
        resultsDiv.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--error-color);">
            <i class="fas fa-exclamation-triangle"></i><br>
            Error searching groups. Please try again.
        </div>`;
    }
};

function displayGroupResults(groups) {
    const resultsDiv = document.getElementById('groupSearchResults');
    
    const html = `
        <div style="margin-bottom: 1rem; font-weight: 600; color: var(--text-primary);">
            Found ${groups.length} group${groups.length !== 1 ? 's' : ''}
        </div>
        <div style="max-height: 500px; overflow-y: auto;">
            ${groups.map(group => `
                <div class="group-result-card" style="border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; margin-bottom: 1rem; background: white;">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.75rem;">
                        <div style="flex: 1;">
                            <h4 style="margin: 0; color: var(--primary-color); font-size: 1.1rem;">
                                ${group.name}
                            </h4>
                            <p style="margin: 0.5rem 0; color: var(--text-secondary);">${group.description || 'No description provided'}</p>
                            <div style="display: flex; gap: 1rem; margin-top: 0.5rem;">
                                <span style="background: ${group.status === 'active' ? '#28a745' : '#6c757d'}; color: white; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.85rem; font-weight: 600;">
                                    ${group.status}
                                </span>
                                <span style="color: var(--text-secondary); font-size: 0.9rem;">
                                    Members: ${group.member_count || 0}
                                </span>
                                <span style="color: var(--text-secondary); font-size: 0.9rem;">
                                    Created: ${new Date(group.created_at).toLocaleDateString()}
                                </span>
                            </div>
                        </div>
                        <div style="display: flex; gap: 0.5rem;">
                            <button onclick="viewGroupDetails('${group.id}')" class="btn btn-sm btn-info">
                                <i class="fas fa-eye"></i> View
                            </button>
                            <button onclick="editGroup('${group.id}')" class="btn btn-sm btn-warning">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                            ${group.status === 'active' ? `
                                <button onclick="hideGroup('${group.id}')" class="btn btn-sm btn-secondary">
                                    <i class="fas fa-eye-slash"></i> Hide
                                </button>
                            ` : `
                                <button onclick="restoreGroup('${group.id}')" class="btn btn-sm btn-success">
                                    <i class="fas fa-undo"></i> Restore
                                </button>
                            `}
                        </div>
                    </div>
                    ${group.permissions && group.permissions.length > 0 ? `
                        <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--border-color);">
                            <strong style="font-size: 0.9rem; color: var(--text-primary);">Data Permissions:</strong>
                            <div style="display: flex; gap: 0.5rem; margin-top: 0.25rem; flex-wrap: wrap;">
                                ${group.permissions.slice(0, 3).map(perm => `
                                    <span style="background: #fff3cd; color: #856404; padding: 0.2rem 0.5rem; border-radius: 8px; font-size: 0.8rem;">
                                        ${perm.name}
                                    </span>
                                `).join('')}
                                ${group.permissions.length > 3 ? `
                                    <span style="color: var(--text-secondary); font-size: 0.8rem;">
                                        +${group.permissions.length - 3} more
                                    </span>
                                ` : ''}
                            </div>
                        </div>
                    ` : ''}
                </div>
            `).join('')}
        </div>
    `;
    
    resultsDiv.innerHTML = html;
}

// Load admin stats on page load
window.loadAdminStats = async function() {
    try {
        const response = await fetch(`${window.location.origin}/api/admin/stats`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('diseaseZoneToken')}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (data.success) {
            document.getElementById('totalUsers').textContent = data.stats.total_users || 0;
            document.getElementById('totalAdmins').textContent = data.stats.admin_users || 0;
            document.getElementById('totalGroups').textContent = data.stats.total_groups || 0;
            document.getElementById('dataPermissions').textContent = data.stats.data_permissions || 0;
        }
    } catch (error) {
        console.error('Error loading admin stats:', error);
    }
};

// Initialize admin panel when view is shown
window.initializeAdminPanel = function() {
    loadAdminStats();
    // Auto-load recent activity, etc.
};

// User tagging system
window.tagUser = async function(userId, tag) {
    try {
        const response = await fetch(`${window.location.origin}/api/admin/users/${userId}/tag`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('diseaseZoneToken')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ tag: tag })
        });

        const data = await response.json();
        if (data.success) {
            showAlert('User tagged successfully', 'success');
            // Refresh user view if open
            if (document.getElementById('userProfileModal')) {
                viewUserProfile(userId);
            }
        } else {
            showAlert(data.message || 'Failed to tag user', 'error');
        }
    } catch (error) {
        console.error('Error tagging user:', error);
        showAlert('Error tagging user', 'error');
    }
};

// Remove user tag
window.removeUserTag = async function(userId, tag) {
    try {
        const response = await fetch(`${window.location.origin}/api/admin/users/${userId}/tag`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('diseaseZoneToken')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ tag: tag })
        });

        const data = await response.json();
        if (data.success) {
            showAlert('Tag removed successfully', 'success');
            // Refresh user view if open
            if (document.getElementById('userProfileModal')) {
                viewUserProfile(userId);
            }
        } else {
            showAlert(data.message || 'Failed to remove tag', 'error');
        }
    } catch (error) {
        console.error('Error removing user tag:', error);
        showAlert('Error removing user tag', 'error');
    }
};

// Assign user rights
window.assignUserRights = async function(userId, rights) {
    try {
        const response = await fetch(`${window.location.origin}/api/admin/users/${userId}/rights`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('diseaseZoneToken')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ rights: rights })
        });

        const data = await response.json();
        if (data.success) {
            showAlert('Rights assigned successfully', 'success');
        } else {
            showAlert(data.message || 'Failed to assign rights', 'error');
        }
    } catch (error) {
        console.error('Error assigning user rights:', error);
        showAlert('Error assigning user rights', 'error');
    }
};

// Create user group
window.createUserGroup = async function() {
    const name = document.getElementById('groupName')?.value;
    const description = document.getElementById('groupDescription')?.value;
    const type = document.getElementById('groupType')?.value || 'standard';

    if (!name) {
        showAlert('Group name is required', 'error');
        return;
    }

    try {
        const response = await fetch(`${window.location.origin}/api/admin/groups/create`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('diseaseZoneToken')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: name,
                description: description,
                type: type
            })
        });

        const data = await response.json();
        if (data.success) {
            showAlert('Group created successfully', 'success');
            // Clear form
            if (document.getElementById('groupName')) document.getElementById('groupName').value = '';
            if (document.getElementById('groupDescription')) document.getElementById('groupDescription').value = '';
            // Refresh groups list if visible
            if (document.getElementById('groupSearchResults')) {
                searchGroups();
            }
        } else {
            showAlert(data.message || 'Failed to create group', 'error');
        }
    } catch (error) {
        console.error('Error creating user group:', error);
        showAlert('Error creating user group', 'error');
    }
};

// Add user to group
window.addUserToGroup = async function(userId) {
    // This would show a modal to select which group to add user to
    // For now, just show a placeholder
    showAlert('Add to group functionality - implementation needed for group selection UI', 'info');
};

// Remove user from group
window.removeUserFromGroup = async function(userId, groupId) {
    try {
        const response = await fetch(`${window.location.origin}/api/admin/groups/${groupId}/members/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('diseaseZoneToken')}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        if (data.success) {
            showAlert('User removed from group successfully', 'success');
            // Refresh user profile if open
            if (document.getElementById('userProfileModal')) {
                viewUserProfile(userId);
            }
        } else {
            showAlert(data.message || 'Failed to remove user from group', 'error');
        }
    } catch (error) {
        console.error('Error removing user from group:', error);
        showAlert('Error removing user from group', 'error');
    }
};

// View user data permissions
window.viewUserDataPermissions = async function(userId) {
    try {
        const response = await fetch(`${window.location.origin}/api/admin/users/${userId}/data-permissions`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('diseaseZoneToken')}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        if (data.success) {
            displayDataPermissionsModal(data.permissions, userId);
        } else {
            showAlert('Failed to load data permissions', 'error');
        }
    } catch (error) {
        console.error('Error loading data permissions:', error);
        showAlert('Error loading data permissions', 'error');
    }
};

// View blockchain records
window.viewBlockchainRecords = async function(userId) {
    try {
        const response = await fetch(`${window.location.origin}/api/admin/users/${userId}/blockchain-records`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('diseaseZoneToken')}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        if (data.success) {
            displayBlockchainRecordsModal(data.records, userId);
        } else {
            showAlert('Failed to load blockchain records', 'error');
        }
    } catch (error) {
        console.error('Error loading blockchain records:', error);
        showAlert('Error loading blockchain records', 'error');
    }
};

// View group details
window.viewGroupDetails = async function(groupId) {
    try {
        const response = await fetch(`${window.location.origin}/api/admin/groups/${groupId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('diseaseZoneToken')}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        if (data.success) {
            displayGroupDetailsModal(data.group);
        } else {
            showAlert('Failed to load group details', 'error');
        }
    } catch (error) {
        console.error('Error loading group details:', error);
        showAlert('Error loading group details', 'error');
    }
};

// Edit group
window.editGroup = async function(groupId) {
    // This would open a modal for editing group details
    showAlert('Edit group functionality - implementation needed for edit UI', 'info');
};

// Hide group (soft delete)
window.hideGroup = async function(groupId) {
    if (confirm('Are you sure you want to hide this group? It can be restored later.')) {
        try {
            const response = await fetch(`${window.location.origin}/api/admin/groups/${groupId}/hide`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('diseaseZoneToken')}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();
            if (data.success) {
                showAlert('Group hidden successfully', 'success');
                searchGroups(); // Refresh groups list
            } else {
                showAlert(data.message || 'Failed to hide group', 'error');
            }
        } catch (error) {
            console.error('Error hiding group:', error);
            showAlert('Error hiding group', 'error');
        }
    }
};

// Restore group
window.restoreGroup = async function(groupId) {
    try {
        const response = await fetch(`${window.location.origin}/api/admin/groups/${groupId}/restore`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('diseaseZoneToken')}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        if (data.success) {
            showAlert('Group restored successfully', 'success');
            searchGroups(); // Refresh groups list
        } else {
            showAlert(data.message || 'Failed to restore group', 'error');
        }
    } catch (error) {
        console.error('Error restoring group:', error);
        showAlert('Error restoring group', 'error');
    }
};

// Helper function to display data permissions modal
function displayDataPermissionsModal(permissions, userId) {
    const modalHtml = `
        <div class="modal active" id="dataPermissionsModal">
            <div class="modal-overlay" onclick="closeModal('dataPermissionsModal')">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3><i class="fas fa-shield-alt"></i> Data Permissions</h3>
                        <button class="modal-close" onclick="closeModal('dataPermissionsModal')">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="permissions-list">
                            ${permissions.map(permission => `
                                <div class="permission-item" style="border: 1px solid var(--border-color); padding: 1rem; margin-bottom: 1rem; border-radius: 8px;">
                                    <h4>${permission.data_type}</h4>
                                    <p>Access Level: ${permission.access_level}</p>
                                    <p>Granted: ${new Date(permission.granted_at).toLocaleDateString()}</p>
                                    ${permission.expires_at ? `<p>Expires: ${new Date(permission.expires_at).toLocaleDateString()}</p>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Remove existing modal
    const existingModal = document.getElementById('dataPermissionsModal');
    if (existingModal) existingModal.remove();

    // Add new modal
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// Helper function to display blockchain records modal
function displayBlockchainRecordsModal(records, userId) {
    const modalHtml = `
        <div class="modal active" id="blockchainRecordsModal">
            <div class="modal-overlay" onclick="closeModal('blockchainRecordsModal')">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3><i class="fas fa-link"></i> Blockchain Records</h3>
                        <button class="modal-close" onclick="closeModal('blockchainRecordsModal')">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="records-list">
                            ${records.map(record => `
                                <div class="record-item" style="border: 1px solid var(--border-color); padding: 1rem; margin-bottom: 1rem; border-radius: 8px;">
                                    <h4>Record ID: ${record.id}</h4>
                                    <p>Type: ${record.type}</p>
                                    <p>Hash: ${record.hash}</p>
                                    <p>Created: ${new Date(record.created_at).toLocaleDateString()}</p>
                                    <a href="#" onclick="viewOnBlockchain('${record.hash}')" class="btn btn-sm btn-primary">
                                        <i class="fas fa-external-link-alt"></i> View on Blockchain
                                    </a>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Remove existing modal
    const existingModal = document.getElementById('blockchainRecordsModal');
    if (existingModal) existingModal.remove();

    // Add new modal
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// Helper function to display group details modal
function displayGroupDetailsModal(group) {
    const modalHtml = `
        <div class="modal active" id="groupDetailsModal">
            <div class="modal-overlay" onclick="closeModal('groupDetailsModal')">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3><i class="fas fa-users"></i> ${group.name}</h3>
                        <button class="modal-close" onclick="closeModal('groupDetailsModal')">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="group-details">
                            <p><strong>Description:</strong> ${group.description || 'No description'}</p>
                            <p><strong>Type:</strong> ${group.type}</p>
                            <p><strong>Created:</strong> ${new Date(group.created_at).toLocaleDateString()}</p>
                            <p><strong>Status:</strong> ${group.status}</p>
                            <p><strong>Members:</strong> ${group.member_count || 0}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Remove existing modal
    const existingModal = document.getElementById('groupDetailsModal');
    if (existingModal) existingModal.remove();

    // Add new modal
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// Helper function to view record on blockchain
window.viewOnBlockchain = function(hash) {
    showAlert(`Blockchain record hash: ${hash} - Integration with blockchain explorer needed`, 'info');
};

// Helper function to close modals
window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.remove();
    }
};

console.log('✅ Admin functions loaded successfully');