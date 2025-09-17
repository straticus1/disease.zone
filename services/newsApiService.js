/**
 * Health & Disease News API Service
 *
 * Aggregates news from multiple sources:
 * - RSS feeds from health organizations
 * - News APIs for health/medical content
 * - Official health alerts and bulletins
 */

const axios = require('axios');
const Parser = require('rss-parser');

class NewsApiService {
    constructor() {
        this.parser = new Parser();
        this.cache = new Map();
        this.cacheTimeout = 15 * 60 * 1000; // 15 minutes

        // RSS Feed sources for health news
        this.rssSources = {
            outbreak_sources: [
                {
                    name: 'WHO Disease Outbreak News',
                    url: 'https://www.who.int/feeds/entity/csr/don/en/rss.xml',
                    category: 'outbreaks',
                    priority: 'high'
                },
                {
                    name: 'CDC Health Alert Network',
                    url: 'https://emergency.cdc.gov/han/rss.xml',
                    category: 'outbreaks',
                    priority: 'high'
                },
                {
                    name: 'ProMED Outbreaks',
                    url: 'https://www.promedmail.org/rss/index.php',
                    category: 'outbreaks',
                    priority: 'medium'
                }
            ],
            research_sources: [
                {
                    name: 'PubMed Latest',
                    url: 'https://pubmed.ncbi.nlm.nih.gov/rss/search/1QIjmAMnYAFTyAOxUh2Z_YQUcTcAfYDBXKl8yE1VQv2BZKnHo2/?limit=50&utm_campaign=pubmed-2&fc=20220524213843',
                    category: 'research',
                    priority: 'medium'
                },
                {
                    name: 'Nature Medicine',
                    url: 'https://feeds.nature.com/nm/rss/current',
                    category: 'research',
                    priority: 'medium'
                },
                {
                    name: 'The Lancet',
                    url: 'https://www.thelancet.com/rssfeed/lancet_current.xml',
                    category: 'research',
                    priority: 'medium'
                }
            ],
            policy_sources: [
                {
                    name: 'FDA News Releases',
                    url: 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/press-announcements/rss.xml',
                    category: 'policy',
                    priority: 'medium'
                },
                {
                    name: 'NIH News',
                    url: 'https://www.nih.gov/news-events/news-releases/rss',
                    category: 'policy',
                    priority: 'medium'
                }
            ],
            prevention_sources: [
                {
                    name: 'CDC Health Tips',
                    url: 'https://tools.cdc.gov/api/v2/resources/media/rss/316422.rss',
                    category: 'prevention',
                    priority: 'low'
                },
                {
                    name: 'Healthline News',
                    url: 'https://www.healthline.com/rss/health-news',
                    category: 'prevention',
                    priority: 'low'
                }
            ]
        };

        // Mock data for development/fallback
        this.mockNews = {
            outbreaks: [
                {
                    title: "WHO Reports New Respiratory Illness Cluster in Southeast Asia",
                    description: "Health officials are investigating a cluster of respiratory illnesses with unknown cause affecting 47 individuals across three provinces.",
                    source: "World Health Organization",
                    publishedAt: new Date().toISOString(),
                    url: "https://who.int/news/outbreak-reports/latest",
                    severity: "high",
                    location: "Southeast Asia",
                    category: "outbreaks"
                },
                {
                    title: "CDC Issues Health Advisory for Increased Norovirus Activity",
                    description: "The Centers for Disease Control and Prevention reports a 35% increase in norovirus outbreaks compared to the same period last year.",
                    source: "CDC",
                    publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                    url: "https://cdc.gov/norovirus/outbreak-advisory",
                    severity: "moderate",
                    location: "United States",
                    category: "outbreaks"
                },
                {
                    title: "Avian Influenza H5N1 Detected in Wild Bird Population",
                    description: "State health officials confirm H5N1 avian influenza in local waterfowl populations, urging caution for poultry farmers and wildlife handlers.",
                    source: "State Health Department",
                    publishedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
                    url: "https://health.state.gov/avian-flu-advisory",
                    severity: "moderate",
                    location: "Pacific Northwest",
                    category: "outbreaks"
                }
            ],
            research: [
                {
                    title: "New Study Reveals CRISPR Gene Therapy Success in Sickle Cell Disease",
                    description: "Clinical trial results show 95% success rate in treating sickle cell disease using CRISPR-Cas9 gene editing technology.",
                    source: "New England Journal of Medicine",
                    publishedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
                    url: "https://nejm.org/crispr-sickle-cell-study",
                    category: "research"
                },
                {
                    title: "Breakthrough mRNA Vaccine Shows Promise Against Multiple Cancer Types",
                    description: "Phase II trials demonstrate significant tumor reduction across breast, lung, and colorectal cancers using personalized mRNA therapy.",
                    source: "Nature Medicine",
                    publishedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
                    url: "https://nature.com/articles/mrna-cancer-vaccine",
                    category: "research"
                },
                {
                    title: "AI-Powered Drug Discovery Identifies New Antibiotic Compound",
                    description: "Machine learning algorithms successfully identify novel antibiotic effective against drug-resistant bacterial infections.",
                    source: "Science",
                    publishedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
                    url: "https://science.org/ai-antibiotic-discovery",
                    category: "research"
                }
            ],
            policy: [
                {
                    title: "FDA Approves New Alzheimer's Drug Following Accelerated Review",
                    description: "The Food and Drug Administration grants accelerated approval for a new treatment targeting amyloid plaques in Alzheimer's disease.",
                    source: "FDA",
                    publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                    url: "https://fda.gov/alzheimers-drug-approval",
                    category: "policy"
                },
                {
                    title: "CDC Updates Guidelines for Healthcare-Associated Infection Prevention",
                    description: "New recommendations emphasize enhanced cleaning protocols and staff training to reduce hospital-acquired infections by 40%.",
                    source: "CDC",
                    publishedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
                    url: "https://cdc.gov/hai-prevention-guidelines",
                    category: "policy"
                }
            ],
            prevention: [
                {
                    title: "Study Shows Mediterranean Diet Reduces Heart Disease Risk by 30%",
                    description: "Long-term research confirms that Mediterranean dietary patterns significantly lower cardiovascular disease incidence.",
                    source: "American Heart Association",
                    publishedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
                    url: "https://heart.org/mediterranean-diet-study",
                    category: "prevention"
                },
                {
                    title: "New Exercise Guidelines Recommend 150 Minutes Weekly Activity",
                    description: "Updated physical activity recommendations emphasize the importance of both aerobic exercise and strength training.",
                    source: "American College of Sports Medicine",
                    publishedAt: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(),
                    url: "https://acsm.org/exercise-guidelines-2024",
                    category: "prevention"
                }
            ]
        };
    }

