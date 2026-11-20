/**
 * Indian Income Tax Calculation Engine
 * Supports FY 2024-25 (AY 2025-26) and FY 2023-24 (AY 2024-25)
 * Compliant with Income Tax Act, 1961 provisions.
 */

// HRA Exemption Calculator under Section 10(13A)
function calculateHRAExemption({ basicSalary = 0, hraReceived = 0, rentPaid = 0, isMetro = false }) {
    if (!hraReceived || !rentPaid || rentPaid <= 0) {
        return {
            exemption: 0,
            taxableHra: hraReceived,
            rules: {
                actualHra: hraReceived,
                rentMinus10PercentBasic: 0,
                percentOfBasic: 0
            }
        };
    }

    const rule1 = hraReceived;
    const rule2 = Math.max(0, rentPaid - (0.10 * basicSalary));
    const rule3 = (isMetro ? 0.50 : 0.40) * basicSalary;

    const exemption = Math.min(rule1, rule2, rule3);
    const taxableHra = Math.max(0, hraReceived - exemption);

    return {
        exemption: Math.round(exemption),
        taxableHra: Math.round(taxableHra),
        rules: {
            actualHra: rule1,
            rentMinus10PercentBasic: Math.round(rule2),
            percentOfBasic: Math.round(rule3)
        }
    };
}

// Rental Income Calculation under Section 24
function calculateRentalIncome({ rentalIncome = 0, municipalTaxes = 0 }) {
    const netAnnualValue = Math.max(0, rentalIncome - municipalTaxes);
    const standardDeduction = Math.round(netAnnualValue * 0.30); // 30% standard deduction u/s 24(a)
    const taxableRentalIncome = netAnnualValue - standardDeduction;

    return {
        grossRent: rentalIncome,
        municipalTaxes,
        netAnnualValue,
        standardDeduction,
        taxableRentalIncome
    };
}

// Surcharge Calculator
function calculateSurcharge(taxableIncome, baseTax, regime = 'new') {
    let rate = 0;
    if (taxableIncome > 50000000) { // > 5 Crore
        rate = regime === 'new' ? 0.25 : 0.37;
    } else if (taxableIncome > 20000000) { // > 2 Crore
        rate = 0.25;
    } else if (taxableIncome > 10000000) { // > 1 Crore
        rate = 0.15;
    } else if (taxableIncome > 5000000) { // > 50 Lakh
        rate = 0.10;
    }
    return Math.round(baseTax * rate);
}

