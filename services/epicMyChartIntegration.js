const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');

/**
 * Epic MyChart Patient Portal Integration
 * 
 * Provides seamless integration with Epic's MyChart patient portal
 * enabling patients to connect their health records to Disease.Zone
 */
class EpicMyChartIntegration {
    constructor() {
        this.dbPath = path.join(__dirname, '../data/mychart_integration.db');
        
        // MyChart-specific configuration
        this.myChartConfig = {
            // Patient-facing OAuth flow
            oauth: {
                scope: 'patient/*.read launch/patient openid fhirUser',
                responseType: 'code',
                grantType: 'authorization_code',
                pkceRequired: true,
                stateRequired: true
            },
            
            // MyChart branding and UI customization
            branding: {
                appName: 'Disease.Zone Health Intelligence',
                description: 'Connect your Epic health records for comprehensive disease tracking',
                logoUrl: 'https://disease.zone/assets/logo.png',
                primaryColor: '#2563eb',
                supportUrl: 'https://disease.zone/support',
                privacyUrl: 'https://disease.zone/privacy'
            },
            
            // Patient consent management
            consent: {
                dataTypes: [
                    'Demographics and contact information',
                    'Medical conditions and diagnoses',
                    'Medications and allergies',
                    'Lab results and vital signs',
                    'Immunization history',
                    'Appointment history'
                ],
                retentionPeriod: '2 years',
                sharingOptions: ['anonymized research', 'public health reporting'],
                withdrawalProcess: 'immediate data deletion'
            }
        };

        this.initializeDatabase();
    }

    /**
     * Initialize database for MyChart integration
     */
    initializeDatabase() {
        this.db = new sqlite3.Database(this.dbPath);
        
        this.db.serialize(() => {
            // Patient MyChart connections
            this.db.run(`
                CREATE TABLE IF NOT EXISTS mychart_connections (
                    id TEXT PRIMARY KEY,
                    patient_email TEXT NOT NULL,
                    patient_name TEXT,
                    epic_patient_id TEXT NOT NULL,
                    organization_id TEXT NOT NULL,
                    access_token TEXT NOT NULL,
                    refresh_token TEXT,
                    expires_at INTEGER NOT NULL,
                    scope TEXT NOT NULL,
                    consent_given BOOLEAN DEFAULT TRUE,
                    consent_timestamp INTEGER NOT NULL,
                    last_sync INTEGER,
                    status TEXT DEFAULT 'active',
                    created_at INTEGER NOT NULL,
                    UNIQUE(patient_email, organization_id)
                )
            `);

            // Patient consent records
            this.db.run(`
                CREATE TABLE IF NOT EXISTS patient_consent (
                    id TEXT PRIMARY KEY,
                    connection_id TEXT NOT NULL,
                    consent_type TEXT NOT NULL,
                    consent_status BOOLEAN NOT NULL,
                    consent_timestamp INTEGER NOT NULL,
                    consent_version TEXT NOT NULL,
                    ip_address TEXT,
                    user_agent TEXT,
                    withdrawal_timestamp INTEGER,
                    FOREIGN KEY(connection_id) REFERENCES mychart_connections(id)
                )
            `);

            // Patient health summaries
            this.db.run(`
                CREATE TABLE IF NOT EXISTS patient_health_summaries (
                    id TEXT PRIMARY KEY,
                    connection_id TEXT NOT NULL,
                    summary_data TEXT NOT NULL,
                    risk_score INTEGER,
                    chronic_conditions TEXT,
                    medication_count INTEGER,
                    allergy_count INTEGER,
                    last_visit_date TEXT,
                    next_appointment_date TEXT,
                    generated_at INTEGER NOT NULL,
                    version INTEGER DEFAULT 1,
                    FOREIGN KEY(connection_id) REFERENCES mychart_connections(id)
                )
            `);

            // Disease intelligence insights for patients
            this.db.run(`
                CREATE TABLE IF NOT EXISTS patient_disease_insights (
                    id TEXT PRIMARY KEY,
                    connection_id TEXT NOT NULL,
                    insight_type TEXT NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT NOT NULL,
                    severity TEXT NOT NULL,
                    actionable BOOLEAN DEFAULT FALSE,
                    recommendation TEXT,
                    data_sources TEXT,
                    confidence_score REAL,
                    created_at INTEGER NOT NULL,
                    acknowledged_at INTEGER,
                    FOREIGN KEY(connection_id) REFERENCES mychart_connections(id)
                )
            `);

            // Patient portal activity logs
            this.db.run(`
                CREATE TABLE IF NOT EXISTS mychart_activity_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    connection_id TEXT NOT NULL,
                    activity_type TEXT NOT NULL,
                    description TEXT,
                    data_accessed TEXT,
                    ip_address TEXT,
                    user_agent TEXT,
                    timestamp INTEGER NOT NULL,
                    FOREIGN KEY(connection_id) REFERENCES mychart_connections(id)
                )
            `);
        });
    }

