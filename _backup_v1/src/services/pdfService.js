const PDFDocument = require('pdfkit');

function generateTaxReportPDF(taxProfile, user) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 40, size: 'A4' });
            const buffers = [];

            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfData = Buffer.concat(buffers);
                resolve(pdfData);
            });

            // Header
            doc.fillColor('#1e3a8a')
               .fontSize(20)
               .text('INCOME TAX COMPUTATION REPORT', { align: 'center', bold: true });
            doc.moveDown(0.3);
            doc.fillColor('#475569')
               .fontSize(10)
               .text(`Financial Year: ${taxProfile.financialYear || '2024-2025'} | Assessment Year: 2025-2026`, { align: 'center' });
            doc.moveDown(1);

            // Taxpayer Info
            doc.fillColor('#0f172a').fontSize(12).text('1. Taxpayer Details', { underline: true });
            doc.fontSize(10).fillColor('#334155');
            doc.text(`Name: ${taxProfile.taxpayerName || user.name || 'N/A'}`);
            doc.text(`Account / ID: ${user.account || 'N/A'}`);
            doc.text(`Employment Type: ${taxProfile.employmentType || 'Salaried'}`);
            doc.text(`Age Category: ${taxProfile.ageCategory || 'General (< 60 years)'}`);
            doc.text(`Residential Status: ${taxProfile.residentialStatus || 'Resident'}`);
            doc.moveDown(0.8);

            // Income Details
            const inc = taxProfile.incomeDetails || {};
            doc.fillColor('#0f172a').fontSize(12).text('2. Income Breakdown', { underline: true });
            doc.fontSize(10).fillColor('#334155');
            doc.text(`Gross Salary / Annual Income: Rs. ${(inc.annualSalary || 0).toLocaleString('en-IN')}`);
            doc.text(`Basic Salary: Rs. ${(inc.basicSalary || 0).toLocaleString('en-IN')}`);
            doc.text(`HRA Received: Rs. ${(inc.hraReceived || 0).toLocaleString('en-IN')} | Rent Paid: Rs. ${(inc.rentPaid || 0).toLocaleString('en-IN')}`);
            doc.text(`Other Allowances: Rs. ${(inc.otherAllowances || 0).toLocaleString('en-IN')}`);
            doc.text(`Rental Income (House Property): Rs. ${(inc.rentalIncome || 0).toLocaleString('en-IN')}`);
            doc.text(`Interest & Other Income: Rs. ${((inc.interestIncome || 0) + (inc.otherIncome || 0)).toLocaleString('en-IN')}`);
            doc.moveDown(0.8);

            // Deductions Details
            const ded = taxProfile.deductions || {};
            doc.fillColor('#0f172a').fontSize(12).text('3. Deductions & Exemptions Claimed (Old Regime)', { underline: true });
            doc.fontSize(10).fillColor('#334155');
            doc.text(`Section 80C (PPF/EPF/ELSS/LIC): Rs. ${(ded.sec80C || 0).toLocaleString('en-IN')}`);
            doc.text(`Section 80D (Health Insurance): Rs. ${((ded.sec80D_self || 0) + (ded.sec80D_parents || 0)).toLocaleString('en-IN')}`);
            doc.text(`Section 80CCD(1B) (NPS Additional): Rs. ${(ded.sec80CCD_1B || 0).toLocaleString('en-IN')}`);
            doc.text(`Section 24(b) (Home Loan Interest): Rs. ${(ded.homeLoanInterest || 0).toLocaleString('en-IN')}`);
            doc.moveDown(0.8);

            // Comparison Summary Table
            const oldR = (taxProfile.results && taxProfile.results.oldRegime) || {};
            const newR = (taxProfile.results && taxProfile.results.newRegime) || {};
            const rec = (taxProfile.results && taxProfile.results.recommendation) || {};

            doc.fillColor('#0f172a').fontSize(12).text('4. Tax Computation Comparison', { underline: true });
            doc.moveDown(0.5);

            const tableTop = doc.y;
            doc.fontSize(10).fillColor('#1e293b');

            // Table Header
            doc.text('Particulars', 50, tableTop, { width: 220, bold: true });
            doc.text('Old Regime', 280, tableTop, { width: 120, align: 'right', bold: true });
            doc.text('New Regime', 420, tableTop, { width: 120, align: 'right', bold: true });
            doc.moveDown(0.3);
            doc.strokeColor('#cbd5e1').moveTo(50, doc.y).lineTo(540, doc.y).stroke();
            doc.moveDown(0.3);

            const rows = [
                ['Gross Total Income', `Rs. ${(oldR.grossTotalIncome || 0).toLocaleString('en-IN')}`, `Rs. ${(newR.grossTotalIncome || 0).toLocaleString('en-IN')}`],
                ['Standard Deduction', `Rs. ${(oldR.exemptions?.standardDeduction || 0).toLocaleString('en-IN')}`, `Rs. ${(newR.exemptions?.standardDeduction || 0).toLocaleString('en-IN')}`],
                ['HRA Exemption', `Rs. ${(oldR.exemptions?.hraExemption || 0).toLocaleString('en-IN')}`, 'Not Applicable'],
                ['Chapter VI-A Deductions', `Rs. ${(oldR.deductions?.total || 0).toLocaleString('en-IN')}`, `Rs. ${(newR.deductions?.total || 0).toLocaleString('en-IN')}`],
                ['Total Taxable Income', `Rs. ${(oldR.taxableIncome || 0).toLocaleString('en-IN')}`, `Rs. ${(newR.taxableIncome || 0).toLocaleString('en-IN')}`],
                ['Tax on Slab Rates', `Rs. ${(oldR.slabTax || 0).toLocaleString('en-IN')}`, `Rs. ${(newR.slabTax || 0).toLocaleString('en-IN')}`],
                ['Rebate u/s 87A', `Rs. ${(oldR.rebate87A || 0).toLocaleString('en-IN')}`, `Rs. ${(newR.rebate87A || 0).toLocaleString('en-IN')}`],
                ['Health & Education Cess (4%)', `Rs. ${(oldR.cess || 0).toLocaleString('en-IN')}`, `Rs. ${(newR.cess || 0).toLocaleString('en-IN')}`],
                ['Final Tax Payable', `Rs. ${(oldR.totalTax || 0).toLocaleString('en-IN')}`, `Rs. ${(newR.totalTax || 0).toLocaleString('en-IN')}`],
                ['Monthly Tax Liability', `Rs. ${(oldR.monthlyTax || 0).toLocaleString('en-IN')}`, `Rs. ${(newR.monthlyTax || 0).toLocaleString('en-IN')}`]
            ];

            rows.forEach(([label, oldVal, newVal]) => {
                const y = doc.y;
                doc.text(label, 50, y, { width: 220 });
                doc.text(oldVal, 280, y, { width: 120, align: 'right' });
                doc.text(newVal, 420, y, { width: 120, align: 'right' });
                doc.moveDown(0.2);
            });

            doc.moveDown(0.5);
            doc.strokeColor('#cbd5e1').moveTo(50, doc.y).lineTo(540, doc.y).stroke();
            doc.moveDown(0.8);

            // Recommendation
            doc.fillColor('#15803d').fontSize(11).text(`Recommendation: ${rec.recommendedRegime || 'New Tax Regime'}`, { bold: true });
            doc.fillColor('#334155').fontSize(10).text(rec.reason || 'Saves tax under selected regime.');
            doc.moveDown(1);

            // Footer
            doc.fontSize(8).fillColor('#94a3b8').text('Generated by Finance AI Tax Assistant - Compliant with Indian Income Tax Act.', { align: 'center' });

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

