const express = require('express');
const router = express.Router();
const fdEngine = require('../services/fdEngine');
const FDRecord = require('../models/FDRecord');
const auth = require('../middleware/auth');

// POST /api/fd/calculate
router.post('/calculate', (req, res) => {
    try {
        const result = fdEngine.calculateFD(req.body);
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/fd/compare
router.post('/compare', (req, res) => {
    try {
        const { principal = 100000, rate = 7.0, isSeniorCitizen = false } = req.body;
        const scenarios = fdEngine.compareFDScenarios(Number(principal), Number(rate), !!isSeniorCitizen);
        res.json({ success: true, scenarios });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/fd/save (Authenticated)
router.post('/save', auth, async (req, res) => {
    try {
        const result = fdEngine.calculateFD(req.body);
        const record = new FDRecord({
            userId: req.user._id,
            principal: result.principal,
            interestRate: result.effectiveRate,
            tenureMonths: result.tenureMonths,
            compounding: result.compounding,
            isCumulative: result.isCumulative,
            isSeniorCitizen: result.isSeniorCitizen,
            maturityAmount: result.maturityAmount,
            totalInterest: result.totalInterest,
            tdsEstimated: result.estimatedTds
        });

        await record.save();
        res.json({ success: true, message: 'FD investment record saved', record });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
