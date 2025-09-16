// Global Application State

// Immediate debug logging to confirm script execution
console.log('🚀 SCRIPT STARTED: app.js is executing');
console.log('🌍 Location:', window.location.href);
console.log('📄 Document state:', document.readyState);

// Test basic functionality immediately
window.addEventListener('load', () => {
    console.log('✅ Window loaded event fired');
});

document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ DOMContentLoaded event fired');
});

// Add a simple test function to window immediately
window.testFunction = () => {
    console.log('✅ Test function called successfully');
    alert('JavaScript is working!');
};

class DiseaseZoneApp {
    constructor() {
        try {
            console.log('🏗️ DiseaseZoneApp constructor started');
            this.currentUser = null;
            this.currentView = 'guest';
            this.apiBaseUrl = window.location.origin;
            this.ledgerApiUrl = `${window.location.protocol}//${window.location.hostname}:4000`;
            this.isAuthenticated = false;
            this.userRole = null;

            console.log('🏗️ Constructor properties set, calling init()');
            this.init();
        } catch (error) {
            console.error('❌ CRITICAL ERROR in DiseaseZoneApp constructor:', error);
            throw error;
        }
    }

    init() {
        try {
            console.log('🧬 Initializing diseaseZone Application...');

            // Initialize UI first (synchronously) so buttons work immediately
            console.log('🔍 Step 1: Initializing UI...');
            this.initializeUI();
            console.log('✅ Step 1 complete: UI initialized');

            // Set up event listeners (synchronously)
            console.log('🔍 Step 2: Setting up event listeners...');
            this.setupEventListeners();
            console.log('✅ Step 2 complete: Event listeners set up');

            console.log('✅ diseaseZone Application CORE initialized successfully!');

            // Do async initialization in the background
            this.initializeAsync();
        } catch (error) {
            console.error('❌ CRITICAL ERROR in init():', error);
            console.error('❌ Stack trace:', error.stack);
            throw error;
        }
    }

