class STDService {
  constructor() {
    this.baseURL = 'https://wonder.cdc.gov/controller/datarequest';
    // Note: Database code needs to be discovered from CDC WONDER interface
    // Common codes: D76 (mortality), D121 (potential STD), D118 (archive)
    this.stdDatabaseId = 'D121'; // Tentative STD database ID - needs verification
    this.fetch = null;
    this.initFetch();

    // Note: CDC WONDER STD data is only available through 2014
    // For recent data (2015+), use the CDCDataService instead
    this.maxAvailableYear = 2014;
    this.minAvailableYear = 1996;

    // Rate limiting (CDC requests spacing queries by 2+ minutes)
    this.lastRequestTime = 0;
    this.minRequestInterval = 2 * 60 * 1000; // 2 minutes in milliseconds

    // Parameter discovery status
    this.parametersDiscovered = false;
    this.discoveryNote = "Parameters need verification via CDC WONDER web interface";
  }

  async initFetch() {
    if (!this.fetch) {
      const { default: fetch } = await import('node-fetch');
      this.fetch = fetch;
    }
  }

  async querySTDData(options = {}) {
    await this.initFetch();

    const {
      disease = 'all', // chlamydia, gonorrhea, syphilis, or all
      year = '2014', // CDC WONDER STD data only available through 2014
      state = 'all',
      ageGroup = 'all'
    } = options;

    // Validate year range
    const requestYear = parseInt(year);
    if (requestYear > this.maxAvailableYear) {
      throw new Error(`STD data only available through ${this.maxAvailableYear}. For recent data, use alternative CDC sources.`);
    }
    if (requestYear < this.minAvailableYear) {
      throw new Error(`STD data only available from ${this.minAvailableYear} onwards.`);
    }

    // Rate limiting check
    const currentTime = Date.now();
    const timeSinceLastRequest = currentTime - this.lastRequestTime;
    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = Math.ceil((this.minRequestInterval - timeSinceLastRequest) / 1000);
      throw new Error(`Rate limited: Please wait ${waitTime} seconds before making another CDC WONDER request.`);
    }

    const xmlRequest = this.buildXMLRequest({
      disease,
      year,
      state,
      ageGroup
    });

