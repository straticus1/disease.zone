/**
 * Disease Data Metasearch Engine
 * Searches across multiple authoritative health data sources
 */

const axios = require('axios');

class MetaSearchService {
    constructor() {
        this.dataSources = [
            {
                name: 'CDC',
                fullName: 'Centers for Disease Control and Prevention',
                baseUrl: 'https://data.cdc.gov',
                searchUrl: 'https://data.cdc.gov/api/views/metadata/v1',
                apiKey: null,
                color: '#005fcc',
                description: 'Official US health surveillance and disease data'
            },
            {
                name: 'WHO',
                fullName: 'World Health Organization',
                baseUrl: 'https://www.who.int',
                searchUrl: 'https://www.who.int/data/gho/data/indicators',
                apiKey: null,
                color: '#0093d0',
                description: 'Global health statistics and disease surveillance'
            },
            {
                name: 'NIH',
                fullName: 'National Institutes of Health',
                baseUrl: 'https://www.ncbi.nlm.nih.gov',
                searchUrl: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi',
                apiKey: process.env.NCBI_API_KEY || null,
                color: '#20558a',
                description: 'Biomedical research and clinical studies'
            },
            {
                name: 'EU ECDC',
                fullName: 'European Centre for Disease Prevention and Control',
                baseUrl: 'https://www.ecdc.europa.eu',
                searchUrl: 'https://www.ecdc.europa.eu/en/data',
                apiKey: null,
                color: '#003d82',
                description: 'European disease surveillance and health data'
            },
            {
                name: 'OpenData',
                fullName: 'US Government Open Data',
                baseUrl: 'https://catalog.data.gov',
                searchUrl: 'https://catalog.data.gov/api/3/action/package_search',
                apiKey: null,
                color: '#112e51',
                description: 'Federal government health datasets'
            }
        ];

        this.cache = new Map();
        this.cacheTimeout = 30 * 60 * 1000; // 30 minutes
    }

