const express = require('express');
const router = express.Router();
const loanEngine = require('../services/loanEngine');
const LoanRecord = require('../models/LoanRecord');
const auth = require('../middleware/auth');

// POST /api/loan/assess (or /api/loan for backward compatibility)
router.post('/assess', (req, res) => {
    try {
        const assessment = loanEngine.assessLoanEligibility(req.body);
        res.json({ success: true, ...assessment });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/loan/amortization
router.post('/amortization', (req, res) => {
    try {
        const { principal = 500000, annualRate = 9.5, tenureMonths = 60 } = req.body;
        const schedule = loanEngine.generateAmortizationSchedule(Number(principal), Number(annualRate), Number(tenureMonths));
        res.json({ success: true, schedule });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/loan/compare
router.post('/compare', (req, res) => {
    try {
        const { loanA, loanB } = req.body;
        const comparison = loanEngine.compareLoans(loanA || {}, loanB || {});
        res.json({ success: true, comparison });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/loan/save (Authenticated)
router.post('/save', auth, async (req, res) => {
    try {
        const assessment = loanEngine.assessLoanEligibility(req.body);

        const record = new LoanRecord({
            userId: req.user._id,
            loanType: req.body.loanType || 'personal',
            occupation: req.body.occupation || 'Salaried',
            monthlyIncome: Number(req.body.monthlyIncome) || 0,
            monthlyExpenses: Number(req.body.monthlyExpenses) || 0,
            existingEmis: Number(req.body.existingEmis) || 0,
            creditScore: Number(req.body.creditScore) || 750,
            requestedAmount: Number(req.body.requestedAmount) || 0,
            interestRate: Number(req.body.interestRate) || 0,
            tenureMonths: Number(req.body.tenureMonths) || 12,
            emi: assessment.emi,
            totalInterest: assessment.totalInterest,
            totalPayment: assessment.totalPayment,
            foir: assessment.foir,
            maxEligibleLoan: assessment.maxEligibleLoan,
            affordabilityStatus: assessment.affordabilityStatus
        });

        await record.save();
        res.json({ success: true, message: 'Loan calculation saved', record });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
