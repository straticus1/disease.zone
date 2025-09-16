/**
 * FHIR (Fast Healthcare Interoperability Resources) Integration Service
 * Enables users to search for and link to FHIR-enabled hospitals and healthcare providers
 * Supports health data import, anonymized disease tracking, and personalized health insights
 */

class FHIRService {
  constructor() {
    this.fhirEndpoints = {
      // Major FHIR directories and registries
      'hapi-fhir': 'https://hapi.fhir.org/baseR4',
      'smarthealth-it': 'https://launch.smarthealthit.org/v/r4/fhir',
      'cerner-sandbox': 'https://fhir-open.cerner.com/r4',
      'epic-sandbox': 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4'
    };

    // FHIR server registry for hospital discovery
    this.fhirRegistries = [
      {
        name: 'FHIR Server Registry',
        url: 'https://registry.fhir.org/servers',
        type: 'official'
      },
      {
        name: 'Smart Health IT Directory',
        url: 'https://launch.smarthealthit.org/servers',
        type: 'sandbox'
      }
    ];

    // Common FHIR resource types we'll work with
    this.resourceTypes = {
      Organization: 'Healthcare organizations and hospitals',
      Patient: 'Patient demographic and contact information',
      Observation: 'Clinical observations and test results',
      Condition: 'Patient conditions and diagnoses',
      DiagnosticReport: 'Diagnostic test reports',
      Immunization: 'Vaccination records',
      Location: 'Physical locations of care',
      Practitioner: 'Healthcare providers'
    };

    // Disease mapping for anonymized tracking
    this.diseaseMapping = {
      // ICD-10 to our internal disease codes
      'A54': 'gonorrhea',
      'A56': 'chlamydia',
      'A51': 'syphilis',
      'B20': 'hiv',
      'B21': 'aids',
      'Z87': 'personal_history'
    };

    this.cache = new Map();
    this.userConnections = new Map(); // Track user-hospital connections
  }

