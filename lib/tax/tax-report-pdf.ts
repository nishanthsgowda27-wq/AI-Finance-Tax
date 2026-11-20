import { jsPDF } from "jspdf";
import type { TaxCalculationResult, TaxComparisonResult, TaxRegime } from "./tax-types";

export type TaxCalculationSnapshot = {
  calculatedAt: Date;
  profession: string;
  incomeType: string;
  regime: TaxRegime;
  result: TaxCalculationResult;
  comparison?: TaxComparisonResult;
  financialYear?: string;
};

const DISCLAIMER = "This tax calculation is an estimate provided for informational and educational purposes only. Actual tax liability may vary depending on applicable tax laws, income sources, deductions, exemptions, residency status, taxpayer-specific circumstances and changes in government regulations. FinanceAI does not file tax returns or determine official tax liability. Users should verify the calculation with the Income Tax Department or a qualified tax professional before making tax-related decisions.";
const BLUE: [number, number, number] = [19, 87, 166];
const DARK: [number, number, number] = [16, 42, 76];
const TEXT: [number, number, number] = [38, 52, 71];
const MUTED: [number, number, number] = [82, 97, 118];
const BORDER: [number, number, number] = [190, 204, 220];
const LIGHT: [number, number, number] = [243, 248, 253];

function amount(value: number) {
  return `INR ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value || 0)}`;
}

function assessmentYear(date: Date) {
  return date.getMonth() >= 3
    ? `${date.getFullYear()}-${String(date.getFullYear() + 1).slice(-2)}`
    : `${date.getFullYear() - 1}-${String(date.getFullYear()).slice(-2)}`;
}

function safeText(value: string) {
  return value.replaceAll("₹", "INR ").replace(/[–—]/g, "-");
}

