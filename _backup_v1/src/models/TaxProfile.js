const mongoose = require('mongoose');

const TaxProfileSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    financialYear: {
        type: String,
        default: '2024-2025'
    },
    taxpayerName: {
        type: String,
        trim: true
    },
    ageCategory: {
        type: String,
        enum: ['general', 'senior', 'super_senior'],
        default: 'general'
    },
    residentialStatus: {
        type: String,
        enum: ['resident', 'nri', 'rnor'],
        default: 'resident'
    },
    employmentType: {
        type: String,
        enum: ['salaried', 'pensioner', 'business', 'professional', 'other'],
        default: 'salaried'
    },
    incomeDetails: {
        annualSalary: { type: Number, default: 0 },
        basicSalary: { type: Number, default: 0 },
        hraReceived: { type: Number, default: 0 },
        rentPaid: { type: Number, default: 0 },
        isMetro: { type: Boolean, default: false },
        otherAllowances: { type: Number, default: 0 },
        rentalIncome: { type: Number, default: 0 },
        interestIncome: { type: Number, default: 0 },
        ltcg: { type: Number, default: 0 },
        stcg: { type: Number, default: 0 },
        otherIncome: { type: Number, default: 0 }
    },
    deductions: {
        sec80C: { type: Number, default: 0 },
        sec80D_self: { type: Number, default: 0 },
        sec80D_parents: { type: Number, default: 0 },
        isParentsSenior: { type: Boolean, default: false },
        sec80CCD_1B: { type: Number, default: 0 },
        sec80CCD_2: { type: Number, default: 0 },
        homeLoanInterest: { type: Number, default: 0 },
        sec80TTA_TTB: { type: Number, default: 0 },
        otherDeductions: { type: Number, default: 0 }
    },
    tdsPaid: { type: Number, default: 0 },
    advanceTaxPaid: { type: Number, default: 0 },
    results: {
        oldRegime: mongoose.Schema.Types.Mixed,
        newRegime: mongoose.Schema.Types.Mixed,
        comparison: mongoose.Schema.Types.Mixed
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('TaxProfile', TaxProfileSchema);