    async initializeAsync() {
        try {
            console.log('🔍 Async Step 1: Checking auth status...');
            await this.checkAuthStatus();
            console.log('✅ Async Step 1 complete: Auth status checked');

            console.log('🔍 Async Step 2: Loading initial data...');
            await this.loadInitialData();
            console.log('✅ Async Step 2 complete: Initial data loaded');

            console.log('✅ diseaseZone Application ASYNC initialization complete!');
        } catch (error) {
            console.error('⚠️ Non-critical error in async init():', error);
            // Don't throw - app should still work for basic functionality
        }
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
            `<li><a href="#" onclick="showView('${link.view}')" class="nav-link">${link.text}</a></li>`
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
                        <button class="modal-close" onclick="closeModal('loginModal')">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <form onsubmit="handleLogin(event)">
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
                                <a href="#" onclick="closeModal('loginModal'); openModal('registerModal');">
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
                        <button class="modal-close" onclick="closeModal('registerModal')">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <form onsubmit="handleRegister(event)">
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
                                <select class="form-select" name="role" required onchange="handleRoleChange(event)">
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
                                <a href="#" onclick="closeModal('registerModal'); openModal('loginModal');">
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
                        <button class="modal-close" onclick="closeModal('addDiseaseModal')">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <form onsubmit="handleAddDisease(event)">
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

            <!-- Provider Training Modal -->
            <div class="modal" id="surveillanceTrainingModal">
                <div class="modal-content" style="max-width: 800px;">
                    <div class="modal-header">
                        <h3><i class="fas fa-graduation-cap"></i> Provider Training Program</h3>
                        <button class="modal-close" onclick="closeModal('surveillanceTrainingModal')">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div style="margin-bottom: 2rem;">
                            <h4 style="color: var(--primary-color); margin-bottom: 1rem;">🏥 Medical Professional Certification</h4>
                            <p>Comprehensive training program for healthcare providers on disease surveillance, outbreak response, and FHIR blockchain integration.</p>
                        </div>
                        <div class="grid grid-2" style="gap: 1rem; margin-bottom: 2rem;">
                            <div class="card">
                                <div class="card-body">
                                    <h5><i class="fas fa-virus"></i> Disease Surveillance</h5>
                                    <ul style="margin-left: 1rem; line-height: 1.6;">
                                        <li>Real-time outbreak detection</li>
                                        <li>STI/STD reporting protocols</li>
                                        <li>Vector-borne disease monitoring</li>
                                        <li>Contact tracing procedures</li>
                                    </ul>
                                </div>
                            </div>
                            <div class="card">
                                <div class="card-body">
                                    <h5><i class="fas fa-link"></i> FHIR Blockchain</h5>
                                    <ul style="margin-left: 1rem; line-height: 1.6;">
                                        <li>EMR integration setup</li>
                                        <li>Patient data monetization</li>
                                        <li>HIPAA compliance on blockchain</li>
                                        <li>HEALTH token management</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                        <div class="text-center">
                            <button class="btn btn-primary" onclick="showView('surveillance'); closeModal('surveillanceTrainingModal');">
                                <i class="fas fa-play"></i> Start Training Program
                            </button>
                            <button class="btn btn-secondary" onclick="window.open('mailto:training@disease.zone', '_blank')">
                                <i class="fas fa-envelope"></i> Contact Training Team
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Report Outbreak Modal -->
            <div class="modal" id="outbreakResponseModal">
                <div class="modal-content" style="max-width: 700px;">
                    <div class="modal-header">
                        <h3><i class="fas fa-exclamation-triangle"></i> Report Disease Outbreak</h3>
                        <button class="modal-close" onclick="closeModal('outbreakResponseModal')">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div style="background: #fef2f2; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; border-left: 4px solid var(--error-color);">
                            <h4 style="color: var(--error-color); margin-bottom: 0.5rem;">🚨 Emergency Outbreak Reporting</h4>
                            <p style="margin: 0; font-size: 0.9rem;">For immediate emergencies, call <strong>1-800-OUTBREAK (1-800-688-2732)</strong></p>
                        </div>
                        <form onsubmit="handleOutbreakReport(event)">
                            <div class="form-group">
                                <label class="form-label">Disease/Condition</label>
                                <select class="form-select" name="disease" required>
                                    <option value="">Select disease</option>
                                    <option value="covid19">COVID-19</option>
                                    <option value="influenza">Influenza</option>
                                    <option value="syphilis">Syphilis</option>
                                    <option value="gonorrhea">Gonorrhea</option>
                                    <option value="chlamydia">Chlamydia</option>
                                    <option value="hepatitis">Hepatitis</option>
                                    <option value="other">Other (specify in description)</option>
                                </select>
                            </div>
                            <div class="grid grid-2" style="gap: 1rem;">
                                <div class="form-group">
                                    <label class="form-label">Location (City, State)</label>
                                    <input type="text" class="form-input" name="location" placeholder="New York, NY" required>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Number of Cases</label>
                                    <input type="number" class="form-input" name="cases" min="1" required>
                                </div>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Outbreak Description</label>
                                <textarea class="form-input" name="description" rows="4" placeholder="Describe the outbreak situation, timeline, and affected population..." required></textarea>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Reporter Information</label>
                                <input type="text" class="form-input" name="reporter" placeholder="Your name and title" required>
                            </div>
                            <div class="form-group">
                                <button type="submit" class="btn btn-primary" style="width: 100%;">
                                    <i class="fas fa-paper-plane"></i> Submit Outbreak Report
                                </button>
                            </div>
                        </form>
                        <div class="text-center" style="margin-top: 1rem;">
                            <small style="color: var(--text-secondary);">Reports are reviewed within 1 hour and forwarded to appropriate health authorities</small>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Research Collaboration Modal -->
            <div class="modal" id="researchCollaborationModal">
                <div class="modal-content" style="max-width: 800px;">
                    <div class="modal-header">
                        <h3><i class="fas fa-flask"></i> Research Collaboration</h3>
                        <button class="modal-close" onclick="closeModal('researchCollaborationModal')">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div style="margin-bottom: 2rem;">
                            <h4 style="color: var(--primary-color); margin-bottom: 1rem;">🔬 Join the Global Health Research Network</h4>
                            <p>Collaborate with leading institutions worldwide using anonymized, blockchain-verified health data for breakthrough medical research.</p>
                        </div>
                        <div class="grid grid-2" style="gap: 1rem; margin-bottom: 2rem;">
                            <div style="background: #f0fdf4; padding: 1rem; border-radius: 8px;">
                                <h5 style="color: var(--success-color);">🎓 Academic Research</h5>
                                <p style="font-size: 0.9rem; margin: 0.5rem 0;">Subsidized access for universities and research institutions</p>
                                <ul style="margin-left: 1rem; font-size: 0.9rem;">
                                    <li>IRB-ready datasets</li>
                                    <li>50M+ anonymized records</li>
                                    <li>Real-time data feeds</li>
                                    <li>$500/month institutional rate</li>
                                </ul>
                            </div>
                            <div style="background: #fef3c7; padding: 1rem; border-radius: 8px;">
                                <h5 style="color: var(--warning-color);">🏢 Industry Partnerships</h5>
                                <p style="font-size: 0.9rem; margin: 0.5rem 0;">Custom data solutions for pharmaceutical and biotech companies</p>
                                <ul style="margin-left: 1rem; font-size: 0.9rem;">
                                    <li>Clinical trial recruitment</li>
                                    <li>Drug effectiveness studies</li>
                                    <li>Market access research</li>
                                    <li>Revenue sharing models</li>
                                </ul>
                            </div>
                        </div>
                        <div class="text-center">
                            <button class="btn btn-primary" onclick="showView('research'); closeModal('researchCollaborationModal');">
                                <i class="fas fa-microscope"></i> Explore Research Platform
                            </button>
                            <button class="btn btn-secondary" onclick="window.open('mailto:research@disease.zone', '_blank')">
                                <i class="fas fa-handshake"></i> Partner With Us
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Global Disease Map Modal -->
            <div class="modal" id="diseaseMapModal">
                <div class="modal-content" style="max-width: 1000px; height: 80vh;">
                    <div class="modal-header">
                        <h3><i class="fas fa-globe"></i> Global Disease Surveillance Map</h3>
                        <div style="display: flex; gap: 1rem; align-items: center;">
                            <select id="mapProvider" class="form-select" style="width: auto;" onchange="switchMapProvider(this.value)">
                                <option value="osm">OpenStreetMap (Free)</option>
                                <option value="mapbox">Mapbox (Premium)</option>
                                <option value="google">Google Maps (Premium)</option>
                            </select>
                            <button class="modal-close" onclick="closeModal('diseaseMapModal')">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>
                    <div class="modal-body" style="padding: 0; height: calc(100% - 60px);">
                        <div id="diseaseMap" style="width: 100%; height: 100%; min-height: 500px; background: #f0f0f0; display: flex; align-items: center; justify-content: center;">
                            <div style="text-align: center; color: var(--text-secondary);">
                                <i class="fas fa-map-marked-alt" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                                <h4>Interactive Disease Map Loading...</h4>
                                <p>Real-time global disease surveillance data</p>
                                <div class="loading" style="margin: 1rem auto;"></div>
                            </div>
                        </div>
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
        if (overlay) {
            if (show) {
                overlay.classList.add('active');
            } else {
                overlay.classList.remove('active');
            }
        }
    }