// Calculate Tax under Old Tax Regime
function calculateOldRegime(inputs, fy = '2024-2025') {
    const {
        annualSalary = 0,
        basicSalary = 0,
        hraReceived = 0,
        rentPaid = 0,
        isMetro = false,
        otherAllowances = 0,
        rentalIncome = 0,
        municipalTaxes = 0,
        interestIncome = 0,
        otherIncome = 0,
        employmentType = 'salaried',
        ageCategory = 'general', // 'general' (<60), 'senior' (60-79), 'super_senior' (>=80)
        sec80C = 0,
        sec80D_self = 0,
        sec80D_parents = 0,
        isParentsSenior = false,
        sec80CCD_1B = 0,
        sec80CCD_2 = 0,
        homeLoanInterest = 0, // Sec 24(b)
        otherDeductions = 0
    } = inputs;

    // 1. Gross Income from Salary
    const isSalaried = ['salaried', 'govt', 'pensioner'].includes(employmentType);
    const hraCalc = isSalaried ? calculateHRAExemption({ basicSalary, hraReceived, rentPaid, isMetro }) : { exemption: 0, taxableHra: hraReceived };
    const exemptHra = hraCalc.exemption;
    const standardDeduction = isSalaried ? 50000 : 0;

    const netSalaryIncome = Math.max(0, annualSalary + otherAllowances - exemptHra - standardDeduction);

    // 2. House Property Income
    const rentalCalc = calculateRentalIncome({ rentalIncome, municipalTaxes });
    // Home loan interest u/s 24(b) for self-occupied capped at 2,00,000 (loss can be set off up to 2L)
    const allowedHomeLoanInterest = Math.min(200000, Math.max(0, homeLoanInterest));
    const incomeFromHouseProperty = rentalCalc.taxableRentalIncome - allowedHomeLoanInterest;

    // 3. Other Sources
    const incomeFromOtherSources = interestIncome + otherIncome;

    // Gross Total Income
    const grossTotalIncome = Math.max(0, netSalaryIncome + incomeFromHouseProperty + incomeFromOtherSources);

    // 4. Chapter VI-A Deductions
    const allowed80C = Math.min(150000, Math.max(0, sec80C));
    
    // 80D: Self & Family: max 25k (50k if senior)
    const max80D_self = (ageCategory === 'senior' || ageCategory === 'super_senior') ? 50000 : 25000;
    const allowed80D_self = Math.min(max80D_self, Math.max(0, sec80D_self));
    
    // 80D: Parents: max 25k (50k if parents are senior)
    const max80D_parents = isParentsSenior ? 50000 : 25000;
    const allowed80D_parents = Math.min(max80D_parents, Math.max(0, sec80D_parents));
    const total80D = allowed80D_self + allowed80D_parents;

    // 80CCD(1B): NPS additional deduction up to 50,000
    const allowed80CCD_1B = Math.min(50000, Math.max(0, sec80CCD_1B));

    // 80CCD(2): Employer NPS: up to 10% of salary
    const max80CCD_2 = isSalaried ? basicSalary * 0.10 : 0;
    const allowed80CCD_2 = Math.min(max80CCD_2, Math.max(0, sec80CCD_2));

    // 80TTA / 80TTB: Interest deduction
    let allowedInterestDeduction = 0;
    if (ageCategory === 'senior' || ageCategory === 'super_senior') {
        allowedInterestDeduction = Math.min(50000, interestIncome); // Sec 80TTB
    } else {
        allowedInterestDeduction = Math.min(10000, interestIncome); // Sec 80TTA
    }

    const totalDeductions = Math.min(
        grossTotalIncome,
        allowed80C + total80D + allowed80CCD_1B + allowed80CCD_2 + allowedInterestDeduction + Math.max(0, otherDeductions)
    );

    // 5. Net Taxable Income
    const taxableIncome = Math.max(0, grossTotalIncome - totalDeductions);

    // 6. Tax Slabs (Old Regime)
    let slabTax = 0;
    const slabBreakdown = [];

    let nilLimit = 250000;
    if (ageCategory === 'senior') nilLimit = 300000;
    if (ageCategory === 'super_senior') nilLimit = 500000;

    if (taxableIncome > nilLimit) {
        if (nilLimit < 500000) {
            const slab1Taxable = Math.min(taxableIncome, 500000) - nilLimit;
            const slab1Tax = slab1Taxable * 0.05;
            slabTax += slab1Tax;
            slabBreakdown.push({ slab: `₹${(nilLimit/100000).toFixed(1)}L to ₹5.0L @ 5%`, amount: slab1Taxable, tax: slab1Tax });
        }

        if (taxableIncome > 500000) {
            const slab2Taxable = Math.min(taxableIncome, 1000000) - 500000;
            const slab2Tax = slab2Taxable * 0.20;
            slabTax += slab2Tax;
            slabBreakdown.push({ slab: `₹5.0L to ₹10.0L @ 20%`, amount: slab2Taxable, tax: slab2Tax });
        }

        if (taxableIncome > 1000000) {
            const slab3Taxable = taxableIncome - 1000000;
            const slab3Tax = slab3Taxable * 0.30;
            slabTax += slab3Tax;
            slabBreakdown.push({ slab: `Above ₹10.0L @ 30%`, amount: slab3Taxable, tax: slab3Tax });
        }
    } else {
        slabBreakdown.push({ slab: `Up to ₹${(nilLimit/100000).toFixed(1)}L`, amount: taxableIncome, tax: 0 });
    }

    // 7. Rebate u/s 87A (Old Regime: If taxable income <= 5,00,000, rebate up to 12,500)
    let rebate87A = 0;
    if (taxableIncome <= 500000) {
        rebate87A = Math.min(slabTax, 12500);
    }
    const taxAfterRebate = Math.max(0, slabTax - rebate87A);

    // 8. Surcharge & Cess
    const surcharge = calculateSurcharge(taxableIncome, taxAfterRebate, 'old');
    const cess = Math.round((taxAfterRebate + surcharge) * 0.04);
    const totalTax = taxAfterRebate + surcharge + cess;

    return {
        regime: 'Old Tax Regime',
        financialYear: fy,
        grossTotalIncome: Math.round(grossTotalIncome),
        exemptions: {
            standardDeduction,
            hraExemption: exemptHra,
            homeLoanInterest: allowedHomeLoanInterest
        },
        deductions: {
            sec80C: allowed80C,
            sec80D: total80D,
            sec80CCD_1B: allowed80CCD_1B,
            sec80CCD_2: allowed80CCD_2,
            interestDeduction: allowedInterestDeduction,
            other: Math.max(0, otherDeductions),
            total: Math.round(totalDeductions)
        },
        taxableIncome: Math.round(taxableIncome),
        slabTax: Math.round(slabTax),
        slabBreakdown,
        rebate87A: Math.round(rebate87A),
        taxAfterRebate: Math.round(taxAfterRebate),
        surcharge,
        cess,
        totalTax: Math.round(totalTax),
        monthlyTax: Math.round(totalTax / 12)
    };
}

