// Global Application State
class DiseaseZoneApp {
    constructor() {
        this.currentUser = null;
        this.currentView = 'guest';
        this.apiBaseUrl = window.location.origin;
        this.ledgerApiUrl = `${window.location.protocol}//${window.location.hostname}:4000`;
        this.isAuthenticated = false;
        this.userRole = null;

        this.init();
    }

    async init() {
        console.log('🧬 Initializing diseaseZone Application...');

        // Check for existing authentication
        await this.checkAuthStatus();

        // Initialize UI
        this.initializeUI();

        // Load initial data
        await this.loadInitialData();

        // Set up event listeners
        this.setupEventListeners();

        console.log('✅ diseaseZone Application initialized');
    }

    // ===== AUTHENTICATION =====
    async checkAuthStatus() {
        try {
            const token = localStorage.getItem('diseaseZoneToken');
            if (!token) {
                this.showView('guest');
                return;
            }

            const response = await this.apiCall('/api/user/profile', 'GET', null, {
                'Authorization': `Bearer ${token}`
            });

            if (response.success) {
                this.currentUser = response.user;
                this.isAuthenticated = true;
                this.userRole = response.user.role;
                this.updateUserInterface();
                this.determineDefaultView();
            } else {
                localStorage.removeItem('diseaseZoneToken');
                this.showView('guest');
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            localStorage.removeItem('diseaseZoneToken');
            this.showView('guest');
        }
    }

    async login(email, password) {
        try {
            this.showLoading(true);

            const response = await this.apiCall('/api/auth/login', 'POST', {
                email,
                password
            });

            if (response.success) {
                localStorage.setItem('diseaseZoneToken', response.token);
                this.currentUser = response.user;
                this.isAuthenticated = true;
                this.userRole = response.user.role;

                this.showAlert('Login successful!', 'success');
                this.closeModal('loginModal');
                this.updateUserInterface();
                this.determineDefaultView();

                // Load user-specific data
                await this.loadUserData();
            } else {
                this.showAlert(response.message || 'Login failed', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showAlert('Login failed. Please try again.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async register(userData) {
        try {
            this.showLoading(true);

            const response = await this.apiCall('/api/auth/register', 'POST', userData);

            if (response.success) {
                this.showAlert('Registration successful! Please login.', 'success');
                this.closeModal('registerModal');
                this.openModal('loginModal');
            } else {
                this.showAlert(response.message || 'Registration failed', 'error');
            }
        } catch (error) {
            console.error('Registration error:', error);
            this.showAlert('Registration failed. Please try again.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    logout() {
        localStorage.removeItem('diseaseZoneToken');
        this.currentUser = null;
        this.isAuthenticated = false;
        this.userRole = null;
        this.showView('guest');
        this.updateUserInterface();
        this.showAlert('Logged out successfully', 'success');
    }

    // ===== UI MANAGEMENT =====
    initializeUI() {
        this.createModals();
        this.showView('guest');
        this.updateUserInterface();
    }

    updateUserInterface() {
        const navLinks = document.getElementById('navLinks');
        const userAvatar = document.getElementById('userAvatar');

        if (this.isAuthenticated && this.currentUser) {
            // Update avatar
            const initials = this.getInitials(this.currentUser.first_name, this.currentUser.last_name);
            userAvatar.textContent = initials;
            userAvatar.onclick = () => this.toggleUserMenu();

            // Update navigation based on role
            this.updateNavigationForRole();
        } else {
            userAvatar.innerHTML = '<i class="fas fa-user"></i>';
            userAvatar.onclick = () => this.openModal('loginModal');
        }
    }

    updateNavigationForRole() {
        const navLinks = document.getElementById('navLinks');
        let links = [];

        switch (this.userRole) {
            case 'medical_professional':
                links = [
                    { text: 'Dashboard', view: 'medical' },
                    { text: 'Patients', view: 'patients' },
                    { text: 'Research', view: 'research' },
                    { text: 'Compliance', view: 'compliance' },
                    { text: 'Blockchain', view: 'blockchain' }
                ];
                break;
            case 'insurance':
                links = [
                    { text: 'Analytics', view: 'insurance' },
                    { text: 'Risk Models', view: 'risk' },
                    { text: 'Claims', view: 'claims' },
                    { text: 'Blockchain', view: 'blockchain' }
                ];
                break;
            case 'researcher':
                links = [
                    { text: 'Dashboard', view: 'user' },
                    { text: 'Data Access', view: 'research' },
                    { text: 'Marketplace', view: 'blockchain' },
                    { text: 'Analytics', view: 'analytics' }
                ];
                break;
            default: // regular user
                links = [
                    { text: 'Dashboard', view: 'user' },
                    { text: 'Health Data', view: 'health' },
                    { text: 'Surveillance', view: 'surveillance' },
                    { text: 'Blockchain', view: 'blockchain' }
                ];
        }

        // Update navigation
        navLinks.innerHTML = links.map(link =>
            `<li><a href="#" onclick="app.showView('${link.view}')" class="nav-link">${link.text}</a></li>`
        ).join('');
    }

    showView(viewName) {
        // Hide all views
        document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));

        // Show selected view
        const targetView = document.getElementById(`${viewName}View`);
        if (targetView) {
            targetView.classList.add('active');
            this.currentView = viewName;
        } else {
            console.error(`View "${viewName}View" not found`);
            // Handle special cases
            if (viewName === 'demo') {
                // Redirect to mapping demo
                window.location.href = '/mapping-demo.html';
                return;
            }
            // Fallback to guest view if view doesn't exist
            this.showView('guest');
            return;
        }

        // Update active navigation
        document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
        const activeLink = document.querySelector(`[onclick*="${viewName}"]`);
        if (activeLink) activeLink.classList.add('active');

        // Load view-specific data
        this.loadViewData(viewName);
    }

    determineDefaultView() {
        if (!this.isAuthenticated) {
            this.showView('guest');
            return;
        }

        switch (this.userRole) {
            case 'medical_professional':
                this.showView('medical');
                break;
            case 'insurance':
                this.showView('insurance');
                break;
            case 'researcher':
                this.showView('user');
                break;
            default:
                this.showView('user');
        }
    }

    // ===== DATA LOADING =====
    async loadInitialData() {
        try {
            // Load public health statistics
            await this.loadPublicHealthStats();
        } catch (error) {
            console.error('Failed to load initial data:', error);
        }
    }

    async loadUserData() {
        if (!this.isAuthenticated) return;

        try {
            const token = localStorage.getItem('diseaseZoneToken');
            const headers = { 'Authorization': `Bearer ${token}` };

            // Load user statistics
            const [familyDiseases, analysisHistory, blockchainMetrics] = await Promise.all([
                this.apiCall('/api/user/family-diseases', 'GET', null, headers),
                this.apiCall('/api/user/symptom-analysis/history', 'GET', null, headers),
                this.loadBlockchainData()
            ]);

            // Update user dashboard stats
            this.updateUserStats({
                dataPoints: familyDiseases.success ? familyDiseases.familyDiseases.length : 0,
                analysisCount: analysisHistory.success ? analysisHistory.sessions.length : 0,
                blockchainData: blockchainMetrics
            });

        } catch (error) {
            console.error('Failed to load user data:', error);
        }
    }

    async loadViewData(viewName) {
        switch (viewName) {
            case 'user':
                await this.loadUserDashboardData();
                break;
            case 'medical':
                await this.loadMedicalDashboardData();
                break;
            case 'insurance':
                await this.loadInsuranceDashboardData();
                break;
            case 'blockchain':
                await this.loadBlockchainDashboardData();
                break;
        }
    }

    async loadUserDashboardData() {
        try {
            if (!this.isAuthenticated) return;

            const token = localStorage.getItem('diseaseZoneToken');
            const headers = { 'Authorization': `Bearer ${token}` };

            // Load user activity
            const activityResponse = await this.apiCall('/api/user/family-diseases', 'GET', null, headers);

            if (activityResponse.success) {
                const activityHtml = activityResponse.familyDiseases.slice(0, 5).map(disease => `
                    <div class="mb-2 p-2" style="border-left: 3px solid var(--primary-color);">
                        <strong>${disease.disease_name}</strong><br>
                        <small style="color: var(--text-secondary);">${new Date(disease.created_at).toLocaleDateString()}</small>
                    </div>
                `).join('') || '<p class="text-center" style="color: var(--text-secondary);">No recent activity</p>';

                document.getElementById('userActivity').innerHTML = activityHtml;
            }

            // Update stats
            document.getElementById('userDataPoints').textContent = activityResponse.success ? activityResponse.familyDiseases.length : '0';
            document.getElementById('userLastUpdate').textContent = activityResponse.success && activityResponse.familyDiseases.length > 0 ?
                new Date(activityResponse.familyDiseases[0].created_at).toLocaleDateString() : 'Never';

        } catch (error) {
            console.error('Failed to load user dashboard data:', error);
        }
    }

    async loadMedicalDashboardData() {
        try {
            if (!this.isAuthenticated || this.userRole !== 'medical_professional') return;

            // Load medical professional data
            const outbreakResponse = await this.apiCall('/api/std/data', 'GET');
            const alertsResponse = await this.apiCall('/global/monitoring', 'GET');

            // Update medical stats
            document.getElementById('totalPatients').textContent = Math.floor(Math.random() * 500) + 100;
            document.getElementById('activeOutbreaks').textContent = alertsResponse.success ?
                alertsResponse.monitoring_data?.active_alerts || '0' : '0';
            document.getElementById('pendingReviews').textContent = Math.floor(Math.random() * 20);
            document.getElementById('researchContributions').textContent = Math.floor(Math.random() * 50);

        } catch (error) {
            console.error('Failed to load medical dashboard data:', error);
        }
    }

    async loadInsuranceDashboardData() {
        try {
            if (!this.isAuthenticated || this.userRole !== 'insurance') return;

            // Update insurance stats with mock data
            document.getElementById('totalPolicies').textContent = Math.floor(Math.random() * 10000) + 5000;
            document.getElementById('riskAssessments').textContent = Math.floor(Math.random() * 1000) + 500;
            document.getElementById('claimsProcessed').textContent = Math.floor(Math.random() * 500) + 200;
            document.getElementById('costSavings').textContent = '$' + (Math.floor(Math.random() * 1000000) + 500000).toLocaleString();

        } catch (error) {
            console.error('Failed to load insurance dashboard data:', error);
        }
    }

    async loadBlockchainDashboardData() {
        try {
            // Load blockchain data from ledger API
            const blockchainData = await this.loadBlockchainData();

            if (blockchainData) {
                document.getElementById('healthTokenBalance').textContent = blockchainData.tokenBalance || '0';
                document.getElementById('dataContributions').textContent = blockchainData.contributions || '0';
                document.getElementById('marketplaceSales').textContent = blockchainData.sales || '0';
                document.getElementById('networkStatus').textContent = blockchainData.networkStatus || 'Offline';
            }

        } catch (error) {
            console.error('Failed to load blockchain dashboard data:', error);
        }
    }

    async loadBlockchainData() {
        try {
            const [tokenResponse, marketplaceResponse, bridgeResponse] = await Promise.all([
                this.apiCall('/api/v1/token/info', 'GET', null, {}, this.ledgerApiUrl),
                this.apiCall('/api/v1/marketplace/status', 'GET', null, {}, this.ledgerApiUrl),
                this.apiCall('/api/v1/bridge/status', 'GET', null, {}, this.ledgerApiUrl)
            ]);

            return {
                tokenBalance: tokenResponse.success ? '1,234' : '0', // Mock user balance
                contributions: tokenResponse.success ? '15' : '0',
                sales: marketplaceResponse.success ? marketplaceResponse.status?.total_licenses_sold || '0' : '0',
                networkStatus: bridgeResponse.success ? 'Online' : 'Offline'
            };
        } catch (error) {
            console.error('Failed to load blockchain data:', error);
            return null;
        }
    }

    // ===== MODAL MANAGEMENT =====
    createModals() {
        const modalHtml = `
            <!-- Login Modal -->
            <div class="modal" id="loginModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Login to diseaseZone</h3>
                        <button class="modal-close" onclick="app.closeModal('loginModal')">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <form onsubmit="app.handleLogin(event)">
                            <div class="form-group">
                                <label class="form-label">Email</label>
                                <input type="email" class="form-input" name="email" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Password</label>
                                <input type="password" class="form-input" name="password" required>
                            </div>
                            <div class="form-group">
                                <button type="submit" class="btn btn-primary" style="width: 100%;">
                                    <i class="fas fa-sign-in-alt"></i>
                                    Login
                                </button>
                            </div>
                            <div class="text-center">
                                <a href="#" onclick="app.closeModal('loginModal'); app.openModal('registerModal');">
                                    Don't have an account? Register here
                                </a>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            <!-- Register Modal -->
            <div class="modal" id="registerModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Create Account</h3>
                        <button class="modal-close" onclick="app.closeModal('registerModal')">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <form onsubmit="app.handleRegister(event)">
                            <div class="form-group">
                                <label class="form-label">First Name</label>
                                <input type="text" class="form-input" name="first_name" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Last Name</label>
                                <input type="text" class="form-input" name="last_name" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Email</label>
                                <input type="email" class="form-input" name="email" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Password</label>
                                <input type="password" class="form-input" name="password" required minlength="8"
                                       title="Password must be at least 8 characters and contain uppercase, lowercase, number, and special character">
                                <small class="form-help">Must contain: uppercase, lowercase, number, and special character (!@#$%^&*)</small>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Role</label>
                                <select class="form-select" name="role" required onchange="app.handleRoleChange(event)">
                                    <option value="">Select your role</option>
                                    <option value="user">Patient/Individual</option>
                                    <option value="medical_professional">Medical Professional</option>
                                    <option value="researcher">Researcher</option>
                                    <option value="insurance">Insurance Company</option>
                                </select>
                            </div>
                            <div id="additionalFields" style="display: none;">
                                <!-- Additional fields will be inserted here based on role -->
                            </div>
                            <div class="form-group">
                                <div class="form-checkbox">
                                    <input type="checkbox" name="terms" required>
                                    <label>I agree to the Terms of Service and Privacy Policy</label>
                                </div>
                            </div>
                            <div class="form-group">
                                <button type="submit" class="btn btn-primary" style="width: 100%;">
                                    <i class="fas fa-user-plus"></i>
                                    Create Account
                                </button>
                            </div>
                            <div class="text-center">
                                <a href="#" onclick="app.closeModal('registerModal'); app.openModal('loginModal');">
                                    Already have an account? Login here
                                </a>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            <!-- Add Disease Modal -->
            <div class="modal" id="addDiseaseModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Add Health Data</h3>
                        <button class="modal-close" onclick="app.closeModal('addDiseaseModal')">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <form onsubmit="app.handleAddDisease(event)">
                            <div class="form-group">
                                <label class="form-label">Disease/Condition</label>
                                <select class="form-select" name="disease_id" required>
                                    <option value="">Select disease</option>
                                    <option value="1">HIV/AIDS</option>
                                    <option value="2">COVID-19</option>
                                    <option value="3">Influenza</option>
                                    <option value="4">Tuberculosis</option>
                                    <option value="5">Hepatitis B</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Family Member</label>
                                <select class="form-select" name="family_member" required>
                                    <option value="">Select family member</option>
                                    <option value="self">Myself</option>
                                    <option value="spouse">Spouse/Partner</option>
                                    <option value="child">Child</option>
                                    <option value="parent">Parent</option>
                                    <option value="sibling">Sibling</option>
                                    <option value="grandparent">Grandparent</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Status</label>
                                <select class="form-select" name="has_disease" required>
                                    <option value="">Select status</option>
                                    <option value="true">Has condition</option>
                                    <option value="false">Does not have condition</option>
                                    <option value="unknown">Unknown/Uncertain</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Additional Notes</label>
                                <textarea class="form-input" name="notes" rows="3" placeholder="Any additional information..."></textarea>
                            </div>
                            <div class="form-group">
                                <button type="submit" class="btn btn-primary" style="width: 100%;">
                                    <i class="fas fa-plus"></i>
                                    Add Health Data
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('modals').innerHTML = modalHtml;
    }

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    // ===== EVENT HANDLERS =====
    async handleLogin(event) {
        event.preventDefault();
        const formData = new FormData(event.target);
        const email = formData.get('email');
        const password = formData.get('password');

        await this.login(email, password);
    }

    async handleRegister(event) {
        event.preventDefault();
        const formData = new FormData(event.target);

        const userData = {
            first_name: formData.get('first_name'),
            last_name: formData.get('last_name'),
            email: formData.get('email'),
            password: formData.get('password'),
            role: formData.get('role')
        };

        // Add role-specific fields
        if (userData.role === 'medical_professional') {
            userData.medical_license_number = formData.get('medical_license_number');
            userData.medical_specialty = formData.get('medical_specialty');
            userData.institution_name = formData.get('institution_name');
        }

        await this.register(userData);
    }

    handleRoleChange(event) {
        const role = event.target.value;
        const additionalFieldsDiv = document.getElementById('additionalFields');

        if (role === 'medical_professional') {
            additionalFieldsDiv.style.display = 'block';
            additionalFieldsDiv.innerHTML = `
                <div class="form-group">
                    <label class="form-label">Medical License Number</label>
                    <input type="text" class="form-input" name="medical_license_number" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Medical Specialty</label>
                    <input type="text" class="form-input" name="medical_specialty" required placeholder="e.g., Internal Medicine, Cardiology">
                </div>
                <div class="form-group">
                    <label class="form-label">Institution Name</label>
                    <input type="text" class="form-input" name="institution_name" required placeholder="e.g., General Hospital, Medical Center">
                </div>
            `;
        } else {
            additionalFieldsDiv.style.display = 'none';
            additionalFieldsDiv.innerHTML = '';
        }
    }

    async handleAddDisease(event) {
        event.preventDefault();

        if (!this.isAuthenticated) {
            this.showAlert('Please login to add health data', 'error');
            return;
        }

        const formData = new FormData(event.target);
        const token = localStorage.getItem('diseaseZoneToken');

        try {
            this.showLoading(true);

            const diseaseData = {
                disease_id: parseInt(formData.get('disease_id')),
                family_member: formData.get('family_member'),
                has_disease: formData.get('has_disease') === 'true',
                notes: formData.get('notes')
            };

            const response = await this.apiCall('/api/user/family-diseases', 'POST', diseaseData, {
                'Authorization': `Bearer ${token}`
            });

            if (response.success) {
                this.showAlert('Health data added successfully!', 'success');
                this.closeModal('addDiseaseModal');
                event.target.reset();
                await this.loadUserData(); // Refresh data
            } else {
                this.showAlert(response.message || 'Failed to add health data', 'error');
            }
        } catch (error) {
            console.error('Add disease error:', error);
            this.showAlert('Failed to add health data. Please try again.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    setupEventListeners() {
        // Close modals when clicking outside
        window.addEventListener('click', (event) => {
            if (event.target.classList.contains('modal')) {
                const modalId = event.target.id;
                this.closeModal(modalId);
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                document.querySelectorAll('.modal.active').forEach(modal => {
                    this.closeModal(modal.id);
                });
            }
        });
    }

    // ===== UTILITY FUNCTIONS =====
    async apiCall(endpoint, method = 'GET', data = null, headers = {}, baseUrl = null) {
        const url = (baseUrl || this.apiBaseUrl) + endpoint;
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        if (data && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(url, options);
        return await response.json();
    }

    showAlert(message, type = 'info') {
        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        alert.innerHTML = `
            ${message}
            <button onclick="this.parentElement.remove()" style="float: right; background: none; border: none; cursor: pointer;">
                <i class="fas fa-times"></i>
            </button>
        `;

        document.body.appendChild(alert);

        setTimeout(() => {
            if (alert.parentElement) {
                alert.remove();
            }
        }, 5000);
    }

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (show) {
            overlay.classList.add('active');
        } else {
            overlay.classList.remove('active');
        }
    }

    getInitials(firstName, lastName) {
        const first = firstName ? firstName.charAt(0).toUpperCase() : '';
        const last = lastName ? lastName.charAt(0).toUpperCase() : '';
        return first + last || '?';
    }

    toggleUserMenu() {
        if (this.isAuthenticated) {
            // Show user menu dropdown
            const userMenu = `
                <div style="position: absolute; top: 100%; right: 0; background: white; border: 1px solid var(--border-color); border-radius: var(--border-radius); box-shadow: var(--shadow-lg); z-index: 1000; min-width: 200px;">
                    <div style="padding: 1rem; border-bottom: 1px solid var(--border-color);">
                        <strong>${this.currentUser.first_name} ${this.currentUser.last_name}</strong><br>
                        <small style="color: var(--text-secondary);">${this.currentUser.email}</small>
                    </div>
                    <div style="padding: 0.5rem;">
                        <a href="#" onclick="app.showView('user'); app.hideUserMenu();" style="display: block; padding: 0.5rem; text-decoration: none; color: var(--text-primary); border-radius: 4px;" onmouseover="this.style.backgroundColor='var(--light-color)';" onmouseout="this.style.backgroundColor='transparent';">
                            <i class="fas fa-user"></i> Profile
                        </a>
                        <a href="#" onclick="app.showView('blockchain'); app.hideUserMenu();" style="display: block; padding: 0.5rem; text-decoration: none; color: var(--text-primary); border-radius: 4px;" onmouseover="this.style.backgroundColor='var(--light-color)';" onmouseout="this.style.backgroundColor='transparent';">
                            <i class="fas fa-coins"></i> HEALTH Tokens
                        </a>
                        <hr style="margin: 0.5rem 0;">
                        <a href="#" onclick="app.logout(); app.hideUserMenu();" style="display: block; padding: 0.5rem; text-decoration: none; color: var(--error-color); border-radius: 4px;" onmouseover="this.style.backgroundColor='var(--light-color)';" onmouseout="this.style.backgroundColor='transparent';">
                            <i class="fas fa-sign-out-alt"></i> Logout
                        </a>
                    </div>
                </div>
            `;

            document.getElementById('userMenu').innerHTML = `
                <div class="user-avatar">
                    ${this.getInitials(this.currentUser.first_name, this.currentUser.last_name)}
                </div>
                ${userMenu}
            `;

            // Close menu when clicking outside
            setTimeout(() => {
                document.addEventListener('click', this.hideUserMenu.bind(this), { once: true });
            }, 100);
        } else {
            this.openModal('loginModal');
        }
    }

    hideUserMenu() {
        document.getElementById('userMenu').innerHTML = `
            <div class="user-avatar" onclick="app.toggleUserMenu()" id="userAvatar">
                ${this.isAuthenticated ? this.getInitials(this.currentUser.first_name, this.currentUser.last_name) : '<i class="fas fa-user"></i>'}
            </div>
        `;
    }

    updateUserStats(stats) {
        if (stats.dataPoints !== undefined) {
            document.getElementById('userDataPoints').textContent = stats.dataPoints;
        }
        if (stats.analysisCount !== undefined) {
            document.getElementById('userTokensEarned').textContent = stats.analysisCount * 10; // Mock calculation
        }
        if (stats.blockchainData) {
            document.getElementById('userTokensEarned').textContent = stats.blockchainData.tokenBalance || '0';
        }
    }

    async loadPublicHealthStats() {
        try {
            // Load public statistics for guest view
            const response = await this.apiCall('/api/std/summary', 'GET');
            // Update any public statistics in the guest view
        } catch (error) {
            console.error('Failed to load public health stats:', error);
        }
    }
}

// Global functions for onclick handlers
window.showView = (viewName) => {
    if (window.app) {
        window.app.showView(viewName);
    } else {
        console.warn('App not initialized yet');
    }
};
window.openModal = (modalId) => {
    if (window.app) {
        window.app.openModal(modalId);
    } else {
        console.warn('App not initialized yet');
    }
};
window.closeModal = (modalId) => {
    if (window.app) {
        window.app.closeModal(modalId);
    } else {
        console.warn('App not initialized yet');
    }
};
window.toggleUserMenu = () => {
    if (window.app) {
        window.app.toggleUserMenu();
    } else {
        console.warn('App not initialized yet');
    }
};
window.toggleMobileMenu = () => {
    const navLinks = document.getElementById('navLinks');
    navLinks.style.display = navLinks.style.display === 'flex' ? 'none' : 'flex';
};

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    window.app = new DiseaseZoneApp();
});

console.log('🧬 diseaseZone Frontend Application Loaded');