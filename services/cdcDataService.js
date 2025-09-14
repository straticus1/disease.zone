class CDCDataService {
  constructor() {
    this.baseURL = 'https://data.cdc.gov/api/views';
    this.fetch = null;
    this.initFetch();

    // CDC data.gov dataset endpoints for STD/STI data
    this.endpoints = {
      syphilis: '6ie8-bpiy', // NNDSS TABLE 1HH. Syphilis, Congenital to Primary/Secondary
      gonorrhea: 'vx8v-gfyf', // NNDSS TABLE 1M. Gonorrhea
      chlamydia: '97tt-n3j3', // NNDSS Table II. Chlamydia to Coccidioidomycosis
      // Additional endpoints can be added here
    };

    // Column mappings for different datasets
    this.columnMappings = {
      syphilis: {
        area: 'reporting_area',
        year: 'mmwr_year',
        week: 'mmwr_week',
        currentWeek: 'syphilis_congenital_current',
        cumulativeYTD: 'syphilis_congenital_cum_2021',
        primarySecondary: 'syphilis_primary_and_secondary_current'
      },
      gonorrhea: {
        area: 'reporting_area',
        year: 'mmwr_year',
        week: 'mmwr_week',
        currentWeek: 'gonorrhea_current_week',
        cumulativeYTD: 'gonorrhea_cum_2021'
      },
      chlamydia: {
        area: 'reporting_area',
        year: 'mmwr_year',
        week: 'mmwr_week',
        currentWeek: 'chlamydia_trachomatis_infection_current_week',
        cumulativeYTD: 'chlamydia_trachomatis_infection_cum_2015'
      }
    };

    // Cache for reducing API calls
    this.cache = new Map();
    this.cacheExpiry = 1000 * 60 * 60; // 1 hour cache
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
      disease = 'all',
      year = '2023',
      state = 'all',
      aggregateBy = 'state' // 'state', 'week', 'year'
    } = options;

    try {
      const cacheKey = `${disease}-${year}-${state}-${aggregateBy}`;

      // Check cache first
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheExpiry) {
          return { ...cached.data, source: 'cache' };
        }
      }

      let results = [];

      if (disease === 'all') {
        // Query all diseases
        const diseases = ['syphilis', 'gonorrhea', 'chlamydia'];
        const promises = diseases.map(d => this.fetchDiseaseData(d, year, state));
        const diseaseResults = await Promise.all(promises);

        diseases.forEach((d, index) => {
          if (diseaseResults[index]) {
            results.push(...diseaseResults[index].map(item => ({ ...item, disease: d })));
          }
        });
      } else if (this.endpoints[disease]) {
        const data = await this.fetchDiseaseData(disease, year, state);
        results = data ? data.map(item => ({ ...item, disease })) : [];
      } else {
        throw new Error(`Unsupported disease: ${disease}`);
      }

      const processedData = this.aggregateData(results, aggregateBy);

      const response = {
        success: true,
        data: processedData,
        totalRecords: processedData.length,
        source: 'CDC data.gov API',
        timestamp: new Date().toISOString(),
        dataYear: year,
        note: 'Real-time CDC surveillance data from NNDSS'
      };

      // Cache the response
      this.cache.set(cacheKey, { data: response, timestamp: Date.now() });

      return response;
    } catch (error) {
      console.error('Error querying CDC data.gov:', error);
      throw new Error(`Failed to fetch STD surveillance data: ${error.message}`);
    }
  }

  async fetchDiseaseData(disease, year, state) {
    const endpoint = this.endpoints[disease];
    if (!endpoint) return null;

    const url = `${this.baseURL}/${endpoint}/rows.json`;

    try {
      const response = await this.fetch(url, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Disease Tracking Application (respectful API usage)'
        }
      });

      if (!response.ok) {
        throw new Error(`CDC API error: ${response.status} - ${response.statusText}`);
      }

      const jsonData = await response.json();

      if (!jsonData.data || !Array.isArray(jsonData.data)) {
        throw new Error('Invalid response format from CDC API');
      }

      // Extract column metadata
      const columns = jsonData.meta?.view?.columns || [];
      const mapping = this.columnMappings[disease] || {};

      // Find column indices
      const columnIndices = {};
      columns.forEach((col, index) => {
        if (mapping.area && col.fieldName === mapping.area) columnIndices.area = index;
        if (mapping.year && col.fieldName === mapping.year) columnIndices.year = index;
        if (mapping.week && col.fieldName === mapping.week) columnIndices.week = index;
        if (mapping.currentWeek && col.fieldName === mapping.currentWeek) columnIndices.currentWeek = index;
        if (mapping.cumulativeYTD && col.fieldName === mapping.cumulativeYTD) columnIndices.cumulativeYTD = index;
      });

      // Process rows
      const processedData = jsonData.data
        .filter(row => {
          // Filter by year if specified
          if (year !== 'all' && columnIndices.year !== undefined) {
            return row[columnIndices.year] === year;
          }
          return true;
        })
        .filter(row => {
          // Filter by state if specified
          if (state !== 'all' && columnIndices.area !== undefined) {
            const areaName = row[columnIndices.area];
            return areaName && (
              areaName.toUpperCase() === state.toUpperCase() ||
              this.normalizeStateName(areaName) === this.normalizeStateName(state)
            );
          }
          return true;
        })
        .map(row => ({
          area: columnIndices.area !== undefined ? row[columnIndices.area] : 'Unknown',
          year: columnIndices.year !== undefined ? row[columnIndices.year] : year,
          week: columnIndices.week !== undefined ? row[columnIndices.week] : null,
          cases: this.parseCaseCount(row[columnIndices.currentWeek]),
          cumulativeCases: this.parseCaseCount(row[columnIndices.cumulativeYTD]),
          rawData: row
        }))
        .filter(item => item.cases !== null || item.cumulativeCases !== null); // Remove empty rows

      return processedData;
    } catch (error) {
      console.error(`Error fetching ${disease} data:`, error);
      return null;
    }
  }

  parseCaseCount(value) {
    if (value === null || value === undefined || value === '-' || value === 'N' || value === 'U') {
      return null;
    }

    const parsed = parseInt(value);
    return isNaN(parsed) ? null : parsed;
  }

  normalizeStateName(name) {
    if (!name) return '';
    return name.toUpperCase().replace(/[^A-Z]/g, '');
  }

  aggregateData(data, aggregateBy) {
    if (aggregateBy === 'raw') {
      return data;
    }

    const grouped = {};

    data.forEach(item => {
      let key;

      switch (aggregateBy) {
        case 'state':
          key = item.area;
          break;
        case 'year':
          key = item.year;
          break;
        case 'disease':
          key = item.disease;
          break;
        default:
          key = `${item.area}-${item.disease}`;
      }

      if (!grouped[key]) {
        grouped[key] = {
          key: key,
          area: item.area,
          year: item.year,
          disease: item.disease,
          totalCases: 0,
          weeklyReports: 0,
          lastUpdated: item.year
        };
      }

      // Aggregate cases (use cumulative if available, otherwise weekly)
      const cases = item.cumulativeCases || item.cases || 0;
      if (cases > grouped[key].totalCases) {
        grouped[key].totalCases = cases;
      }
      grouped[key].weeklyReports++;
    });

    return Object.values(grouped);
  }

  async getAvailableYears() {
    // Based on CDC NNDSS data availability
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let year = 2015; year <= currentYear; year++) {
      years.push(year.toString());
    }
    return years.reverse(); // Most recent first
  }

  async getDatasetInfo() {
    return {
      name: 'CDC data.gov STI Surveillance',
      description: 'Real-time STI surveillance data from CDC NNDSS',
      diseases: Object.keys(this.endpoints),
      dataRange: '2015-present',
      updateFrequency: 'Weekly',
      source: 'National Notifiable Diseases Surveillance System (NNDSS)',
      limitations: 'Data may include provisional counts subject to revision'
    };
  }
}

module.exports = CDCDataService;