import {
  CHILDREN_EDUCATION_ALLOWANCE_PER_CHILD_MONTHLY,
  EPF_DEFAULT_RATE,
  HEALTH_EDUCATION_CESS,
  HOSTEL_EXPENDITURE_ALLOWANCE_PER_CHILD_MONTHLY,
  NEW_REGIME_2024_MAX_REBATE,
  NEW_REGIME_2024_REBATE_INCOME_LIMIT,
  NEW_REGIME_2025_MAX_REBATE,
  NEW_REGIME_2025_REBATE_INCOME_LIMIT,
  NEW_REGIME_STANDARD_DEDUCTION,
  NEW_TAX_REGIME_SLABS_2024_25,
  NEW_TAX_REGIME_SLABS_2025_26,
  OLD_REGIME_MAX_REBATE,
  OLD_REGIME_REBATE_INCOME_LIMIT,
  OLD_REGIME_STANDARD_DEDUCTION,
  OLD_TAX_REGIME_SLABS,
  SECTION_24B_SELF_OCCUPIED_MAX_LIMIT,
  SECTION_80CCD_1B_MAX_LIMIT,
  SECTION_80C_MAX_LIMIT,
  SECTION_80D_NON_SENIOR_LIMIT,
  SECTION_80D_SENIOR_LIMIT,
  TaxSlab,
} from "./tax-rules";

import {
  FinancialYear,
  NewRegimeDeductionsInput,
  OldRegimeDeductionsInput,
  RegimeCalculationDetails,
  SalaryReconciliation,
  SalaryStructure,
  TaxCalculationResult,
  TaxComparisonResult,
  TaxRegime,
  TaxSlabResult,
} from "./tax-types";

/* =====================================================================
   HELPER: SAFE NUMBER CONVERSION (NON-NEGATIVE)
   ===================================================================== */
export function safeNumber(value: number | string | undefined | null): number {
  if (value === undefined || value === null || value === "") return 0;
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, num);
}

/* =====================================================================
   HELPER: SALARY RECONCILIATION
   ===================================================================== */
export function reconcileSalary(salary: {
  grossSalary: number;
  basicSalary: number;
  hraReceived: number;
  specialAllowance: number;
  otherAllowances: number;
}): SalaryReconciliation {
  const sumOfComponents = Math.round(
    salary.basicSalary +
    salary.hraReceived +
    salary.specialAllowance +
    salary.otherAllowances
  );
  const difference = Math.round(salary.grossSalary - sumOfComponents);
  const isBalanced = Math.abs(difference) === 0;

  let message = "Salary components match Gross Salary.";
  if (difference > 0) {
    message = `Components are ₹${difference.toLocaleString("en-IN")} less than Gross Salary.`;
  } else if (difference < 0) {
    message = `Components exceed Gross Salary by ₹${Math.abs(difference).toLocaleString("en-IN")}.`;
  }

  return {
    isBalanced,
    grossSalary: salary.grossSalary,
    sumOfComponents,
    difference,
    message,
  };
}

/* =====================================================================
   CALCULATE SLAB TAX
   ===================================================================== */
export function calculateSlabs(
  taxableIncome: number,
  slabs: TaxSlab[]
): {
  totalTax: number;
  breakdown: TaxSlabResult[];
} {
  let totalTax = 0;
  const breakdown: TaxSlabResult[] = [];

  for (const slab of slabs) {
    let taxableAmount = 0;

    if (taxableIncome > slab.min) {
      const upperLimit = slab.max === null ? taxableIncome : Math.min(taxableIncome, slab.max);
      taxableAmount = Math.max(0, upperLimit - slab.min);
    }

    const slabTax = taxableAmount * (slab.rate / 100);
    totalTax += slabTax;

    breakdown.push({
      range: slab.label,
      taxableAmount: Math.round(taxableAmount),
      rate: slab.rate,
      tax: Math.round(slabTax),
    });
  }

  return {
    totalTax,
    breakdown,
  };
}

/* =====================================================================
   1. SALARY & PF BREAKDOWN ENGINE
   ===================================================================== */
