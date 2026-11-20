export type TaxRegime = "new" | "old";
export type FinancialYear = "FY 2025-26" | "FY 2024-25";

export type TaxSlabResult = {
  range: string;
  taxableAmount: number;
  rate: number;
  tax: number;
};

export type TaxCalculationResult = {
  annualIncome: number;
  deductions: number;
  taxableIncome: number;
  incomeTaxBeforeRebate: number;
  rebate: number;
  incomeTaxBeforeCess: number;
  cess: number;
  annualTax: number;
  monthlyTax: number;
  monthlyIncome: number;
  afterTaxAnnualIncome: number;
  afterTaxMonthlyIncome: number;
  effectiveTaxRate: number;
  slabs: TaxSlabResult[];
  rebateExplanation?: string;
  isRebateApplied?: boolean;
  isMarginalReliefApplied?: boolean;
  marginalRelief?: number;
};

export type SalaryReconciliation = {
  isBalanced: boolean;
  grossSalary: number;
  sumOfComponents: number;
  difference: number; // gross - sumOfComponents
  message: string;
};

export type SalaryStructure = {
  grossSalary: number; // Annual
  basicSalary: number; // Annual
  basicSalaryPercent: number; // e.g. 50
  isBasicPercent: boolean;
  hraReceived: number; // Annual
  specialAllowance: number; // Annual
  otherAllowances: number; // Annual
  employeePF: number; // Annual
  employerPF: number; // Annual
  isCustomPF: boolean;
  reconciliation?: SalaryReconciliation;
};

export type OldRegimeDeductionsInput = {
  rentPaid: number; // Annual
  isMetro: boolean;
  ltaExemption: number;
  childrenCount: number; // 0, 1, 2
  hostelChildrenCount: number; // 0, 1, 2
  // Section 80C
  includeEmployeePFIn80C: boolean;
  ppf: number;
  elss: number;
  lic: number;
  tuitionFees: number;
  other80C: number;
  // Section 24(b)
  homeLoanInterest24b: number;
  // Section 80D
  healthInsuranceSelf: number;
  isSelfSenior: boolean;
  healthInsuranceParents: number;
  isParentsSenior: boolean;
  // Section 80CCD
  npsVoluntary80CCD1B: number;
  employerNPS80CCD2: number;
};

export type NewRegimeDeductionsInput = {
  standardDeduction: number;
  employerNPS80CCD2: number;
};

export type RegimeCalculationDetails = {
  regime: TaxRegime;
  financialYear: FinancialYear;
  grossSalary: number;
  exemptions: number; // Section 10 exemptions
  standardDeduction: number;
  chapter6ADeductions: number; // 80C, 80D, 80CCD, 24b
  totalDeductions: number;
  taxableIncome: number;
  incomeTaxBeforeRebate: number;
  rebate: number;
  marginalRelief: number;
  taxBeforeCess: number;
  cess: number;
  annualTax: number;
  monthlyTDS: number;
  afterTaxAnnualIncome: number;
  afterTaxMonthlyIncome: number;
  effectiveTaxRate: number;
  slabs: TaxSlabResult[];
  rebateExplanation?: string;
  isRebateApplied?: boolean;
  isMarginalReliefApplied?: boolean;
  hraBreakdown?: {
    actualHRA: number;
    rentMinus10PercentBasic: number;
    percentOfBasic: number;
    exemptHRA: number;
    taxableHRA: number;
    isMetro: boolean;
  };
  pfBreakdown: {
    basicSalaryAnnual: number;
    employeePFMonthly: number;
    employeePFAnnual: number;
    employerPFMonthly: number;
    employerPFAnnual: number;
    includedIn80C: number;
    isCustom: boolean;
    explanation: string;
  };
  section80CBreakdown?: {
    employeePF: number;
    ppf: number;
    elss: number;
    lic: number;
    tuitionFees: number;
    other80C: number;
    totalInvested: number;
    allowedDeduction: number;
  };
};

export type TaxComparisonResult = {
  financialYear: FinancialYear;
  oldRegime: RegimeCalculationDetails;
  newRegime: RegimeCalculationDetails;
  recommendedRegime: "old" | "new" | "equal";
  annualTaxDifference: number;
  monthlyTDSDifference: number;
  summaryMessage: string;
};
