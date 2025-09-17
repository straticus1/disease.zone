/**
 * Redirect Service for External Source Attribution
 * Tracks outbound clicks and provides attribution page
 */

class RedirectService {
    constructor() {
        this.redirectLog = new Map();
        this.sources = {
            'CDC': {
                fullName: 'Centers for Disease Control and Prevention',
                logo: '/images/cdc-logo.png',
                description: 'The CDC is the national public health agency of the United States.',
                website: 'https://www.cdc.gov',
                trustScore: 'Highly Trusted',
                color: '#005fcc'
            },
            'WHO': {
                fullName: 'World Health Organization',
                logo: '/images/who-logo.png',
                description: 'WHO is the directing and coordinating authority on international health within the United Nations.',
                website: 'https://www.who.int',
                trustScore: 'Highly Trusted',
                color: '#0093d0'
            },
            'NIH': {
                fullName: 'National Institutes of Health',
                logo: '/images/nih-logo.png',
                description: 'NIH is the primary agency of the US government responsible for biomedical research.',
                website: 'https://www.nih.gov',
                trustScore: 'Highly Trusted',
                color: '#20558a'
            },
            'EU ECDC': {
                fullName: 'European Centre for Disease Prevention and Control',
                logo: '/images/ecdc-logo.png',
                description: 'ECDC strengthens Europe\'s defences against infectious diseases.',
                website: 'https://www.ecdc.europa.eu',
                trustScore: 'Highly Trusted',
                color: '#003d82'
            },
            'OpenData': {
                fullName: 'US Government Open Data',
                logo: '/images/opendata-logo.png',
                description: 'Official repository of federal government datasets.',
                website: 'https://data.gov',
                trustScore: 'Government Source',
                color: '#112e51'
            }
        };
    }

    /**
     * Create a redirect URL with tracking
     */
    createRedirectUrl(targetUrl, source, searchQuery = '', resultTitle = '') {
        const redirectId = this.generateRedirectId();

        // Store redirect information
        this.redirectLog.set(redirectId, {
            targetUrl,
            source,
            searchQuery,
            resultTitle,
            timestamp: new Date().toISOString(),
            clicked: false
        });

        return `/redirect/${redirectId}`;
    }

    /**
     * Get redirect information by ID
     */
    getRedirectInfo(redirectId) {
        return this.redirectLog.get(redirectId) || null;
    }

    /**
     * Mark redirect as clicked and get target URL
     */
    processRedirect(redirectId, userIP = null) {
        const redirectInfo = this.redirectLog.get(redirectId);

        if (!redirectInfo) {
            return null;
        }

        // Mark as clicked
        redirectInfo.clicked = true;
        redirectInfo.clickedAt = new Date().toISOString();
        redirectInfo.userIP = userIP;

        // Log the redirect for analytics
        console.log(`🔗 Redirect: User redirected to ${redirectInfo.source} - ${redirectInfo.targetUrl}`);

        return redirectInfo;
    }

    /**
     * Get source information
     */
    getSourceInfo(sourceName) {
        return this.sources[sourceName] || {
            fullName: sourceName,
            description: 'External data source',
            website: '',
            trustScore: 'Unknown',
            color: '#6b7280'
        };
    }