export function calculateSalaryAndPF(input: {
  annualGross?: number | string;
  monthlyGross?: number | string;
  basicSalary?: number | string;
  basicSalaryPercent?: number | string;
  isBasicPercent?: boolean;
  hraReceived?: number | string;
  specialAllowance?: number | string;
  otherAllowances?: number | string;
  employeePF?: number | string;
  employerPF?: number | string;
  isCustomPF?: boolean;
}): SalaryStructure {
  let annualGross = safeNumber(input.annualGross);
  const monthlyGross = safeNumber(input.monthlyGross);

  if (annualGross === 0 && monthlyGross > 0) {
    annualGross = monthlyGross * 12;
  }

  const isBasicPercent = input.isBasicPercent ?? true;
  const basicSalaryPercent = safeNumber(input.basicSalaryPercent) || 50; // default 50%

  let basicSalary = 0;
  if (isBasicPercent) {
    basicSalary = (annualGross * basicSalaryPercent) / 100;
  } else {
    basicSalary = safeNumber(input.basicSalary);
    if (basicSalary === 0 && annualGross > 0) {
      basicSalary = annualGross * 0.5; // fallback 50%
    }
  }

  // Ensure basic does not exceed gross
  if (annualGross > 0 && basicSalary > annualGross) {
    basicSalary = annualGross;
  }

  // HRA received (default 40% of basic if not specified)
  const hraReceived = input.hraReceived !== undefined && input.hraReceived !== ""
    ? safeNumber(input.hraReceived)
    : Math.round(basicSalary * 0.4);

  // Allowances
  const otherAllowances = safeNumber(input.otherAllowances);
  const specialAllowance = input.specialAllowance !== undefined && input.specialAllowance !== ""
    ? safeNumber(input.specialAllowance)
    : Math.max(0, Math.round(annualGross - basicSalary - hraReceived - otherAllowances));

  // PF Calculation
  // Default: 12% of Basic Salary (separately for employee and employer)
  const isCustomPF = input.isCustomPF ?? false;
  let employeePF = 0;
  let employerPF = 0;

  if (isCustomPF) {
    employeePF = safeNumber(input.employeePF);
    employerPF = input.employerPF !== undefined && input.employerPF !== ""
      ? safeNumber(input.employerPF)
      : employeePF;
  } else {
    employeePF = Math.round(basicSalary * EPF_DEFAULT_RATE);
    employerPF = Math.round(basicSalary * EPF_DEFAULT_RATE);
  }

  const reconciliation = reconcileSalary({
    grossSalary: Math.round(annualGross),
    basicSalary: Math.round(basicSalary),
    hraReceived: Math.round(hraReceived),
    specialAllowance: Math.round(specialAllowance),
    otherAllowances: Math.round(otherAllowances),
  });

  return {
    grossSalary: Math.round(annualGross),
    basicSalary: Math.round(basicSalary),
    basicSalaryPercent,
    isBasicPercent,
    hraReceived: Math.round(hraReceived),
    specialAllowance: Math.round(specialAllowance),
    otherAllowances: Math.round(otherAllowances),
    employeePF: Math.round(employeePF),
    employerPF: Math.round(employerPF),
    isCustomPF,
    reconciliation,
  };
}

/* =====================================================================
   2. HRA EXEMPTION ENGINE (SECTION 10(13A))
   ===================================================================== */
export function calculateHraExemption({
  actualHRA,
  rentPaidAnnual,
  basicSalaryAnnual,
  isMetro = false,
}: {
  actualHRA: number;
  rentPaidAnnual: number;
  basicSalaryAnnual: number;
  isMetro?: boolean;
}): {
  actualHRA: number;
  rentMinus10PercentBasic: number;
  percentOfBasic: number;
  exemptHRA: number;
  taxableHRA: number;
  isMetro: boolean;
} {
  const hra = safeNumber(actualHRA);
  const rent = safeNumber(rentPaidAnnual);
  const basic = safeNumber(basicSalaryAnnual);

  if (hra <= 0 || rent <= 0 || basic <= 0) {
    return {
      actualHRA: hra,
      rentMinus10PercentBasic: 0,
      percentOfBasic: 0,
      exemptHRA: 0,
      taxableHRA: hra,
      isMetro,
    };
  }

  // Statutory Condition 1: Actual HRA received
  const condition1 = hra;

  // Statutory Condition 2: Rent paid minus 10% of Basic Salary
  const condition2 = Math.max(0, rent - 0.1 * basic);

  // Statutory Condition 3: 50% of Basic for Metro (Delhi, Mumbai, Kolkata, Chennai) or 40% for Non-Metro
  const metroPercent = isMetro ? 0.5 : 0.4;
  const condition3 = basic * metroPercent;

  // Exemption is the MINIMUM of the three statutory conditions
  const exemptHRA = Math.round(Math.min(condition1, condition2, condition3));
  const taxableHRA = Math.max(0, Math.round(hra - exemptHRA));

  return {
    actualHRA: Math.round(hra),
    rentMinus10PercentBasic: Math.round(condition2),
    percentOfBasic: Math.round(condition3),
    exemptHRA,
    taxableHRA,
    isMetro,
  };
}

