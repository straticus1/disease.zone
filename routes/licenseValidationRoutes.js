const express = require('express');
const router = express.Router();
const LicenseValidationService = require('../services/licenseValidationService');
const rateLimit = require('express-rate-limit');

// Initialize the license validation service
const licenseService = new LicenseValidationService();

// Rate limiting for different tiers
const freeTierLimit = rateLimit({
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    max: 25, // 25 searches per day for free users
    message: {
        error: 'Free tier daily limit exceeded',
        limit: 25,
        resetTime: '24 hours',
        upgrade: 'Consider upgrading to Premium for 100 daily searches'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Skip rate limiting for premium users
        return req.user?.subscription?.tier !== 'free';
    }
});

const premiumTierLimit = rateLimit({
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    max: 100, // 100 searches per day for premium users
    message: {
        error: 'Premium tier daily limit exceeded',
        limit: 100,
        resetTime: '24 hours'
    },
    skip: (req) => {
        return req.user?.subscription?.tier === 'enterprise';
    }
});

/**
 * GET /api/license-validation/search
 * Search for healthcare provider licenses
 */
router.get('/search', freeTierLimit, premiumTierLimit, async (req, res) => {
    try {
        const { name, state, city, licenseNumber, providerType } = req.query;
        
        // Validation
        if (!name && !licenseNumber) {
            return res.status(400).json({
                error: 'Either name or license number is required',
                example: '/api/license-validation/search?name=John Smith&state=CA'
            });
        }

        if (!state && !licenseNumber) {
            return res.status(400).json({
                error: 'State is required when searching by name',
                validStates: ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY']
            });
        }

        // Get user tier for pricing/feature access
        const userTier = req.user?.subscription?.tier || 'free';
        
        // Perform the search
        const results = await licenseService.searchProviders({
            name,
            state: state?.toUpperCase(),
            city,
            licenseNumber,
            providerType: providerType || 'all'
        }, userTier);

        // Format response based on user tier
        const response = {
            success: true,
            results: {
                doctors: results.doctors.map(doctor => formatProviderForTier(doctor, userTier)),
                nurses: results.nurses.map(nurse => formatProviderForTier(nurse, userTier)),
                meta: results.searchMeta
            },
            userTier,
            searchesRemaining: await getRemainingSearches(req, userTier)
        };

        // Add tier-specific messaging
        if (userTier === 'free') {
            response.notice = 'Free tier: Basic license info only. Upgrade for violation history and detailed reports.';
            response.upgradeUrl = '/pricing';
        }

        res.json(response);

    } catch (error) {
        console.error('License search error:', error);
        res.status(500).json({
            error: 'Internal server error during license search',
            message: 'Please try again later'
        });
    }
});

/**
 * GET /api/license-validation/provider/:id/violations
 * Get detailed violation information for a provider (Premium+ only)
 */
router.get('/provider/:id/violations', async (req, res) => {
    try {
        const userTier = req.user?.subscription?.tier || 'free';
        
        if (userTier === 'free') {
            return res.status(403).json({
                error: 'Premium subscription required',
                message: 'Detailed violation reports are available for Premium and Enterprise subscribers only',
                upgradeUrl: '/pricing'
            });
        }

        const { id } = req.params;
        const violations = await licenseService.getViolations(id, req.query.providerType || 'doctor');

        res.json({
            success: true,
            providerId: id,
            violations: violations.map(violation => ({
                id: violation.id,
                type: violation.violation_type,
                description: violation.description,
                dateReported: violation.date_reported,
                status: violation.status,
                boardAction: violation.board_action,
                sourceUrl: violation.source_url,
                lastUpdated: new Date(violation.cached_at).toISOString()
            })),
            totalViolations: violations.length
        });

    } catch (error) {
        console.error('Violation lookup error:', error);
        res.status(500).json({
            error: 'Failed to retrieve violation data'
        });
    }
});

/**
 * GET /api/license-validation/verify/:npi
 * Quick NPI verification (all tiers)
 */
