const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const NewsApiService = require('../services/newsApiService');

// Initialize news service
const newsService = new NewsApiService();

// Rate limiting for news endpoints
const newsRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
        success: false,
        error: 'Too many news requests from this IP, please try again later.',
        code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Admin rate limiting (more restrictive)
const adminRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limit each IP to 10 admin requests per windowMs
    message: {
        success: false,
        error: 'Too many admin requests from this IP, please try again later.',
        code: 'ADMIN_RATE_LIMIT_EXCEEDED'
    }
});

// Input validation middleware
const validateNewsRequest = (req, res, next) => {
    const { category } = req.params;
    const { limit } = req.query;
    
    if (category && !/^[a-zA-Z_]+$/.test(category)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid category format. Only letters and underscores allowed.',
            code: 'INVALID_CATEGORY'
        });
    }
    
    if (limit !== undefined) {
        const limitNum = parseInt(limit);
        if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
            return res.status(400).json({
                success: false,
                error: 'Limit must be a number between 1 and 50.',
                code: 'INVALID_LIMIT'
            });
        }
    }
    
    next();
};

// Apply rate limiting to all news routes
router.use(newsRateLimit);

// Get news by category
router.get('/category/:category', validateNewsRequest, async (req, res) => {
    try {
        const { category } = req.params;
        const { limit = 10 } = req.query;

        const result = await newsService.getNewsByCategory(category, parseInt(limit));

        res.json(result);

    } catch (error) {
        console.error('Error fetching news by category:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            category: req.params.category
        });
    }
});

// Get all categories
router.get('/categories', async (req, res) => {
    try {
        const result = await newsService.getAllCategories();
        res.json(result);

    } catch (error) {
        console.error('Error fetching news categories:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get latest news across all categories
router.get('/latest', validateNewsRequest, async (req, res) => {
    try {
        const { limit = 20 } = req.query;

        const result = await newsService.getNewsByCategory('all', parseInt(limit));

        res.json(result);

    } catch (error) {
        console.error('Error fetching latest news:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Clear news cache (admin only)
router.post('/cache/clear', adminRateLimit, async (req, res) => {
    try {
        newsService.clearCache();

        res.json({
            success: true,
            message: 'News cache cleared successfully'
        });

    } catch (error) {
        console.error('Error clearing news cache:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get cache statistics
router.get('/cache/stats', async (req, res) => {
    try {
        const stats = newsService.getCacheStats();

        res.json({
            success: true,
            cache: stats,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error fetching cache stats:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;