/* =====================================================================
   3. OLD TAX REGIME CALCULATION
   ===================================================================== */
export function calculateOldRegime({
  salary,
  deductions,
  financialYear = "FY 2025-26",
}: {
  salary: SalaryStructure;
  deductions: OldRegimeDeductionsInput;
  financialYear?: FinancialYear;
}): RegimeCalculationDetails {
  const grossSalary = salary.grossSalary;

  // A. Section 10 Exemptions
  const hraResult = calculateHraExemption({
    actualHRA: salary.hraReceived,
    rentPaidAnnual: deductions.rentPaid,
    basicSalaryAnnual: salary.basicSalary,
    isMetro: deductions.isMetro,
  });

  const ltaExemption = safeNumber(deductions.ltaExemption);

  // Children Education Allowance: ₹100/month per child (max 2 children)
  const validChildren = Math.min(2, Math.max(0, deductions.childrenCount || 0));
  const childrenEduExemption = validChildren * CHILDREN_EDUCATION_ALLOWANCE_PER_CHILD_MONTHLY * 12;

  // Hostel Expenditure Allowance: ₹300/month per child (max 2 children)
  const validHostelChildren = Math.min(2, Math.max(0, deductions.hostelChildrenCount || 0));
  const hostelExemption = validHostelChildren * HOSTEL_EXPENDITURE_ALLOWANCE_PER_CHILD_MONTHLY * 12;

  const totalExemptions = Math.min(
    grossSalary,
    hraResult.exemptHRA + ltaExemption + childrenEduExemption + hostelExemption
  );

  // B. Standard Deduction
  const standardDeduction = Math.min(grossSalary - totalExemptions, OLD_REGIME_STANDARD_DEDUCTION);

  // C. Section 80C Deductions (Max ₹1,50,000)
  // Employee PF is included in 80C by default if selected, avoiding duplicate deduction
  const employeePFIn80C = deductions.includeEmployeePFIn80C !== false ? salary.employeePF : 0;
  const ppf = safeNumber(deductions.ppf);
  const elss = safeNumber(deductions.elss);
  const lic = safeNumber(deductions.lic);
  const tuitionFees = safeNumber(deductions.tuitionFees);
  const other80C = safeNumber(deductions.other80C);

  const total80CInvested = employeePFIn80C + ppf + elss + lic + tuitionFees + other80C;
  const allowed80C = Math.min(SECTION_80C_MAX_LIMIT, total80CInvested);

  // D. Section 24(b) Home Loan Interest (Max ₹2,00,000 for self-occupied)
  const homeLoanInterest = Math.min(SECTION_24B_SELF_OCCUPIED_MAX_LIMIT, safeNumber(deductions.homeLoanInterest24b));

  // E. Section 80D Health Insurance
  const selfLimit = deductions.isSelfSenior ? SECTION_80D_SENIOR_LIMIT : SECTION_80D_NON_SENIOR_LIMIT;
  const parentsLimit = deductions.isParentsSenior ? SECTION_80D_SENIOR_LIMIT : SECTION_80D_NON_SENIOR_LIMIT;

  const self80D = Math.min(selfLimit, safeNumber(deductions.healthInsuranceSelf));
  const parents80D = Math.min(parentsLimit, safeNumber(deductions.healthInsuranceParents));
  const total80D = self80D + parents80D;

  // F. Section 80CCD(1B) Additional Voluntary NPS (Max ₹50,000)
  const nps80CCD1B = Math.min(SECTION_80CCD_1B_MAX_LIMIT, safeNumber(deductions.npsVoluntary80CCD1B));

  // G. Section 80CCD(2) Employer NPS Contribution (Up to 14% of Basic)
  const maxEmployerNPS = Math.round(salary.basicSalary * 0.14);
  const employerNPS80CCD2 = Math.min(maxEmployerNPS, safeNumber(deductions.employerNPS80CCD2));

  // Total Chapter VI-A Deductions
  const chapter6ADeductions = allowed80C + homeLoanInterest + total80D + nps80CCD1B + employerNPS80CCD2;
  const totalDeductions = totalExemptions + standardDeduction + chapter6ADeductions;

  // Taxable Income
  const taxableIncome = Math.max(0, grossSalary - totalDeductions);

  // Calculate Slabs
  const { totalTax: calculatedTax, breakdown } = calculateSlabs(taxableIncome, OLD_TAX_REGIME_SLABS);
  const incomeTaxBeforeRebate = calculatedTax;

  // Section 87A Rebate: Income up to ₹5,00,000 gets max ₹12,500 rebate
  let rebate = 0;
  let isRebateApplied = false;
  let rebateExplanation = "";

  if (taxableIncome <= OLD_REGIME_REBATE_INCOME_LIMIT) {
    rebate = Math.min(incomeTaxBeforeRebate, OLD_REGIME_MAX_REBATE);
    isRebateApplied = rebate > 0;
    if (incomeTaxBeforeRebate === 0) {
      rebateExplanation = "Taxable income falls within the ₹0 - ₹2,50,000 nil tax slab (0% tax rate).";
    } else {
      rebateExplanation = `Section 87A rebate of ₹${Math.round(rebate).toLocaleString("en-IN")} applied: Taxable income (₹${Math.round(taxableIncome).toLocaleString("en-IN")}) does not exceed ₹5,00,000. Calculated tax is reduced to ₹0.`;
    }
  } else {
    rebateExplanation = `No Section 87A rebate: Taxable income of ₹${Math.round(taxableIncome).toLocaleString("en-IN")} exceeds the ₹5,00,000 threshold under Old Regime. Full slab rates apply.`;
  }

  const taxAfterRebate = Math.max(0, incomeTaxBeforeRebate - rebate);
  const marginalRelief = 0; // Not applicable in Old Regime under statutory law
  const taxBeforeCess = taxAfterRebate;

  // 4% Health & Education Cess
  const cess = Math.round(taxBeforeCess * (HEALTH_EDUCATION_CESS / 100));
  const annualTax = taxBeforeCess + cess;
  const monthlyTDS = Math.round(annualTax / 12);
  const afterTaxAnnualIncome = Math.max(0, grossSalary - annualTax);
  const afterTaxMonthlyIncome = Math.round(afterTaxAnnualIncome / 12);
  const effectiveTaxRate = grossSalary > 0 ? Number(((annualTax / grossSalary) * 100).toFixed(2)) : 0;

  return {
    regime: "old",
    financialYear,
    grossSalary: Math.round(grossSalary),
    exemptions: Math.round(totalExemptions),
    standardDeduction: Math.round(standardDeduction),
    chapter6ADeductions: Math.round(chapter6ADeductions),
    totalDeductions: Math.round(totalDeductions),
    taxableIncome: Math.round(taxableIncome),
    incomeTaxBeforeRebate: Math.round(incomeTaxBeforeRebate),
    rebate: Math.round(rebate),
    marginalRelief,
    taxBeforeCess: Math.round(taxBeforeCess),
    cess,
    annualTax: Math.round(annualTax),
    monthlyTDS,
    afterTaxAnnualIncome: Math.round(afterTaxAnnualIncome),
    afterTaxMonthlyIncome,
    effectiveTaxRate,
    slabs: breakdown,
    rebateExplanation,
    isRebateApplied,
    isMarginalReliefApplied: false,
    hraBreakdown: hraResult,
    pfBreakdown: {
      basicSalaryAnnual: salary.basicSalary,
      employeePFMonthly: Math.round(salary.employeePF / 12),
      employeePFAnnual: salary.employeePF,
      employerPFMonthly: Math.round(salary.employerPF / 12),
      employerPFAnnual: salary.employerPF,
      includedIn80C: employeePFIn80C,
      isCustom: salary.isCustomPF,
      explanation: "Employee PF is calculated as 12% of Basic Salary and eligible under Section 80C (up to ₹1.5L cap). Employer PF is 12% of Basic paid by employer and is not an employee deduction.",
    },
    section80CBreakdown: {
      employeePF: employeePFIn80C,
      ppf,
      elss,
      lic,
      tuitionFees,
      other80C,
      totalInvested: Math.round(total80CInvested),
      allowedDeduction: Math.round(allowed80C),
    },
  };
}

