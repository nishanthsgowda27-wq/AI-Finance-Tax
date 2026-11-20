const mongoose = require('mongoose');

const FDRecordSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    principal: {
        type: Number,
        required: true,
        min: 1000
    },
    interestRate: {
        type: Number,
        required: true
    },
    tenureMonths: {
        type: Number,
        required: true
    },
    compounding: {
        type: String,
        enum: ['quarterly', 'monthly', 'half_yearly', 'yearly'],
        default: 'quarterly'
    },
    isCumulative: {
        type: Boolean,
        default: true
    },
    isSeniorCitizen: {
        type: Boolean,
        default: false
    },
    maturityAmount: Number,
    totalInterest: Number,
    tdsEstimated: Number,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('FDRecord', FDRecordSchema);