  /**
   * Search for FHIR-enabled hospitals and healthcare organizations
   */
  async searchHospitals(searchParams = {}) {
    const {
      location = null,
      name = null,
      state = null,
      city = null,
      radius = 50, // miles
      fhirVersion = 'R4',
      includeTest = false
    } = searchParams;

    try {
      const results = [];
      
      // Search through known FHIR endpoints
      for (const [serverId, baseUrl] of Object.entries(this.fhirEndpoints)) {
        try {
          const organizations = await this.searchFHIROrganizations(baseUrl, {
            name,
            address: location || `${city}, ${state}`,
            type: 'prov' // Healthcare provider
          });
          
          organizations.forEach(org => {
            results.push({
              id: org.id,
              name: org.name,
              fhirServerId: serverId,
              fhirBaseUrl: baseUrl,
              fhirVersion,
              address: this.extractAddress(org.address),
              telecom: this.extractTelecom(org.telecom),
              type: this.extractOrganizationType(org.type),
              active: org.active,
              capabilities: null, // Will be populated by capability statement
              distance: location ? await this.calculateDistance(location, org.address) : null,
              lastVerified: new Date().toISOString(),
              testEnvironment: serverId.includes('sandbox')
            });
          });
        } catch (error) {
          console.log(`Failed to search FHIR server ${serverId}:`, error.message);
          continue;
        }
      }

      // Filter results based on search criteria
      let filteredResults = results;
      
      if (!includeTest) {
        filteredResults = results.filter(org => !org.testEnvironment);
      }
      
      if (radius && location) {
        filteredResults = results.filter(org => org.distance && org.distance <= radius);
      }

      // Get FHIR capabilities for each organization
      for (const org of filteredResults.slice(0, 20)) { // Limit to prevent timeout
        try {
          org.capabilities = await this.getFHIRCapabilities(org.fhirBaseUrl);
        } catch (error) {
          console.log(`Failed to get capabilities for ${org.name}:`, error.message);
        }
      }

      return {
        success: true,
        totalResults: filteredResults.length,
        hospitals: filteredResults.sort((a, b) => (a.distance || 999) - (b.distance || 999)),
        searchParams,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error searching FHIR hospitals:', error);
      return {
        success: false,
        error: error.message,
        hospitals: [],
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Search for organizations in a specific FHIR server
   */
  async searchFHIROrganizations(baseUrl, searchParams) {
    const { default: fetch } = await import('node-fetch');
    
    // Build FHIR search URL
    const params = new URLSearchParams({
      _format: 'json',
      _count: '50' // Limit results
    });

    if (searchParams.name) {
      params.append('name', searchParams.name);
    }
    if (searchParams.address) {
      params.append('address', searchParams.address);
    }
    if (searchParams.type) {
      params.append('type', searchParams.type);
    }

    const url = `${baseUrl}/Organization?${params}`;
    
    const response = await fetch(url, {
      timeout: 10000,
      headers: {
        'Accept': 'application/fhir+json',
        'User-Agent': 'diseaseZone FHIR Client'
      }
    });

    if (!response.ok) {
      throw new Error(`FHIR server error: ${response.status}`);
    }

    const bundle = await response.json();
    
    if (bundle.resourceType !== 'Bundle') {
      throw new Error('Invalid FHIR Bundle response');
    }

    return bundle.entry ? bundle.entry.map(entry => entry.resource) : [];
  }

  /**
   * Get FHIR server capabilities
   */
  async getFHIRCapabilities(baseUrl) {
    const { default: fetch } = await import('node-fetch');
    
    try {
      const response = await fetch(`${baseUrl}/metadata`, {
        timeout: 5000,
        headers: {
          'Accept': 'application/fhir+json'
        }
      });

      if (!response.ok) {
        return { error: `HTTP ${response.status}` };
      }

      const capabilityStatement = await response.json();
      
      return {
        fhirVersion: capabilityStatement.fhirVersion,
        supportedResources: this.extractSupportedResources(capabilityStatement),
        authorizationSupported: this.checkAuthorizationSupport(capabilityStatement),
        smartEnabled: this.checkSmartSupport(capabilityStatement),
        lastUpdated: capabilityStatement.date
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Initiate FHIR connection for a user to a hospital
   */
  async initiateHospitalConnection(userId, hospitalId, connectionParams = {}) {
    const {
      scopes = ['patient/*.read', 'patient/*.write'],
      authMethod = 'smart-on-fhir',
      purpose = 'disease-surveillance-insights'
    } = connectionParams;

    try {
      // Generate a secure connection token
      const connectionId = this.generateConnectionId();
      
      const connection = {
        id: connectionId,
        userId,
        hospitalId,
        status: 'pending',
        scopes,
        authMethod,
        purpose,
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        consentGiven: false,
        dataPermissions: {
          readObservations: false,
          readConditions: false,
          readImmunizations: false,
          allowAnonymizedSharing: false
        }
      };

      // Store connection attempt
      this.userConnections.set(connectionId, connection);

      // Generate authorization URL for SMART on FHIR
      const authUrl = await this.generateSMARTAuthUrl(hospitalId, connectionId, scopes);

      return {
        success: true,
        connectionId,
        authorizationUrl: authUrl,
        instructions: this.getConnectionInstructions(authMethod),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutes
      };

    } catch (error) {
      console.error('Error initiating hospital connection:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Complete FHIR authorization and establish connection
   */
  async completeHospitalConnection(connectionId, authCode, state) {
    try {
      const connection = this.userConnections.get(connectionId);
      if (!connection) {
        throw new Error('Connection not found or expired');
      }

      // Exchange authorization code for access token
      const tokenResponse = await this.exchangeAuthCode(connection.hospitalId, authCode);
      
      // Update connection with token information
      connection.status = 'active';
      connection.accessToken = tokenResponse.access_token;
      connection.refreshToken = tokenResponse.refresh_token;
      connection.tokenExpiresAt = new Date(Date.now() + (tokenResponse.expires_in * 1000)).toISOString();
      connection.patientId = tokenResponse.patient;
      connection.consentGiven = true;
      connection.lastActivity = new Date().toISOString();

      this.userConnections.set(connectionId, connection);

      // Perform initial data sync
      const initialSync = await this.performInitialDataSync(connection);

      return {
        success: true,
        connectionId,
        status: 'active',
        patientId: tokenResponse.patient,
        dataSync: initialSync,
        message: 'Hospital connection established successfully'
      };

    } catch (error) {
      console.error('Error completing hospital connection:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Sync health data from connected hospital
   */
  async syncHealthData(connectionId, options = {}) {
    const {
      includeObservations = true,
      includeConditions = true,
      includeImmunizations = true,
      sinceDate = null,
      anonymizeData = true
    } = options;

    try {
      const connection = this.userConnections.get(connectionId);
      if (!connection || connection.status !== 'active') {
        throw new Error('No active hospital connection found');
      }

      const syncResults = {
        observations: [],
        conditions: [],
        immunizations: [],
        anonymizedInsights: {},
        lastSyncDate: new Date().toISOString()
      };

      const baseUrl = this.getHospitalFHIRUrl(connection.hospitalId);
      const headers = {
        'Authorization': `Bearer ${connection.accessToken}`,
        'Accept': 'application/fhir+json'
      };

      // Sync observations (lab results, vitals, etc.)
      if (includeObservations && connection.dataPermissions.readObservations) {
        syncResults.observations = await this.syncFHIRResource(
          baseUrl, 'Observation', connection.patientId, headers, sinceDate
        );
      }

      // Sync conditions (diagnoses)
      if (includeConditions && connection.dataPermissions.readConditions) {
        syncResults.conditions = await this.syncFHIRResource(
          baseUrl, 'Condition', connection.patientId, headers, sinceDate
        );
      }

      // Sync immunizations
      if (includeImmunizations && connection.dataPermissions.readImmunizations) {
        syncResults.immunizations = await this.syncFHIRResource(
          baseUrl, 'Immunization', connection.patientId, headers, sinceDate
        );
      }

      // Generate anonymized insights if permission given
      if (anonymizeData && connection.dataPermissions.allowAnonymizedSharing) {
        syncResults.anonymizedInsights = await this.generateAnonymizedInsights(
          syncResults, connection.userId
        );
      }

      // Update last activity
      connection.lastActivity = new Date().toISOString();
      this.userConnections.set(connectionId, connection);

      return {
        success: true,
        connectionId,
        syncResults,
        recordCount: this.countSyncedRecords(syncResults)
      };

    } catch (error) {
      console.error('Error syncing health data:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate anonymized disease insights for surveillance
   */
  async generateAnonymizedInsights(healthData, userId) {
    const insights = {
      diseaseExposures: [],
      riskFactors: [],
      geographicPatterns: [],
      temporalPatterns: {},
      contributionToSurveillance: 'anonymous'
    };

    try {
      // Analyze conditions for disease surveillance
      healthData.conditions.forEach(condition => {
        const diseaseCode = this.mapConditionToDisease(condition);
        if (diseaseCode) {
          insights.diseaseExposures.push({
            disease: diseaseCode,
            onsetDate: this.extractOnsetDate(condition),
            clinicalStatus: condition.clinicalStatus?.coding?.[0]?.code,
            severity: this.extractSeverity(condition),
            anonymizedLocation: this.anonymizeLocation(condition),
            ageGroup: this.getAgeGroup(condition.onsetDateTime),
            anonymous: true
          });
        }
      });

      // Analyze observations for risk factors
      healthData.observations.forEach(observation => {
        const riskFactor = this.identifyRiskFactor(observation);
        if (riskFactor) {
          insights.riskFactors.push({
            factor: riskFactor.type,
            value: this.anonymizeValue(riskFactor.value),
            category: riskFactor.category,
            anonymous: true
          });
        }
      });

      // Generate geographic patterns (heavily anonymized)
      insights.geographicPatterns = this.generateGeographicPatterns(insights.diseaseExposures);

      // Temporal analysis
      insights.temporalPatterns = this.analyzeTemporalPatterns(insights.diseaseExposures);

      return insights;

    } catch (error) {
      console.error('Error generating anonymized insights:', error);
      return { error: error.message };
    }
  }

  /**
   * Get user's connected hospitals
   */
  getUserConnections(userId) {
    const userConnections = [];
    
    for (const [connectionId, connection] of this.userConnections.entries()) {
      if (connection.userId === userId) {
        userConnections.push({
          id: connectionId,
          hospitalId: connection.hospitalId,
          hospitalName: this.getHospitalName(connection.hospitalId),
          status: connection.status,
          connectedAt: connection.createdAt,
          lastActivity: connection.lastActivity,
          dataPermissions: connection.dataPermissions,
          patientId: connection.patientId ? 'linked' : 'not-linked'
        });
      }
    }

    return userConnections;
  }

  // Utility methods
  extractAddress(addressArray) {
    if (!addressArray || !Array.isArray(addressArray)) return null;
    const addr = addressArray[0];
    return {
      line: addr.line,
      city: addr.city,
      state: addr.state,
      postalCode: addr.postalCode,
      country: addr.country
    };
  }

  extractTelecom(telecomArray) {
    if (!telecomArray || !Array.isArray(telecomArray)) return {};
    const telecom = {};
    telecomArray.forEach(contact => {
      if (contact.system === 'phone') telecom.phone = contact.value;
      if (contact.system === 'email') telecom.email = contact.value;
    });
    return telecom;
  }

  extractOrganizationType(typeArray) {
    if (!typeArray || !Array.isArray(typeArray)) return 'healthcare';
    return typeArray[0]?.coding?.[0]?.display || 'Healthcare Organization';
  }

  extractSupportedResources(capabilityStatement) {
    const resources = [];
    if (capabilityStatement.rest && capabilityStatement.rest[0] && capabilityStatement.rest[0].resource) {
      capabilityStatement.rest[0].resource.forEach(resource => {
        resources.push({
          type: resource.type,
          interactions: resource.interaction?.map(i => i.code) || []
        });
      });
    }
    return resources;
  }

  checkAuthorizationSupport(capabilityStatement) {
    return capabilityStatement.rest?.[0]?.security?.extension?.some(ext => 
      ext.url?.includes('oauth-uris')
    ) || false;
  }

  checkSmartSupport(capabilityStatement) {
    return this.checkAuthorizationSupport(capabilityStatement) && 
           capabilityStatement.rest?.[0]?.security?.cors === true;
  }

  generateConnectionId() {
    return 'fhir_' + Date.now() + '_' + Math.random().toString(36).substring(7);
  }

  async generateSMARTAuthUrl(hospitalId, connectionId, scopes) {
    // This would normally query the hospital's .well-known/smart_configuration
    // For now, return a template URL
    const baseUrl = this.getHospitalFHIRUrl(hospitalId);
    return `${baseUrl}/auth/authorize?response_type=code&client_id=diseaseZone&redirect_uri=${encodeURIComponent('https://disease.zone/fhir/callback')}&scope=${encodeURIComponent(scopes.join(' '))}&state=${connectionId}`;
  }

  getConnectionInstructions(authMethod) {
    return [
      '1. Click the authorization link to connect to your hospital',
      '2. Log in with your patient portal credentials', 
      '3. Review and approve data sharing permissions',
      '4. You will be redirected back to diseaseZone',
      '5. Your health data will be securely imported and anonymized'
    ];
  }

  getHospitalFHIRUrl(hospitalId) {
    // This would look up the actual FHIR base URL for the hospital
    return this.fhirEndpoints['hapi-fhir']; // Fallback
  }

  getHospitalName(hospitalId) {
    // This would look up the hospital name from our database
    return 'Connected Hospital';
  }

  mapConditionToDisease(condition) {
    const coding = condition.code?.coding?.[0];
    if (!coding) return null;
    
    // Map ICD-10 codes to our disease tracking system
    const icd10Code = coding.code?.substring(0, 3); // First 3 chars of ICD-10
    return this.diseaseMapping[icd10Code] || null;
  }

  // Additional utility methods would be implemented here...
  extractOnsetDate(condition) { return condition.onsetDateTime || null; }
  extractSeverity(condition) { return condition.severity?.coding?.[0]?.display || 'unknown'; }
  anonymizeLocation(condition) { return 'anonymized_location'; }
  getAgeGroup(date) { return date ? '20-30' : 'unknown'; }
  identifyRiskFactor(observation) { return null; } // Implement risk factor identification
  anonymizeValue(value) { return 'anonymized'; }
  generateGeographicPatterns(exposures) { return []; }
  analyzeTemporalPatterns(exposures) { return {}; }
  countSyncedRecords(results) { return (results.observations?.length || 0) + (results.conditions?.length || 0) + (results.immunizations?.length || 0); }

  async syncFHIRResource(baseUrl, resourceType, patientId, headers, sinceDate) {
    const { default: fetch } = await import('node-fetch');
    
    try {
      let url = `${baseUrl}/${resourceType}?patient=${patientId}&_count=100`;
      if (sinceDate) {
        url += `&_lastUpdated=ge${sinceDate}`;
      }

      const response = await fetch(url, { headers, timeout: 10000 });
      
      if (!response.ok) {
        throw new Error(`Failed to sync ${resourceType}: ${response.status}`);
      }

      const bundle = await response.json();
      return bundle.entry ? bundle.entry.map(entry => entry.resource) : [];
      
    } catch (error) {
      console.error(`Error syncing ${resourceType}:`, error);
      return [];
    }
  }

  async calculateDistance(location1, location2) {
    // Implement distance calculation between two addresses
    return Math.random() * 50; // Placeholder
  }

  async exchangeAuthCode(hospitalId, authCode) {
    // Implement OAuth2 authorization code exchange
    return {
      access_token: 'sample_token',
      refresh_token: 'sample_refresh',
      expires_in: 3600,
      patient: 'patient123'
    };
  }

  async performInitialDataSync(connection) {
    return {
      success: true,
      recordsImported: 0,
      message: 'Initial sync completed'
    };
  }
}

module.exports = FHIRService;