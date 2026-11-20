const mongoose = require('mongoose');

const LoanRecordSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    loanType: {
        type: String,
        enum: ['home', 'personal', 'car', 'education', 'agriculture'],
        default: 'personal'
    },
    occupation: {
        type: String,
        default: 'Salaried'
    },
    monthlyIncome: {
        type: Number,
        required: true
    },
    monthlyExpenses: {
        type: Number,
        default: 0
    },
    existingEmis: {
        type: Number,
        default: 0
    },
    creditScore: {
        type: Number,
        default: 750
    },
    requestedAmount: {
        type: Number,
        required: true
    },
    interestRate: {
        type: Number,
        required: true
    },
    tenureMonths: {
        type: Number,
        required: true
    },
    emi: Number,
    totalInterest: Number,
    totalPayment: Number,
    foir: Number,
    maxEligibleLoan: Number,
    affordabilityStatus: {
        type: String,
        enum: ['Affordable', 'Moderate / Borderline', 'Strained / High Risk']
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('LoanRecord', LoanRecordSchema);