/* =====================================================================
   4. NEW TAX REGIME CALCULATION (WITH MARGINAL RELIEF)
   ===================================================================== */
export function calculateNewRegime({
  salary,
  deductions,
  financialYear = "FY 2025-26",
}: {
  salary: SalaryStructure;
  deductions?: Partial<NewRegimeDeductionsInput>;
  financialYear?: FinancialYear;
}): RegimeCalculationDetails {
  const grossSalary = salary.grossSalary;

  // New Regime allows ONLY:
  // 1. Standard deduction (₹75,000 for salaried)
  // 2. Employer contribution to NPS under Section 80CCD(2) (up to 14% of Basic)
  // No 80C, no 80D, no 80CCD(1B), no HRA, no LTA, no self-occupied 24(b).

  const standardDeduction = Math.min(grossSalary, NEW_REGIME_STANDARD_DEDUCTION);

  const maxEmployerNPS = Math.round(salary.basicSalary * 0.14);
  const employerNPS80CCD2 = Math.min(maxEmployerNPS, safeNumber(deductions?.employerNPS80CCD2));

  const totalDeductions = standardDeduction + employerNPS80CCD2;
  const taxableIncome = Math.max(0, grossSalary - totalDeductions);

  // Slabs & Rebate limits based on Financial Year
  const is2024 = financialYear === "FY 2024-25";
  const slabs = is2024 ? NEW_TAX_REGIME_SLABS_2024_25 : NEW_TAX_REGIME_SLABS_2025_26;
  const rebateIncomeLimit = is2024 ? NEW_REGIME_2024_REBATE_INCOME_LIMIT : NEW_REGIME_2025_REBATE_INCOME_LIMIT;
  const maxRebate = is2024 ? NEW_REGIME_2024_MAX_REBATE : NEW_REGIME_2025_MAX_REBATE;

  const { totalTax: calculatedTax, breakdown } = calculateSlabs(taxableIncome, slabs);
  const incomeTaxBeforeRebate = calculatedTax;

  let rebate = 0;
  let marginalRelief = 0;
  let taxAfterRebateAndRelief = 0;
  let isRebateApplied = false;
  let isMarginalReliefApplied = false;
  let rebateExplanation = "";

  const thresholdInLakhs = (rebateIncomeLimit / 100000).toFixed(0);

  if (taxableIncome <= rebateIncomeLimit) {
    // Full Section 87A Rebate: Zero tax payable
    rebate = Math.min(incomeTaxBeforeRebate, maxRebate);
    taxAfterRebateAndRelief = Math.max(0, incomeTaxBeforeRebate - rebate);
    isRebateApplied = rebate > 0;
    if (incomeTaxBeforeRebate === 0) {
      rebateExplanation = is2024
        ? "Taxable income falls within the ₹0 - ₹3,00,000 nil tax slab (0% tax rate)."
        : "Taxable income falls within the ₹0 - ₹4,00,000 nil tax slab (0% tax rate).";
    } else {
      rebateExplanation = `Section 87A rebate of ₹${Math.round(rebate).toLocaleString("en-IN")} applied: Taxable income (₹${Math.round(taxableIncome).toLocaleString("en-IN")}) does not exceed ₹${thresholdInLakhs} Lakhs (${financialYear}). Net tax is reduced to ₹0.`;
    }
  } else {
    // Marginal Relief Under Section 87A:
    // If taxable income slightly exceeds rebateIncomeLimit (e.g. ₹12,10,000 or ₹7,10,000),
    // the tax payable cannot exceed the income exceeding the rebate threshold!
    const excessIncome = taxableIncome - rebateIncomeLimit;
    if (incomeTaxBeforeRebate > excessIncome) {
      marginalRelief = incomeTaxBeforeRebate - excessIncome;
      taxAfterRebateAndRelief = excessIncome;
      isMarginalReliefApplied = true;
      rebateExplanation = `Marginal Relief of ₹${Math.round(marginalRelief).toLocaleString("en-IN")} applied under Section 87A: Tax before cess is capped at ₹${Math.round(excessIncome).toLocaleString("en-IN")} (the amount by which taxable income exceeds ₹${thresholdInLakhs} Lakhs).`;
    } else {
      taxAfterRebateAndRelief = incomeTaxBeforeRebate;
      rebateExplanation = `Taxable income of ₹${Math.round(taxableIncome).toLocaleString("en-IN")} exceeds the ₹${thresholdInLakhs} Lakh threshold. Normal slab rates apply without rebate.`;
    }
  }

  const taxBeforeCess = taxAfterRebateAndRelief;
  const cess = Math.round(taxBeforeCess * (HEALTH_EDUCATION_CESS / 100));
  const annualTax = taxBeforeCess + cess;
  const monthlyTDS = Math.round(annualTax / 12);
  const afterTaxAnnualIncome = Math.max(0, grossSalary - annualTax);
  const afterTaxMonthlyIncome = Math.round(afterTaxAnnualIncome / 12);
  const effectiveTaxRate = grossSalary > 0 ? Number(((annualTax / grossSalary) * 100).toFixed(2)) : 0;

  return {
    regime: "new",
    financialYear,
    grossSalary: Math.round(grossSalary),
    exemptions: 0, // No section 10 exemptions in New Regime
    standardDeduction: Math.round(standardDeduction),
    chapter6ADeductions: Math.round(employerNPS80CCD2),
    totalDeductions: Math.round(totalDeductions),
    taxableIncome: Math.round(taxableIncome),
    incomeTaxBeforeRebate: Math.round(incomeTaxBeforeRebate),
    rebate: Math.round(rebate),
    marginalRelief: Math.round(marginalRelief),
    taxBeforeCess: Math.round(taxBeforeCess),
    cess,
    annualTax: Math.round(annualTax),
    monthlyTDS,
    afterTaxAnnualIncome: Math.round(afterTaxAnnualIncome),
    afterTaxMonthlyIncome,
    effectiveTaxRate,
    slabs: breakdown,
    rebateExplanation,
    isRebateApplied,
    isMarginalReliefApplied,
    pfBreakdown: {
      basicSalaryAnnual: salary.basicSalary,
      employeePFMonthly: Math.round(salary.employeePF / 12),
      employeePFAnnual: salary.employeePF,
      employerPFMonthly: Math.round(salary.employerPF / 12),
      employerPFAnnual: salary.employerPF,
      includedIn80C: 0, // 80C not allowed in New Regime
      isCustom: salary.isCustomPF,
      explanation: "In the New Tax Regime, employee PF is not eligible for Section 80C deduction. Employer PF (12%) is paid by employer and does not reduce taxable income.",
    },
  };
}