    /**
     * Initiate MyChart connection flow
     * @param {Object} patientInfo - Patient information
     * @param {string} organizationId - Epic organization ID
     * @param {string} redirectUri - OAuth redirect URI
     * @returns {Promise<Object>} Authorization URL and connection details
     */
    async initiateMyChartConnection(patientInfo, organizationId, redirectUri) {
        const { email, name } = patientInfo;
        
        // Generate secure OAuth parameters
        const state = uuidv4();
        const codeChallenge = this.generatePKCEChallenge();
        const connectionId = uuidv4();

        // Get Epic organization configuration
        const organization = await this.getEpicOrganization(organizationId);
        if (!organization) {
            throw new Error('Epic organization not found');
        }

        // Build patient-friendly authorization URL
        const authParams = new URLSearchParams({
            response_type: 'code',
            client_id: organization.client_id,
            redirect_uri: redirectUri,
            scope: this.myChartConfig.oauth.scope,
            state: state,
            code_challenge: codeChallenge,
            code_challenge_method: 'S256',
            aud: organization.base_url,
            // MyChart-specific parameters
            launch: 'patient',
            patient: 'patient-launch'
        });

        const authUrl = `${organization.auth_url}?${authParams.toString()}`;

        // Store connection session
        await this.storeConnectionSession(state, {
            connectionId,
            patientEmail: email,
            patientName: name,
            organizationId,
            codeChallenge,
            redirectUri,
            createdAt: Date.now()
        });

        return {
            connectionId,
            authorizationUrl: authUrl,
            state: state,
            instructions: 'Patient will be redirected to Epic MyChart for secure login',
            consentRequired: true,
            dataTypes: this.myChartConfig.consent.dataTypes
        };
    }

    /**
     * Complete MyChart connection after OAuth callback
     * @param {string} code - Authorization code
     * @param {string} state - State parameter
     * @returns {Promise<Object>} Connection details and patient summary
     */
    async completeMyChartConnection(code, state) {
        const session = await this.getConnectionSession(state);
        if (!session) {
            throw new Error('Invalid or expired connection session');
        }

        const organization = await this.getEpicOrganization(session.organizationId);
        
        // Exchange code for tokens
        const tokenParams = {
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: session.redirectUri,
            client_id: organization.client_id,
            code_verifier: session.codeChallenge
        };

        try {
            const tokenResponse = await axios.post(organization.token_url, tokenParams, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                }
            });

            const tokenData = tokenResponse.data;

            // Get patient information from token context
            let patientId = tokenData.patient;
            if (!patientId && tokenData.id_token) {
                // Extract patient ID from ID token if needed
                const idTokenPayload = this.decodeJWT(tokenData.id_token);
                patientId = idTokenPayload.sub || idTokenPayload.patient;
            }

            // Store MyChart connection
            const connectionId = await this.storeMyChartConnection({
                id: session.connectionId,
                patientEmail: session.patientEmail,
                patientName: session.patientName,
                epicPatientId: patientId,
                organizationId: session.organizationId,
                accessToken: tokenData.access_token,
                refreshToken: tokenData.refresh_token,
                expiresIn: tokenData.expires_in,
                scope: tokenData.scope
            });

            // Record initial consent
            await this.recordPatientConsent(connectionId, 'initial_connection', true);

            // Fetch initial patient summary
            const patientSummary = await this.generatePatientSummary(connectionId);

            // Clean up session
            await this.cleanupConnectionSession(state);

