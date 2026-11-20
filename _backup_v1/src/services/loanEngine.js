/**
 * Loan Assessment & EMI Engine
 * Realistic banking metrics: FOIR, Amortization, Affordability, Multi-loan comparisons
 */

// Calculate standard EMI
function calculateEMI(principal, annualRate, tenureMonths) {
    if (principal <= 0 || tenureMonths <= 0) return 0;
    if (annualRate <= 0) return Math.round(principal / tenureMonths);

    const monthlyRate = annualRate / (12 * 100);
    const emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) /
                (Math.pow(1 + monthlyRate, tenureMonths) - 1);

    return Math.round(emi);
}

// Generate Month-by-Month Amortization Schedule
function generateAmortizationSchedule(principal, annualRate, tenureMonths) {
    const emi = calculateEMI(principal, annualRate, tenureMonths);
    const monthlyRate = annualRate / (12 * 100);
    let balance = principal;
    const schedule = [];

    for (let month = 1; month <= tenureMonths; month++) {
        const interest = Math.round(balance * monthlyRate);
        const principalPaid = Math.min(balance, emi - interest);
        balance = Math.max(0, balance - principalPaid);

        schedule.push({
            month,
            emi,
            principalPaid,
            interestPaid: interest,
            remainingBalance: balance
        });

        if (balance <= 0) break;
    }

    return schedule;
}