// Calculate Tax under New Tax Regime (Section 115BAC)
function calculateNewRegime(inputs, fy = '2024-2025') {
    const {
        annualSalary = 0,
        basicSalary = 0,
        otherAllowances = 0,
        rentalIncome = 0,
        municipalTaxes = 0,
        interestIncome = 0,
        otherIncome = 0,
        employmentType = 'salaried',
        sec80CCD_2 = 0
    } = inputs;

    const isSalaried = ['salaried', 'govt', 'pensioner'].includes(employmentType);

    // Standard Deduction:
    // FY 2024-25: ₹75,000 (Revised in Union Budget 2024)
    // FY 2023-24: ₹50,000
    const standardDeduction = isSalaried ? (fy === '2023-2024' ? 50000 : 75000) : 0;

    const netSalaryIncome = Math.max(0, annualSalary + otherAllowances - standardDeduction);

    // Rental Income under New Regime: 30% std deduction allowed, but NO set-off of house property loss against salary!
    const rentalCalc = calculateRentalIncome({ rentalIncome, municipalTaxes });
    const netHouseProperty = Math.max(0, rentalCalc.taxableRentalIncome);

    const grossTotalIncome = Math.max(0, netSalaryIncome + netHouseProperty + interestIncome + otherIncome);

    // In New Regime, only Employer NPS u/s 80CCD(2) is permitted
    const max80CCD_2 = isSalaried ? basicSalary * 0.10 : 0;
    const allowed80CCD_2 = Math.min(max80CCD_2, Math.max(0, sec80CCD_2));
    const totalDeductions = Math.min(grossTotalIncome, allowed80CCD_2);

    const taxableIncome = Math.max(0, grossTotalIncome - totalDeductions);

    let slabTax = 0;
    const slabBreakdown = [];

    if (fy === '2024-2025') {
        // FY 2024-25 New Slabs:
        // 0 - 3L: Nil
        // 3L - 7L: 5% (₹20,000 on 4L)
        // 7L - 10L: 10% (₹30,000 on 3L)
        // 10L - 12L: 15% (₹30,000 on 2L)
        // 12L - 15L: 20% (₹60,000 on 3L)
        // > 15L: 30%
        if (taxableIncome > 300000) {
            const slab1 = Math.min(taxableIncome, 700000) - 300000;
            const t1 = slab1 * 0.05;
            slabTax += t1;
            slabBreakdown.push({ slab: '₹3L to ₹7L @ 5%', amount: slab1, tax: t1 });
        }
        if (taxableIncome > 700000) {
            const slab2 = Math.min(taxableIncome, 1000000) - 700000;
            const t2 = slab2 * 0.10;
            slabTax += t2;
            slabBreakdown.push({ slab: '₹7L to ₹10L @ 10%', amount: slab2, tax: t2 });
        }
        if (taxableIncome > 1000000) {
            const slab3 = Math.min(taxableIncome, 1200000) - 1000000;
            const t3 = slab3 * 0.15;
            slabTax += t3;
            slabBreakdown.push({ slab: '₹10L to ₹12L @ 15%', amount: slab3, tax: t3 });
        }
        if (taxableIncome > 1200000) {
            const slab4 = Math.min(taxableIncome, 1500000) - 1200000;
            const t4 = slab4 * 0.20;
            slabTax += t4;
            slabBreakdown.push({ slab: '₹12L to ₹15L @ 20%', amount: slab4, tax: t4 });
        }
        if (taxableIncome > 1500000) {
            const slab5 = taxableIncome - 1500000;
            const t5 = slab5 * 0.30;
            slabTax += t5;
            slabBreakdown.push({ slab: 'Above ₹15L @ 30%', amount: slab5, tax: t5 });
        }
    } else {
        // FY 2023-24 New Slabs:
        // 0-3L: Nil, 3-6L: 5%, 6-9L: 10%, 9-12L: 15%, 12-15L: 20%, >15L: 30%
        if (taxableIncome > 300000) {
            const slab1 = Math.min(taxableIncome, 600000) - 300000;
            const t1 = slab1 * 0.05;
            slabTax += t1;
            slabBreakdown.push({ slab: '₹3L to ₹6L @ 5%', amount: slab1, tax: t1 });
        }
        if (taxableIncome > 600000) {
            const slab2 = Math.min(taxableIncome, 900000) - 600000;
            const t2 = slab2 * 0.10;
            slabTax += t2;
            slabBreakdown.push({ slab: '₹6L to ₹9L @ 10%', amount: slab2, tax: t2 });
        }
        if (taxableIncome > 900000) {
            const slab3 = Math.min(taxableIncome, 1200000) - 900000;
            const t3 = slab3 * 0.15;
            slabTax += t3;
            slabBreakdown.push({ slab: '₹9L to ₹12L @ 15%', amount: slab3, tax: t3 });
        }
        if (taxableIncome > 1200000) {
            const slab4 = Math.min(taxableIncome, 1500000) - 1200000;
            const t4 = slab4 * 0.20;
            slabTax += t4;
            slabBreakdown.push({ slab: '₹12L to ₹15L @ 20%', amount: slab4, tax: t4 });
        }
        if (taxableIncome > 1500000) {
            const slab5 = taxableIncome - 1500000;
            const t5 = slab5 * 0.30;
            slabTax += t5;
            slabBreakdown.push({ slab: 'Above ₹15L @ 30%', amount: slab5, tax: t5 });
        }
    }

    // 87A Rebate and Marginal Relief (New Regime):
    // Full rebate if taxable income <= ₹7,00,000
    // Marginal relief if taxable income slightly exceeds ₹7,00,000 such that tax payable > income exceeding ₹7L
    let rebate87A = 0;
    let marginalRelief = 0;
    let taxAfterRebate = slabTax;

    if (taxableIncome <= 700000) {
        rebate87A = slabTax;
        taxAfterRebate = 0;
    } else {
        // Marginal relief calculation
        const excessIncome = taxableIncome - 700000;
        if (slabTax > excessIncome) {
            marginalRelief = slabTax - excessIncome;
            taxAfterRebate = excessIncome;
        }
    }

    // Surcharge & Cess
    const surcharge = calculateSurcharge(taxableIncome, taxAfterRebate, 'new');
    const cess = Math.round((taxAfterRebate + surcharge) * 0.04);
    const totalTax = taxAfterRebate + surcharge + cess;

    return {
        regime: 'New Tax Regime (Sec 115BAC)',
        financialYear: fy,
        grossTotalIncome: Math.round(grossTotalIncome),
        exemptions: {
            standardDeduction
        },
        deductions: {
            sec80CCD_2: allowed80CCD_2,
            total: Math.round(totalDeductions)
        },
        taxableIncome: Math.round(taxableIncome),
        slabTax: Math.round(slabTax),
        slabBreakdown,
        rebate87A: Math.round(rebate87A),
        marginalRelief: Math.round(marginalRelief),
        taxAfterRebate: Math.round(taxAfterRebate),
        surcharge,
        cess,
        totalTax: Math.round(totalTax),
        monthlyTax: Math.round(totalTax / 12)
    };
}