/* =====================================================================
   5. COMPARISON ENGINE (OLD VS NEW REGIME)
   ===================================================================== */
export function compareOldAndNewRegimes({
  salary,
  oldDeductions,
  newDeductions,
  financialYear = "FY 2025-26",
}: {
  salary: SalaryStructure;
  oldDeductions: OldRegimeDeductionsInput;
  newDeductions?: Partial<NewRegimeDeductionsInput>;
  financialYear?: FinancialYear;
}): TaxComparisonResult {
  const oldRegime = calculateOldRegime({ salary, deductions: oldDeductions, financialYear });
  const newRegime = calculateNewRegime({ salary, deductions: newDeductions, financialYear });

  const annualTaxDifference = Math.abs(oldRegime.annualTax - newRegime.annualTax);
  const monthlyTDSDifference = Math.abs(oldRegime.monthlyTDS - newRegime.monthlyTDS);

  let recommendedRegime: "old" | "new" | "equal" = "equal";
  let summaryMessage = "Both tax regimes result in the exact same tax liability.";

  if (newRegime.annualTax < oldRegime.annualTax) {
    recommendedRegime = "new";
    summaryMessage = `New Tax Regime saves you ₹${annualTaxDifference.toLocaleString("en-IN")} annually (₹${monthlyTDSDifference.toLocaleString("en-IN")}/month).`;
  } else if (oldRegime.annualTax < newRegime.annualTax) {
    recommendedRegime = "old";
    summaryMessage = `Old Tax Regime saves you ₹${annualTaxDifference.toLocaleString("en-IN")} annually (₹${monthlyTDSDifference.toLocaleString("en-IN")}/month).`;
  } else {
    recommendedRegime = "equal";
    if (newRegime.annualTax === 0 && oldRegime.annualTax === 0) {
      summaryMessage = "Both regimes result in ₹0 tax liability for your current income and deduction profile.";
    } else {
      summaryMessage = `Both tax regimes result in the exact same tax liability of ₹${newRegime.annualTax.toLocaleString("en-IN")}.`;
    }
  }

  return {
    financialYear,
    oldRegime,
    newRegime,
    recommendedRegime,
    annualTaxDifference,
    monthlyTDSDifference,
    summaryMessage,
  };
}

