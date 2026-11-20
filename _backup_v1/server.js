require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./src/config/db');

// Initialize database
connectDB();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files (both public folder and root files)
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// Route Handlers
const authRoutes = require('./src/routes/auth');
const transactionRoutes = require('./src/routes/transactions');
const budgetRoutes = require('./src/routes/budgets');
const taxRoutes = require('./src/routes/tax');
const loanRoutes = require('./src/routes/loans');
const fdRoutes = require('./src/routes/fd');
const vehicleRoutes = require('./src/routes/vehicle');
const reportRoutes = require('./src/routes/reports');
const aiRoutes = require('./src/routes/ai');

// Mount Modular API Routes
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/tax', taxRoutes);
app.use('/api/loan', loanRoutes);
app.use('/api/fd', fdRoutes);
app.use('/api/vehicle', vehicleRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/ai', aiRoutes);

// Backward Compatibility Aliases for Existing Legacy Routes
const taxEngine = require('./src/services/taxEngine');
const loanEngine = require('./src/services/loanEngine');
const fdEngine = require('./src/services/fdEngine');

// 1. Direct Authentication Endpoints
app.post('/api/login', authRoutes.loginHandler);
app.post('/api/register', authRoutes.registerHandler);
app.post('/api/send-otp', authRoutes.sendOtpHandler);
app.post('/api/verify-register', authRoutes.registerWithOtpHandler);

// 2. Legacy Tax
app.post('/api/tax', (req, res) => {
    try {
        const income = Number(req.body.income || req.body.annualSalary || 0);
        const result = taxEngine.compareTaxRegimes({
            annualSalary: income,
            basicSalary: income * 0.5,
            ...req.body
        }, req.body.financialYear || '2024-2025');

        res.json({
            success: true,
            tax: result.newRegime.totalTax,
            monthly: result.newRegime.monthlyTax,
            ...result
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 3. Legacy Loan
app.post('/api/loan', (req, res) => {
    try {
        const income = Number(req.body.income || 0);
        const job = req.body.job || 'govt';
        const requested = req.body.requestedAmount || (income * 5);

        const assessment = loanEngine.assessLoanEligibility({
            monthlyIncome: income > 0 ? (income > 100000 ? income / 12 : income) : 50000,
            requestedAmount: Number(requested) || 200000,
            interestRate: Number(req.body.interestRate) || 10.5,
            tenureMonths: Number(req.body.tenureMonths) || 60,
            occupation: job
        });

        res.json({
            success: true,
            type: assessment.categoryDetails.title,
            schemes: [assessment.categoryDetails.specialSchemes],
            eligible: assessment.maxEligibleLoan,
            emi: assessment.emi,
            ...assessment
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 4. Legacy FD
app.post('/api/fd', (req, res) => {
    try {
        const income = Number(req.body.income || 0);
        const amount = Number(req.body.amount || req.body.principal || (income > 0 ? income * 0.2 : 50000));
        const rate = Number(req.body.rate || req.body.interestRate || 7);
        const years = Number(req.body.years || 2);

        const calc = fdEngine.calculateFD({
            principal: amount,
            annualRate: rate,
            tenureMonths: years * 12,
            compounding: req.body.compounding || 'quarterly',
            isCumulative: req.body.isCumulative !== false,
            isSeniorCitizen: !!req.body.isSeniorCitizen
        });

        res.json({
            success: true,
            invest: calc.principal,
            maturity: calc.maturityAmount,
            profit: calc.totalInterest,
            ...calc
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 5. Legacy Vehicle
app.post('/api/vehicle', (req, res) => {
    try {
        const income = Number(req.body.income || 0);
        const monthly = income > 100000 ? income / 12 : (income || 40000);

        let car = "Tata Punch";
        let bike = "TVS Apache";
        let carPrice = 600000;
        let bikePrice = 120000;

        if (monthly > 80000) {
            car = "Hyundai Creta";
            bike = "Royal Enfield Classic 350";
            carPrice = 1200000;
            bikePrice = 193000;
        }

        const r = 10 / 12 / 100;
        const m = 60;
        const carEMI = (carPrice * r * Math.pow(1 + r, m)) / (Math.pow(1 + r, m) - 1);
        const bikeEMI = (bikePrice * r * Math.pow(1 + r, m)) / (Math.pow(1 + r, m) - 1);

        res.json({
            success: true,
            car,
            bike,
            carPrice,
            bikePrice,
            carEMI: Math.round(carEMI),
            bikeEMI: Math.round(bikeEMI),
            carTotal: Math.round(carEMI * m),
            bikeTotal: Math.round(bikeEMI * m),
            carImg: "https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2",
            bikeImg: "https://images.unsplash.com/photo-1580310614729-ccd69652491d"
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 6. Legacy Report
app.post('/api/report', (req, res) => {
    const { income = 0, food = 0, travel = 0, rent = 0, shopping = 0, other = 0 } = req.body;
    const total = food + travel + rent + shopping + other;
    const savings = income - total;

    res.json({
        success: true,
        income,
        expense: total,
        savings,
        report: `
INCOME: ₹${Number(income).toLocaleString('en-IN')}
EXPENSE: ₹${Number(total).toLocaleString('en-IN')}
SAVINGS: ₹${Number(savings).toLocaleString('en-IN')}

Breakdown:
Food ₹${Number(food).toLocaleString('en-IN')}
Travel ₹${Number(travel).toLocaleString('en-IN')}
Rent ₹${Number(rent).toLocaleString('en-IN')}
Shopping ₹${Number(shopping).toLocaleString('en-IN')}
Other ₹${Number(other).toLocaleString('en-IN')}

Advice:
Save at least 20% of your income. Maximize Section 80C and maintain a 6-month emergency fund.
        `
    });
});

// Start Server
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`🚀 FINANCE AI & TAX ASSISTANT SERVER RUNNING on http://localhost:${PORT}`);
    });
}

module.exports = app;
