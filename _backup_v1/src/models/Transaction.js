const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ['income', 'expense'],
        required: true
    },
    category: {
        type: String,
        required: true,
        trim: true
    },
    amount: {
        type: Number,
        required: [true, 'Please specify an amount'],
        min: [0.01, 'Amount must be greater than zero']
    },
    date: {
        type: Date,
        default: Date.now,
        index: true
    },
    description: {
        type: String,
        trim: true,
        default: ''
    },
    paymentMethod: {
        type: String,
        enum: ['UPI', 'Credit Card', 'Debit Card', 'Net Banking', 'Cash', 'Other'],
        default: 'UPI'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Transaction', TransactionSchema);
