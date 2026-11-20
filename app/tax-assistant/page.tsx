"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  calculateSalaryAndPF,
  calculateOldRegime,
  calculateNewRegime,
  compareOldAndNewRegimes,
  safeNumber,
} from "@/lib/tax/tax-calculator";
import type {
  FinancialYear,
  NewRegimeDeductionsInput,
  OldRegimeDeductionsInput,
  SalaryStructure,
  TaxComparisonResult,
  TaxRegime,
} from "@/lib/tax/tax-types";
import { createTaxAssessmentPdf, type TaxCalculationSnapshot } from "@/lib/tax/tax-report-pdf";
import AuthGuard from "@/components/auth/auth-guard";
import AccountControls from "@/components/layout/account-controls";

const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);

export default function TaxAssistantPage() {
  const router = useRouter();

  // 1. General & Financial Year Settings
  const [financialYear, setFinancialYear] = useState<FinancialYear>("FY 2025-26");
  const [profession, setProfession] = useState("Private Employee");
  const [incomeType, setIncomeType] = useState("Salary");
  const [activeRegimeTab, setActiveRegimeTab] = useState<"comparison" | "salary" | "old-deductions" | "new-deductions">("comparison");

  // 2. Salary Structure State
  const [annualGross, setAnnualGross] = useState<number>(1200000); // Default ₹12L
  const [monthlyGross, setMonthlyGross] = useState<number>(100000);
  const [isBasicPercent, setIsBasicPercent] = useState<boolean>(true);
  const [basicSalaryPercent, setBasicSalaryPercent] = useState<number>(50); // Default 50%
  const [customBasicSalary, setCustomBasicSalary] = useState<number>(600000);
  const [hraReceived, setHraReceived] = useState<number>(240000); // 40% of basic
  const [specialAllowance, setSpecialAllowance] = useState<number>(240000);
  const [otherAllowances, setOtherAllowances] = useState<number>(120000);

  // Provident Fund State
  const [isCustomPF, setIsCustomPF] = useState<boolean>(false);
  const [customEmployeePF, setCustomEmployeePF] = useState<number>(72000);
  const [customEmployerPF, setCustomEmployerPF] = useState<number>(72000);

  // 3. Old Regime Deductions State (Defaults to 0 so unentered deductions do not falsely zero out tax)
  const [rentPaidAnnual, setRentPaidAnnual] = useState<number>(0);
  const [isMetro, setIsMetro] = useState<boolean>(true);
  const [ltaExemption, setLtaExemption] = useState<number>(0);
  const [childrenCount, setChildrenCount] = useState<number>(0);
  const [hostelChildrenCount, setHostelChildrenCount] = useState<number>(0);

  // Section 80C
  const [includeEmployeePFIn80C, setIncludeEmployeePFIn80C] = useState<boolean>(true);
  const [ppf, setPpf] = useState<number>(0);
  const [elss, setElss] = useState<number>(0);
  const [lic, setLic] = useState<number>(0);
  const [tuitionFees, setTuitionFees] = useState<number>(0);
  const [other80C, setOther80C] = useState<number>(0);

  // Section 24(b) Home Loan Interest
  const [homeLoanInterest, setHomeLoanInterest] = useState<number>(0);

  // Section 80D Health Insurance
  const [healthInsuranceSelf, setHealthInsuranceSelf] = useState<number>(0);
  const [isSelfSenior, setIsSelfSenior] = useState<boolean>(false);
  const [healthInsuranceParents, setHealthInsuranceParents] = useState<number>(0);
  const [isParentsSenior, setIsParentsSenior] = useState<boolean>(true);

  // Section 80CCD
  const [npsVoluntary80CCD1B, setNpsVoluntary80CCD1B] = useState<number>(0);
  const [employerNPS80CCD2, setEmployerNPS80CCD2] = useState<number>(0);

  // Deduction quick presets
  function handleLoadSampleDeductions() {
    setRentPaidAnnual(180000);
    setIsMetro(true);
    setPpf(50000);
    setElss(25000);
    setLic(15000);
    setHealthInsuranceSelf(15000);
    setHealthInsuranceParents(25000);
    setNpsVoluntary80CCD1B(50000);
  }

  function handleClearAllDeductions() {
    setRentPaidAnnual(0);
    setLtaExemption(0);
    setChildrenCount(0);
    setHostelChildrenCount(0);
    setPpf(0);
    setElss(0);
    setLic(0);
    setTuitionFees(0);
    setOther80C(0);
    setHomeLoanInterest(0);
    setHealthInsuranceSelf(0);
    setHealthInsuranceParents(0);
    setNpsVoluntary80CCD1B(0);
    setEmployerNPS80CCD2(0);
  }

  function handleAutoBalanceSalary() {
    const basic = isBasicPercent ? Math.round((annualGross * basicSalaryPercent) / 100) : customBasicSalary;
    const remaining = Math.max(0, Math.round(annualGross - basic - hraReceived - otherAllowances));
    setSpecialAllowance(remaining);
  }

  // UI status
  const [downloadError, setDownloadError] = useState("");

  // Load existing profile if available
  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      try {
        const response = await fetch("/api/profile", { cache: "no-store" });
        if (!response.ok) return;
        const profile = (await response.json()).profile;
        if (!active || !profile) return;
        if (profile.annualIncome > 0) {
          handleAnnualGrossChange(profile.annualIncome);
        }
        if (profile.profession) setProfession(profile.profession);
        if (profile.incomeType) setIncomeType(profile.incomeType);
      } catch (error) {
        console.error("Unable to load financial profile", error);
      }
    };
    void loadProfile();
    return () => {
      active = false;
    };
  }, []);

  // Sync Annual <-> Monthly Gross
  function handleAnnualGrossChange(val: number | string) {
    const annual = safeNumber(val);
    setAnnualGross(annual);
    setMonthlyGross(Math.round(annual / 12));

    // Update auto components
    const basic = isBasicPercent ? Math.round((annual * basicSalaryPercent) / 100) : customBasicSalary;
    const hra = Math.round(basic * 0.4);
    setHraReceived(hra);
    setSpecialAllowance(Math.max(0, Math.round(annual - basic - hra - otherAllowances)));
    const autoPF = Math.round(basic * 0.12);
    if (!isCustomPF) {
      setCustomEmployeePF(autoPF);
      setCustomEmployerPF(autoPF);
    }
  }

  function handleMonthlyGrossChange(val: number | string) {
    const monthly = safeNumber(val);
    setMonthlyGross(monthly);
    const annual = monthly * 12;
    setAnnualGross(annual);

    const basic = isBasicPercent ? Math.round((annual * basicSalaryPercent) / 100) : customBasicSalary;
    const hra = Math.round(basic * 0.4);
    setHraReceived(hra);
    setSpecialAllowance(Math.max(0, Math.round(annual - basic - hra - otherAllowances)));
    const autoPF = Math.round(basic * 0.12);
    if (!isCustomPF) {
      setCustomEmployeePF(autoPF);
      setCustomEmployerPF(autoPF);
    }
  }

  function handleBasicPercentChange(pct: number) {
    setBasicSalaryPercent(pct);
    setIsBasicPercent(true);
    const calculatedBasic = Math.round((annualGross * pct) / 100);
    setCustomBasicSalary(calculatedBasic);
    const hra = Math.round(calculatedBasic * 0.4);
    setHraReceived(hra);
    setSpecialAllowance(Math.max(0, Math.round(annualGross - calculatedBasic - hra - otherAllowances)));
    if (!isCustomPF) {
      setCustomEmployeePF(Math.round(calculatedBasic * 0.12));
      setCustomEmployerPF(Math.round(calculatedBasic * 0.12));
    }
  }

  function handleCustomBasicChange(amount: number) {
    setCustomBasicSalary(amount);
    setIsBasicPercent(false);
    if (annualGross > 0) {
      setBasicSalaryPercent(Math.round((amount / annualGross) * 100));
    }
    const hra = Math.round(amount * 0.4);
    setHraReceived(hra);
    setSpecialAllowance(Math.max(0, Math.round(annualGross - amount - hra - otherAllowances)));
    if (!isCustomPF) {
      setCustomEmployeePF(Math.round(amount * 0.12));
      setCustomEmployerPF(Math.round(amount * 0.12));
    }
  }

  // Memoized Salary Structure
  const salaryStructure: SalaryStructure = useMemo(() => {
    return calculateSalaryAndPF({
      annualGross,
      monthlyGross,
      basicSalary: customBasicSalary,
      basicSalaryPercent,
      isBasicPercent,
      hraReceived,
      specialAllowance,
      otherAllowances,
      employeePF: customEmployeePF,
      employerPF: customEmployerPF,
      isCustomPF,
    });
  }, [
    annualGross,
    monthlyGross,
    customBasicSalary,
    basicSalaryPercent,
    isBasicPercent,
    hraReceived,
    specialAllowance,
    otherAllowances,
    customEmployeePF,
    customEmployerPF,
    isCustomPF,
  ]);

  // Memoized Deductions Inputs
  const oldDeductions: OldRegimeDeductionsInput = useMemo(() => {
    return {
      rentPaid: rentPaidAnnual,
      isMetro,
      ltaExemption,
      childrenCount,
      hostelChildrenCount,
      includeEmployeePFIn80C,
      ppf,
      elss,
      lic,
      tuitionFees,
      other80C,
      homeLoanInterest24b: homeLoanInterest,
      healthInsuranceSelf,
      isSelfSenior,
      healthInsuranceParents,
      isParentsSenior,
      npsVoluntary80CCD1B,
      employerNPS80CCD2,
    };
  }, [
    rentPaidAnnual,
    isMetro,
    ltaExemption,
    childrenCount,
    hostelChildrenCount,
    includeEmployeePFIn80C,
    ppf,
    elss,
    lic,
    tuitionFees,
    other80C,
    homeLoanInterest,
    healthInsuranceSelf,
    isSelfSenior,
    healthInsuranceParents,
    isParentsSenior,
    npsVoluntary80CCD1B,
    employerNPS80CCD2,
  ]);

  const newDeductions: NewRegimeDeductionsInput = useMemo(() => {
    return {
      standardDeduction: 75000,
      employerNPS80CCD2,
    };
  }, [employerNPS80CCD2]);

  // Memoized Real-Time Comparison
  const comparison: TaxComparisonResult = useMemo(() => {
    return compareOldAndNewRegimes({
      salary: salaryStructure,
      oldDeductions,
      newDeductions,
      financialYear,
    });
  }, [salaryStructure, oldDeductions, newDeductions, financialYear]);

  const activeResultSnapshot = comparison.recommendedRegime === "old"
    ? comparison.oldRegime
    : comparison.newRegime;

  // PDF Export
  function handleDownloadPDF() {
    try {
      const snapshot: TaxCalculationSnapshot = {
        calculatedAt: new Date(),
        profession,
        incomeType,
        regime: comparison.recommendedRegime === "old" ? "old" : "new",
        financialYear,
        result: {
          annualIncome: activeResultSnapshot.grossSalary,
          deductions: activeResultSnapshot.totalDeductions,
          taxableIncome: activeResultSnapshot.taxableIncome,
          incomeTaxBeforeRebate: activeResultSnapshot.incomeTaxBeforeRebate,
          rebate: activeResultSnapshot.rebate,
          incomeTaxBeforeCess: activeResultSnapshot.taxBeforeCess,
          cess: activeResultSnapshot.cess,
          annualTax: activeResultSnapshot.annualTax,
          monthlyTax: activeResultSnapshot.monthlyTDS,
          monthlyIncome: Math.round(activeResultSnapshot.grossSalary / 12),
          afterTaxAnnualIncome: activeResultSnapshot.afterTaxAnnualIncome,
          afterTaxMonthlyIncome: activeResultSnapshot.afterTaxMonthlyIncome,
          effectiveTaxRate: activeResultSnapshot.effectiveTaxRate,
          slabs: activeResultSnapshot.slabs,
          marginalRelief: activeResultSnapshot.marginalRelief,
        },
        comparison,
      };

      const doc = createTaxAssessmentPdf(snapshot);
      doc.save(`FinanceAI-Tax-Report-${financialYear.replace(/\s+/g, "_")}.pdf`);
      setDownloadError("");
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Error generating PDF report.");
    }
  }

  // 80C total investment tracker
  const total80CClaimed = (includeEmployeePFIn80C ? salaryStructure.employeePF : 0) +
    ppf + elss + lic + tuitionFees + other80C;

  return (
    <AuthGuard>
      <main className="tax-page min-h-screen bg-slate-50 p-4 md:p-8">
        <div className="mx-auto max-w-7xl">
          {/* TOP BAR */}
          <header className="no-print mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-blue-600 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-white">
                  Tax Assistant
                </span>
                <span className="text-xs font-medium text-slate-500">
                  Income Tax Department Rules Verified
                </span>
              </div>
              <h1 className="mt-1 text-2xl font-black text-slate-900 md:text-3xl">
                Indian Income Tax Calculator
              </h1>
              <p className="text-sm text-slate-500">
                Detailed salary structure, accurate PF, HRA exemption & real-time Old vs New Regime comparison.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <AccountControls />
              <button
                onClick={() => router.push("/dashboard")}
                className="cursor-pointer rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                ← Dashboard
              </button>
              <button
                onClick={() => window.print()}
                className="cursor-pointer rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                🖨️ Print
              </button>
              <button
                onClick={handleDownloadPDF}
                className="cursor-pointer rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
              >
                📥 Download PDF Report
              </button>
            </div>
          </header>

          {downloadError && (
            <div className="no-print mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              ⚠️ {downloadError}
            </div>
          )}

          {/* FINANCIAL YEAR & PROFILE STRIP */}
          <div className="no-print mb-6 grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Financial Year (Tax Rules)
              </label>
              <select
                value={financialYear}
                onChange={(e) => setFinancialYear(e.target.value as FinancialYear)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 p-2.5 text-sm font-bold text-blue-700 focus:bg-white focus:outline-blue-600"
              >
                <option value="FY 2025-26">FY 2025-26 (AY 2026-27) • Latest Budget 2025</option>
                <option value="FY 2024-25">FY 2024-25 (AY 2025-26) • Budget 2024</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Profession
              </label>
              <select
                value={profession}
                onChange={(e) => setProfession(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 p-2.5 text-sm font-semibold text-slate-800 focus:bg-white"
              >
                <option value="Private Employee">Private Company Employee</option>
                <option value="Government Employee">Government Employee</option>
                <option value="Software Engineer">Software Engineer / IT Professional</option>
                <option value="Doctor">Doctor / Medical Professional</option>
                <option value="Business Owner">Business Owner / Trader</option>
                <option value="Self Employed">Self-Employed Professional</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Income Source
              </label>
              <select
                value={incomeType}
                onChange={(e) => setIncomeType(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 p-2.5 text-sm font-semibold text-slate-800 focus:bg-white"
              >
                <option value="Salary">Salaried Employment</option>
                <option value="Pension">Pensioner</option>
                <option value="Business">Business / Profession</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Residential City (HRA Rule)
              </label>
              <div className="mt-1 flex items-center justify-between rounded-xl border border-slate-300 bg-slate-50 p-2">
                <span className="text-sm font-semibold text-slate-800">
                  {isMetro ? "Metro (50% HRA)" : "Non-Metro (40% HRA)"}
                </span>
                <button
                  type="button"
                  onClick={() => setIsMetro(!isMetro)}
                  className={`cursor-pointer rounded-lg px-3 py-1 text-xs font-bold transition-colors ${
                    isMetro
                      ? "bg-blue-600 text-white"
                      : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                  }`}
                >
                  {isMetro ? "Delhi/Mum/Kol/Chn" : "Switch to Metro"}
                </button>
              </div>
            </div>
          </div>

          {/* REGIME COMPARISON HERO RECOMMENDATION BANNER */}
          <section className="no-print mb-8 overflow-hidden rounded-3xl border border-blue-200 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-6 text-white shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-200 backdrop-blur-md">
                  <span>🏆 Verdict & Recommendation</span>
                  <span>•</span>
                  <span>{financialYear}</span>
                </div>
                <h2 className="mt-3 text-2xl font-black text-white sm:text-3xl">
                  {comparison.summaryMessage}
                </h2>
                <p className="mt-2 text-sm text-blue-100/90 leading-relaxed">
                  Based on your entered salary structure of <strong>{money(annualGross)}</strong> and total deductions of{" "}
                  <strong>{money(comparison.oldRegime.totalDeductions)}</strong> under Old Regime vs{" "}
                  <strong>{money(comparison.newRegime.totalDeductions)}</strong> under New Regime.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4 text-center backdrop-blur-md">
                  <div className="text-xs font-semibold uppercase tracking-wider text-blue-200">
                    Old Regime Tax
                  </div>
                  <div className="text-2xl font-black text-white">
                    {money(comparison.oldRegime.annualTax)}
                  </div>
                  <div className="text-xs text-blue-200">
                    TDS: {money(comparison.oldRegime.monthlyTDS)}/mo
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/10 p-4 text-center backdrop-blur-md">
                  <div className="text-xs font-semibold uppercase tracking-wider text-blue-200">
                    New Regime Tax
                  </div>
                  <div className="text-2xl font-black text-white">
                    {money(comparison.newRegime.annualTax)}
                  </div>
                  <div className="text-xs text-blue-200">
                    TDS: {money(comparison.newRegime.monthlyTDS)}/mo
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/20 p-4 text-center backdrop-blur-md">
                  <div className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                    Annual Savings
                  </div>
                  <div className="text-2xl font-black text-emerald-300">
                    {money(comparison.annualTaxDifference)}
                  </div>
                  <div className="text-xs text-emerald-200 font-semibold">
                    {money(comparison.monthlyTDSDifference)} / month
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* MAIN TWO-COLUMN WORKBENCH */}
          <div className="no-print grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* LEFT COLUMN: SALARY STRUCTURE & DEDUCTIONS INPUTS (7 COLS) */}
            <div className="space-y-6 lg:col-span-7">
              {/* NAVIGATION TABS */}
              <div className="flex rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
                <button
                  type="button"
                  onClick={() => setActiveRegimeTab("salary")}
                  className={`flex-1 cursor-pointer rounded-xl py-2.5 text-center text-xs font-bold transition-all sm:text-sm ${
                    activeRegimeTab === "salary"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  1. Salary & PF Breakdown
                </button>
                <button
                  type="button"
                  onClick={() => setActiveRegimeTab("old-deductions")}
                  className={`flex-1 cursor-pointer rounded-xl py-2.5 text-center text-xs font-bold transition-all sm:text-sm ${
                    activeRegimeTab === "old-deductions"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  2. Old Regime Deductions
                </button>
                <button
                  type="button"
                  onClick={() => setActiveRegimeTab("new-deductions")}
                  className={`flex-1 cursor-pointer rounded-xl py-2.5 text-center text-xs font-bold transition-all sm:text-sm ${
                    activeRegimeTab === "new-deductions"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  3. New Regime Rules
                </button>
              </div>

              {/* SECTION A: SALARY & PF INPUTS */}
              {activeRegimeTab === "salary" && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">
                        Salary Structure Details
                      </h3>
                      <p className="text-xs text-slate-500">
                        Enter your CTC/Gross salary. Monthly and annual amounts update in real-time.
                      </p>
                    </div>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                      Step 1 of 3
                    </span>
                  </div>

                  {/* 1. GROSS SALARY INPUTS (ANNUAL & MONTHLY SYNCED) */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                        Annual Gross Salary (CTC) (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={annualGross || ""}
                        onChange={(e) => handleAnnualGrossChange(e.target.value)}
                        placeholder="e.g. 1200000"
                        className="mt-1.5 w-full rounded-xl border border-slate-300 p-3.5 text-base font-bold text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                      />
                      <span className="text-[11px] text-slate-400">
                        {money(annualGross)} per year
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                        Monthly Gross Salary (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="500"
                        value={monthlyGross || ""}
                        onChange={(e) => handleMonthlyGrossChange(e.target.value)}
                        placeholder="e.g. 100000"
                        className="mt-1.5 w-full rounded-xl border border-slate-300 p-3.5 text-base font-bold text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                      />
                      <span className="text-[11px] text-slate-400">
                        {money(monthlyGross)} per month
                      </span>
                    </div>
                  </div>

                  {/* 2. BASIC SALARY CALCULATION & PERCENTAGE */}
                  <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Basic Salary Configuration
                        </span>
                        <p className="text-xs text-slate-500">
                          Basic is typically 40%–50% of CTC. (Not fixed at 12%).
                        </p>
                      </div>

                      {/* Quick Percentage Buttons */}
                      <div className="flex items-center gap-1.5">
                        {[40, 50, 60].map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => handleBasicPercentChange(pct)}
                            className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                              isBasicPercent && basicSalaryPercent === pct
                                ? "bg-blue-600 text-white"
                                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            {pct}%
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600">
                          Basic as % of Gross ({basicSalaryPercent}%)
                        </label>
                        <input
                          type="range"
                          min="20"
                          max="80"
                          value={basicSalaryPercent}
                          onChange={(e) => handleBasicPercentChange(Number(e.target.value))}
                          className="mt-2 w-full cursor-pointer accent-blue-600"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600">
                          Basic Salary Amount (₹ / Year)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={salaryStructure.basicSalary}
                          onChange={(e) => handleCustomBasicChange(Number(e.target.value))}
                          className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm font-bold text-slate-900"
                        />
                        <span className="text-[11px] text-slate-500">
                          {money(Math.round(salaryStructure.basicSalary / 12))}/mo
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 3. ALLOWANCES BREAKDOWN */}
                  <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        HRA Received (Annual)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={hraReceived}
                        onChange={(e) => setHraReceived(safeNumber(e.target.value))}
                        className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm font-semibold"
                      />
                      <span className="text-[11px] text-slate-400">
                        {money(Math.round(hraReceived / 12))}/mo
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Special Allowance
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={specialAllowance}
                        onChange={(e) => setSpecialAllowance(safeNumber(e.target.value))}
                        className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm font-semibold"
                      />
                      <span className="text-[11px] text-slate-400">
                        {money(Math.round(specialAllowance / 12))}/mo
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Other Allowances
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={otherAllowances}
                        onChange={(e) => setOtherAllowances(safeNumber(e.target.value))}
                        className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm font-semibold"
                      />
                      <span className="text-[11px] text-slate-400">
                        {money(Math.round(otherAllowances / 12))}/mo
                      </span>
                    </div>
                  </div>

                  {/* SALARY RECONCILIATION BANNER */}
                  {salaryStructure.reconciliation && (
                    <div
                      className={`mt-4 rounded-xl border p-3 text-xs flex flex-wrap items-center justify-between gap-2 ${
                        salaryStructure.reconciliation.isBalanced
                          ? "border-emerald-200 bg-emerald-50/70 text-emerald-900"
                          : "border-amber-300 bg-amber-50 text-amber-900"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">
                          {salaryStructure.reconciliation.isBalanced ? "✅" : "⚠️"}
                        </span>
                        <span>
                          <strong>Salary Reconciliation:</strong> Basic ({money(salaryStructure.basicSalary)}) + HRA ({money(salaryStructure.hraReceived)}) + Special ({money(salaryStructure.specialAllowance)}) + Other ({money(salaryStructure.otherAllowances)}) ={" "}
                          <strong>{money(salaryStructure.reconciliation.sumOfComponents)}</strong>{" "}
                          {salaryStructure.reconciliation.isBalanced ? (
                            <span className="text-emerald-700 font-bold">(Matches Gross Salary)</span>
                          ) : (
                            <span className="text-amber-800 font-bold">
                              ({salaryStructure.reconciliation.difference > 0 ? "Under by " : "Exceeds by "}
                              {money(Math.abs(salaryStructure.reconciliation.difference))})
                            </span>
                          )}
                        </span>
                      </div>
                      {!salaryStructure.reconciliation.isBalanced && (
                        <button
                          type="button"
                          onClick={handleAutoBalanceSalary}
                          className="cursor-pointer rounded-lg bg-amber-600 px-3 py-1 text-xs font-bold text-white hover:bg-amber-700 shadow-sm"
                        >
                          ⚡ Auto-Balance Special Allowance
                        </button>
                      )}
                    </div>
                  )}

                  {/* 4. PROVIDENT FUND (PF) MODULE */}
                  <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50/60 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-200/60 pb-3">
                      <div>
                        <span className="text-sm font-bold text-blue-900">
                          🛡️ Provident Fund (PF) Contributions
                        </span>
                        <p className="text-xs text-blue-700">
                          Statutory EPF rule: 12% of Basic Salary (not 12% of Gross).
                        </p>
                      </div>

                      <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-blue-900">
                        <input
                          type="checkbox"
                          checked={isCustomPF}
                          onChange={(e) => setIsCustomPF(e.target.checked)}
                          className="h-4 w-4 rounded text-blue-600"
                        />
                        <span>Enter Custom PF</span>
                      </label>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="rounded-xl border border-blue-200 bg-white p-3.5">
                        <div className="text-xs font-bold uppercase tracking-wide text-slate-600">
                          Employee PF Contribution
                        </div>
                        <div className="text-lg font-black text-blue-900">
                          {money(salaryStructure.employeePF)} / yr
                        </div>
                        <div className="text-xs text-slate-500">
                          {money(Math.round(salaryStructure.employeePF / 12))} / month
                        </div>
                        {isCustomPF && (
                          <input
                            type="number"
                            min="0"
                            value={customEmployeePF}
                            onChange={(e) => setCustomEmployeePF(safeNumber(e.target.value))}
                            className="mt-2 w-full rounded-lg border border-slate-300 p-2 text-xs font-bold"
                          />
                        )}
                        <p className="mt-1.5 text-[11px] text-slate-500">
                          Eligible under Section 80C in Old Regime (within ₹1.5L limit).
                        </p>
                      </div>

                      <div className="rounded-xl border border-blue-200 bg-white p-3.5">
                        <div className="text-xs font-bold uppercase tracking-wide text-slate-600">
                          Employer PF Contribution
                        </div>
                        <div className="text-lg font-black text-slate-800">
                          {money(salaryStructure.employerPF)} / yr
                        </div>
                        <div className="text-xs text-slate-500">
                          {money(Math.round(salaryStructure.employerPF / 12))} / month
                        </div>
                        {isCustomPF && (
                          <input
                            type="number"
                            min="0"
                            value={customEmployerPF}
                            onChange={(e) => setCustomEmployerPF(safeNumber(e.target.value))}
                            className="mt-2 w-full rounded-lg border border-slate-300 p-2 text-xs font-bold"
                          />
                        )}
                        <p className="mt-1.5 text-[11px] text-slate-500">
                          Paid by employer. Does not reduce employee take-home pay.
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 rounded-lg bg-blue-100/70 p-2.5 text-xs text-blue-900 leading-relaxed">
                      💡 <strong>PF Rule:</strong> Employee PF is automatically accounted for in Section 80C below. It is not deducted again separately, preventing double deduction.
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setActiveRegimeTab("old-deductions")}
                      className="cursor-pointer rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
                    >
                      Next: Old Regime Deductions →
                    </button>
                  </div>
                </div>
              )}

              {/* SECTION B: OLD REGIME DEDUCTIONS & EXEMPTIONS */}
              {activeRegimeTab === "old-deductions" && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">
                        Old Tax Regime – Deductions & Exemptions
                      </h3>
                      <p className="text-xs text-slate-500">
                        Section 10 exemptions, 80C investments, Health Insurance (80D), and Home Loan (24b).
                      </p>
                    </div>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                      Step 2 of 3
                    </span>
                  </div>

                  {/* QUICK DEDUCTION PRESETS */}
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                    <span className="text-xs font-medium text-slate-600">
                      Deduction Presets:
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleLoadSampleDeductions}
                        className="cursor-pointer rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100 transition-colors"
                      >
                        ⚡ Load Sample Deductions
                      </button>
                      <button
                        type="button"
                        onClick={handleClearAllDeductions}
                        className="cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                      >
                        🔄 Clear All to ₹0
                      </button>
                    </div>
                  </div>

                  {/* 1. HRA EXEMPTION ENGINE */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-900">
                        🏠 Section 10(13A) – House Rent Allowance (HRA) Exemption
                      </span>
                      <span className="text-xs font-bold text-blue-700">
                        Exempt: {money(comparison.oldRegime.hraBreakdown?.exemptHRA || 0)}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600">
                          Annual Rent Paid by You (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={rentPaidAnnual}
                          onChange={(e) => setRentPaidAnnual(safeNumber(e.target.value))}
                          placeholder="e.g. 180000"
                          className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm font-semibold"
                        />
                        <span className="text-[11px] text-slate-500">
                          {money(Math.round(rentPaidAnnual / 12))}/month
                        </span>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600">
                          Metro City Status
                        </label>
                        <div className="mt-1 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setIsMetro(true)}
                            className={`flex-1 rounded-xl p-2.5 text-xs font-bold transition-all ${
                              isMetro
                                ? "bg-blue-600 text-white"
                                : "bg-white text-slate-600 border border-slate-200"
                            }`}
                          >
                            Metro (50% of Basic)
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsMetro(false)}
                            className={`flex-1 rounded-xl p-2.5 text-xs font-bold transition-all ${
                              !isMetro
                                ? "bg-blue-600 text-white"
                                : "bg-white text-slate-600 border border-slate-200"
                            }`}
                          >
                            Non-Metro (40%)
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* HRA 3-Rule Breakdown card */}
                    {comparison.oldRegime.hraBreakdown && (
                      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600 space-y-1">
                        <div className="font-bold text-slate-800">
                          Statutory Minimum Rule (Least of 3 is Exempt):
                        </div>
                        <div className="flex justify-between">
                          <span>1. Actual HRA received:</span>
                          <strong>{money(comparison.oldRegime.hraBreakdown.actualHRA)}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>2. Rent paid − 10% of Basic ({money(rentPaidAnnual)} − {money(Math.round(salaryStructure.basicSalary * 0.1))}):</span>
                          <strong>{money(comparison.oldRegime.hraBreakdown.rentMinus10PercentBasic)}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>3. {isMetro ? "50%" : "40%"} of Basic Salary:</span>
                          <strong>{money(comparison.oldRegime.hraBreakdown.percentOfBasic)}</strong>
                        </div>
                        <div className="flex justify-between border-t border-slate-100 pt-1 text-emerald-700 font-bold">
                          <span>✅ Eligible Exemption:</span>
                          <span>{money(comparison.oldRegime.hraBreakdown.exemptHRA)}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 2. OTHER SECTION 10 ALLOWANCES (LTA, CHILDREN, HOSTEL) */}
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        LTA Exemption (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={ltaExemption}
                        onChange={(e) => setLtaExemption(safeNumber(e.target.value))}
                        className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-xs font-semibold"
                        placeholder="0"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Children Education ({childrenCount})
                      </label>
                      <select
                        value={childrenCount}
                        onChange={(e) => setChildrenCount(Number(e.target.value))}
                        className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-xs font-semibold"
                      >
                        <option value={0}>0 Children (₹0)</option>
                        <option value={1}>1 Child (₹1,200/yr)</option>
                        <option value={2}>2 Children (₹2,400/yr)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Hostel Allowance ({hostelChildrenCount})
                      </label>
                      <select
                        value={hostelChildrenCount}
                        onChange={(e) => setHostelChildrenCount(Number(e.target.value))}
                        className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-xs font-semibold"
                      >
                        <option value={0}>0 Children (₹0)</option>
                        <option value={1}>1 Child (₹3,600/yr)</option>
                        <option value={2}>2 Children (₹7,200/yr)</option>
                      </select>
                    </div>
                  </div>

                  {/* 3. SECTION 80C DEDUCTIONS (CAP: ₹1,50,000) */}
                  <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-900">
                        📈 Section 80C Investments (Max Limit: ₹1,50,000)
                      </span>
                      <span className="text-xs font-bold text-blue-700">
                        Claimed: {money(comparison.oldRegime.section80CBreakdown?.allowedDeduction || 0)} / ₹1,50,000
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full bg-blue-600 transition-all duration-300"
                        style={{
                          width: `${Math.min(100, ((total80CClaimed || 0) / 150000) * 100)}%`,
                        }}
                      />
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-2.5">
                        <div>
                          <div className="text-xs font-bold text-slate-800">
                            Employee PF (From Salary)
                          </div>
                          <div className="text-xs text-blue-600 font-semibold">
                            {money(salaryStructure.employeePF)}
                          </div>
                        </div>
                        <label className="flex items-center gap-1.5 text-xs text-slate-600">
                          <input
                            type="checkbox"
                            checked={includeEmployeePFIn80C}
                            onChange={(e) => setIncludeEmployeePFIn80C(e.target.checked)}
                            className="rounded text-blue-600"
                          />
                          <span>Include</span>
                        </label>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600">
                          PPF (Public Provident Fund)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={ppf}
                          onChange={(e) => setPpf(safeNumber(e.target.value))}
                          className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2 text-xs font-semibold"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600">
                          ELSS (Tax-Saving Mutual Funds)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={elss}
                          onChange={(e) => setElss(safeNumber(e.target.value))}
                          className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2 text-xs font-semibold"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600">
                          Life Insurance Premium (LIC)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={lic}
                          onChange={(e) => setLic(safeNumber(e.target.value))}
                          className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2 text-xs font-semibold"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600">
                          Tuition Fees (Max 2 Children)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={tuitionFees}
                          onChange={(e) => setTuitionFees(safeNumber(e.target.value))}
                          className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2 text-xs font-semibold"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600">
                          Other 80C (Home Loan Principal, NSC)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={other80C}
                          onChange={(e) => setOther80C(safeNumber(e.target.value))}
                          className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2 text-xs font-semibold"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 4. SECTION 24(B) HOME LOAN INTEREST (CAP: ₹2,00,000) */}
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-700">
                        🏡 Section 24(b) – Home Loan Interest (Self-Occupied)
                      </span>
                      <span className="text-xs font-bold text-slate-500">
                        Max ₹2,00,000
                      </span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      max="200000"
                      value={homeLoanInterest}
                      onChange={(e) => setHomeLoanInterest(safeNumber(e.target.value))}
                      placeholder="e.g. 150000"
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-2 text-xs font-semibold"
                    />
                  </div>

                  {/* 5. SECTION 80D HEALTH INSURANCE (SELF & PARENTS) */}
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-700">
                      🩺 Section 80D – Medical Insurance Premium
                    </span>
                    <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-800">
                            Self, Spouse & Children
                          </span>
                          <label className="flex items-center gap-1 text-[11px] text-slate-500">
                            <input
                              type="checkbox"
                              checked={isSelfSenior}
                              onChange={(e) => setIsSelfSenior(e.target.checked)}
                            />
                            <span>Senior (60+)</span>
                          </label>
                        </div>
                        <input
                          type="number"
                          min="0"
                          max={isSelfSenior ? 50000 : 25000}
                          value={healthInsuranceSelf}
                          onChange={(e) => setHealthInsuranceSelf(safeNumber(e.target.value))}
                          className="mt-1.5 w-full rounded-lg border border-slate-300 p-1.5 text-xs font-bold"
                        />
                        <span className="text-[10px] text-slate-400">
                          Limit: {isSelfSenior ? "₹50,000" : "₹25,000"}
                        </span>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-800">
                            Parents Health Insurance
                          </span>
                          <label className="flex items-center gap-1 text-[11px] text-slate-500">
                            <input
                              type="checkbox"
                              checked={isParentsSenior}
                              onChange={(e) => setIsParentsSenior(e.target.checked)}
                            />
                            <span>Senior (60+)</span>
                          </label>
                        </div>
                        <input
                          type="number"
                          min="0"
                          max={isParentsSenior ? 50000 : 25000}
                          value={healthInsuranceParents}
                          onChange={(e) => setHealthInsuranceParents(safeNumber(e.target.value))}
                          className="mt-1.5 w-full rounded-lg border border-slate-300 p-1.5 text-xs font-bold"
                        />
                        <span className="text-[10px] text-slate-400">
                          Limit: {isParentsSenior ? "₹50,000" : "₹25,000"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 6. SECTION 80CCD NPS CONTRIBUTIONS */}
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <label className="block text-xs font-semibold text-slate-700">
                        80CCD(1B) – Additional Voluntary NPS
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="50000"
                        value={npsVoluntary80CCD1B}
                        onChange={(e) => setNpsVoluntary80CCD1B(safeNumber(e.target.value))}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs font-semibold"
                      />
                      <span className="text-[10px] text-slate-400">
                        Max ₹50,000 additional deduction
                      </span>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <label className="block text-xs font-semibold text-slate-700">
                        80CCD(2) – Employer NPS (Max 14% Basic)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={employerNPS80CCD2}
                        onChange={(e) => setEmployerNPS80CCD2(safeNumber(e.target.value))}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs font-semibold"
                      />
                      <span className="text-[10px] text-slate-400">
                        Allowed in both Old & New Regimes
                      </span>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-between">
                    <button
                      type="button"
                      onClick={() => setActiveRegimeTab("salary")}
                      className="cursor-pointer rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      ← Back to Salary
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveRegimeTab("new-deductions")}
                      className="cursor-pointer rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
                    >
                      Next: New Regime Rules →
                    </button>
                  </div>
                </div>
              )}

              {/* SECTION C: NEW REGIME DEDUCTIONS RULES */}
              {activeRegimeTab === "new-deductions" && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">
                        New Tax Regime (Section 115BAC) Rules
                      </h3>
                      <p className="text-xs text-slate-500">
                        Default tax regime in India with lower tax slabs and minimal deductions.
                      </p>
                    </div>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                      Step 3 of 3
                    </span>
                  </div>

                  <div className="space-y-4">
                    {/* Standard deduction card */}
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-bold text-emerald-900">
                            ✅ Standard Deduction: ₹75,000
                          </div>
                          <p className="text-xs text-emerald-700">
                            Increased from ₹50,000 to ₹75,000 for salaried employees and pensioners.
                          </p>
                        </div>
                        <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white">
                          Applied Automatically
                        </span>
                      </div>
                    </div>

                    {/* Section 87A rebate card */}
                    <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
                      <div className="text-sm font-bold text-blue-900">
                        🎯 Section 87A Rebate & Marginal Relief
                      </div>
                      <p className="mt-1 text-xs text-blue-800 leading-relaxed">
                        {financialYear === "FY 2025-26" ? (
                          <>
                            Under <strong>Budget 2025</strong>, taxable income up to <strong>₹12,00,000</strong> pays <strong>₹0 tax</strong> (Rebate up to ₹60,000). Combined with ₹75k standard deduction, gross salary up to <strong>₹12,75,000</strong> is completely tax-free!
                          </>
                        ) : (
                          <>
                            Under <strong>Budget 2024</strong>, taxable income up to <strong>₹7,00,000</strong> pays <strong>₹0 tax</strong> (Rebate up to ₹25,000). Combined with ₹75k standard deduction, gross salary up to <strong>₹7,75,000</strong> is tax-free!
                          </>
                        )}
                      </p>
                      <p className="mt-1 text-xs text-blue-700">
                        Marginal relief protects taxpayers whose income slightly exceeds the threshold so the tax never exceeds the excess income.
                      </p>
                    </div>

                    {/* Section 80CCD(2) Employer NPS */}
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Section 80CCD(2) – Employer NPS Contribution
                        </span>
                        <span className="text-xs text-slate-500">Allowed in New Regime</span>
                      </div>
                      <input
                        type="number"
                        min="0"
                        value={employerNPS80CCD2}
                        onChange={(e) => setEmployerNPS80CCD2(safeNumber(e.target.value))}
                        className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs font-bold"
                        placeholder="Employer NPS contribution amount"
                      />
                      <span className="text-[11px] text-slate-400">
                        Up to 14% of Basic Salary ({money(Math.round(salaryStructure.basicSalary * 0.14))}) is exempt.
                      </span>
                    </div>

                    {/* Disallowed deductions notice */}
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900">
                      <strong>⚠️ Disallowed Deductions in New Regime:</strong>
                      <p className="mt-1">
                        Section 80C (PPF, ELSS, PF, LIC), Section 80D (Health Insurance), HRA exemption, LTA, and self-occupied home loan interest (24b) are <strong>not permitted</strong> under the New Tax Regime.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-between">
                    <button
                      type="button"
                      onClick={() => setActiveRegimeTab("old-deductions")}
                      className="cursor-pointer rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      ← Back to Old Regime
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveRegimeTab("salary")}
                      className="cursor-pointer rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
                    >
                      Back to Salary Breakdown ↑
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: SIDE-BY-SIDE REGIME COMPARISON & SLAB DETAILS (5 COLS) */}
            <div className="space-y-6 lg:col-span-5">
              {/* COMPARISON SUMMARY CARD */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      Old vs New Regime Breakdown
                    </h3>
                    <p className="text-xs text-slate-500">
                      Side-by-side tax computation for {financialYear}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                      comparison.recommendedRegime === "new"
                        ? "bg-emerald-100 text-emerald-800"
                        : comparison.recommendedRegime === "old"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-slate-100 text-slate-800"
                    }`}
                  >
                    {comparison.recommendedRegime === "new"
                      ? "New Regime Wins"
                      : comparison.recommendedRegime === "old"
                        ? "Old Regime Wins"
                        : "Regimes Equal"}
                  </span>
                </div>

                {/* COMPARISON TABLE */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="py-2 font-bold">Component</th>
                        <th className="py-2 text-right font-bold text-slate-700">Old Regime</th>
                        <th className="py-2 text-right font-bold text-blue-700">New Regime</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      <tr>
                        <td className="py-2.5 font-medium">Gross Salary</td>
                        <td className="py-2.5 text-right font-semibold">{money(comparison.oldRegime.grossSalary)}</td>
                        <td className="py-2.5 text-right font-semibold text-blue-700">{money(comparison.newRegime.grossSalary)}</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 font-medium">Sec 10 Exemptions (HRA, LTA)</td>
                        <td className="py-2.5 text-right text-emerald-600 font-semibold">− {money(comparison.oldRegime.exemptions)}</td>
                        <td className="py-2.5 text-right text-slate-400">₹0 (Disallowed)</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 font-medium">Standard Deduction</td>
                        <td className="py-2.5 text-right text-emerald-600 font-semibold">− {money(comparison.oldRegime.standardDeduction)}</td>
                        <td className="py-2.5 text-right text-emerald-600 font-semibold">− {money(comparison.newRegime.standardDeduction)}</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 font-medium">Chapter VI-A (80C, 80D, 24b)</td>
                        <td className="py-2.5 text-right text-emerald-600 font-semibold">− {money(comparison.oldRegime.chapter6ADeductions)}</td>
                        <td className="py-2.5 text-right text-slate-400">− {money(comparison.newRegime.chapter6ADeductions)} (NPS)</td>
                      </tr>
                      <tr className="bg-slate-50/80 font-bold">
                        <td className="py-2.5 text-slate-900">Taxable Income</td>
                        <td className="py-2.5 text-right text-slate-900">{money(comparison.oldRegime.taxableIncome)}</td>
                        <td className="py-2.5 text-right text-blue-900">{money(comparison.newRegime.taxableIncome)}</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 font-medium">Tax Before Rebate</td>
                        <td className="py-2.5 text-right">{money(comparison.oldRegime.incomeTaxBeforeRebate)}</td>
                        <td className="py-2.5 text-right">{money(comparison.newRegime.incomeTaxBeforeRebate)}</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 font-medium">Section 87A Rebate</td>
                        <td className="py-2.5 text-right text-emerald-600">− {money(comparison.oldRegime.rebate)}</td>
                        <td className="py-2.5 text-right text-emerald-600">− {money(comparison.newRegime.rebate)}</td>
                      </tr>
                      {comparison.newRegime.marginalRelief > 0 && (
                        <tr>
                          <td className="py-2.5 font-medium">Marginal Relief</td>
                          <td className="py-2.5 text-right text-slate-400">₹0</td>
                          <td className="py-2.5 text-right text-emerald-600">− {money(comparison.newRegime.marginalRelief)}</td>
                        </tr>
                      )}
                      <tr>
                        <td className="py-2.5 font-medium">4% Cess</td>
                        <td className="py-2.5 text-right">{money(comparison.oldRegime.cess)}</td>
                        <td className="py-2.5 text-right">{money(comparison.newRegime.cess)}</td>
                      </tr>
                      <tr className="border-t-2 border-slate-300 bg-blue-50/40 text-sm font-black">
                        <td className="py-3 text-slate-900">Total Annual Tax</td>
                        <td className="py-3 text-right text-slate-900">{money(comparison.oldRegime.annualTax)}</td>
                        <td className="py-3 text-right text-blue-700">{money(comparison.newRegime.annualTax)}</td>
                      </tr>
                      <tr className="font-bold">
                        <td className="py-2.5 text-slate-700">Monthly TDS</td>
                        <td className="py-2.5 text-right text-slate-700">{money(comparison.oldRegime.monthlyTDS)}</td>
                        <td className="py-2.5 text-right text-blue-700">{money(comparison.newRegime.monthlyTDS)}</td>
                      </tr>
                      <tr className="bg-emerald-50/50 font-bold text-emerald-900">
                        <td className="py-2.5">Monthly Take-Home Pay</td>
                        <td className="py-2.5 text-right">{money(comparison.oldRegime.afterTaxMonthlyIncome)}</td>
                        <td className="py-2.5 text-right font-black">{money(comparison.newRegime.afterTaxMonthlyIncome)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* VISUAL TAX COMPARISON BAR */}
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Tax Liability Comparison
                  </div>
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-xs font-semibold text-slate-700">
                        <span>Old Tax Regime</span>
                        <span>{money(comparison.oldRegime.annualTax)}</span>
                      </div>
                      <div className="mt-1 h-3 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full bg-slate-600 rounded-full"
                          style={{
                            width: `${Math.max(4, Math.min(100, (comparison.oldRegime.annualTax / (Math.max(comparison.oldRegime.annualTax, comparison.newRegime.annualTax) || 1)) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-semibold text-blue-700">
                        <span>New Tax Regime</span>
                        <span>{money(comparison.newRegime.annualTax)}</span>
                      </div>
                      <div className="mt-1 h-3 w-full rounded-full bg-blue-50 overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full"
                          style={{
                            width: `${Math.max(4, Math.min(100, (comparison.newRegime.annualTax / (Math.max(comparison.oldRegime.annualTax, comparison.newRegime.annualTax) || 1)) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION 87A REBATE & ZERO TAX EXPLANATION */}
                <div className="mt-5 space-y-2 border-t border-slate-100 pt-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Statutory Rebate & Relief Notes
                  </div>
                  {comparison.newRegime.rebateExplanation && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900 leading-relaxed">
                      <div className="font-bold text-blue-950">📘 New Tax Regime:</div>
                      <div>{comparison.newRegime.rebateExplanation}</div>
                    </div>
                  )}
                  {comparison.oldRegime.rebateExplanation && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800 leading-relaxed">
                      <div className="font-bold text-slate-900">📙 Old Tax Regime:</div>
                      <div>{comparison.oldRegime.rebateExplanation}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* ACTIVE REGIME SLAB BREAKDOWN ACCORDION */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h4 className="text-sm font-bold text-slate-900">
                  {comparison.recommendedRegime === "old" ? "Old Regime" : "New Regime"} Slab Computation
                </h4>
                <p className="text-xs text-slate-500 mb-3">
                  How tax is calculated across each income slab
                </p>

                <div className="space-y-2">
                  {activeResultSnapshot.slabs.map((slab, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-800">{slab.range}</div>
                        <div className="text-[11px] text-slate-400">Rate: {slab.rate}%</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-slate-900">{money(slab.tax)}</div>
                        <div className="text-[11px] text-slate-500">
                          Taxable: {money(slab.taxableAmount)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </AuthGuard>
  );
}