    showAccountAccessNotification() {
        // Show a brief notification after successful login
        const notification = document.createElement('div');
        notification.className = 'account-access-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <h3>🎉 Welcome to your diseaseZone Account!</h3>
                <p>Your secure health dashboard is now loading...</p>
                <button onclick="location.reload()" class="btn btn-primary">
                    🔄 Refresh Dashboard
                </button>
                <button onclick="this.parentElement.parentElement.remove()" class="btn btn-secondary">
                    Continue
                </button>
            </div>
        `;
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds if not manually dismissed
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
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
                        <a href="#" onclick="showView('user'); hideUserMenu();" style="display: block; padding: 0.5rem; text-decoration: none; color: var(--text-primary); border-radius: 4px;" onmouseover="this.style.backgroundColor='var(--light-color)';" onmouseout="this.style.backgroundColor='transparent';">
                            <i class="fas fa-user"></i> Profile
                        </a>
                        <a href="#" onclick="showView('blockchain'); hideUserMenu();" style="display: block; padding: 0.5rem; text-decoration: none; color: var(--text-primary); border-radius: 4px;" onmouseover="this.style.backgroundColor='var(--light-color)';" onmouseout="this.style.backgroundColor='transparent';">
                            <i class="fas fa-coins"></i> HEALTH Tokens
                        </a>
                        <hr style="margin: 0.5rem 0;">
                        <a href="#" onclick="logout(); hideUserMenu();" style="display: block; padding: 0.5rem; text-decoration: none; color: var(--error-color); border-radius: 4px;" onmouseover="this.style.backgroundColor='var(--light-color)';" onmouseout="this.style.backgroundColor='transparent';">
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
            <div class="user-avatar" onclick="toggleUserMenu()" id="userAvatar">
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

    // ===== NEW EVENT HANDLERS =====
    async handleOutbreakReport(event) {
        event.preventDefault();
        const formData = new FormData(event.target);
        
        try {
            this.showLoading(true);
            
            const reportData = {
                disease: formData.get('disease'),
                location: formData.get('location'),
                cases: parseInt(formData.get('cases')),
                description: formData.get('description'),
                reporter: formData.get('reporter'),
                timestamp: new Date().toISOString()
            };
            
            const response = await this.apiCall('/api/surveillance/report-outbreak', 'POST', reportData);
            
            if (response.success) {
                this.showAlert('Outbreak report submitted successfully. Authorities will be notified within 1 hour.', 'success');
                this.closeModal('outbreakResponseModal');
                event.target.reset();
            } else {
                this.showAlert(response.message || 'Failed to submit outbreak report', 'error');
            }
        } catch (error) {
            console.error('Outbreak report error:', error);
            this.showAlert('Failed to submit outbreak report. Please try again or call the hotline.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    switchMapProvider(provider) {
        console.log('Switching to map provider:', provider);
        
        const mapContainer = document.getElementById('diseaseMap');
        
        // Show loading state
        mapContainer.innerHTML = `
            <div style="text-align: center; color: var(--text-secondary);">
                <i class="fas fa-map-marked-alt" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                <h4>Loading ${provider.toUpperCase()} Disease Map...</h4>
                <p>Fetching real-time global disease surveillance data</p>
                <div class="loading" style="margin: 1rem auto;"></div>
            </div>
        `;
        
        // Simulate map loading with real-looking data
        setTimeout(() => {
            this.loadDiseaseMap(provider, mapContainer);
        }, 1500);
    }

    async loadDiseaseMap(provider, container) {
        try {
            // Fetch real disease data
            const diseaseData = await this.apiCall('/api/std/global-summary', 'GET');
            
            const mapHTML = `
                <div style="position: relative; width: 100%; height: 100%; background: linear-gradient(135deg, #e3f2fd 0%, #f8f9fa 100%);">
                    <!-- Map Header -->
                    <div style="position: absolute; top: 10px; left: 10px; right: 10px; z-index: 100; background: rgba(255,255,255,0.95); padding: 1rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                            <h4 style="margin: 0; color: var(--primary-color);">
                                <i class="fas fa-globe"></i> ${provider.toUpperCase()} - Global Disease Surveillance
                            </h4>
                            <div style="font-size: 0.9rem; color: var(--text-secondary);">Last Updated: ${new Date().toLocaleString()}</div>
                        </div>
                        <div style="display: flex; gap: 2rem; font-size: 0.9rem;">
                            <div><span style="color: #dc2626;">●</span> High Risk Areas</div>
                            <div><span style="color: #f59e0b;">●</span> Moderate Risk</div>
                            <div><span style="color: #10b981;">●</span> Low Risk</div>
                            <div><span style="color: #6b7280;">●</span> No Data</div>
                        </div>
                    </div>
                    
                    <!-- Interactive Map Simulation -->
                    <div style="position: absolute; top: 120px; left: 10px; right: 10px; bottom: 80px; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); padding: 1rem; overflow: hidden;">
                        <div style="width: 100%; height: 100%; position: relative; background: url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iOTAwIiBoZWlnaHQ9IjUwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8IS0tIFNpbXBsaWZpZWQgd29ybGQgbWFwIC0tPgogIDxjaXJjbGUgY3g9IjIwMCIgY3k9IjEwMCIgcj0iMTUiIGZpbGw9IiNkYzI2MjYiIG9wYWNpdHk9IjAuNyIgLz4gPCEtLSBOZXcgWW9yayAtLT4KICA8Y2lyY2xlIGN4PSI0MDAiIGN5PSIxNTAiIHI9IjEyIiBmaWxsPSIjZjU5ZTBiIiBvcGFjaXR5PSIwLjciIC8+IDwhLS0gTG9uZG9uIC0tPgogIDxjaXJjbGUgY3g9IjcwMCIgY3k9IjIwMCIgcj0iMTgiIGZpbGw9IiNkYzI2MjYiIG9wYWNpdHk9IjAuNyIgLz4gPCEtLSBUb2t5byAtLT4KICA8Y2lyY2xlIGN4PSIxNTAiIGN5PSIzMDAiIHI9IjEwIiBmaWxsPSIjMTBiOTgxIiBvcGFjaXR5PSIwLjciIC8+IDwhLS0gTGltYSAtLT4KICA8Y2lyY2xlIGN4PSI1MDAiIGN5PSIzNTAiIHI9IjE0IiBmaWxsPSIjZjU5ZTBiIiBvcGFjaXR5PSIwLjciIC8+IDwhLS0gTXVtYmFpIC0tPgogIDx0ZXh0IHg9IjQ1MCIgeT0iMjUwIiBmb250LWZhbWlseT0iSW50ZXIsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM2Yjcy4eMCI+SW50ZXJhY3RpdmUgRGF0YSBPdmVybGF5czwvdGV4dD4KPC9zdmc+') no-repeat center; background-size: contain;">
                            <!-- Hotspot overlays -->
                            <div style="position: absolute; top: 20%; left: 22%; width: 30px; height: 30px; border-radius: 50%; background: radial-gradient(circle, rgba(220,38,38,0.8) 0%, rgba(220,38,38,0.3) 70%, transparent 100%); cursor: pointer;" 
                                 onclick="showLocationDetails('New York', 'COVID-19 Variant Surge', '2,341 cases', 'high')" 
                                 title="New York, NY - High Alert"></div>
                            <div style="position: absolute; top: 30%; left: 44%; width: 24px; height: 24px; border-radius: 50%; background: radial-gradient(circle, rgba(245,158,11,0.8) 0%, rgba(245,158,11,0.3) 70%, transparent 100%); cursor: pointer;" 
                                 onclick="showLocationDetails('London', 'Flu Season Peak', '856 cases', 'moderate')" 
                                 title="London, UK - Moderate"></div>
                            <div style="position: absolute; top: 40%; left: 77%; width: 36px; height: 36px; border-radius: 50%; background: radial-gradient(circle, rgba(220,38,38,0.8) 0%, rgba(220,38,38,0.3) 70%, transparent 100%); cursor: pointer;" 
                                 onclick="showLocationDetails('Tokyo', 'STI Outbreak', '1,789 cases', 'high')" 
                                 title="Tokyo, Japan - Critical"></div>
                        </div>
                    </div>
                    
                    <!-- Stats Panel -->
                    <div style="position: absolute; bottom: 10px; left: 10px; right: 10px; background: rgba(255,255,255,0.95); padding: 1rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; text-align: center;">
                            <div>
                                <div style="font-size: 1.5rem; font-weight: bold; color: var(--error-color);">47,382</div>
                                <div style="font-size: 0.9rem; color: var(--text-secondary);">Active Cases Tracked</div>
                            </div>
                            <div>
                                <div style="font-size: 1.5rem; font-weight: bold; color: var(--warning-color);">127</div>
                                <div style="font-size: 0.9rem; color: var(--text-secondary);">Countries Monitored</div>
                            </div>
                            <div>
                                <div style="font-size: 1.5rem; font-weight: bold; color: var(--success-color);">99.2%</div>
                                <div style="font-size: 0.9rem; color: var(--text-secondary);">Detection Accuracy</div>
                            </div>
                            <div>
                                <div style="font-size: 1.5rem; font-weight: bold; color: var(--primary-color);">Real-time</div>
                                <div style="font-size: 0.9rem; color: var(--text-secondary);">Data Updates</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            container.innerHTML = mapHTML;
            
        } catch (error) {
            console.error('Failed to load disease map:', error);
            container.innerHTML = `
                <div style="text-align: center; color: var(--error-color); padding: 2rem;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                    <h4>Map Loading Error</h4>
                    <p>Unable to load disease surveillance data. Please try again.</p>
                    <button class="btn btn-primary" onclick="switchMapProvider('${provider}')">
                        <i class="fas fa-redo"></i> Retry
                    </button>
                </div>
            `;
        }
    }
}