export function createTaxAssessmentPdf(calculation: TaxCalculationSnapshot) {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 14;
  const width = pageWidth - margin * 2;
  const innerWidth = width - 12;
  let y = margin;
  const result = calculation.result;
  const regimeName = calculation.regime === "new" ? "New Tax Regime" : "Old Tax Regime";
  const date = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric" }).format(calculation.calculatedAt);
  const time = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(calculation.calculatedAt);
  const boxContentY = (boxY: number) => boxY + 16;

  function newPage() {
    pdf.addPage();
    y = margin;
  }

  function drawPanel(title: string, height: number, drawContent: (contentY: number) => void) {
    if (y + height > pageHeight - 18) newPage();
    const top = y;
    pdf.setLineWidth(0.28);
    pdf.setDrawColor(...BORDER);
    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(margin, top, width, height, 1.8, 1.8, "FD");
    pdf.setFillColor(...LIGHT);
    pdf.rect(margin + 0.3, top + 0.3, width - 0.6, 11, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10.5);
    pdf.setTextColor(...BLUE);
    pdf.text(title, margin + 5, top + 7.4);
    drawContent(boxContentY(top));
    y = top + height + 5;
  }

  function wrap(text: string, size: number, maxWidth: number) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(size);
    return pdf.splitTextToSize(safeText(text), maxWidth) as string[];
  }

  function rowLayouts(rows: { label: string; value: string; emphasis?: boolean }[]) {
    const labelWidth = 91;
    const valueWidth = innerWidth - labelWidth;
    return rows.map((row) => {
      const labels = wrap(row.label, 9, labelWidth);
      const values = wrap(row.value, 9, valueWidth);
      return { ...row, labels, values, height: Math.max(labels.length, values.length, 1) * 4.1 + 2.4 };
    });
  }

  function drawRows(rows: { label: string; value: string; emphasis?: boolean }[], contentY: number, valueAlign: "left" | "right" = "right") {
    const layouts = rowLayouts(rows);
    const labelX = margin + 6;
    const valueX = margin + 6 + 93;
    let rowY = contentY;

    for (const row of layouts) {
      if (row.emphasis) {
        pdf.setFillColor(239, 246, 253);
        pdf.rect(margin + 1, rowY, width - 2, row.height, "F");
      }
      pdf.setFont("helvetica", row.emphasis ? "bold" : "normal");
      pdf.setFontSize(row.emphasis ? 9.4 : 9);
      pdf.setTextColor(...(row.emphasis ? DARK : TEXT));
      row.labels.forEach((line, index) => pdf.text(line, labelX, rowY + 3.8 + index * 4));
      pdf.setTextColor(...(row.emphasis ? BLUE : TEXT));
      row.values.forEach((line, index) => {
        const x = valueAlign === "left" ? valueX : margin + width - 6;
        pdf.text(line, x, rowY + 3.8 + index * 4, valueAlign === "left" ? undefined : { align: "right" });
      });
      pdf.setDrawColor(230, 238, 247);
      pdf.setLineWidth(0.18);
      pdf.line(margin + 5, rowY + row.height, margin + width - 5, rowY + row.height);
      rowY += row.height;
    }
  }

  function drawRowsPanel(title: string, rows: { label: string; value: string; emphasis?: boolean }[], valueAlign: "left" | "right" = "right") {
    const totalContentHeight = rowLayouts(rows).reduce((total, row) => total + row.height, 0);
    drawPanel(title, 17 + totalContentHeight + 3, (contentY) => drawRows(rows, contentY, valueAlign));
  }

  function drawTablePanel(title: string, headers: string[], rows: string[][], columnWidths: number[]) {
    const headerHeight = 7.5;
    const dataRowHeight = 6.8;
    const renderedRows = rows.length;
    const tableWidth = columnWidths.reduce((sum, w) => sum + w, 0);
    const tableX = margin + (width - tableWidth) / 2;

    drawPanel(title, 17 + headerHeight + renderedRows * dataRowHeight + 5, (contentY) => {
      pdf.setFillColor(...LIGHT);
      pdf.rect(tableX, contentY, tableWidth, headerHeight, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.8);
      pdf.setTextColor(...DARK);
      let columnX = tableX;
      headers.forEach((header, index) => {
        const isFirst = index === 0;
        const x = isFirst ? columnX + 1.5 : columnX + columnWidths[index] - 1.5;
        pdf.text(header, x, contentY + 5.2, isFirst ? undefined : { align: "right" });
        columnX += columnWidths[index];
      });
      pdf.setDrawColor(216, 224, 234);
      pdf.setLineWidth(0.2);
      pdf.line(tableX, contentY + headerHeight, tableX + tableWidth, contentY + headerHeight);

      let rowY = contentY + headerHeight;
      rows.forEach((row, rowIndex) => {
        if (rowIndex % 2 === 1) {
          pdf.setFillColor(248, 251, 255);
          pdf.rect(tableX, rowY, tableWidth, dataRowHeight, "F");
        }
        columnX = tableX;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.6);
        pdf.setTextColor(...TEXT);
        row.forEach((cellText, index) => {
          const isFirst = index === 0;
          const x = isFirst ? columnX + 1.5 : columnX + columnWidths[index] - 1.5;
          pdf.text(cellText, x, rowY + 5.2, isFirst ? undefined : { align: "right" });
          columnX += columnWidths[index];
        });
        pdf.setDrawColor(229, 235, 242);
        pdf.setLineWidth(0.18);
        pdf.line(tableX, rowY + dataRowHeight, tableX + tableWidth, rowY + dataRowHeight);
        rowY += dataRowHeight;
      });
      pdf.setDrawColor(216, 224, 234);
      pdf.rect(tableX, contentY, tableWidth, headerHeight + renderedRows * dataRowHeight, "S");
    });
  }

  function drawBulletPanel(title: string, points: string[]) {
    const lineHeight = 4.4;
    const wrapped = points.map((point) => wrap(point, 9.2, innerWidth - 12));
    const contentHeight = wrapped.reduce((total, lines) => total + Math.max(lines.length * lineHeight, 7) + 1.5, 0);
    drawPanel(title, 17 + contentHeight + 5, (contentY) => {
      let textY = contentY + 4;
      for (const lines of wrapped) {
        pdf.setFillColor(...BLUE);
        pdf.circle(margin + 7, textY - 1, 0.8, "F");
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9.2);
        pdf.setTextColor(...TEXT);
        lines.forEach((line, index) => pdf.text(line, margin + 11, textY + index * lineHeight));
        textY += Math.max(lines.length * lineHeight, 7) + 1.5;
      }
    });
  }

  function drawDisclaimerPanel() {
    const lines = wrap(DISCLAIMER, 8.7, innerWidth - 2);
    const lineHeight = 4.1;
    const height = 17 + lines.length * lineHeight + 17;
    drawPanel("IMPORTANT DISCLAIMER", height, (contentY) => {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.7);
      pdf.setTextColor(...TEXT);
      lines.forEach((line, index) => pdf.text(line, margin + 6, contentY + 3 + index * lineHeight));
      const dateY = contentY + 6 + lines.length * lineHeight;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.4);
      pdf.setTextColor(...MUTED);
      pdf.text(`Calculation Date: ${date}`, margin + 6, dateY);
      pdf.text(`Calculation Time: ${time}`, margin + 6 + innerWidth / 2, dateY);
    });
  }

  function drawHeader() {
    const height = 37;
    const top = y;
    pdf.setLineWidth(0.28);
    pdf.setDrawColor(...BORDER);
    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(margin, top, width, height, 1.8, 1.8, "FD");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(...BLUE);
    pdf.text("FINANCEAI", margin + 6, top + 7);
    pdf.setFontSize(15);
    pdf.setTextColor(...DARK);
    pdf.text("TAX ASSESSMENT & ANALYSIS REPORT", margin + 6, top + 15);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    pdf.setTextColor(...MUTED);
    pdf.text(`Report Generated: ${date}, ${time}`, margin + 6, top + 25);
    pdf.text(`Financial Year: ${calculation.financialYear || "FY 2025-26"} | Assessment Year: ${assessmentYear(calculation.calculatedAt)}`, margin + 6, top + 32);
    y = top + height + 5;
  }

  pdf.setProperties({ title: "FinanceAI Tax Assessment & Analysis Report", subject: "Estimated tax calculation" });
  drawHeader();

  // If comparison is available, display Old vs New comparison upfront!
  if (calculation.comparison) {
    const comp = calculation.comparison;
    const recText = comp.recommendedRegime === "new"
      ? `RECOMMENDED: New Tax Regime saves ${amount(comp.annualTaxDifference)} annually`
      : comp.recommendedRegime === "old"
        ? `RECOMMENDED: Old Tax Regime saves ${amount(comp.annualTaxDifference)} annually`
        : "Both regimes result in the exact same tax";

    drawTablePanel("1. OLD VS NEW REGIME COMPARISON", ["Tax Metric", "Old Regime", "New Regime", "Difference"], [
      ["Gross Annual Salary", amount(comp.oldRegime.grossSalary), amount(comp.newRegime.grossSalary), "INR 0"],
      ["Section 10 Exemptions", amount(comp.oldRegime.exemptions), "INR 0 (Not allowed)", amount(comp.oldRegime.exemptions)],
      ["Standard Deduction", amount(comp.oldRegime.standardDeduction), amount(comp.newRegime.standardDeduction), amount(comp.newRegime.standardDeduction - comp.oldRegime.standardDeduction)],
      ["Chapter VI-A Deductions", amount(comp.oldRegime.chapter6ADeductions), amount(comp.newRegime.chapter6ADeductions), amount(comp.oldRegime.chapter6ADeductions - comp.newRegime.chapter6ADeductions)],
      ["Total Deductions", amount(comp.oldRegime.totalDeductions), amount(comp.newRegime.totalDeductions), amount(comp.oldRegime.totalDeductions - comp.newRegime.totalDeductions)],
      ["Taxable Income", amount(comp.oldRegime.taxableIncome), amount(comp.newRegime.taxableIncome), amount(Math.abs(comp.oldRegime.taxableIncome - comp.newRegime.taxableIncome))],
      ["Tax Before Cess", amount(comp.oldRegime.taxBeforeCess), amount(comp.newRegime.taxBeforeCess), amount(Math.abs(comp.oldRegime.taxBeforeCess - comp.newRegime.taxBeforeCess))],
      ["4% Cess", amount(comp.oldRegime.cess), amount(comp.newRegime.cess), amount(Math.abs(comp.oldRegime.cess - comp.newRegime.cess))],
      ["FINAL ANNUAL TAX", amount(comp.oldRegime.annualTax), amount(comp.newRegime.annualTax), amount(comp.annualTaxDifference)],
      ["Estimated Monthly TDS", amount(comp.oldRegime.monthlyTDS), amount(comp.newRegime.monthlyTDS), amount(comp.monthlyTDSDifference)],
      ["After-Tax Monthly Pay", amount(comp.oldRegime.afterTaxMonthlyIncome), amount(comp.newRegime.afterTaxMonthlyIncome), amount(Math.abs(comp.oldRegime.afterTaxMonthlyIncome - comp.newRegime.afterTaxMonthlyIncome))],
    ], [65, 38, 38, 35]);

    drawBulletPanel("2. REGIME RECOMMENDATION & VERDICT", [
      recText,
      `Old Regime Annual Tax: ${amount(comp.oldRegime.annualTax)} (${comp.oldRegime.effectiveTaxRate.toFixed(2)}% effective rate).`,
      `New Regime Annual Tax: ${amount(comp.newRegime.annualTax)} (${comp.newRegime.effectiveTaxRate.toFixed(2)}% effective rate).`,
      `Monthly Take-Home Difference: ${amount(comp.monthlyTDSDifference)} per month.`,
    ]);
  } else {
    drawRowsPanel("1. EXECUTIVE TAX SUMMARY", [
      { label: "Annual Income", value: amount(result.annualIncome) },
      { label: "Taxable Income", value: amount(result.taxableIncome) },
      { label: "Estimated Annual Tax", value: amount(result.annualTax), emphasis: true },
      { label: "Monthly Tax Provision", value: amount(result.monthlyTax) },
      { label: "After-Tax Monthly Income", value: amount(result.afterTaxMonthlyIncome) },
    ]);
  }

  newPage();
  drawRowsPanel("3. TAXPAYER & INCOME PROFILE", [
    { label: "Profession", value: calculation.profession || "Not provided" },
    { label: "Income Type", value: calculation.incomeType },
    { label: "Financial Year", value: calculation.financialYear || "FY 2025-26" },
    { label: "Assessment Year", value: assessmentYear(calculation.calculatedAt) },
    { label: "Active Tax Regime", value: regimeName },
    { label: "Annual Gross Income", value: amount(result.annualIncome) },
    { label: "Total Eligible Deductions", value: amount(result.deductions) },
  ], "left");

  drawTablePanel("4. ACTIVE REGIME SLAB BREAKDOWN", ["Tax Slab", "Rate", "Taxable Amount", "Tax"], result.slabs.map((slab) => [
    slab.range,
    `${slab.rate}%`,
    amount(slab.taxableAmount),
    amount(slab.tax),
  ]), [65, 19, 51, 35]);

  drawRowsPanel("5. TAX COMPUTATION & CESS", [
    { label: "Income Tax Before Rebate", value: amount(result.incomeTaxBeforeRebate) },
    { label: "Less: Section 87A Rebate", value: amount(result.rebate) },
    { label: "Less: Marginal Relief", value: amount(result.marginalRelief || 0) },
    { label: "Income Tax Before Cess", value: amount(result.incomeTaxBeforeCess) },
    { label: "Health & Education Cess (4%)", value: amount(result.cess) },
    { label: "FINAL ESTIMATED ANNUAL TAX", value: amount(result.annualTax), emphasis: true },
  ]);

  newPage();
  drawRowsPanel("6. MONTHLY FINANCIAL TAKE-HOME IMPACT", [
    { label: "Monthly Gross Salary", value: amount(result.monthlyIncome) },
    { label: "Estimated Monthly TDS", value: amount(result.monthlyTax) },
    { label: "Estimated After-Tax Monthly Take-Home", value: amount(result.afterTaxMonthlyIncome), emphasis: true },
  ]);

  const activeSlabs = result.slabs.filter((slab) => slab.taxableAmount > 0);
  const calculationNotes = [
    `${amount(result.annualIncome)} gross annual income less ${amount(result.deductions)} eligible deductions equals ${amount(result.taxableIncome)} taxable income.`,
    ...(activeSlabs.length
      ? activeSlabs.map((slab) => `${amount(slab.taxableAmount)} in ${slab.range} taxed at ${slab.rate}% produces ${amount(slab.tax)} tax.`)
      : ["No income falls within a taxable slab."]),
    `Tax before rebate of ${amount(result.incomeTaxBeforeRebate)} less rebate/marginal relief equals ${amount(result.incomeTaxBeforeCess)} before cess.`,
    `Adding health and education cess of ${amount(result.cess)} results in final estimated annual tax of ${amount(result.annualTax)}.`,
  ];
  drawBulletPanel("7. CALCULATION EXPLANATION & NOTES", calculationNotes);
  drawDisclaimerPanel();

  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    pdf.setLineWidth(0.3);
    pdf.setDrawColor(184, 201, 220);
    pdf.roundedRect(6, 6, pageWidth - 12, pageHeight - 12, 1.5, 1.5, "S");
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...MUTED);
    pdf.text(`FINANCEAI  |  Tax Assessment  |  Page ${page} of ${pageCount}`, pageWidth / 2, pageHeight - 9, { align: "center" });
  }

  return pdf;
}
