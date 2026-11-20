const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');
const auth = require('../middleware/auth');

// POST /api/ai/chat (Authenticated)
router.post('/chat', auth, async (req, res) => {
    try {
        const { message } = req.body;
        const reply = await aiService.askAIFinancialAssistant(req.user._id, message);
        res.json({ success: true, reply });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/ai/context (Authenticated)
router.get('/context', auth, async (req, res) => {
    try {
        const context = await aiService.getFinancialContext(req.user._id);
        res.json({ success: true, context });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
