export type TaxSlab = {
  min: number;
  max: number | null;
  rate: number;
  label: string;
};

/*
 * =====================================================================
 * NEW TAX REGIME SLABS
 * =====================================================================
 */

// FY 2025-26 (AY 2026-27 - Budget 2025)
export const NEW_TAX_REGIME_SLABS_2025_26: TaxSlab[] = [
  { min: 0, max: 400000, rate: 0, label: "₹0 - ₹4,00,000" },
  { min: 400000, max: 800000, rate: 5, label: "₹4,00,001 - ₹8,00,000" },
  { min: 800000, max: 1200000, rate: 10, label: "₹8,00,001 - ₹12,00,000" },
  { min: 1200000, max: 1600000, rate: 15, label: "₹12,00,001 - ₹16,00,000" },
  { min: 1600000, max: 2000000, rate: 20, label: "₹16,00,001 - ₹20,00,000" },
  { min: 2000000, max: 2400000, rate: 25, label: "₹20,00,001 - ₹24,00,000" },
  { min: 2400000, max: null, rate: 30, label: "Above ₹24,00,000" },
];

// FY 2024-25 (AY 2025-26 - Budget 2024)
export const NEW_TAX_REGIME_SLABS_2024_25: TaxSlab[] = [
  { min: 0, max: 300000, rate: 0, label: "₹0 - ₹3,00,000" },
  { min: 300000, max: 700000, rate: 5, label: "₹3,00,001 - ₹7,00,000" },
  { min: 700000, max: 1000000, rate: 10, label: "₹7,00,001 - ₹10,00,000" },
  { min: 1000000, max: 1200000, rate: 15, label: "₹10,00,001 - ₹12,00,000" },
  { min: 1200000, max: 1500000, rate: 20, label: "₹12,00,001 - ₹15,00,000" },
  { min: 1500000, max: null, rate: 30, label: "Above ₹15,00,000" },
];

// Default alias for backward compatibility
export const NEW_TAX_REGIME_SLABS = NEW_TAX_REGIME_SLABS_2025_26;

/*
 * =====================================================================
 * OLD TAX REGIME SLABS
 * =====================================================================
 */
export const OLD_TAX_REGIME_SLABS: TaxSlab[] = [
  { min: 0, max: 250000, rate: 0, label: "₹0 - ₹2,50,000" },
  { min: 250000, max: 500000, rate: 5, label: "₹2,50,001 - ₹5,00,000" },
  { min: 500000, max: 1000000, rate: 20, label: "₹5,00,001 - ₹10,00,000" },
  { min: 1000000, max: null, rate: 30, label: "Above ₹10,00,000" },
];

// Senior Citizens (Age 60-79) - Old Regime
export const OLD_TAX_REGIME_SLABS_SENIOR: TaxSlab[] = [
  { min: 0, max: 300000, rate: 0, label: "₹0 - ₹3,00,000" },
  { min: 300000, max: 500000, rate: 5, label: "₹3,00,001 - ₹5,00,000" },
  { min: 500000, max: 1000000, rate: 20, label: "₹5,00,001 - ₹10,00,000" },
  { min: 1000000, max: null, rate: 30, label: "Above ₹10,00,000" },
];

/*
 * =====================================================================
 * CESS & REBATE STATUTORY RULES
 * =====================================================================
 */
export const HEALTH_EDUCATION_CESS = 4; // 4%

// Section 87A Rebate - FY 2025-26 New Regime (Tax free up to ₹12 Lakhs)
export const NEW_REGIME_2025_REBATE_INCOME_LIMIT = 1200000;
export const NEW_REGIME_2025_MAX_REBATE = 60000;

// Section 87A Rebate - FY 2024-25 New Regime (Tax free up to ₹7 Lakhs)
export const NEW_REGIME_2024_REBATE_INCOME_LIMIT = 700000;
export const NEW_REGIME_2024_MAX_REBATE = 25000;

// Default alias for backward compatibility
export const NEW_REGIME_REBATE_INCOME_LIMIT = NEW_REGIME_2025_REBATE_INCOME_LIMIT;
export const NEW_REGIME_MAX_REBATE = NEW_REGIME_2025_MAX_REBATE;

// Section 87A Rebate - Old Regime (Tax free up to ₹5 Lakhs)
export const OLD_REGIME_REBATE_INCOME_LIMIT = 500000;
export const OLD_REGIME_MAX_REBATE = 12500;

/*
 * =====================================================================
 * STANDARD DEDUCTIONS
 * =====================================================================
 */
export const NEW_REGIME_STANDARD_DEDUCTION = 75000; // Increased to 75k from Budget 2024 onwards
export const OLD_REGIME_STANDARD_DEDUCTION = 50000; // 50k in Old Regime

/*
 * =====================================================================
 * DEDUCTION STATUTORY LIMITS (CHAPTER VI-A & SECTION 10)
 * =====================================================================
 */
export const SECTION_80C_MAX_LIMIT = 150000; // ₹1.5 Lakhs combined limit
export const SECTION_80CCD_1B_MAX_LIMIT = 50000; // Additional ₹50,000 NPS limit
export const SECTION_24B_SELF_OCCUPIED_MAX_LIMIT = 200000; // ₹2.0 Lakhs home loan interest
export const SECTION_80D_NON_SENIOR_LIMIT = 25000; // Self/Family under 60
export const SECTION_80D_SENIOR_LIMIT = 50000; // Self/Parents 60 and above
export const SECTION_80CCD_2_GOVT_PERCENT_LIMIT = 14; // 14% of basic for Govt/Corporate
export const SECTION_80CCD_2_PRIVATE_PERCENT_LIMIT = 14; // 14% of basic from Budget 2024

// Section 10 Allowances
export const CHILDREN_EDUCATION_ALLOWANCE_PER_CHILD_MONTHLY = 100; // Max 2 children = ₹2,400/yr
export const HOSTEL_EXPENDITURE_ALLOWANCE_PER_CHILD_MONTHLY = 300; // Max 2 children = ₹7,200/yr

// Provident Fund Statutory Reference
export const EPF_DEFAULT_RATE = 0.12; // 12% of Basic Salary
export const EPF_STATUTORY_WAGE_CEILING_MONTHLY = 15000; // ₹15,000 statutory wage ceiling