    try {
      // Update last request time for rate limiting
      this.lastRequestTime = currentTime;

      const response = await this.fetch(`${this.baseURL}/${this.stdDatabaseId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Disease Tracking Application (respectful API usage)'
        },
        body: `request-xml=${encodeURIComponent(xmlRequest)}&agree=yes`,
        timeout: 30000 // 30 second timeout
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('CDC WONDER API Error Response:', errorText);
        throw new Error(`CDC WONDER API error: ${response.status} - ${response.statusText}`);
      }

      const xmlData = await response.text();
      const result = this.parseXMLResponse(xmlData);

      // Add metadata to result
      result.source = 'CDC WONDER API';
      result.requestedYear = requestYear;
      result.dataLimitations = 'Data available 1996-2014 only';

      return result;
    } catch (error) {
      console.error('Error querying STD data:', error);
      if (error.message.includes('Rate limited')) {
        throw error; // Re-throw rate limiting errors as-is
      }
      throw new Error(`Failed to fetch STD surveillance data: ${error.message}`);
    }
  }

  buildXMLRequest({ disease, year, state, ageGroup }) {
    // Improved XML structure based on CDC WONDER API research
    const dbCode = this.stdDatabaseId; // e.g., 'D121'

    return `<?xml version="1.0" encoding="UTF-8"?>
<request-parameters>
  <parameter>
    <name>accept_datause_restrictions</name>
    <value>true</value>
  </parameter>
  <parameter>
    <name>B_1</name>
    <value>${dbCode}.V1-level1</value>
  </parameter>
  <parameter>
    <name>B_2</name>
    <value>${dbCode}.V2-level1</value>
  </parameter>
  <parameter>
    <name>M_1</name>
    <value>${dbCode}.M1</value>
  </parameter>
  <parameter>
    <name>M_2</name>
    <value>${dbCode}.M2</value>
  </parameter>
  <parameter>
    <name>F_${dbCode}.V1</name>
    <value>*All*</value>
  </parameter>
  <parameter>
    <name>F_${dbCode}.V2</name>
    <value>*All*</value>
  </parameter>
  <parameter>
    <name>V_${dbCode}.V1</name>
    <value>${year}</value>
  </parameter>
  <parameter>
    <name>V_${dbCode}.V2</name>
    <value>${this.getStateCode(state)}</value>
  </parameter>
  <parameter>
    <name>V_${dbCode}.V3</name>
    <value>${this.getDiseaseCode(disease)}</value>
  </parameter>
  <parameter>
    <name>O_javascript</name>
    <value>Y</value>
  </parameter>
  <parameter>
    <name>action-Send</name>
    <value>Send</value>
  </parameter>
</request-parameters>`;
  }

  getDiseaseCode(disease) {
    const codes = {
      'chlamydia': 'Chlamydia',
      'gonorrhea': 'Gonorrhea',
      'syphilis': 'Primary and secondary syphilis',
      'all': '*All*'
    };
    return codes[disease.toLowerCase()] || codes['all'];
  }

  getStateCode(state) {
    if (state === 'all') return '*All*';
    const stateCodes = {
      'ny': 'New York',
      'ca': 'California',
      'tx': 'Texas',
      'fl': 'Florida',
      'al': 'Alabama',
      'ak': 'Alaska',
      'az': 'Arizona',
      'ar': 'Arkansas'
    };
    return stateCodes[state.toLowerCase()] || '*All*';
  }

  getAgeGroupCode(ageGroup) {
    const codes = {
      '15-19': '15-19 years',
      '20-24': '20-24 years',
      '25-29': '25-29 years',
      '30-34': '30-34 years',
      'all': '*All*'
    };
    return codes[ageGroup] || codes['all'];
  }

  parseXMLResponse(xmlData) {
    try {
      const dataRows = [];
      const lines = xmlData.split('\n');
      let inDataSection = false;

      for (const line of lines) {
        if (line.includes('<data-table>')) {
          inDataSection = true;
          continue;
        }

        if (line.includes('</data-table>')) {
          break;
        }

        if (inDataSection && line.includes('<r>')) {
          const rowMatch = line.match(/<r>([^<]+)<\/r>/);
          if (rowMatch) {
            const values = rowMatch[1].split('\t');
            if (values.length >= 4) {
              dataRows.push({
                disease: values[0] || 'Unknown',
                year: values[1] || 'Unknown',
                state: values[2] || 'Unknown',
                cases: parseInt(values[3]) || 0,
                rate: parseFloat(values[4]) || 0
              });
            }
          }
        }
      }

      return {
        success: true,
        data: dataRows,
        totalRecords: dataRows.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error parsing XML response:', error);
      return {
        success: false,
        error: 'Failed to parse CDC WONDER response',
        data: [],
        totalRecords: 0
      };
    }
  }

  async getSTDSummary(year = '2014') {
    try {
      if (!this.parametersDiscovered) {
        return {
          success: false,
          error: 'CDC WONDER parameters not yet configured',
          year: year,
          alternative: 'Use CDCDataService for recent data (2015-2024)',
          discoveryInstructions: [
            '1. Visit https://wonder.cdc.gov/std.html',
            '2. Configure desired query parameters',
            '3. Click Send to run query',
            '4. Click API Options tab after results load',
            '5. Download XML to get correct parameter structure',
            '6. Update this service with discovered parameters'
          ],
          timestamp: new Date().toISOString()
        };
      }

      const diseases = ['chlamydia', 'gonorrhea', 'syphilis'];
      const summaryData = {};

      for (const disease of diseases) {
        const result = await this.querySTDData({ disease, year });
        if (result.success && result.data.length > 0) {
          summaryData[disease] = {
            totalCases: result.data.reduce((sum, item) => sum + item.cases, 0),
            states: result.data.length,
            avgRate: result.data.reduce((sum, item) => sum + item.rate, 0) / result.data.length
          };
        }
      }

      return {
        success: true,
        year: year,
        summary: summaryData,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting STD summary:', error);
      throw new Error('Failed to generate STD summary data');
    }
  }

  // Method to help with parameter discovery
  getParameterDiscoveryInstructions() {
    return {
      status: 'parameters_need_discovery',
      currentDatabaseId: this.stdDatabaseId,
      potentialCodes: ['D118', 'D119', 'D120', 'D121', 'D122', 'D123', 'D124', 'D125'],
      nndssEventCodes: ['10118', '10119', '10120', '10121', '10122'],
      discoverySteps: [
        'Visit CDC WONDER STD interface: https://wonder.cdc.gov/std.html',
        'Configure a test query with desired parameters',
        'Submit the query and wait for results',
        'Click the "API Options" tab in the results',
        'Export the XML to see the correct parameter structure',
        'Update STDService with discovered database code and parameters'
      ],
      whatToLookFor: [
        'Database code (e.g., D121, D118, etc.)',
        'Variable codes (V1, V2, V3 for year, state, disease)',
        'Measure codes (M1, M2 for cases, rates)',
        'Filter parameter patterns (F_ prefix)',
        'Exact disease name spellings'
      ],
      researchFindings: {
        pythonExamples: 'https://github.com/alipphardt/cdc-wonder-api',
        rPackage: 'socdataR/wonderapi',
        dataStructure: 'STD morbidity data from 1984, includes chlamydia, gonorrhea, syphilis',
        limitations: 'CDC WONDER website experiencing 502 errors during testing'
      },
      alternativeRecommendation: 'Use CDCDataService for 2015-2024 data with real-time access'
    };
  }

  // Test multiple database codes to find working one
  async testDatabaseCodes() {
    const codes = ['D118', 'D119', 'D120', 'D121', 'D122', 'D123', 'D124', 'D125'];
    const results = {};

    for (const code of codes) {
      try {
        const testXML = this.buildTestXMLRequest(code);
        const response = await this.fetch(`${this.baseURL}/${code}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Disease Tracking Application (parameter discovery)'
          },
          body: `request-xml=${encodeURIComponent(testXML)}&agree=yes`,
          timeout: 10000
        });

        results[code] = {
          status: response.status,
          success: response.ok,
          note: response.ok ? 'Potential working code' : `Error ${response.status}`
        };

      } catch (error) {
        results[code] = {
          status: 'error',
          success: false,
          note: error.message
        };
      }

      // Add delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return {
      testResults: results,
      recommendedNext: 'Try the codes that returned 200 status with actual data parameters',
      timestamp: new Date().toISOString()
    };
  }

  buildTestXMLRequest(databaseCode) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<request-parameters>
  <parameter>
    <name>accept_datause_restrictions</name>
    <value>true</value>
  </parameter>
  <parameter>
    <name>B_1</name>
    <value>${databaseCode}.V1</value>
  </parameter>
  <parameter>
    <name>M_1</name>
    <value>${databaseCode}.M1</value>
  </parameter>
  <parameter>
    <name>O_javascript</name>
    <value>Y</value>
  </parameter>
  <parameter>
    <name>action-Send</name>
    <value>Send</value>
  </parameter>
</request-parameters>`;
  }
}

module.exports = STDService;