/* =====================================================================
   6. BACKWARD COMPATIBLE SINGLE REGIME CALCULATOR
   ===================================================================== */
export function calculateTax({
  annualIncome,
  regime = "new",
  deductions = 0,
  financialYear = "FY 2025-26",
}: {
  annualIncome: number | string;
  regime?: TaxRegime;
  deductions?: number | string;
  financialYear?: FinancialYear;
}): TaxCalculationResult {
  const income = safeNumber(annualIncome);
  const deductionAmount = Math.min(safeNumber(deductions), income);
  const salary = calculateSalaryAndPF({ annualGross: income });

  if (regime === "old") {
    const oldDeductions: OldRegimeDeductionsInput = {
      rentPaid: 0,
      isMetro: false,
      ltaExemption: 0,
      childrenCount: 0,
      hostelChildrenCount: 0,
      includeEmployeePFIn80C: true,
      ppf: 0,
      elss: 0,
      lic: 0,
      tuitionFees: 0,
      other80C: Math.max(0, deductionAmount - OLD_REGIME_STANDARD_DEDUCTION),
      homeLoanInterest24b: 0,
      healthInsuranceSelf: 0,
      isSelfSenior: false,
      healthInsuranceParents: 0,
      isParentsSenior: false,
      npsVoluntary80CCD1B: 0,
      employerNPS80CCD2: 0,
    };
    const res = calculateOldRegime({ salary, deductions: oldDeductions, financialYear });
    return {
      annualIncome: res.grossSalary,
      deductions: res.totalDeductions,
      taxableIncome: res.taxableIncome,
      incomeTaxBeforeRebate: res.incomeTaxBeforeRebate,
      rebate: res.rebate,
      incomeTaxBeforeCess: res.taxBeforeCess,
      cess: res.cess,
      annualTax: res.annualTax,
      monthlyTax: res.monthlyTDS,
      monthlyIncome: Math.round(res.grossSalary / 12),
      afterTaxAnnualIncome: res.afterTaxAnnualIncome,
      afterTaxMonthlyIncome: res.afterTaxMonthlyIncome,
      effectiveTaxRate: res.effectiveTaxRate,
      slabs: res.slabs,
      marginalRelief: res.marginalRelief,
    };
  } else {
    const res = calculateNewRegime({ salary, financialYear });
    return {
      annualIncome: res.grossSalary,
      deductions: res.totalDeductions,
      taxableIncome: res.taxableIncome,
      incomeTaxBeforeRebate: res.incomeTaxBeforeRebate,
      rebate: res.rebate,
      incomeTaxBeforeCess: res.taxBeforeCess,
      cess: res.cess,
      annualTax: res.annualTax,
      monthlyTax: res.monthlyTDS,
      monthlyIncome: Math.round(res.grossSalary / 12),
      afterTaxAnnualIncome: res.afterTaxAnnualIncome,
      afterTaxMonthlyIncome: res.afterTaxMonthlyIncome,
      effectiveTaxRate: res.effectiveTaxRate,
      slabs: res.slabs,
      marginalRelief: res.marginalRelief,
    };
  }
}
