const express = require('express');
const router = express.Router();
const taxEngine = require('../services/taxEngine');
const pdfService = require('../services/pdfService');
const TaxProfile = require('../models/TaxProfile');
const auth = require('../middleware/auth');

// POST /api/tax/calculate (Public or Authenticated)
router.post('/calculate', (req, res) => {
    try {
        const fy = req.body.financialYear || '2024-2025';
        const result = taxEngine.compareTaxRegimes(req.body, fy);
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/tax/save (Authenticated)
router.post('/save', auth, async (req, res) => {
    try {
        const fy = req.body.financialYear || '2024-2025';
        const calcResult = taxEngine.compareTaxRegimes(req.body, fy);

        const profile = new TaxProfile({
            userId: req.user._id,
            financialYear: fy,
            taxpayerName: req.body.taxpayerName || req.user.name,
            ageCategory: req.body.ageCategory || 'general',
            residentialStatus: req.body.residentialStatus || 'resident',
            employmentType: req.body.employmentType || req.user.job || 'salaried',
            incomeDetails: {
                annualSalary: Number(req.body.annualSalary) || 0,
                basicSalary: Number(req.body.basicSalary) || 0,
                hraReceived: Number(req.body.hraReceived) || 0,
                rentPaid: Number(req.body.rentPaid) || 0,
                isMetro: !!req.body.isMetro,
                otherAllowances: Number(req.body.otherAllowances) || 0,
                rentalIncome: Number(req.body.rentalIncome) || 0,
                interestIncome: Number(req.body.interestIncome) || 0,
                ltcg: Number(req.body.ltcg) || 0,
                stcg: Number(req.body.stcg) || 0,
                otherIncome: Number(req.body.otherIncome) || 0
            },
            deductions: {
                sec80C: Number(req.body.sec80C) || 0,
                sec80D_self: Number(req.body.sec80D_self) || 0,
                sec80D_parents: Number(req.body.sec80D_parents) || 0,
                isParentsSenior: !!req.body.isParentsSenior,
                sec80CCD_1B: Number(req.body.sec80CCD_1B) || 0,
                sec80CCD_2: Number(req.body.sec80CCD_2) || 0,
                homeLoanInterest: Number(req.body.homeLoanInterest) || 0,
                sec80TTA_TTB: Number(req.body.sec80TTA_TTB) || 0,
                otherDeductions: Number(req.body.otherDeductions) || 0
            },
            tdsPaid: Number(req.body.tdsPaid) || 0,
            advanceTaxPaid: Number(req.body.advanceTaxPaid) || 0,
            results: calcResult
        });

        await profile.save();
        res.json({ success: true, message: 'Tax computation saved successfully', profileId: profile._id, results: calcResult });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/tax/latest (Authenticated)
router.get('/latest', auth, async (req, res) => {
    try {
        const latest = await TaxProfile.findOne({ userId: req.user._id }).sort({ updatedAt: -1 });
        res.json({ success: true, profile: latest });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/tax/download-pdf (Authenticated via Bearer or query token)
router.get('/download-pdf', auth, async (req, res) => {
    try {
        const profile = await TaxProfile.findOne({ userId: req.user._id }).sort({ updatedAt: -1 });
        if (!profile) {
            return res.status(404).json({ success: false, message: 'No tax profile found. Please compute and save tax first.' });
        }

        const pdfBuffer = await pdfService.generateTaxReportPDF(profile, req.user);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="tax-report-${profile.financialYear}.pdf"`);
        res.send(pdfBuffer);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
