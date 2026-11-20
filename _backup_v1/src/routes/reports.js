const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const pdfService = require('../services/pdfService');
const auth = require('../middleware/auth');

// GET /api/reports/analytics (Authenticated)
router.get('/analytics', auth, async (req, res) => {
    try {
        const transactions = await Transaction.find({ userId: req.user._id }).sort({ date: 1 });

        let totalIncome = 0;
        let totalExpense = 0;
        const categoryBreakdown = {};
        const dailyExpenses = {};

        transactions.forEach(t => {
            if (t.type === 'income') {
                totalIncome += t.amount;
            } else {
                totalExpense += t.amount;
                categoryBreakdown[t.category] = (categoryBreakdown[t.category] || 0) + t.amount;

                const dayKey = new Date(t.date).toISOString().split('T')[0];
                dailyExpenses[dayKey] = (dailyExpenses[dayKey] || 0) + t.amount;
            }
        });

        const netSavings = totalIncome - totalExpense;
        const savingsRate = totalIncome > 0 ? Number(((netSavings / totalIncome) * 100).toFixed(1)) : 0;

        res.json({
            success: true,
            totalIncome,
            totalExpense,
            netSavings,
            savingsRate,
            categoryBreakdown,
            dailyExpenses,
            transactionCount: transactions.length
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/reports/download-pdf (Authenticated via Bearer or ?token=)
router.get('/download-pdf', auth, async (req, res) => {
    try {
        const transactions = await Transaction.find({ userId: req.user._id }).sort({ date: -1 });

        let totalIncome = 0;
        let totalExpense = 0;
        const categoryBreakdown = {};

        transactions.forEach(t => {
            if (t.type === 'income') totalIncome += t.amount;
            else {
                totalExpense += t.amount;
                categoryBreakdown[t.category] = (categoryBreakdown[t.category] || 0) + t.amount;
            }
        });

        const summary = {
            totalIncome,
            totalExpense,
            netSavings: totalIncome - totalExpense,
            savingsRate: totalIncome > 0 ? Number((((totalIncome - totalExpense) / totalIncome) * 100).toFixed(1)) : 0,
            categoryBreakdown
        };

        const pdfBuffer = await pdfService.generateFinancialReportPDF(req.user, summary, transactions);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="financial-report.pdf"');
        res.send(pdfBuffer);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