    async getNewsByCategory(category = 'outbreaks', limit = 10) {
        try {
            const cacheKey = `news_${category}_${limit}`;

            // Check cache first
            if (this.cache.has(cacheKey)) {
                const cached = this.cache.get(cacheKey);
                if (Date.now() - cached.timestamp < this.cacheTimeout) {
                    return cached.data;
                }
            }

            let news = [];

            // Try to fetch from RSS sources
            try {
                news = await this.fetchFromRssSources(category, limit);
            } catch (error) {
                console.warn('RSS fetch failed, using mock data:', error.message);
                news = this.getMockNewsByCategory(category, limit);
            }

            // If no news fetched, use mock data
            if (news.length === 0) {
                news = this.getMockNewsByCategory(category, limit);
            }

            const result = {
                success: true,
                category,
                news,
                total: news.length,
                lastUpdated: new Date().toISOString()
            };

            // Cache the result
            this.cache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });

            return result;

        } catch (error) {
            console.error('Error fetching news:', error);
            return {
                success: false,
                error: error.message,
                category,
                news: this.getMockNewsByCategory(category, limit),
                total: 0,
                lastUpdated: new Date().toISOString()
            };
        }
    }

    async fetchFromRssSources(category, limit) {
        const sources = this.getAllSourcesForCategory(category);
        const allNews = [];

        for (const source of sources) {
            try {
                const feed = await this.parser.parseURL(source.url);
                const items = feed.items.slice(0, Math.ceil(limit / sources.length)).map(item => ({
                    title: item.title,
                    description: item.contentSnippet || item.content || 'No description available',
                    source: source.name,
                    publishedAt: item.pubDate || new Date().toISOString(),
                    url: item.link,
                    category: source.category,
                    priority: source.priority
                }));
                allNews.push(...items);
            } catch (error) {
                console.warn(`Failed to fetch from ${source.name}:`, error.message);
            }
        }

        // Sort by published date (newest first) and limit results
        return allNews
            .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
            .slice(0, limit);
    }

    getAllSourcesForCategory(category) {
        const allSources = [];
        Object.values(this.rssSources).forEach(sourceGroup => {
            allSources.push(...sourceGroup.filter(source =>
                source.category === category || category === 'all'
            ));
        });
        return allSources;
    }

    getMockNewsByCategory(category, limit) {
        if (category === 'all') {
            const allMockNews = [];
            Object.values(this.mockNews).forEach(categoryNews => {
                allMockNews.push(...categoryNews);
            });
            return allMockNews
                .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
                .slice(0, limit);
        }

        return (this.mockNews[category] || []).slice(0, limit);
    }

    async getAllCategories() {
        return {
            success: true,
            categories: [
                {
                    id: 'outbreaks',
                    name: 'Disease Outbreaks',
                    description: 'Real-time outbreak alerts and epidemic monitoring',
                    icon: 'fas fa-exclamation-triangle',
                    color: '#dc2626'
                },
                {
                    id: 'research',
                    name: 'Medical Research',
                    description: 'Latest breakthroughs in medical science and technology',
                    icon: 'fas fa-microscope',
                    color: '#2563eb'
                },
                {
                    id: 'policy',
                    name: 'Health Policy',
                    description: 'Regulatory updates and health policy changes',
                    icon: 'fas fa-gavel',
                    color: '#7c3aed'
                },
                {
                    id: 'prevention',
                    name: 'Prevention & Wellness',
                    description: 'Public health guidance and prevention strategies',
                    icon: 'fas fa-shield-alt',
                    color: '#059669'
                }
            ]
        };
    }

    clearCache() {
        this.cache.clear();
        console.log('News API cache cleared');
    }

    getCacheStats() {
        return {
            size: this.cache.size,
            entries: Array.from(this.cache.keys())
        };
    }
}

module.exports = NewsApiService;