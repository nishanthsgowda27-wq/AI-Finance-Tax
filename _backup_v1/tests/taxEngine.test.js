const { test } = require('node:test');
const assert = require('node:assert');
const taxEngine = require('../src/services/taxEngine');

test('HRA Exemption: Minimum of three conditions', () => {
    // Basic: 60,000/mo = 7,20,000/yr. HRA: 30,000/mo = 3,60,000/yr. Rent: 25,000/mo = 3,00,000/yr in Metro (50%).
    // 1. Actual HRA = 3,60,000
    // 2. Rent - 10% Basic = 3,00,000 - 72,000 = 2,28,000
    // 3. 50% Basic = 3,60,000
    // Min is 2,28,000
    const res = taxEngine.calculateHRAExemption({
        basicSalary: 720000,
        hraReceived: 360000,
        rentPaid: 300000,
        isMetro: true
    });

    assert.strictEqual(res.exemption, 228000);
    assert.strictEqual(res.taxableHra, 132000);
});

test('New Tax Regime FY 2024-25: Standard Deduction is ₹75,000 and Rebate u/s 87A up to ₹7 Lakh', () => {
    // Annual salary = ₹7,75,000
    // Standard deduction = ₹75,000 -> Taxable income = ₹7,00,000
    // Slabs: 0-3L (0), 3L-7L (4L @ 5% = 20,000)
    // Slab tax = ₹20,000. Rebate 87A = ₹20,000. Total Tax = ₹0.
    const res = taxEngine.calculateNewRegime({
        annualSalary: 775000,
        employmentType: 'salaried'
    }, '2024-2025');

    assert.strictEqual(res.exemptions.standardDeduction, 75000);
    assert.strictEqual(res.taxableIncome, 700000);
    assert.strictEqual(res.slabTax, 20000);
    assert.strictEqual(res.rebate87A, 20000);
    assert.strictEqual(res.totalTax, 0);
});

test('Old Tax Regime: Section 80C statutory cap of ₹1,50,000 and ₹50,000 Standard Deduction', () => {
    // Salary = ₹10,00,000. 80C entered = ₹2,50,000 (should cap at 1.5L).
    // Gross Income = 10,00,000 - 50,000 = 9,50,000
    // Net Taxable = 9,50,000 - 1,50,000 = 8,00,000
    const res = taxEngine.calculateOldRegime({
        annualSalary: 1000000,
        sec80C: 250000,
        employmentType: 'salaried',
        ageCategory: 'general'
    }, '2024-2025');

    assert.strictEqual(res.exemptions.standardDeduction, 50000);
    assert.strictEqual(res.deductions.sec80C, 150000);
    assert.strictEqual(res.taxableIncome, 800000);

    // Old slab tax on 8L:
    // 0-2.5L: Nil
    // 2.5L-5L: 5% of 2.5L = 12,500
    // 5L-8L: 20% of 3L = 60,000
    // Total slab tax = 72,500
    assert.strictEqual(res.slabTax, 72500);

    // Cess = 4% of 72,500 = 2,900
    assert.strictEqual(res.cess, 2900);
    assert.strictEqual(res.totalTax, 75400);
});

test('Old vs New Regime Comparison properly selects recommendation', () => {
    const comp = taxEngine.compareTaxRegimes({
        annualSalary: 1200000,
        basicSalary: 600000,
        sec80C: 150000,
        sec80D_self: 25000,
        employmentType: 'salaried'
    }, '2024-2025');

    assert.ok(comp.oldRegime);
    assert.ok(comp.newRegime);
    assert.ok(comp.recommendation.recommendedRegime);
    assert.ok(comp.recommendation.reason);
});
