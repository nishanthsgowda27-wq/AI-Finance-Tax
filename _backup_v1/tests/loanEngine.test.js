const { test } = require('node:test');
const assert = require('node:assert');
const loanEngine = require('../src/services/loanEngine');
const fdEngine = require('../src/services/fdEngine');

test('Loan EMI Calculation: Standard formula check', () => {
    // Principal: 1,00,000, 12% per annum, 12 months.
    // Standard EMI is ₹8,885.
    const emi = loanEngine.calculateEMI(100000, 12, 12);
    assert.strictEqual(emi, 8885);
});

test('Loan Assessment: FOIR and affordability calculation', () => {
    const assessment = loanEngine.assessLoanEligibility({
        monthlyIncome: 60000,
        monthlyExpenses: 25000,
        existingEmis: 5000,
        requestedAmount: 500000,
        interestRate: 10.5,
        tenureMonths: 60,
        creditScore: 780
    });

    assert.ok(assessment.emi > 0);
    assert.ok(assessment.foir > 0);
    assert.strictEqual(assessment.scoreBand, 'Excellent');
    assert.strictEqual(assessment.affordabilityStatus, 'Affordable');
    assert.ok(assessment.maxEligibleLoan > 0);
});

test('FD Calculation: Quarterly Compounding matches Indian Banking formula', () => {
    // Principal: 1,00,000, 7.5% p.a., 12 months (1 yr), quarterly compounding (n=4).
    // A = 100000 * (1 + 0.075/4)^4 = 100000 * (1.01875)^4 = 1,07,713.58 -> ~1,07,714
    const res = fdEngine.calculateFD({
        principal: 100000,
        annualRate: 7.5,
        tenureMonths: 12,
        compounding: 'quarterly',
        isCumulative: true
    });

    assert.strictEqual(res.maturityAmount, 107714);
    assert.strictEqual(res.totalInterest, 7714);
});