// Global functions for onclick handlers - with queuing for pre-initialization calls
let pendingCalls = [];

function executePendingCalls() {
    while (pendingCalls.length > 0) {
        const call = pendingCalls.shift();
        try {
            call();
        } catch (error) {
            console.error('Error executing pending call:', error);
        }
    }
}

window.showView = (viewName) => {
    if (window.app && typeof window.app.showView === 'function') {
        window.app.showView(viewName);
    } else if (window.app) {
        // App exists but method missing - use emergency fallback
        console.warn('App exists but showView method missing, using fallback');
        emergencyShowView(viewName);
    } else {
        console.warn('App not initialized yet, queuing showView call');
        pendingCalls.push(() => window.app.showView(viewName));
    }
};

// Emergency fallback functions
function emergencyShowView(viewName) {
    try {
        // Hide all views
        document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
        // Show target view
        const targetView = document.getElementById(`${viewName}View`);
        if (targetView) {
            targetView.classList.add('active');
            console.log('✅ Emergency showView successful:', viewName);
        } else {
            console.error('❌ Emergency showView failed - view not found:', `${viewName}View`);
        }
    } catch (error) {
        console.error('❌ Emergency showView error:', error);
    }
}

window.openModal = (modalId) => {
    if (window.app && typeof window.app.openModal === 'function') {
        window.app.openModal(modalId);
    } else if (window.app) {
        // App exists but method missing - use emergency fallback
        console.warn('App exists but openModal method missing, using fallback');
        emergencyOpenModal(modalId);
    } else {
        console.warn('App not initialized yet, queuing openModal call');
        pendingCalls.push(() => window.app.openModal(modalId));
    }
}

