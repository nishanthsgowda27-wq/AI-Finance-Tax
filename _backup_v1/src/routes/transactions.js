const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');

// All transaction routes require authentication
router.use(auth);

// GET /api/transactions
router.get('/', async (req, res) => {
    try {
        const { type, category, limit = 50 } = req.query;
        const query = { userId: req.user._id };

        if (type) query.type = type;
        if (category) query.category = category;

        const transactions = await Transaction.find(query).sort({ date: -1 }).limit(Number(limit));
        res.json({ success: true, count: transactions.length, transactions });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/transactions
router.post('/', async (req, res) => {
    try {
        const { type, category, amount, date, description, paymentMethod } = req.body;
        if (!type || !category || !amount) {
            return res.status(400).json({ success: false, message: 'Type, category, and amount are required' });
        }

        const transaction = new Transaction({
            userId: req.user._id,
            type,
            category,
            amount: Number(amount),
            date: date ? new Date(date) : new Date(),
            description: description || '',
            paymentMethod: paymentMethod || 'UPI'
        });

        await transaction.save();
        res.status(201).json({ success: true, transaction });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// PUT /api/transactions/:id
router.put('/:id', async (req, res) => {
    try {
        const transaction = await Transaction.findOne({ _id: req.params.id, userId: req.user._id });
        if (!transaction) {
            return res.status(404).json({ success: false, message: 'Transaction not found' });
        }

        const { type, category, amount, date, description, paymentMethod } = req.body;
        if (type) transaction.type = type;
        if (category) transaction.category = category;
        if (amount !== undefined) transaction.amount = Number(amount);
        if (date) transaction.date = new Date(date);
        if (description !== undefined) transaction.description = description;
        if (paymentMethod) transaction.paymentMethod = paymentMethod;

        await transaction.save();
        res.json({ success: true, transaction });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// DELETE /api/transactions/:id
router.delete('/:id', async (req, res) => {
    try {
        const transaction = await Transaction.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        if (!transaction) {
            return res.status(404).json({ success: false, message: 'Transaction not found' });
        }
        res.json({ success: true, message: 'Transaction deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/transactions/summary
router.get('/summary', async (req, res) => {
    try {
        const transactions = await Transaction.find({ userId: req.user._id });
        let totalIncome = 0;
        let totalExpense = 0;
        const categoryBreakdown = {};

        transactions.forEach(t => {
            if (t.type === 'income') {
                totalIncome += t.amount;
            } else {
                totalExpense += t.amount;
                categoryBreakdown[t.category] = (categoryBreakdown[t.category] || 0) + t.amount;
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
            categoryBreakdown
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