router.get('/verify/:npi', async (req, res) => {
    try {
        const { npi } = req.params;
        
        // Validate NPI format (10 digits)
        if (!/^\d{10}$/.test(npi)) {
            return res.status(400).json({
                error: 'Invalid NPI format',
                message: 'NPI must be exactly 10 digits',
                example: '1234567890'
            });
        }

        // Search by NPI in our system
        const results = await licenseService.searchProviders({
            licenseNumber: npi,
            providerType: 'doctor'
        }, req.user?.subscription?.tier || 'free');

        if (results.doctors.length === 0) {
            return res.status(404).json({
                error: 'NPI not found',
                npi,
                suggestion: 'Verify the NPI number at https://npiregistry.cms.hhs.gov/'
            });
        }

        const provider = results.doctors[0];
        res.json({
            success: true,
            npi,
            provider: {
                name: provider.name,
                state: provider.state,
                city: provider.city,
                specialty: provider.specialty,
                status: provider.status,
                source: provider.source,
                verificationUrl: provider.verificationUrl
            },
            verified: true,
            verifiedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error('NPI verification error:', error);
        res.status(500).json({
            error: 'NPI verification failed'
        });
    }
});

/**
 * GET /api/license-validation/stats
 * Service usage statistics (Enterprise only)
 */
router.get('/stats', async (req, res) => {
    try {
        const userTier = req.user?.subscription?.tier || 'free';
        
        if (userTier !== 'enterprise') {
            return res.status(403).json({
                error: 'Enterprise subscription required',
                message: 'Usage statistics are available for Enterprise subscribers only'
            });
        }

        const stats = await licenseService.getStats();
        
        res.json({
            success: true,
            stats: {
                totalSearches: stats.reduce((sum, row) => sum + row.total_searches, 0),
                uniqueSearches: stats.reduce((sum, row) => sum + row.unique_searches, 0),
                breakdown: stats
            },
            period: 'Last 30 days'
        });

    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({
            error: 'Failed to retrieve statistics'
        });
    }
});

/**
 * GET /api/license-validation/state-boards
 * Get list of state medical/nursing boards
 */
router.get('/state-boards', (req, res) => {
    const stateBoards = {
        medical: {
            'CA': { name: 'Medical Board of California', url: 'https://www.mbc.ca.gov/License-Verification/' },
            'NY': { name: 'New York State Board for Medicine', url: 'https://www.health.ny.gov/professionals/doctors/' },
            'TX': { name: 'Texas Medical Board', url: 'https://www.tmb.state.tx.us/page/lookup-a-license' },
            'FL': { name: 'Florida Department of Health', url: 'https://mqa-internet.doh.state.fl.us/mqasearchservices/healthcareproviders' }
        },
        nursing: {
            'CA': { name: 'California Board of Registered Nursing', url: 'https://www.rn.ca.gov/online/verify.shtml' },
            'NY': { name: 'New York State Board of Nursing', url: 'https://www.op.nysed.gov/prof/nurse/' },
            'TX': { name: 'Texas Board of Nursing', url: 'https://www.bon.texas.gov/licensure_verification.asp' },
            'FL': { name: 'Florida Board of Nursing', url: 'https://mqa-internet.doh.state.fl.us/mqasearchservices/healthcareproviders' }
        }
    };

    res.json({
        success: true,
        stateBoards,
        note: 'For complete verification, always check with the official state board',
        nationalResources: {
            doctors: 'https://www.docinfo.org/',
            nurses: 'https://www.nursys.com/'
        }
    });
});

/**
 * Helper function to format provider data based on user tier
 */
function formatProviderForTier(provider, userTier) {
    const baseData = {
        id: provider.id,
        name: provider.name,
        city: provider.city,
        state: provider.state,
        licenseNumber: provider.licenseNumber,
        status: provider.status,
        validThrough: provider.validThrough,
        specialty: provider.specialty,
        source: provider.source,
        verificationUrl: provider.verificationUrl
    };

    // Add tier-specific data
    if (userTier !== 'free') {
        baseData.npiNumber = provider.npiNumber;
        baseData.violationsCount = provider.violations?.length || 0;
        
        if (userTier === 'premium' || userTier === 'enterprise') {
            baseData.hasViolations = (provider.violations?.length || 0) > 0;
            
            if (userTier === 'enterprise') {
                baseData.violations = provider.violations || [];
            }
        }
    }

    return baseData;
}

/**
 * Helper function to calculate remaining searches for rate limiting
 */
async function getRemainingSearches(req, userTier) {
    const limits = {
        free: 25,
        premium: 100,
        enterprise: 'unlimited'
    };
    
    if (userTier === 'enterprise') {
        return 'unlimited';
    }
    
    // This would need integration with your rate limiting store
    // For now, return a placeholder
    return limits[userTier] || 25;
}

module.exports = router;