function generateFinancialReportPDF(user, summary, transactions) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 40, size: 'A4' });
            const buffers = [];

            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));

            doc.fillColor('#1e3a8a').fontSize(20).text('PERSONAL FINANCIAL REPORT', { align: 'center', bold: true });
            doc.moveDown(0.3);
            doc.fillColor('#475569').fontSize(10).text(`User: ${user.name} (${user.account}) | Date: ${new Date().toLocaleDateString('en-IN')}`, { align: 'center' });
            doc.moveDown(1);

            // Summary
            doc.fillColor('#0f172a').fontSize(12).text('1. Financial Summary', { underline: true });
            doc.fontSize(10).fillColor('#334155');
            doc.text(`Total Income: Rs. ${(summary.totalIncome || 0).toLocaleString('en-IN')}`);
            doc.text(`Total Expenses: Rs. ${(summary.totalExpense || 0).toLocaleString('en-IN')}`);
            doc.text(`Net Savings: Rs. ${(summary.netSavings || 0).toLocaleString('en-IN')}`);
            doc.text(`Savings Rate: ${summary.savingsRate || 0}%`);
            doc.moveDown(1);

            // Expense Category Breakdown
            doc.fillColor('#0f172a').fontSize(12).text('2. Expense Category Breakdown', { underline: true });
            doc.fontSize(10).fillColor('#334155');
            Object.entries(summary.categoryBreakdown || {}).forEach(([cat, amt]) => {
                doc.text(`- ${cat}: Rs. ${amt.toLocaleString('en-IN')}`);
            });
            doc.moveDown(1);

            // Recent Transactions
            doc.fillColor('#0f172a').fontSize(12).text('3. Recent Transactions', { underline: true });
            doc.moveDown(0.3);
            const yHead = doc.y;
            doc.text('Date', 50, yHead, { width: 80 });
            doc.text('Category', 140, yHead, { width: 100 });
            doc.text('Type', 250, yHead, { width: 80 });
            doc.text('Amount', 420, yHead, { width: 120, align: 'right' });
            doc.moveDown(0.3);
            doc.strokeColor('#cbd5e1').moveTo(50, doc.y).lineTo(540, doc.y).stroke();
            doc.moveDown(0.2);

            (transactions || []).slice(0, 15).forEach(t => {
                const y = doc.y;
                doc.text(new Date(t.date).toLocaleDateString('en-IN'), 50, y, { width: 80 });
                doc.text(t.category, 140, y, { width: 100 });
                doc.text(t.type.toUpperCase(), 250, y, { width: 80 });
                doc.text(`Rs. ${t.amount.toLocaleString('en-IN')}`, 420, y, { width: 120, align: 'right' });
                doc.moveDown(0.2);
            });

            doc.moveDown(1);
            doc.fontSize(8).fillColor('#94a3b8').text('Generated by Finance AI Personal Finance System.', { align: 'center' });

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

module.exports = {
    generateTaxReportPDF,
    generateFinancialReportPDF
};
