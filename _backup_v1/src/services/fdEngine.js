/**
 * Fixed Deposit (FD) Calculation Engine
 * Indian banking compounding (Quarterly default, Monthly, Half-Yearly, Annual)
 * Section 194A TDS threshold support
 */

function calculateFD(inputs) {
    const {
        principal = 100000,
        annualRate = 7.0,
        tenureMonths = 12,
        compounding = 'quarterly', // 'quarterly', 'monthly', 'half_yearly', 'yearly'
        isCumulative = true,
        isSeniorCitizen = false
    } = inputs;

    // Senior citizen interest premium (+0.50% standard across Indian banks)
    const effectiveRate = isSeniorCitizen ? annualRate + 0.50 : annualRate;
    const r = effectiveRate / 100;
    const t = tenureMonths / 12;

    let n = 4; // Quarterly compounding
    if (compounding === 'monthly') n = 12;
    else if (compounding === 'half_yearly') n = 2;
    else if (compounding === 'yearly') n = 1;

    let maturityAmount = 0;
    let totalInterest = 0;
    let periodicPayout = 0;

    if (isCumulative) {
        // A = P * (1 + r/n)^(n*t)
        maturityAmount = principal * Math.pow(1 + (r / n), n * t);
        totalInterest = maturityAmount - principal;
    } else {
        // Non-cumulative payout
        totalInterest = principal * r * t;
        maturityAmount = principal;
        const totalPayoutPeriods = n * t;
        periodicPayout = totalPayoutPeriods > 0 ? totalInterest / totalPayoutPeriods : 0;
    }

    // TDS u/s 194A: 10% if interest in a financial year exceeds ₹40,000 (₹50,000 for senior citizens)
    const annualInterestRateEstimate = totalInterest / Math.max(1, t);
    const tdsThreshold = isSeniorCitizen ? 50000 : 40000;
    let tdsApplicable = annualInterestRateEstimate > tdsThreshold;
    let estimatedTds = tdsApplicable ? Math.round(totalInterest * 0.10) : 0;

    return {
        principal: Math.round(principal),
        effectiveRate: Number(effectiveRate.toFixed(2)),
        isSeniorCitizen,
        tenureMonths,
        tenureYears: Number(t.toFixed(2)),
        compounding,
        isCumulative,
        maturityAmount: Math.round(maturityAmount),
        totalInterest: Math.round(totalInterest),
        periodicPayout: Math.round(periodicPayout),
        tdsThreshold,
        tdsApplicable,
        estimatedTds,
        netMaturityPostTds: Math.round(maturityAmount - (isCumulative ? estimatedTds : 0))
    };
}

function compareFDScenarios(principal, rate, isSeniorCitizen = false) {
    const scenarios = [
        { label: '1 Year FD', tenureMonths: 12 },
        { label: '3 Years FD', tenureMonths: 36 },
        { label: '5 Years Tax-Saver FD (80C)', tenureMonths: 60 }
    ];

    return scenarios.map(s => {
        const calc = calculateFD({
            principal,
            annualRate: rate,
            tenureMonths: s.tenureMonths,
            compounding: 'quarterly',
            isCumulative: true,
            isSeniorCitizen
        });
        return {
            ...s,
            ...calc
        };
    });
}

module.exports = {
    calculateFD,
    compareFDScenarios
};
