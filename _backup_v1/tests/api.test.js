const { test } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const app = require('../server');

const mongoose = require('mongoose');

let server;
let port;
let baseUrl;

test.before(async () => {
    await new Promise((resolve) => {
        server = http.createServer(app);
        server.listen(0, () => {
            port = server.address().port;
            baseUrl = `http://127.0.0.1:${port}`;
            resolve();
        });
    });
});

test.after(async () => {
    if (server) {
        await new Promise((resolve) => server.close(resolve));
    }
    await mongoose.disconnect();
});

let authToken = '';
const testAccount = `test_${Date.now()}`;

test('API: User Registration', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: 'Test Indian Taxpayer',
            account: testAccount,
            password: 'Password@123',
            job: 'salaried',
            annualIncome: 1200000
        })
    });

    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.ok(data.token);
    authToken = data.token;
});

test('API: User Login', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            account: testAccount,
            password: 'Password@123'
        })
    });

    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.ok(data.token);
});

test('API: Tax Calculation & Comparison (FY 2024-25)', async () => {
    const res = await fetch(`${baseUrl}/api/tax/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            financialYear: '2024-2025',
            annualSalary: 1500000,
            basicSalary: 750000,
            hraReceived: 300000,
            rentPaid: 240000,
            isMetro: true,
            sec80C: 150000,
            sec80D_self: 25000,
            sec80CCD_1B: 50000
        })
    });

    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.ok(data.oldRegime);
    assert.ok(data.newRegime);
    assert.ok(data.recommendation.recommendedRegime);
});

test('API: Loan Assessment & FOIR', async () => {
    const res = await fetch(`${baseUrl}/api/loan/assess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            monthlyIncome: 80000,
            monthlyExpenses: 30000,
            existingEmis: 8000,
            creditScore: 780,
            requestedAmount: 500000,
            interestRate: 10.5,
            tenureMonths: 60
        })
    });

    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.ok(data.emi > 0);
    assert.ok(data.foir > 0);
    assert.ok(data.maxEligibleLoan > 0);
});

test('API: Add & Retrieve Transaction (Authenticated)', async () => {
    // Add transaction
    const addRes = await fetch(`${baseUrl}/api/transactions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
            type: 'expense',
            category: 'Food',
            amount: 2500,
            description: 'Grocery shopping',
            paymentMethod: 'UPI'
        })
    });

    const addData = await addRes.json();
    assert.strictEqual(addData.success, true);
    assert.ok(addData.transaction._id);

    // Retrieve transactions
    const listRes = await fetch(`${baseUrl}/api/transactions`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const listData = await listRes.json();
    assert.strictEqual(listData.success, true);
    assert.ok(listData.transactions.length > 0);
});

test('API: AI Financial Chat Assistant', async () => {
    const res = await fetch(`${baseUrl}/api/ai/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
            message: 'How is my spending and budget?'
        })
    });

    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.ok(data.reply.length > 0);
});

test('API: Legacy Route Backwards Compatibility (/api/tax, /api/loan, /api/fd, /api/vehicle)', async () => {
    const taxRes = await fetch(`${baseUrl}/api/tax`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ income: 800000 })
    });
    const taxData = await taxRes.json();
    assert.ok(taxData.tax !== undefined);

    const loanRes = await fetch(`${baseUrl}/api/loan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ income: 50000, job: 'business' })
    });
    const loanData = await loanRes.json();
    assert.ok(loanData.eligible > 0);

    const fdRes = await fetch(`${baseUrl}/api/fd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 100000, rate: 7.5, years: 2 })
    });
    const fdData = await fdRes.json();
    assert.ok(fdData.maturity > 0);

    const vehRes = await fetch(`${baseUrl}/api/vehicle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ income: 60000 })
    });
    const vehData = await vehRes.json();
    assert.ok(vehData.car);
    assert.ok(vehData.carEMI > 0);
});

