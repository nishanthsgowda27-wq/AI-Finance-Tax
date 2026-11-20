const express = require('express');
const router = express.Router();
const Budget = require('../models/Budget');
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');

router.use(auth);

// GET /api/budgets
router.get('/', async (req, res) => {
    try {
        const now = new Date();
        const month = Number(req.query.month) || (now.getMonth() + 1);
        const year = Number(req.query.year) || now.getFullYear();

        const budgets = await Budget.find({ userId: req.user._id, month, year });

        // Get spending for this month per category
        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 0, 23, 59, 59);

        const expenses = await Transaction.find({
            userId: req.user._id,
            type: 'expense',
            date: { $gte: startOfMonth, $lte: endOfMonth }
        });

        const categorySpent = {};
        expenses.forEach(e => {
            categorySpent[e.category] = (categorySpent[e.category] || 0) + e.amount;
        });

        const enrichedBudgets = budgets.map(b => {
            const spent = categorySpent[b.category] || 0;
            const remaining = Math.max(0, b.monthlyLimit - spent);
            const percentUsed = b.monthlyLimit > 0 ? Number(((spent / b.monthlyLimit) * 100).toFixed(1)) : 0;
            return {
                id: b._id,
                category: b.category,
                monthlyLimit: b.monthlyLimit,
                spent,
                remaining,
                percentUsed,
                isOverBudget: spent > b.monthlyLimit
            };
        });

        res.json({ success: true, month, year, budgets: enrichedBudgets });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/budgets
router.post('/', async (req, res) => {
    try {
        const { category, monthlyLimit, month, year } = req.body;
        if (!category || monthlyLimit === undefined) {
            return res.status(400).json({ success: false, message: 'Category and monthlyLimit are required' });
        }

        const now = new Date();
        const m = Number(month) || (now.getMonth() + 1);
        const y = Number(year) || now.getFullYear();

        const budget = await Budget.findOneAndUpdate(
            { userId: req.user._id, category, month: m, year: y },
            { monthlyLimit: Number(monthlyLimit) },
            { upsert: true, new: true, runValidators: true }
        );

        res.json({ success: true, budget });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// DELETE /api/budgets/:id
router.delete('/:id', async (req, res) => {
    try {
        await Budget.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        res.json({ success: true, message: 'Budget removed' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