    /**
     * Perform metasearch across all configured data sources
     */
    async search(query, options = {}) {
        const {
            sources = this.dataSources.map(s => s.name),
            maxResults = 15,
            timeout = 10000,
            page = 1,
            pageSize = 50
        } = options;

        console.log(`🔍 MetaSearch: Searching for "${query}" across ${sources.length} sources (Page ${page})`);

        const cacheKey = `${query}_${sources.join(',')}_${maxResults}_${page}_${pageSize}`;

        // Check cache first
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                console.log('📦 MetaSearch: Returning cached results');
                return cached.data;
            }
        }

        const searchPromises = sources.map(sourceName => {
            const source = this.dataSources.find(s => s.name === sourceName);
            if (!source) return Promise.resolve([]);

            return this.searchSource(source, query, maxResults, timeout)
                .catch(error => {
                    console.warn(`⚠️ MetaSearch: Failed to search ${sourceName}:`, error.message);
                    return [];
                });
        });

        try {
            const allResults = await Promise.all(searchPromises);
            const { paginatedResults, totalResults } = this.combineAndRankResults(allResults, query, page, pageSize);

            const totalPages = Math.ceil(totalResults / pageSize);

            const result = {
                query,
                totalSources: sources.length,
                totalResults,
                currentPage: page,
                pageSize,
                totalPages,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1,
                searchTime: Date.now(),
                results: paginatedResults
            };

            // Cache the results
            this.cache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });

            console.log(`✅ MetaSearch: Found ${combinedResults.length} results across ${sources.length} sources`);
            return result;

        } catch (error) {
            console.error('❌ MetaSearch: Search failed:', error);
            throw error;
        }
    }

    /**
     * Search a specific data source
     */
    async searchSource(source, query, maxResults, timeout) {
        console.log(`🔍 Searching ${source.name} for "${query}"`);

        try {
            switch (source.name) {
                case 'CDC':
                    return await this.searchCDC(source, query, maxResults, timeout);
                case 'NIH':
                    return await this.searchNIH(source, query, maxResults, timeout);
                case 'OpenData':
                    return await this.searchOpenData(source, query, maxResults, timeout);
                default:
                    return await this.searchGeneric(source, query, maxResults, timeout);
            }
        } catch (error) {
            console.warn(`⚠️ ${source.name} search failed:`, error.message);
            return [];
        }
    }

    /**
     * Search CDC data catalog
     */
    async searchCDC(source, query, maxResults, timeout) {
        const searchUrl = `${source.searchUrl}?q=${encodeURIComponent(query)}&limit=${maxResults}`;

        const response = await axios.get(searchUrl, { timeout });
        const results = [];

        if (response.data && Array.isArray(response.data)) {
            for (const item of response.data.slice(0, maxResults)) {
                if (item.name && item.name.toLowerCase().includes(query.toLowerCase())) {
                    results.push({
                        title: item.name || 'Untitled Dataset',
                        description: item.description || 'CDC health dataset',
                        url: `https://data.cdc.gov/d/${item.id}`,
                        source: source.name,
                        sourceFullName: source.fullName,
                        sourceColor: source.color,
                        sourceDescription: source.description,
                        dataType: 'dataset',
                        lastUpdated: item.rowsUpdatedAt ? new Date(item.rowsUpdatedAt * 1000).toISOString() : null,
                        categories: item.tags || [],
                        score: this.calculateRelevanceScore(query, item.name, item.description)
                    });
                }
            }
        }

        return results;
    }

    /**
     * Search NIH/PubMed
     */
    async searchNIH(source, query, maxResults, timeout) {
        const searchUrl = `${source.searchUrl}?db=pubmed&term=${encodeURIComponent(query)}&retmax=${maxResults}&retmode=json`;

        const response = await axios.get(searchUrl, { timeout });
        const results = [];

        if (response.data && response.data.esearchresult && response.data.esearchresult.idlist) {
            // Get article details
            const ids = response.data.esearchresult.idlist.slice(0, maxResults);
            if (ids.length > 0) {
                const detailsUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`;

                try {
                    const detailsResponse = await axios.get(detailsUrl, { timeout });
                    const articles = detailsResponse.data.result;

                    for (const id of ids) {
                        const article = articles[id];
                        if (article && article.title) {
                            results.push({
                                title: article.title,
                                description: article.authors ? `By ${article.authors.slice(0, 3).map(a => a.name).join(', ')} - ${article.source}` : article.source || '',
                                url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
                                source: source.name,
                                sourceFullName: source.fullName,
                                sourceColor: source.color,
                                sourceDescription: source.description,
                                dataType: 'research',
                                lastUpdated: article.pubdate ? new Date(article.pubdate).toISOString() : null,
                                categories: ['research', 'publication'],
                                score: this.calculateRelevanceScore(query, article.title, article.source)
                            });
                        }
                    }
                } catch (error) {
                    console.warn('⚠️ NIH details fetch failed:', error.message);
                }
            }
        }

        return results;
    }

    /**
     * Search US Government Open Data
     */
    async searchOpenData(source, query, maxResults, timeout) {
        const searchUrl = `${source.searchUrl}?q=${encodeURIComponent(query + ' health disease')}&rows=${maxResults}`;

        const response = await axios.get(searchUrl, { timeout });
        const results = [];

        if (response.data && response.data.result && response.data.result.results) {
            for (const item of response.data.result.results) {
                results.push({
                    title: item.title || 'Government Dataset',
                    description: item.notes || 'Federal government health dataset',
                    url: `https://catalog.data.gov/dataset/${item.name}`,
                    source: source.name,
                    sourceFullName: source.fullName,
                    sourceColor: source.color,
                    sourceDescription: source.description,
                    dataType: 'dataset',
                    lastUpdated: item.metadata_modified || null,
                    categories: item.tags ? item.tags.map(t => t.display_name) : [],
                    score: this.calculateRelevanceScore(query, item.title, item.notes)
                });
            }
        }

        return results;
    }

    /**
     * Generic search for other sources
     */
    async searchGeneric(source, query, maxResults, timeout) {
        // For sources without specific API integration, return placeholder results
        return [{
            title: `${source.fullName} Search Results`,
            description: `Search "${query}" on ${source.fullName}`,
            url: `${source.baseUrl}/search?q=${encodeURIComponent(query)}`,
            source: source.name,
            sourceFullName: source.fullName,
            sourceColor: source.color,
            sourceDescription: source.description,
            dataType: 'external',
            lastUpdated: null,
            categories: ['external-search'],
            score: 0.5
        }];
    }

    /**
     * Calculate relevance score based on query match
     */
    calculateRelevanceScore(query, title, description) {
        const queryLower = query.toLowerCase();
        const titleLower = (title || '').toLowerCase();
        const descLower = (description || '').toLowerCase();

        let score = 0;

        // Exact title match
        if (titleLower.includes(queryLower)) {
            score += 0.8;
        }

        // Individual word matches in title
        const queryWords = queryLower.split(' ');
        queryWords.forEach(word => {
            if (word.length > 2 && titleLower.includes(word)) {
                score += 0.3;
            }
        });

        // Description matches
        if (descLower.includes(queryLower)) {
            score += 0.4;
        }

        queryWords.forEach(word => {
            if (word.length > 2 && descLower.includes(word)) {
                score += 0.1;
            }
        });

        return Math.min(score, 1.0);
    }

    /**
     * Combine and rank results from all sources with pagination
     */
    combineAndRankResults(allResults, query, page = 1, pageSize = 50) {
        const combined = [];

        allResults.forEach((sourceResults, index) => {
            if (Array.isArray(sourceResults)) {
                combined.push(...sourceResults);
            }
        });

        // Sort by relevance score, then by data type preference
        const sorted = combined
            .sort((a, b) => {
                // Primary sort: relevance score
                if (Math.abs(a.score - b.score) > 0.1) {
                    return b.score - a.score;
                }

                // Secondary sort: prefer datasets and research over external links
                const typeOrder = { dataset: 3, research: 2, external: 1 };
                return (typeOrder[b.dataType] || 0) - (typeOrder[a.dataType] || 0);
            });

        const totalResults = sorted.length;
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedResults = sorted.slice(startIndex, endIndex);

        return {
            paginatedResults,
            totalResults
        };
    }

    /**
     * Get available data sources
     */
    getDataSources() {
        return this.dataSources.map(source => ({
            name: source.name,
            fullName: source.fullName,
            description: source.description,
            color: source.color,
            baseUrl: source.baseUrl
        }));
    }

    /**
     * Clear search cache
     */
    clearCache() {
        this.cache.clear();
        console.log('🗑️ MetaSearch: Cache cleared');
    }
}

module.exports = MetaSearchService;