    /**
     * Generate redirect HTML page
     */
    generateRedirectPage(redirectInfo) {
        const sourceInfo = this.getSourceInfo(redirectInfo.source);

        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Redirecting to ${sourceInfo.fullName} - diseaseZone</title>
    <meta http-equiv="refresh" content="3;url=${redirectInfo.targetUrl}">
    <style>
        :root {
            --primary-color: #2563eb;
            --success-color: #10b981;
            --border-color: #e2e8f0;
            --text-primary: #0f172a;
            --text-secondary: #64748b;
            --light-color: #f8fafc;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--text-primary);
        }

        .redirect-container {
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
            padding: 3rem;
            max-width: 600px;
            width: 90%;
            text-align: center;
            border: 1px solid var(--border-color);
        }

        .logo-section {
            margin-bottom: 2rem;
        }

        .logo-section h1 {
            color: var(--primary-color);
            font-size: 2rem;
            font-weight: 700;
            margin-bottom: 0.5rem;
        }

        .logo-section p {
            color: var(--text-secondary);
            font-size: 1rem;
        }

        .redirect-info {
            background: var(--light-color);
            border-radius: 12px;
            padding: 2rem;
            margin: 2rem 0;
            border-left: 4px solid ${sourceInfo.color};
        }

        .source-badge {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            background: ${sourceInfo.color};
            color: white;
            padding: 0.5rem 1rem;
            border-radius: 20px;
            font-size: 0.9rem;
            font-weight: 600;
            margin-bottom: 1rem;
        }

        .redirect-title {
            font-size: 1.5rem;
            font-weight: 600;
            color: var(--text-primary);
            margin-bottom: 1rem;
        }

        .source-description {
            color: var(--text-secondary);
            font-size: 1rem;
            line-height: 1.6;
            margin-bottom: 1.5rem;
        }

        .trust-badge {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            background: var(--success-color);
            color: white;
            padding: 0.5rem 1rem;
            border-radius: 6px;
            font-size: 0.9rem;
            font-weight: 500;
        }

        .progress-section {
            margin: 2rem 0;
        }

        .progress-bar {
            background: var(--border-color);
            height: 6px;
            border-radius: 3px;
            overflow: hidden;
            margin: 1rem 0;
        }

        .progress-fill {
            background: linear-gradient(90deg, var(--primary-color), var(--success-color));
            height: 100%;
            border-radius: 3px;
            animation: progress 3s ease-in-out;
        }

        @keyframes progress {
            from { width: 0%; }
            to { width: 100%; }
        }

        .action-buttons {
            display: flex;
            gap: 1rem;
            justify-content: center;
            flex-wrap: wrap;
        }

        .btn {
            padding: 0.75rem 1.5rem;
            border-radius: 8px;
            font-weight: 600;
            text-decoration: none;
            transition: all 0.2s ease;
            border: none;
            cursor: pointer;
            font-size: 0.95rem;
        }

        .btn-primary {
            background: var(--primary-color);
            color: white;
        }

        .btn-primary:hover {
            background: #1d4ed8;
            transform: translateY(-1px);
        }

        .btn-secondary {
            background: white;
            color: var(--text-primary);
            border: 2px solid var(--border-color);
        }

        .btn-secondary:hover {
            border-color: var(--primary-color);
            color: var(--primary-color);
        }

        .search-context {
            background: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 8px;
            padding: 1rem;
            margin: 1.5rem 0;
            font-size: 0.9rem;
        }

        .search-context strong {
            color: #d97706;
        }

        @media (max-width: 640px) {
            .redirect-container {
                padding: 2rem;
                margin: 1rem;
            }

            .action-buttons {
                flex-direction: column;
            }
        }
    </style>
</head>
<body>
    <div class="redirect-container">
        <div class="logo-section">
            <h1>🧬 diseaseZone</h1>
            <p>Global Health Intelligence Platform</p>
        </div>

        <div class="redirect-info">
            <div class="source-badge">
                🔗 ${sourceInfo.fullName}
            </div>

            <h2 class="redirect-title">Taking you to ${sourceInfo.fullName}</h2>

            <p class="source-description">
                ${sourceInfo.description}
            </p>

            <div class="trust-badge">
                ✅ ${sourceInfo.trustScore}
            </div>
        </div>

        ${redirectInfo.searchQuery ? `
        <div class="search-context">
            <strong>Search Context:</strong> Results for "${redirectInfo.searchQuery}"
            ${redirectInfo.resultTitle ? `<br><strong>Result:</strong> ${redirectInfo.resultTitle}` : ''}
        </div>
        ` : ''}

        <div class="progress-section">
            <p style="color: var(--text-secondary); margin-bottom: 0.5rem;">
                Redirecting automatically in 3 seconds...
            </p>
            <div class="progress-bar">
                <div class="progress-fill"></div>
            </div>
        </div>

        <div class="action-buttons">
            <a href="${redirectInfo.targetUrl}" class="btn btn-primary">
                🚀 Continue to ${redirectInfo.source}
            </a>
            <a href="/" class="btn btn-secondary">
                ← Back to diseaseZone
            </a>
        </div>

        <div style="margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid var(--border-color);">
            <p style="color: var(--text-secondary); font-size: 0.9rem;">
                This redirect helps us provide attribution to our data sources and track which resources are most valuable to our users.
            </p>
        </div>
    </div>

    <script>
        // Optional: Add click tracking
        document.querySelector('a[href="${redirectInfo.targetUrl}"]').addEventListener('click', function() {
            // Track manual click
            fetch('/api/redirect/track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    redirectId: '${redirectInfo.redirectId || ''}',
                    manual: true
                })
            }).catch(() => {}); // Silent fail
        });
    </script>
</body>
</html>`;
    }

    /**
     * Generate a unique redirect ID
     */
    generateRedirectId() {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }

    /**
     * Clean up old redirect entries (older than 24 hours)
     */
    cleanupOldRedirects() {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        for (const [id, info] of this.redirectLog.entries()) {
            if (new Date(info.timestamp) < oneDayAgo) {
                this.redirectLog.delete(id);
            }
        }

        console.log(`🧹 Redirect cleanup: ${this.redirectLog.size} entries remaining`);
    }

    /**
     * Get redirect analytics
     */
    getAnalytics() {
        const total = this.redirectLog.size;
        const clicked = Array.from(this.redirectLog.values()).filter(r => r.clicked).length;
        const bySource = {};

        for (const info of this.redirectLog.values()) {
            bySource[info.source] = (bySource[info.source] || 0) + 1;
        }

        return {
            totalRedirects: total,
            clickedRedirects: clicked,
            clickRate: total > 0 ? (clicked / total * 100).toFixed(1) : 0,
            bySource
        };
    }
}

module.exports = RedirectService;