            return {
                connectionId,
                patientId,
                summary: patientSummary,
                connectionStatus: 'active',
                dataSync: 'in_progress',
                nextSteps: [
                    'Complete initial health data sync',
                    'Review personalized health insights',
                    'Set up health monitoring preferences'
                ]
            };

        } catch (error) {
            throw new Error(`MyChart connection failed: ${error.response?.data?.error_description || error.message}`);
        }
    }

    /**
     * Generate comprehensive patient summary from Epic data
     * @param {string} connectionId - MyChart connection ID
     * @returns {Promise<Object>} Patient health summary
     */
    async generatePatientSummary(connectionId) {
        const connection = await this.getMyChartConnection(connectionId);
        if (!connection) {
            throw new Error('MyChart connection not found');
        }

        const summary = {
            patientId: connection.epic_patient_id,
            lastUpdated: new Date().toISOString(),
            healthOverview: {
                overallHealthScore: 0,
                riskLevel: 'unknown',
                chronicConditions: [],
                activeMedications: [],
                knownAllergies: [],
                recentVisits: []
            },
            diseaseIntelligence: {
                riskFactors: [],
                preventiveRecommendations: [],
                outbreakAlerts: [],
                healthTrends: []
            },
            dataCompleteness: {
                demographics: false,
                conditions: false,
                medications: false,
                allergies: false,
                vitals: false,
                immunizations: false
            }
        };

        try {
            // Fetch core patient data
            const coreResources = ['Patient', 'Condition', 'MedicationRequest', 'AllergyIntolerance', 'Observation'];
            
            for (const resourceType of coreResources) {
                try {
                    const data = await this.fetchPatientResource(connectionId, resourceType);
                    
                    switch (resourceType) {
                        case 'Patient':
                            summary.demographics = this.extractPatientDemographics(data);
                            summary.dataCompleteness.demographics = true;
                            break;
                        case 'Condition':
                            summary.healthOverview.chronicConditions = this.extractActiveConditions(data);
                            summary.dataCompleteness.conditions = true;
                            break;
                        case 'MedicationRequest':
                            summary.healthOverview.activeMedications = this.extractActiveMedications(data);
                            summary.dataCompleteness.medications = true;
                            break;
                        case 'AllergyIntolerance':
                            summary.healthOverview.knownAllergies = this.extractAllergies(data);
                            summary.dataCompleteness.allergies = true;
                            break;
                        case 'Observation':
                            summary.vitals = this.extractVitalSigns(data);
                            summary.dataCompleteness.vitals = true;
                            break;
                    }
                } catch (error) {
                    console.warn(`Failed to fetch ${resourceType} for patient:`, error.message);
                }
            }

            // Calculate health score and risk assessment
            summary.healthOverview.overallHealthScore = this.calculateHealthScore(summary);
            summary.healthOverview.riskLevel = this.assessRiskLevel(summary);

            // Generate disease intelligence insights
            summary.diseaseIntelligence = await this.generateDiseaseIntelligence(summary);

            // Store summary in database
            await this.storePatientSummary(connectionId, summary);

            return summary;

        } catch (error) {
            console.error('Error generating patient summary:', error);
            throw new Error('Failed to generate patient health summary');
        }
    }

    /**
     * Generate personalized disease intelligence insights
     * @param {Object} patientSummary - Patient health summary
     * @returns {Promise<Object>} Disease intelligence insights
     */
    async generateDiseaseIntelligence(patientSummary) {
        const insights = {
            riskFactors: [],
            preventiveRecommendations: [],
            outbreakAlerts: [],
            healthTrends: []
        };

        // Analyze chronic conditions for risk factors
        if (patientSummary.healthOverview.chronicConditions) {
            for (const condition of patientSummary.healthOverview.chronicConditions) {
                if (condition.code === 'E11' || condition.display?.toLowerCase().includes('diabetes')) {
                    insights.riskFactors.push({
                        type: 'chronic_condition',
                        condition: 'Type 2 Diabetes',
                        riskLevel: 'high',
                        description: 'Increases risk for cardiovascular disease and infections',
                        recommendations: ['Regular A1C monitoring', 'Annual eye exams', 'Foot care']
                    });
                }
                
                if (condition.code === 'I10' || condition.display?.toLowerCase().includes('hypertension')) {
                    insights.riskFactors.push({
                        type: 'chronic_condition',
                        condition: 'Hypertension',
                        riskLevel: 'medium',
                        description: 'Cardiovascular risk factor requiring monitoring',
                        recommendations: ['Regular BP monitoring', 'Low sodium diet', 'Regular exercise']
                    });
                }
            }
        }

        // Generate preventive care recommendations
        insights.preventiveRecommendations = await this.generatePreventiveRecommendations(patientSummary);

        // Check for relevant disease outbreaks
        insights.outbreakAlerts = await this.checkRelevantOutbreaks(patientSummary);

        // Analyze health trends from historical data
        insights.healthTrends = await this.analyzeHealthTrends(patientSummary);

        return insights;
    }

    /**
     * Sync patient data with Disease.Zone analytics
     * @param {string} connectionId - MyChart connection ID
     * @returns {Promise<Object>} Sync results
     */
    async syncPatientDataWithAnalytics(connectionId) {
        const connection = await this.getMyChartConnection(connectionId);
        if (!connection) {
            throw new Error('MyChart connection not found');
        }

        const syncResults = {
            connectionId,
            syncStarted: new Date().toISOString(),
            dataProcessed: {
                demographics: false,
                conditions: false,
                medications: false,
                allergies: false,
                vitals: false,
                immunizations: false
            },
            insightsGenerated: [],
            recommendations: [],
            errors: []
        };

        try {
            // Update patient summary
            const updatedSummary = await this.generatePatientSummary(connectionId);
            syncResults.dataProcessed = updatedSummary.dataCompleteness;

            // Generate new insights based on updated data
            const newInsights = await this.generatePersonalizedInsights(connectionId, updatedSummary);
            syncResults.insightsGenerated = newInsights;

            // Update last sync timestamp
            await this.updateLastSync(connectionId);

            // Log activity
            await this.logActivity(connectionId, 'data_sync', 'Automatic health data synchronization');

            syncResults.syncCompleted = new Date().toISOString();
            syncResults.status = 'success';

            return syncResults;

        } catch (error) {
            syncResults.errors.push(error.message);
            syncResults.status = 'partial_failure';
            syncResults.syncCompleted = new Date().toISOString();
            
            return syncResults;
        }
    }

    /**
     * Disconnect MyChart integration
     * @param {string} connectionId - MyChart connection ID
     * @param {string} reason - Disconnection reason
     * @returns {Promise<Object>} Disconnection result
     */
    async disconnectMyChart(connectionId, reason = 'user_request') {
        const connection = await this.getMyChartConnection(connectionId);
        if (!connection) {
            throw new Error('MyChart connection not found');
        }

        try {
            // Record consent withdrawal
            await this.recordPatientConsent(connectionId, 'connection_withdrawal', false, reason);

            // Revoke Epic tokens (if possible)
            try {
                await this.revokeEpicTokens(connection);
            } catch (error) {
                console.warn('Token revocation failed:', error.message);
            }

            // Mark connection as inactive
            await this.updateConnectionStatus(connectionId, 'disconnected');

            // Log disconnection activity
            await this.logActivity(connectionId, 'disconnection', `MyChart disconnected: ${reason}`);

            // Handle data retention based on patient preference
            const dataHandling = await this.handleDataRetention(connectionId, reason);

            return {
                connectionId,
                status: 'disconnected',
                reason: reason,
                dataHandling: dataHandling,
                disconnectedAt: new Date().toISOString(),
                message: 'MyChart integration has been successfully disconnected'
            };

        } catch (error) {
            throw new Error(`Failed to disconnect MyChart: ${error.message}`);
        }
    }

    /**
     * Helper methods for data extraction and processing
     */

    extractPatientDemographics(fhirData) {
        const patient = fhirData.entry?.[0]?.resource;
        if (!patient) return null;

        return {
            id: patient.id,
            name: this.formatPatientName(patient.name),
            birthDate: patient.birthDate,
            gender: patient.gender,
            address: patient.address?.[0],
            phone: patient.telecom?.find(t => t.system === 'phone')?.value,
            email: patient.telecom?.find(t => t.system === 'email')?.value,
            maritalStatus: patient.maritalStatus?.coding?.[0]?.display,
            language: patient.communication?.[0]?.language?.coding?.[0]?.display
        };
    }

    extractActiveConditions(fhirData) {
        return fhirData.entry?.map(entry => ({
            code: entry.resource.code?.coding?.[0]?.code,
            display: entry.resource.code?.coding?.[0]?.display,
            clinicalStatus: entry.resource.clinicalStatus?.coding?.[0]?.code,
            verificationStatus: entry.resource.verificationStatus?.coding?.[0]?.code,
            onsetDateTime: entry.resource.onsetDateTime,
            recordedDate: entry.resource.recordedDate
        })).filter(condition => condition.clinicalStatus === 'active') || [];
    }

    extractActiveMedications(fhirData) {
        return fhirData.entry?.map(entry => ({
            medication: entry.resource.medicationCodeableConcept?.coding?.[0]?.display ||
                       entry.resource.medicationReference?.display,
            status: entry.resource.status,
            intent: entry.resource.intent,
            authoredOn: entry.resource.authoredOn,
            dosageInstruction: entry.resource.dosageInstruction?.[0]?.text,
            prescriber: entry.resource.requester?.display
        })).filter(med => med.status === 'active') || [];
    }

    extractAllergies(fhirData) {
        return fhirData.entry?.map(entry => ({
            substance: entry.resource.code?.coding?.[0]?.display,
            category: entry.resource.category?.[0],
            criticality: entry.resource.criticality,
            type: entry.resource.type,
            reactions: entry.resource.reaction?.map(r => ({
                manifestation: r.manifestation?.[0]?.coding?.[0]?.display,
                severity: r.severity,
                onset: r.onset
            })) || []
        })) || [];
    }

    extractVitalSigns(fhirData) {
        return fhirData.entry?.slice(0, 20).map(entry => ({
            code: entry.resource.code?.coding?.[0]?.code,
            display: entry.resource.code?.coding?.[0]?.display,
            value: entry.resource.valueQuantity?.value,
            unit: entry.resource.valueQuantity?.unit,
            effectiveDateTime: entry.resource.effectiveDateTime,
            category: entry.resource.category?.[0]?.coding?.[0]?.display
        })) || [];
    }

    calculateHealthScore(summary) {
        let score = 100;
        
        // Deduct for chronic conditions
        score -= (summary.healthOverview.chronicConditions?.length || 0) * 8;
        
        // Deduct for multiple medications
        const medCount = summary.healthOverview.activeMedications?.length || 0;
        if (medCount > 5) score -= (medCount - 5) * 3;
        
        // Deduct for serious allergies
        const allergyCount = summary.healthOverview.knownAllergies?.length || 0;
        score -= allergyCount * 2;
        
        return Math.max(score, 0);
    }

    assessRiskLevel(summary) {
        const healthScore = summary.healthOverview.overallHealthScore;
        if (healthScore < 60) return 'high';
        if (healthScore < 80) return 'medium';
        return 'low';
    }

    formatPatientName(nameArray) {
        if (!nameArray || nameArray.length === 0) return 'Unknown';
        const name = nameArray[0];
        return `${name.given?.join(' ') || ''} ${name.family || ''}`.trim();
    }

    generatePKCEChallenge() {
        return Buffer.from(Math.random().toString()).toString('base64url');
    }

    decodeJWT(token) {
        try {
            const payload = token.split('.')[1];
            return JSON.parse(Buffer.from(payload, 'base64url').toString());
        } catch (error) {
            return {};
        }
    }

    // Database helper methods (implementation details)
    async getEpicOrganization(organizationId) { /* Implementation */ }
    async storeConnectionSession(state, data) { /* Implementation */ }
    async getConnectionSession(state) { /* Implementation */ }
    async cleanupConnectionSession(state) { /* Implementation */ }
    async storeMyChartConnection(connectionData) { /* Implementation */ }
    async getMyChartConnection(connectionId) { /* Implementation */ }
    async recordPatientConsent(connectionId, type, status, reason = null) { /* Implementation */ }
    async storePatientSummary(connectionId, summary) { /* Implementation */ }
    async fetchPatientResource(connectionId, resourceType) { /* Implementation */ }
    async generatePreventiveRecommendations(summary) { /* Implementation */ }
    async checkRelevantOutbreaks(summary) { /* Implementation */ }
    async analyzeHealthTrends(summary) { /* Implementation */ }
    async generatePersonalizedInsights(connectionId, summary) { /* Implementation */ }
    async updateLastSync(connectionId) { /* Implementation */ }
    async logActivity(connectionId, type, description) { /* Implementation */ }
    async revokeEpicTokens(connection) { /* Implementation */ }
    async updateConnectionStatus(connectionId, status) { /* Implementation */ }
    async handleDataRetention(connectionId, reason) { /* Implementation */ }

    /**
     * Close database connection
     */
    close() {
        if (this.db) {
            this.db.close();
        }
    }
}

module.exports = EpicMyChartIntegration;