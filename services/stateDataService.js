class StateDataService {
  constructor() {
    this.fetch = null;
    this.initFetch();

    // State-level STD data sources
    this.stateSources = {
      california: {
        name: 'California Health and Human Services Open Data Portal',
        description: 'STD surveillance data for California by disease, county, year, and sex',
        csvUrl: 'https://data.chhs.ca.gov/dataset/4de76cd0-0ac9-4260-8ac3-0637acb444fb/resource/563ba92b-8ac5-48ec-9afd-2f515bbbad66/download/stds-by-disease-county-year-sex-2001-2021.csv',
        dataRange: '2001-2021',
        updateFrequency: 'Annual',
        lastChecked: null
      },
      newYork: {
        name: 'New York State Department of Health',
        description: 'STI surveillance data for New York State',
        dataPortal: 'https://health.data.ny.gov/',
        dataRange: '2015-present',
        updateFrequency: 'Annual',
        lastChecked: null,
        note: 'API endpoints need to be discovered'
      },
      texas: {
        name: 'Texas Department of State Health Services',
        description: 'STD surveillance data for Texas',
        dataPortal: 'https://healthdata.dshs.texas.gov/',
        dataRange: '2010-present',
        updateFrequency: 'Annual',
        lastChecked: null,
        note: 'Dashboard available, API endpoints need to be discovered'
      }
    };

    // Cache for reducing external API calls
    this.cache = new Map();
    this.cacheExpiry = 1000 * 60 * 60 * 24; // 24 hour cache for state data
  }

  async initFetch() {
    if (!this.fetch) {
      const { default: fetch } = await import('node-fetch');
      this.fetch = fetch;
    }
  }

  async getCaliforniaData(options = {}) {
    await this.initFetch();

    const {
      disease = 'all',
      county = 'California', // State-level by default
      year = 'all',
      sex = 'Total'
    } = options;

    const cacheKey = `ca-${disease}-${county}-${year}-${sex}`;

    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheExpiry) {
        return { ...cached.data, source: 'cache' };
      }
    }

    try {
      const response = await this.fetch(this.stateSources.california.csvUrl, {
        timeout: 30000,
        headers: {
          'User-Agent': 'STD Surveillance Research Tool (respectful data usage)'
        }
      });

      if (!response.ok) {
        throw new Error(`California data fetch failed: ${response.status} - ${response.statusText}`);
      }

      const csvText = await response.text();
      const parsedData = this.parseCaliforniaCSV(csvText);

      // Filter data based on options
      const filteredData = parsedData.filter(row => {
        if (disease !== 'all' && row.disease.toLowerCase() !== disease.toLowerCase()) return false;
        if (county !== 'all' && row.county !== county) return false;
        if (year !== 'all' && row.year !== parseInt(year)) return false;
        if (sex !== 'all' && row.sex !== sex) return false;
        return true;
      });

      const result = {
        success: true,
        data: filteredData,
        totalRecords: filteredData.length,
        source: 'California Department of Public Health',
        state: 'California',
        dataRange: this.stateSources.california.dataRange,
        timestamp: new Date().toISOString(),
        note: 'State-level data from California Health and Human Services Open Data Portal'
      };

      // Cache the result
      this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;

    } catch (error) {
      console.error('Error fetching California STD data:', error);
      throw new Error(`Failed to fetch California STD surveillance data: ${error.message}`);
    }
  }

  parseCaliforniaCSV(csvText) {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.replace(/"/g, ''));
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length >= headers.length) {
        data.push({
          disease: values[0],
          county: values[1],
          year: parseInt(values[2]),
          sex: values[3],
          cases: parseInt(values[4]) || 0,
          population: parseInt(values[5]) || 0,
          rate: parseFloat(values[6]) || 0,
          lowerCI: parseFloat(values[7]) || null,
          upperCI: parseFloat(values[8]) || null,
          annotation: values[9] || null
        });
      }
    }

    return data;
  }

  parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current.trim());
    return values;
  }

  async queryStateData(state, options = {}) {
    switch (state.toLowerCase()) {
      case 'california':
      case 'ca':
        return await this.getCaliforniaData(options);

      case 'newyork':
      case 'ny':
        return {
          success: false,
          error: 'New York State data integration not yet implemented',
          note: 'New York provides data through health.data.ny.gov but specific STD datasets need to be identified',
          fallback: 'Use CDC data.gov API for New York data'
        };

      case 'texas':
      case 'tx':
        return {
          success: false,
          error: 'Texas State data integration not yet implemented',
          note: 'Texas provides data through healthdata.dshs.texas.gov but API endpoints need to be discovered',
          fallback: 'Use CDC data.gov API for Texas data'
        };

      default:
        return {
          success: false,
          error: `State '${state}' data integration not available`,
          availableStates: Object.keys(this.stateSources),
          fallback: 'Use CDC data.gov API for federal surveillance data'
        };
    }
  }

  async getAvailableStates() {
    return {
      states: Object.keys(this.stateSources),
      stateInfo: this.stateSources,
      note: 'State-level data sources with varying levels of API integration'
    };
  }

  async getStateDataSummary(state, year = 2021) {
    try {
      const data = await this.queryStateData(state, { year: year.toString(), sex: 'Total' });

      if (!data.success) {
        return data;
      }

      // Aggregate by disease
      const summary = {};
      data.data.forEach(item => {
        if (!summary[item.disease]) {
          summary[item.disease] = {
            totalCases: 0,
            totalPopulation: 0,
            counties: 0,
            avgRate: 0
          };
        }

        summary[item.disease].totalCases += item.cases;
        summary[item.disease].totalPopulation += item.population;
        summary[item.disease].counties += 1;
      });

      // Calculate average rates
      Object.keys(summary).forEach(disease => {
        const diseaseData = summary[disease];
        diseaseData.avgRate = diseaseData.totalPopulation > 0
          ? (diseaseData.totalCases / diseaseData.totalPopulation) * 100000
          : 0;
        diseaseData.avgRate = Math.round(diseaseData.avgRate * 100) / 100;
      });

      return {
        success: true,
        state: state,
        year: year,
        summary: summary,
        source: data.source,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error(`Error generating state data summary for ${state}:`, error);
      return {
        success: false,
        error: error.message,
        state: state,
        year: year
      };
    }
  }
}

module.exports = StateDataService;