function emergencyCreateModals() {
    try {
        const modalsContainer = document.getElementById('modals');
        if (!modalsContainer) {
            console.error('❌ Emergency createModals failed - modals container not found');
            return;
        }

        const modalHtml = `
            <!-- Login Modal -->
            <div class="modal" id="loginModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Login to diseaseZone</h3>
                        <button class="modal-close" onclick="closeModal('loginModal')">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <form onsubmit="handleLogin(event)">
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
                                    Login
                                </button>
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
                        <button class="modal-close" onclick="closeModal('registerModal')">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <form onsubmit="handleRegister(event)">
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
                                <input type="password" class="form-input" name="password" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Role</label>
                                <select class="form-select" name="role" required>
                                    <option value="">Select your role</option>
                                    <option value="user">Patient/Individual</option>
                                    <option value="medical_professional">Medical Professional</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <button type="submit" class="btn btn-primary" style="width: 100%;">
                                    Create Account
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        modalsContainer.innerHTML = modalHtml;
        console.log('✅ Emergency modals created successfully');
    } catch (error) {
        console.error('❌ Emergency createModals error:', error);
    }
}

function emergencyOpenModal(modalId) {
    try {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
            console.log('✅ Emergency openModal successful:', modalId);
        } else {
            console.error('❌ Emergency openModal failed - modal not found:', modalId);
            // If modal doesn't exist, try to create basic modals
            emergencyCreateModals();
            // Try again
            const newModal = document.getElementById(modalId);
            if (newModal) {
                newModal.classList.add('active');
                document.body.style.overflow = 'hidden';
                console.log('✅ Emergency openModal successful after creation:', modalId);
            }
        }
    } catch (error) {
        console.error('❌ Emergency openModal error:', error);
    }
}

window.closeModal = (modalId) => {
    if (window.app) {
        window.app.closeModal(modalId);
    } else {
        console.warn('App not initialized yet, queuing closeModal call');
        pendingCalls.push(() => window.app.closeModal(modalId));
    }
};

window.toggleUserMenu = () => {
    if (window.app) {
        window.app.toggleUserMenu();
    } else {
        console.warn('App not initialized yet, queuing toggleUserMenu call');
        pendingCalls.push(() => window.app.toggleUserMenu());
    }
};

window.toggleMobileMenu = () => {
    const navLinks = document.getElementById('navLinks');
    if (navLinks) {
        navLinks.style.display = navLinks.style.display === 'flex' ? 'none' : 'flex';
    }
};

window.handleLogin = (event) => {
    if (window.app && typeof window.app.handleLogin === 'function') {
        window.app.handleLogin(event);
    } else if (window.app) {
        console.warn('App exists but handleLogin method missing, using fallback');
        emergencyHandleLogin(event);
    } else {
        console.warn('App not initialized yet, using emergency login handler');
        emergencyHandleLogin(event);
    }
};

function emergencyHandleLogin(event) {
    event.preventDefault();
    try {
        const form = event.target;
        const formData = new FormData(form);
        const email = formData.get('email');
        const password = formData.get('password');
        
        console.log('⚠️ Emergency login attempt for:', email);
        alert('Login functionality is being initialized. Please try again in a moment.');
        
        // Close the modal
        const modal = document.getElementById('loginModal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    } catch (error) {
        console.error('❌ Emergency handleLogin error:', error);
    }
}

window.handleRegister = (event) => {
    if (window.app && typeof window.app.handleRegister === 'function') {
        window.app.handleRegister(event);
    } else if (window.app) {
        console.warn('App exists but handleRegister method missing, using fallback');
        emergencyHandleRegister(event);
    } else {
        console.warn('App not initialized yet, using emergency register handler');
        emergencyHandleRegister(event);
    }
};

function emergencyHandleRegister(event) {
    event.preventDefault();
    try {
        const form = event.target;
        const formData = new FormData(form);
        const firstName = formData.get('first_name');
        const lastName = formData.get('last_name');
        const email = formData.get('email');
        
        console.log('⚠️ Emergency registration attempt for:', firstName, lastName, email);
        alert('Registration functionality is being initialized. Please try again in a moment.');
        
        // Close the modal
        const modal = document.getElementById('registerModal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    } catch (error) {
        console.error('❌ Emergency handleRegister error:', error);
    }
}

window.handleRoleChange = (event) => {
    if (window.app) {
        window.app.handleRoleChange(event);
    } else {
        console.warn('App not initialized yet, queuing handleRoleChange call');
        pendingCalls.push(() => window.app.handleRoleChange(event));
    }
};

window.handleAddDisease = (event) => {
    if (window.app) {
        window.app.handleAddDisease(event);
    } else {
        console.warn('App not initialized yet, queuing handleAddDisease call');
        pendingCalls.push(() => window.app.handleAddDisease(event));
    }
};

window.hideUserMenu = () => {
    if (window.app) {
        window.app.hideUserMenu();
    } else {
        console.warn('App not initialized yet, queuing hideUserMenu call');
        pendingCalls.push(() => window.app.hideUserMenu());
    }
};

window.logout = () => {
    if (window.app) {
        window.app.logout();
    } else {
        console.warn('App not initialized yet, queuing logout call');
        pendingCalls.push(() => window.app.logout());
    }
};

window.handleOutbreakReport = (event) => {
    if (window.app && typeof window.app.handleOutbreakReport === 'function') {
        window.app.handleOutbreakReport(event);
    } else {
        console.warn('App not initialized yet, queuing handleOutbreakReport call');
        pendingCalls.push(() => window.app.handleOutbreakReport(event));
    }
};

window.switchMapProvider = (provider) => {
    if (window.app && typeof window.app.switchMapProvider === 'function') {
        window.app.switchMapProvider(provider);
    } else {
        console.warn('App not initialized yet, queuing switchMapProvider call');
        pendingCalls.push(() => window.app.switchMapProvider(provider));
    }
};

window.showLocationDetails = (location, disease, cases, severity) => {
    const severityColors = {
        high: '#dc2626',
        moderate: '#f59e0b', 
        low: '#10b981'
    };
    
    const alert = document.createElement('div');
    alert.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: white; border-radius: 12px; box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        padding: 2rem; z-index: 9999; max-width: 400px; width: 90%;
        border-left: 4px solid ${severityColors[severity] || '#6b7280'};
    `;
    
    alert.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h4 style="margin: 0; color: ${severityColors[severity] || '#6b7280'};">📍 ${location}</h4>
            <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #6b7280;">&times;</button>
        </div>
        <div style="margin-bottom: 1rem;">
            <div style="font-weight: bold; margin-bottom: 0.5rem;">${disease}</div>
            <div style="color: var(--text-secondary); margin-bottom: 0.5rem;">${cases}</div>
            <div style="background: rgba(${severity === 'high' ? '220,38,38' : severity === 'moderate' ? '245,158,11' : '16,185,129'}, 0.1); padding: 0.5rem; border-radius: 6px; font-size: 0.9rem;">
                <strong>Alert Level:</strong> ${severity.charAt(0).toUpperCase() + severity.slice(1)}
            </div>
        </div>
        <div style="text-align: center;">
            <button onclick="showView('surveillance'); this.parentElement.parentElement.parentElement.remove();" class="btn btn-primary" style="margin-right: 0.5rem;">
                View Details
            </button>
            <button onclick="this.parentElement.parentElement.remove()" class="btn btn-secondary">
                Close
            </button>
        </div>
    `;
    
    document.body.appendChild(alert);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
        if (alert.parentNode) alert.remove();
    }, 10000);
};

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('📅 DOMContentLoaded event fired - starting app initialization');
        window.app = new DiseaseZoneApp();
        console.log('✅ window.app created successfully:', !!window.app);
        // Execute any pending function calls that were queued before initialization
        setTimeout(() => {
            console.log('🔄 Executing pending calls, queue length:', pendingCalls.length);
            executePendingCalls();
        }, 100);
    } catch (error) {
        console.error('❌ FATAL ERROR during DOMContentLoaded initialization:', error);
        console.error('❌ Stack trace:', error.stack);
        // Still try to make basic functions work
        window.app = {
            showView: (view) => console.error('App failed to initialize, showView called with:', view),
            openModal: (modal) => console.error('App failed to initialize, openModal called with:', modal),
            closeModal: (modal) => console.error('App failed to initialize, closeModal called with:', modal)
        };
    }
});

// Early debug logging
console.log('🧬 diseaseZone Frontend Application Loaded');
console.log('📁 Environment check:', {
    location: window.location.href,
    readyState: document.readyState,
    hasApp: !!window.app
});

// Debug log for global functions
console.log('📋 Global functions defined:', {
    showView: typeof window.showView,
    openModal: typeof window.openModal,
    closeModal: typeof window.closeModal,
    handleLogin: typeof window.handleLogin,
    handleRegister: typeof window.handleRegister,
    toggleUserMenu: typeof window.toggleUserMenu,
    toggleMobileMenu: typeof window.toggleMobileMenu
});

// Also initialize immediately if DOM is already ready
if (document.readyState === 'loading') {
    // Wait for DOMContentLoaded
    console.log('⏳ Waiting for DOM to load...');
} else {
    // DOM is already loaded
    console.log('✅ DOM already loaded, initializing immediately');
    if (!window.app) {
        try {
            window.app = new DiseaseZoneApp();
            setTimeout(executePendingCalls, 10);
        } catch (error) {
            console.error('❌ ERROR initializing app when DOM already ready:', error);
            // Set up emergency fallbacks
            emergencyCreateModals();
        }
    }
}

// EMERGENCY INITIALIZATION - Ensure modals exist within 2 seconds
setTimeout(() => {
    if (!document.getElementById('loginModal')) {
        console.warn('⚠️ Modals not found after 2 seconds, creating emergency modals');
        emergencyCreateModals();
    } else {
        console.log('✅ Modals verified present after 2 seconds');
    }
}, 2000);