// Compare Both Regimes & Provide Recommendations
function compareTaxRegimes(inputs, fy = '2024-2025') {
    const oldRes = calculateOldRegime(inputs, fy);
    const newRes = calculateNewRegime(inputs, fy);

    const taxDiff = oldRes.totalTax - newRes.totalTax;
    let recommendedRegime = 'New Tax Regime';
    let savings = 0;
    let reason = '';

    if (taxDiff > 0) {
        recommendedRegime = 'New Tax Regime';
        savings = taxDiff;
        reason = `You save ₹${savings.toLocaleString('en-IN')} with the New Tax Regime due to lower tax slab rates and higher standard deduction of ₹${newRes.exemptions.standardDeduction.toLocaleString('en-IN')}.`;
    } else if (taxDiff < 0) {
        recommendedRegime = 'Old Tax Regime';
        savings = Math.abs(taxDiff);
        reason = `You save ₹${savings.toLocaleString('en-IN')} with the Old Tax Regime because your deductions & exemptions (₹${(oldRes.exemptions.hraExemption + oldRes.deductions.total + oldRes.exemptions.homeLoanInterest).toLocaleString('en-IN')}) outweigh the lower slabs of the New Regime.`;
    } else {
        recommendedRegime = 'Either (Identical Tax)';
        savings = 0;
        reason = 'Both regimes result in the exact same tax liability. New Regime is generally recommended for simpler documentation.';
    }

    // Advance tax schedule
    const effectiveTax = Math.min(oldRes.totalTax, newRes.totalTax);
    const tdsPaid = inputs.tdsPaid || 0;
    const netTaxPayable = Math.max(0, effectiveTax - tdsPaid);
    const advanceTaxRequired = netTaxPayable >= 10000;

    const advanceTaxSchedule = [
        { dueDate: '15 June', cumulativePercent: 15, installmentTax: Math.round(netTaxPayable * 0.15) },
        { dueDate: '15 September', cumulativePercent: 45, installmentTax: Math.round(netTaxPayable * 0.30) },
        { dueDate: '15 December', cumulativePercent: 75, installmentTax: Math.round(netTaxPayable * 0.30) },
        { dueDate: '15 March', cumulativePercent: 100, installmentTax: Math.round(netTaxPayable * 0.25) }
    ];

    // Tax-saving investment recommendations (for Old Regime)
    const suggestions = [];
    const unused80C = Math.max(0, 150000 - (inputs.sec80C || 0));
    if (unused80C > 0) {
        suggestions.push({
            section: 'Section 80C',
            potentialAmount: unused80C,
            message: `Invest up to ₹${unused80C.toLocaleString('en-IN')} more in ELSS, PPF, or EPF to max out the ₹1.5 Lakh 80C limit.`
        });
    }

    const unused80CCD_1B = Math.max(0, 50000 - (inputs.sec80CCD_1B || 0));
    if (unused80CCD_1B > 0) {
        suggestions.push({
            section: 'Section 80CCD(1B)',
            potentialAmount: unused80CCD_1B,
            message: `Invest up to ₹${unused80CCD_1B.toLocaleString('en-IN')} in NPS Tier-1 for exclusive additional tax deductions over and above 80C.`
        });
    }

    const current80D = (inputs.sec80D_self || 0) + (inputs.sec80D_parents || 0);
    if (current80D < 25000) {
        suggestions.push({
            section: 'Section 80D',
            potentialAmount: 25000 - current80D,
            message: `Health insurance premiums and preventive health checkups (up to ₹5,000) are deductible under Section 80D.`
        });
    }

    return {
        financialYear: fy,
        oldRegime: oldRes,
        newRegime: newRes,
        recommendation: {
            recommendedRegime,
            savings,
            reason
        },
        advanceTax: {
            netTaxPayable,
            tdsPaid,
            advanceTaxRequired,
            schedule: advanceTaxRequired ? advanceTaxSchedule : []
        },
        suggestions
    };
}

module.exports = {
    calculateHRAExemption,
    calculateRentalIncome,
    calculateOldRegime,
    calculateNewRegime,
    compareTaxRegimes
};