// Comprehensive Loan Assessment & FOIR Engine
function assessLoanEligibility(inputs) {
    const {
        monthlyIncome = 0,
        monthlyExpenses = 0,
        existingEmis = 0,
        creditScore = 750,
        requestedAmount = 100000,
        interestRate = 10.5,
        tenureMonths = 36,
        loanType = 'personal',
        occupation = 'Salaried'
    } = inputs;

    const emi = calculateEMI(requestedAmount, interestRate, tenureMonths);
    const totalPayment = emi * tenureMonths;
    const totalInterest = Math.max(0, totalPayment - requestedAmount);

    const disposableIncome = monthlyIncome - monthlyExpenses - existingEmis;

    // FOIR = (Existing EMIs + New EMI) / Monthly Income * 100
    const totalEmis = existingEmis + emi;
    const foir = monthlyIncome > 0 ? Number(((totalEmis / monthlyIncome) * 100).toFixed(1)) : 100;

    // Benchmark FOIR limits based on income brackets and credit score
    let allowableFoir = 45;
    if (monthlyIncome >= 100000) allowableFoir = 60;
    else if (monthlyIncome >= 50000) allowableFoir = 55;
    else if (monthlyIncome >= 25000) allowableFoir = 50;
    else allowableFoir = 40;

    // Credit score adjustment
    let scoreRemark = '';
    let scoreBand = 'Good';
    if (creditScore >= 750) {
        scoreBand = 'Excellent';
        scoreRemark = 'Excellent credit history. Eligible for competitive interest rates and faster approval.';
    } else if (creditScore >= 700) {
        scoreBand = 'Good';
        scoreRemark = 'Good credit standing. Eligible for standard lending rates.';
    } else if (creditScore >= 650) {
        scoreBand = 'Fair / Borderline';
        scoreRemark = 'Fair credit score. May attract higher interest rates and stricter documentation.';
        allowableFoir -= 5;
    } else {
        scoreBand = 'Poor / High Risk';
        scoreRemark = 'Low credit score. High probability of rejection or requirement of a co-signer.';
        allowableFoir -= 10;
    }

    // Maximum allowable EMI based on benchmark FOIR
    const maxAllowableTotalEmi = (monthlyIncome * (allowableFoir / 100));
    const maxNewEmi = Math.max(0, maxAllowableTotalEmi - existingEmis);

    // Max loan amount user could borrow at current interest rate and tenure
    let maxEligibleLoan = 0;
    if (maxNewEmi > 0 && interestRate > 0) {
        const r = interestRate / (12 * 100);
        maxEligibleLoan = Math.round((maxNewEmi * (Math.pow(1 + r, tenureMonths) - 1)) / (r * Math.pow(1 + r, tenureMonths)));
    } else if (interestRate === 0 && tenureMonths > 0) {
        maxEligibleLoan = Math.round(maxNewEmi * tenureMonths);
    }

    // Affordability Status
    let affordabilityStatus = 'Affordable';
    let assessmentAdvice = '';

    if (foir > allowableFoir || disposableIncome < emi || creditScore < 650) {
        affordabilityStatus = 'Strained / High Risk';
        assessmentAdvice = `The requested loan causes high financial strain. Your FOIR (${foir}%) exceeds the prudent limit (${allowableFoir}%), or your disposable income (₹${disposableIncome.toLocaleString('en-IN')}) is insufficient for this EMI (₹${emi.toLocaleString('en-IN')}). Consider increasing tenure or reducing the loan amount.`;
    } else if (foir > (allowableFoir - 8) || (disposableIncome - emi) < (0.2 * monthlyIncome)) {
        affordabilityStatus = 'Moderate / Borderline';
        assessmentAdvice = `Manageable, but your financial buffer will be narrow. Try to maintain an emergency fund before committing.`;
    } else {
        affordabilityStatus = 'Affordable';
        assessmentAdvice = `Comfortably within safe lending limits. Your FOIR is ${foir}%, leaving ample disposable income for savings and emergencies.`;
    }

    // Loan Category specifics
    const loanCatalog = {
        home: {
            title: 'Home Loan',
            typicalRateRange: '8.40% - 9.50%',
            maxTenureYears: 30,
            taxBenefits: 'Tax deduction up to ₹1.5L u/s 80C (Principal) and up to ₹2L u/s 24(b) (Interest).',
            specialSchemes: 'PMAY Interest Subsidy (for eligible categories)'
        },
        personal: {
            title: 'Personal Loan',
            typicalRateRange: '10.50% - 16.00%',
            maxTenureYears: 5,
            taxBenefits: 'No direct tax benefits unless used for home improvement or business.',
            specialSchemes: 'Pre-approved salary loans, Instant paperless disbursals'
        },
        car: {
            title: 'Car Loan',
            typicalRateRange: '8.75% - 11.00%',
            maxTenureYears: 7,
            taxBenefits: 'Deductible for business use / depreciation for self-employed.',
            specialSchemes: 'EV green car loans (lower rate + Sec 80EEB if applicable)'
        },
        education: {
            title: 'Education Loan',
            typicalRateRange: '8.50% - 11.50%',
            maxTenureYears: 15,
            taxBenefits: 'Full interest deduction u/s 80E without upper cap for up to 8 years.',
            specialSchemes: 'CSIS Central Sector Interest Subsidy for economically weaker sections'
        },
        agriculture: {
            title: 'Agriculture & Rural Loan',
            typicalRateRange: '4.00% - 7.00%',
            maxTenureYears: 5,
            taxBenefits: 'Agricultural income is 100% exempt from income tax in India.',
            specialSchemes: 'Kisan Credit Card (KCC) at 7% with 3% prompt repayment incentive (effective 4%), NABARD refinance schemes'
        }
    };

    return {
        loanType,
        occupation,
        monthlyIncome,
        monthlyExpenses,
        existingEmis,
        disposableIncome,
        creditScore,
        scoreBand,
        scoreRemark,
        requestedAmount,
        interestRate,
        tenureMonths,
        emi,
        totalPayment,
        totalInterest,
        foir,
        allowableFoir,
        maxEligibleLoan,
        affordabilityStatus,
        assessmentAdvice,
        categoryDetails: loanCatalog[loanType] || loanCatalog.personal
    };
}

// Compare two loan options
function compareLoans(loanA, loanB) {
    const resA = assessLoanEligibility(loanA);
    const resB = assessLoanEligibility(loanB);

    const diffEmi = resA.emi - resB.emi;
    const diffInterest = resA.totalInterest - resB.totalInterest;

    return {
        optionA: resA,
        optionB: resB,
        emiDifference: Math.abs(diffEmi),
        interestDifference: Math.abs(diffInterest),
        recommendation: diffInterest < 0
            ? 'Option A costs less total interest over its tenure.'
            : 'Option B costs less total interest over its tenure.'
    };
}

module.exports = {
    calculateEMI,
    generateAmortizationSchedule,
    assessLoanEligibility,
    compareLoans
};
