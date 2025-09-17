const express = require('express');
const router = express.Router();
const NewsApiService = require('../services/newsApiService');

// Initialize news service
const newsService = new NewsApiService();

// Get news by category
router.get('/category/:category', async (req, res) => {
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
router.get('/latest', async (req, res) => {
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
router.post('/cache/clear', async (req, res) => {
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