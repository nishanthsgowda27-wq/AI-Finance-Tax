// ==========================================
// Finance AI - Complete Client Application Controller
// ==========================================

const API_BASE = '/api';
let token = localStorage.getItem('finance_token') || '';
let currentUser = JSON.parse(localStorage.getItem('finance_user') || 'null');

let overviewPieInstance = null;
let reportsPieInstance = null;
let reportsBarInstance = null;

// Ensure authentication
function checkAuth() {
    if (!token && !window.location.pathname.includes('login') && !window.location.pathname.includes('index')) {
        window.location.href = 'login.html';
        return false;
    }
    if (currentUser) {
        const sideName = document.getElementById('sideUserName');
        const sideRole = document.getElementById('sideUserRole');
        const avatar = document.getElementById('avatarInitial');
        if (sideName) sideName.innerText = currentUser.name || currentUser.account;
        if (sideRole) sideRole.innerText = (currentUser.job ? currentUser.job.toUpperCase() : 'SALARIED') + ' TAXPAYER';
        if (avatar) avatar.innerText = (currentUser.name || currentUser.account || 'U').charAt(0).toUpperCase();
    }
    return true;
}

function getAuthHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
    };
}

function logout() {
    localStorage.removeItem('finance_token');
    localStorage.removeItem('finance_user');
    window.location.href = 'login.html';
}

// ==========================================
// NAVIGATION CONTROLLER
// ==========================================

const VIEW_TITLES = {
    overview: { title: 'Dashboard Overview', sub: 'Welcome back to your personal financial hub' },
    tax: { title: 'Indian Tax Assistant', sub: 'Official Old vs New Regime calculation for FY 2024-25' },
    transactions: { title: 'Transaction Records', sub: 'Add, review, and filter your monthly cashflows' },
    budgets: { title: 'Budget Planner', sub: 'Set category targets and maintain the 50/30/20 rule' },
    loans: { title: 'Loan & Credit Assistant', sub: 'FOIR, CIBIL score affordability, and amortization schedules' },
    fd: { title: 'Fixed Deposit (FD) Assistant', sub: 'Quarterly compounding growth and TDS estimation' },
    vehicle: { title: 'Vehicle Finance', sub: 'Loan EMIs and Indian cars & bikes recommendations' },
    ai: { title: 'AI Finance Copilot', sub: 'Context-aware intelligence reading your database records' },
    reports: { title: 'Analytics & Statements', sub: 'Visual reports and downloadable official PDF records' }
};

function navigate(viewName) {
    const views = ['overview', 'tax', 'transactions', 'budgets', 'loans', 'fd', 'vehicle', 'ai', 'reports'];
    views.forEach(v => {
        const el = document.getElementById(`view-${v}`);
        if (el) el.style.display = (v === viewName) ? 'block' : 'none';
    });

    // Update Sidebar active state
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('onclick')?.includes(viewName)) {
            btn.classList.add('active');
        }
    });

    // Update Header
    const heading = document.getElementById('viewHeading');
    const subheading = document.getElementById('viewSubheading');
    if (heading && VIEW_TITLES[viewName]) heading.innerText = VIEW_TITLES[viewName].title;
    if (subheading && VIEW_TITLES[viewName]) subheading.innerText = VIEW_TITLES[viewName].sub;

    // View-specific data triggers
    if (viewName === 'overview') {
        updateIncomeOverview();
        loadTransactions();
    } else if (viewName === 'tax') {
        computeFullTax();
    } else if (viewName === 'transactions') {
        loadTransactions();
    } else if (viewName === 'budgets') {
        loadBudgets();
    } else if (viewName === 'loans') {
        calculateFullLoan();
    } else if (viewName === 'fd') {
        calculateFDLive();
    } else if (viewName === 'vehicle') {
        calculateVehicleLive();
    } else if (viewName === 'reports') {
        renderReportsCharts();
    }
}

// ==========================================
// 1. OVERVIEW & INCOME
// ==========================================

async function updateIncomeOverview() {
    const incInput = document.getElementById('income');
    const income = Number(incInput ? incInput.value : 1200000) || 1200000;
    const monthly = Math.round(income / 12);

    // Update KPI cards
    const kpiGross = document.getElementById('kpiGrossIncome');
    const kpiMonthly = document.getElementById('kpiMonthlyIncome');
    if (kpiGross) kpiGross.innerText = `₹${income.toLocaleString('en-IN')}`;
    if (kpiMonthly) kpiMonthly.innerText = `₹${monthly.toLocaleString('en-IN')} / month`;

    // 50/30/20 calculation
    const needs = Math.round(monthly * 0.50);
    const wants = Math.round(monthly * 0.30);
    const savings = Math.round(monthly * 0.20);

    const bNeeds = document.getElementById('budgetNeeds');
    const bWants = document.getElementById('budgetWants');
    const bSavings = document.getElementById('budgetSavings');
    if (bNeeds) bNeeds.innerText = `₹${needs.toLocaleString('en-IN')}`;
    if (bWants) bWants.innerText = `₹${wants.toLocaleString('en-IN')}`;
    if (bSavings) bSavings.innerText = `₹${savings.toLocaleString('en-IN')}`;

    // Quick Tax Snapshot
    try {
        const res = await fetch(`${API_BASE}/tax`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ annualSalary: income })
        });
        const d = await res.json();
        const newTax = d.newRegime?.totalTax || 0;
        const oldTax = d.oldRegime?.totalTax || 0;

        const kpiTax = document.getElementById('kpiTaxEst');
        const kpiTaxM = document.getElementById('kpiMonthlyTax');
        const qNew = document.getElementById('quickNewTax');
        const qNewM = document.getElementById('quickNewMonthly');
        const qOld = document.getElementById('quickOldTax');
        const qOldM = document.getElementById('quickOldMonthly');
        const qRec = document.getElementById('quickTaxRecommendation');

        if (kpiTax) kpiTax.innerText = `₹${newTax.toLocaleString('en-IN')}`;
        if (kpiTaxM) kpiTaxM.innerText = `₹${Math.round(newTax / 12).toLocaleString('en-IN')} / month`;
        if (qNew) qNew.innerText = `₹${newTax.toLocaleString('en-IN')}`;
        if (qNewM) qNewM.innerText = `₹${Math.round(newTax / 12).toLocaleString('en-IN')}/mo`;
        if (qOld) qOld.innerText = `₹${oldTax.toLocaleString('en-IN')}`;
        if (qOldM) qOldM.innerText = `₹${Math.round(oldTax / 12).toLocaleString('en-IN')}/mo`;

        if (qRec) {
            const savingsAmt = Math.abs(oldTax - newTax);
            const winner = oldTax > newTax ? 'New Tax Regime' : 'Old Tax Regime';
            qRec.innerHTML = `🏆 Recommendation: ${winner} saves ₹${savingsAmt.toLocaleString('en-IN')}`;
        }
    } catch (e) {
        console.error('Quick tax calc error:', e);
    }
}

// ==========================================
// 2. INDIAN TAX ASSISTANT ENGINE
// ==========================================

async function computeFullTax() {
    const payload = {
        financialYear: document.getElementById('taxFY')?.value || '2024-2025',
        ageCategory: document.getElementById('taxAge')?.value || 'general',
        employmentType: document.getElementById('taxEmpType')?.value || 'salaried',
        annualSalary: Number(document.getElementById('taxSalary')?.value) || 0,
        basicSalary: Number(document.getElementById('taxBasic')?.value) || 0,
        hraReceived: Number(document.getElementById('taxHRA')?.value) || 0,
        rentPaid: Number(document.getElementById('taxRent')?.value) || 0,
        isMetro: document.getElementById('taxMetro')?.value === 'true',
        otherIncome: Number(document.getElementById('taxOther')?.value) || 0,
        sec80C: Number(document.getElementById('tax80C')?.value) || 0,
        sec80D_self: Number(document.getElementById('tax80D_self')?.value) || 0,
        sec80D_parents: Number(document.getElementById('tax80D_parents')?.value) || 0,
        sec80CCD_1B: Number(document.getElementById('tax80CCD')?.value) || 0,
        homeLoanInterest: Number(document.getElementById('taxHomeLoan')?.value) || 0,
        tdsPaid: Number(document.getElementById('taxTDS')?.value) || 0
    };

    try {
        const res = await fetch(`${API_BASE}/tax/calculate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const d = await res.json();
        if (!d.success) return;

        const oldR = d.oldRegime;
        const newR = d.newRegime;
        const rec = d.recommendation;

        // Populate Cards
        const dispOldTax = document.getElementById('dispOldTax');
        const dispOldMonthly = document.getElementById('dispOldMonthly');
        const dispOldStd = document.getElementById('dispOldStd');
        const dispOldHRA = document.getElementById('dispOldHRA');
        const dispOldDed = document.getElementById('dispOldDed');
        const dispOldTaxable = document.getElementById('dispOldTaxable');

        const dispNewTax = document.getElementById('dispNewTax');
        const dispNewMonthly = document.getElementById('dispNewMonthly');
        const dispNewStd = document.getElementById('dispNewStd');
        const dispNewRebate = document.getElementById('dispNewRebate');
        const dispNewMarginal = document.getElementById('dispNewMarginal');
        const dispNewTaxable = document.getElementById('dispNewTaxable');

        if (dispOldTax) dispOldTax.innerText = `₹${oldR.totalTax.toLocaleString('en-IN')}`;
        if (dispOldMonthly) dispOldMonthly.innerText = `₹${oldR.monthlyTax.toLocaleString('en-IN')} / month`;
        if (dispOldStd) dispOldStd.innerText = `₹${oldR.exemptions.standardDeduction.toLocaleString('en-IN')}`;
        if (dispOldHRA) dispOldHRA.innerText = `₹${oldR.exemptions.hraExemption.toLocaleString('en-IN')}`;
        if (dispOldDed) dispOldDed.innerText = `₹${oldR.deductions.total.toLocaleString('en-IN')}`;
        if (dispOldTaxable) dispOldTaxable.innerText = `₹${oldR.taxableIncome.toLocaleString('en-IN')}`;

        if (dispNewTax) dispNewTax.innerText = `₹${newR.totalTax.toLocaleString('en-IN')}`;
        if (dispNewMonthly) dispNewMonthly.innerText = `₹${newR.monthlyTax.toLocaleString('en-IN')} / month`;
        if (dispNewStd) dispNewStd.innerText = `₹${newR.exemptions.standardDeduction.toLocaleString('en-IN')}`;
        if (dispNewRebate) dispNewRebate.innerText = `₹${newR.rebate87A.toLocaleString('en-IN')}`;
        if (dispNewMarginal) dispNewMarginal.innerText = `₹${newR.marginalRelief.toLocaleString('en-IN')}`;
        if (dispNewTaxable) dispNewTaxable.innerText = `₹${newR.taxableIncome.toLocaleString('en-IN')}`;

        // Winner Card Highlight
        const cardOld = document.getElementById('cardOldRegime');
        const cardNew = document.getElementById('cardNewRegime');
        const ribbon = document.getElementById('winnerRibbon');

        if (rec.recommendedRegime.includes('Old')) {
            cardOld.classList.add('recommended');
            cardNew.classList.remove('recommended');
            if (ribbon) cardOld.appendChild(ribbon);
        } else {
            cardNew.classList.add('recommended');
            cardOld.classList.remove('recommended');
            if (ribbon) cardNew.appendChild(ribbon);
        }

        // Detailed Table Rows
        const tbody = document.getElementById('detailedTaxTableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr><td><strong>Gross Total Income</strong></td><td>₹${oldR.grossTotalIncome.toLocaleString('en-IN')}</td><td>₹${newR.grossTotalIncome.toLocaleString('en-IN')}</td></tr>
                <tr><td>Standard Deduction</td><td>₹${oldR.exemptions.standardDeduction.toLocaleString('en-IN')}</td><td>₹${newR.exemptions.standardDeduction.toLocaleString('en-IN')}</td></tr>
                <tr><td>HRA Exemption u/s 10(13A)</td><td>₹${oldR.exemptions.hraExemption.toLocaleString('en-IN')}</td><td>Not Applicable</td></tr>
                <tr><td>Chapter VI-A Deductions (80C, 80D, 80CCD)</td><td>₹${oldR.deductions.total.toLocaleString('en-IN')}</td><td>₹${newR.deductions.total.toLocaleString('en-IN')}</td></tr>
                <tr><td><strong>Net Taxable Income</strong></td><td><strong>₹${oldR.taxableIncome.toLocaleString('en-IN')}</strong></td><td><strong>₹${newR.taxableIncome.toLocaleString('en-IN')}</strong></td></tr>
                <tr><td>Tax Computed on Slabs</td><td>₹${oldR.slabTax.toLocaleString('en-IN')}</td><td>₹${newR.slabTax.toLocaleString('en-IN')}</td></tr>
                <tr><td>Section 87A Rebate</td><td>₹${oldR.rebate87A.toLocaleString('en-IN')}</td><td>₹${newR.rebate87A.toLocaleString('en-IN')}</td></tr>
                <tr><td>Marginal Relief u/s 87A</td><td>Not Applicable</td><td>₹${newR.marginalRelief.toLocaleString('en-IN')}</td></tr>
                <tr><td>Health & Education Cess (4%)</td><td>₹${oldR.cess.toLocaleString('en-IN')}</td><td>₹${newR.cess.toLocaleString('en-IN')}</td></tr>
                <tr style="background:#f1f5f9;font-weight:800;">
                    <td>Final Tax Payable</td>
                    <td style="color:${rec.recommendedRegime.includes('Old')?'#10b981':'#0f172a'};font-size:1.05rem;">₹${oldR.totalTax.toLocaleString('en-IN')}</td>
                    <td style="color:${rec.recommendedRegime.includes('New')?'#10b981':'#0f172a'};font-size:1.05rem;">₹${newR.totalTax.toLocaleString('en-IN')}</td>
                </tr>
            `;
        }

        // Advance Tax Schedule
        const advContent = document.getElementById('advanceTaxContent');
        if (advContent) {
            if (d.advanceTax && d.advanceTax.advanceTaxRequired) {
                advContent.innerHTML = `<strong>Advance Tax is mandatory</strong> (Net liability after TDS exceeds ₹10,000):<br>` +
                    d.advanceTax.schedule.map(s => `• <strong>${s.dueDate}</strong> (${s.cumulativePercent}%): ₹${s.installmentTax.toLocaleString('en-IN')}`).join('<br>');
            } else {
                advContent.innerHTML = `No advance tax required. Total tax liability after TDS is below the statutory ₹10,000 threshold.`;
            }
        }

        // Tax Tips
        const tipsContent = document.getElementById('taxSavingTipsContent');
        if (tipsContent) {
            tipsContent.innerHTML = (d.suggestions && d.suggestions.length > 0)
                ? d.suggestions.map(s => `• <strong>${s.section}:</strong> ${s.message}`).join('<br>')
                : `Your 80C, 80D, and NPS tax exemptions are fully utilized!`;
        }
    } catch (e) {
        console.error('Tax engine error:', e);
    }
}

async function saveTaxProfile() {
    const payload = {
        financialYear: document.getElementById('taxFY')?.value || '2024-2025',
        ageCategory: document.getElementById('taxAge')?.value || 'general',
        employmentType: document.getElementById('taxEmpType')?.value || 'salaried',
        annualSalary: Number(document.getElementById('taxSalary')?.value) || 0,
        basicSalary: Number(document.getElementById('taxBasic')?.value) || 0,
        hraReceived: Number(document.getElementById('taxHRA')?.value) || 0,
        rentPaid: Number(document.getElementById('taxRent')?.value) || 0,
        isMetro: document.getElementById('taxMetro')?.value === 'true',
        otherIncome: Number(document.getElementById('taxOther')?.value) || 0,
        sec80C: Number(document.getElementById('tax80C')?.value) || 0,
        sec80D_self: Number(document.getElementById('tax80D_self')?.value) || 0,
        sec80D_parents: Number(document.getElementById('tax80D_parents')?.value) || 0,
        sec80CCD_1B: Number(document.getElementById('tax80CCD')?.value) || 0,
        homeLoanInterest: Number(document.getElementById('taxHomeLoan')?.value) || 0,
        tdsPaid: Number(document.getElementById('taxTDS')?.value) || 0
    };

    try {
        const res = await fetch(`${API_BASE}/tax/save`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });
        const d = await res.json();
        if (d.success) alert('✅ Tax profile saved successfully to MongoDB!');
        else alert('Error: ' + d.message);
    } catch (e) {
        alert('Save error: ' + e.message);
    }
}

function downloadTaxPDF() {
    const url = `${API_BASE}/tax/download-pdf?token=${encodeURIComponent(token)}`;
    window.open(url, '_blank');
}

function downloadFinancialPDF() {
    const url = `${API_BASE}/reports/download-pdf?token=${encodeURIComponent(token)}`;
    window.open(url, '_blank');
}

// ==========================================
// 3. TRANSACTIONS CRUD
// ==========================================

async function loadTransactions() {
    try {
        const res = await fetch(`${API_BASE}/transactions`, { headers: getAuthHeaders() });
        const d = await res.json();
        const txs = d.transactions || [];

        // Update Overview KPIs
        let totalExpense = 0;
        let totalIncome = 0;
        const catMap = {};

        txs.forEach(t => {
            if (t.type === 'income') totalIncome += t.amount;
            else {
                totalExpense += t.amount;
                catMap[t.category] = (catMap[t.category] || 0) + t.amount;
            }
        });

        const grossIncomeVal = Number(document.getElementById('income')?.value) || 1200000;
        const netSavingsVal = grossIncomeVal - totalExpense;
        const rateVal = grossIncomeVal > 0 ? ((netSavingsVal / grossIncomeVal) * 100).toFixed(1) : 100;

        const kpiExp = document.getElementById('kpiTotalExpense');
        const kpiExpC = document.getElementById('kpiExpenseCount');
        const kpiNet = document.getElementById('kpiNetSavings');
        const kpiRate = document.getElementById('kpiSavingsRate');

        if (kpiExp) kpiExp.innerText = `₹${totalExpense.toLocaleString('en-IN')}`;
        if (kpiExpC) kpiExpC.innerText = `${txs.length} transactions logged`;
        if (kpiNet) kpiNet.innerText = `₹${netSavingsVal.toLocaleString('en-IN')}`;
        if (kpiRate) kpiRate.innerText = `Savings Rate: ${rateVal}%`;

        // Render Recent in Overview
        const overviewTbody = document.getElementById('overviewTxTableBody');
        if (overviewTbody) {
            overviewTbody.innerHTML = '';
            if (txs.length === 0) {
                overviewTbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#64748b;">No transactions recorded yet.</td></tr>`;
            } else {
                txs.slice(0, 5).forEach(t => {
                    const dateStr = new Date(t.date).toLocaleDateString('en-IN');
                    const color = t.type === 'income' ? '#10b981' : '#ef4444';
                    overviewTbody.innerHTML += `
                        <tr>
                            <td>${dateStr}</td>
                            <td><strong>${t.category}</strong></td>
                            <td>${t.description || '-'}</td>
                            <td><span class="badge badge-blue">${t.paymentMethod || 'UPI'}</span></td>
                            <td style="text-align:right;font-weight:700;color:${color};">₹${t.amount.toLocaleString('en-IN')}</td>
                        </tr>
                    `;
                });
            }
        }

        // Render Full Log in Transactions Tab
        const fullTbody = document.getElementById('txFullTableBody');
        if (fullTbody) {
            fullTbody.innerHTML = '';
            if (txs.length === 0) {
                fullTbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#64748b;">No transactions found. Add your first transaction above!</td></tr>`;
            } else {
                txs.forEach(t => {
                    const dateStr = new Date(t.date).toLocaleDateString('en-IN');
                    const typeBadge = t.type === 'income' ? '<span class="badge badge-green">INCOME</span>' : '<span class="badge badge-red">EXPENSE</span>';
                    fullTbody.innerHTML += `
                        <tr>
                            <td>${dateStr}</td>
                            <td>${typeBadge}</td>
                            <td><strong>${t.category}</strong></td>
                            <td>${t.description || '-'}</td>
                            <td>${t.paymentMethod || 'UPI'}</td>
                            <td style="font-weight:700;">₹${t.amount.toLocaleString('en-IN')}</td>
                            <td><button onclick="deleteTransaction('${t._id}')" class="btn-pill" style="background:#fee2e2;color:#991b1b;padding:4px 8px;font-size:0.75rem;">Delete</button></td>
                        </tr>
                    `;
                });
            }
        }

        // Render Pie Chart
        renderOverviewPieChart(catMap);
    } catch (e) {
        console.error('Load transactions error:', e);
    }
}

async function saveTransaction() {
    const type = document.getElementById('txType')?.value || 'expense';
    const category = document.getElementById('txCategory')?.value || 'Food';
    const amount = Number(document.getElementById('txAmount')?.value);
    const description = document.getElementById('txDesc')?.value || '';
    const paymentMethod = document.getElementById('txPayment')?.value || 'UPI';

    if (!amount || amount <= 0) return alert('Please enter a valid amount');

    try {
        const res = await fetch(`${API_BASE}/transactions`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ type, category, amount, description, paymentMethod })
        });
        const d = await res.json();
        if (d.success) {
            if (document.getElementById('txAmount')) document.getElementById('txAmount').value = '';
            if (document.getElementById('txDesc')) document.getElementById('txDesc').value = '';
            loadTransactions();
            loadBudgets();
            alert('✅ Transaction saved to MongoDB!');
        } else {
            alert('Error: ' + d.message);
        }
    } catch (e) {
        alert('Transaction error: ' + e.message);
    }
}

async function deleteTransaction(id) {
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    try {
        const res = await fetch(`${API_BASE}/transactions/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        const d = await res.json();
        if (d.success) {
            loadTransactions();
            loadBudgets();
        }
    } catch (e) {
        alert('Delete failed: ' + e.message);
    }
}

function renderOverviewPieChart(catMap) {
    const ctx = document.getElementById('overviewPieChart')?.getContext('2d');
    if (!ctx) return;

    const labels = Object.keys(catMap).length > 0 ? Object.keys(catMap) : ['Food', 'Travel', 'Rent', 'Shopping', 'Utilities'];
    const data = Object.keys(catMap).length > 0 ? Object.values(catMap) : [12000, 4500, 20000, 8000, 3500];

    if (overviewPieInstance) overviewPieInstance.destroy();
    overviewPieInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } }
        }
    });
}

// ==========================================
// 4. BUDGET PLANNER
// ==========================================

async function loadBudgets() {
    try {
        const res = await fetch(`${API_BASE}/budgets`, { headers: getAuthHeaders() });
        const d = await res.json();
        const container = document.getElementById('budgetsFullContainer');
        if (!container) return;

        container.innerHTML = '';
        const budgets = d.budgets || [];
        if (budgets.length === 0) {
            container.innerHTML = `<div style="color:#64748b;font-size:0.9rem;">No category budget limits set yet. Add one on the left!</div>`;
            return;
        }

        budgets.forEach(b => {
            const fillWidth = Math.min(100, b.percentUsed);
            const fillColor = b.isOverBudget ? '#ef4444' : (b.percentUsed > 75 ? '#f59e0b' : '#2563eb');
            const statusBadge = b.isOverBudget ? '<span class="badge badge-red">EXCEEDED</span>'
                : (b.percentUsed > 75 ? '<span class="badge badge-amber">WARNING</span>' : '<span class="badge badge-green">HEALTHY</span>');

            container.innerHTML += `
                <div style="padding:16px;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                        <div><strong style="font-size:0.95rem;">${b.category}</strong> ${statusBadge}</div>
                        <div style="font-size:0.9rem;font-weight:700;">₹${b.spent.toLocaleString('en-IN')} / ₹${b.monthlyLimit.toLocaleString('en-IN')} (${b.percentUsed}%)</div>
                    </div>
                    <div style="height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden;">
                        <div style="height:100%;width:${fillWidth}%;background:${fillColor};border-radius:4px;"></div>
                    </div>
                    <div style="display:flex;justify-content:space-between;font-size:0.75rem;color:#64748b;margin-top:6px;">
                        <span>Spent: ₹${b.spent.toLocaleString('en-IN')}</span>
                        <span>Remaining: ₹${b.remaining.toLocaleString('en-IN')}</span>
                    </div>
                </div>
            `;
        });
    } catch (e) {
        console.error('Load budgets error:', e);
    }
}

async function setBudget() {
    const category = document.getElementById('bgCategory')?.value;
    const monthlyLimit = Number(document.getElementById('bgLimit')?.value);
    if (!monthlyLimit || monthlyLimit <= 0) return alert('Enter a valid budget limit');

    try {
        const res = await fetch(`${API_BASE}/budgets`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ category, monthlyLimit })
        });
        const d = await res.json();
        if (d.success) {
            document.getElementById('bgLimit').value = '';
            loadBudgets();
            alert('✅ Budget target saved!');
        }
    } catch (e) {
        alert('Error setting budget: ' + e.message);
    }
}

// ==========================================
// 5. LOAN & FOIR ASSISTANT
// ==========================================

async function calculateFullLoan() {
    const payload = {
        loanType: document.getElementById('loanType')?.value || 'personal',
        monthlyIncome: Number(document.getElementById('loanIncome')?.value) || 80000,
        monthlyExpenses: Number(document.getElementById('loanExpenses')?.value) || 30000,
        existingEmis: Number(document.getElementById('loanExistingEmis')?.value) || 5000,
        creditScore: Number(document.getElementById('loanCredit')?.value) || 780,
        requestedAmount: Number(document.getElementById('loanAmount')?.value) || 500000,
        interestRate: Number(document.getElementById('loanRate')?.value) || 10.5,
        tenureMonths: Number(document.getElementById('loanTenure')?.value) || 36
    };

    try {
        const res = await fetch(`${API_BASE}/loan/assess`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const d = await res.json();

        const resEmi = document.getElementById('resEmi');
        const resTotalPayment = document.getElementById('resTotalPayment');
        const resTotalInterest = document.getElementById('resTotalInterest');
        const resFoir = document.getElementById('resFoir');
        const resAllowable = document.getElementById('resAllowableFoir');
        const resStatus = document.getElementById('resStatus');
        const resDisposable = document.getElementById('resDisposable');
        const adviceBox = document.getElementById('loanAdviceBox');

        if (resEmi) resEmi.innerText = `₹${d.emi.toLocaleString('en-IN')}`;
        if (resTotalPayment) resTotalPayment.innerText = `Total: ₹${d.totalPayment.toLocaleString('en-IN')}`;
        if (resTotalInterest) resTotalInterest.innerText = `₹${d.totalInterest.toLocaleString('en-IN')}`;
        if (resFoir) resFoir.innerText = `${d.foir}%`;
        if (resAllowable) resAllowable.innerText = `Allowable benchmark: ${d.allowableFoir}%`;
        if (resStatus) resStatus.innerText = d.affordabilityStatus;
        if (resDisposable) resDisposable.innerText = `Disposable: ₹${d.disposableIncome.toLocaleString('en-IN')}`;

        if (adviceBox) {
            adviceBox.innerHTML = `<strong>Bank Assessment:</strong> ${d.assessmentAdvice} ` +
                (d.categoryDetails ? `<br><strong>Scheme Details:</strong> ${d.categoryDetails.taxBenefits} ${d.categoryDetails.specialSchemes}` : '');
        }
    } catch (e) {
        console.error('Loan calculation error:', e);
    }
}

async function toggleAmortization() {
    const wrap = document.getElementById('amortizationWrap');
    if (!wrap) return;

    if (wrap.style.display === 'block') {
        wrap.style.display = 'none';
        return;
    }

    const principal = Number(document.getElementById('loanAmount')?.value) || 500000;
    const annualRate = Number(document.getElementById('loanRate')?.value) || 10.5;
    const tenureMonths = Number(document.getElementById('loanTenure')?.value) || 36;

    try {
        const res = await fetch(`${API_BASE}/loan/amortization`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ principal, annualRate, tenureMonths })
        });
        const d = await res.json();
        const tbody = document.getElementById('amortScheduleBody');
        tbody.innerHTML = '';

        (d.schedule || []).slice(0, 24).forEach(r => {
            tbody.innerHTML += `
                <tr>
                    <td>Month ${r.month}</td>
                    <td>₹${r.emi.toLocaleString('en-IN')}</td>
                    <td>₹${r.principalPaid.toLocaleString('en-IN')}</td>
                    <td>₹${r.interestPaid.toLocaleString('en-IN')}</td>
                    <td>₹${r.remainingBalance.toLocaleString('en-IN')}</td>
                </tr>
            `;
        });
        wrap.style.display = 'block';
    } catch (e) {
        console.error(e);
    }
}

// ==========================================
// 6. FD CALCULATOR & SCENARIOS
// ==========================================

async function calculateFDLive() {
    const principal = Number(document.getElementById('fdPrincipal')?.value) || 200000;
    const annualRate = Number(document.getElementById('fdInterestRate')?.value) || 7.5;
    const tenureYears = Number(document.getElementById('fdTenureYears')?.value) || 2;
    const isSeniorCitizen = document.getElementById('fdSeniorCitizen')?.checked || false;

    try {
        const res = await fetch(`${API_BASE}/fd/calculate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                principal,
                annualRate,
                tenureMonths: tenureYears * 12,
                compounding: 'quarterly',
                isCumulative: true,
                isSeniorCitizen
            })
        });
        const d = await res.json();

        const dispInv = document.getElementById('fdDispInvest');
        const dispInt = document.getElementById('fdDispInterest');
        const dispMat = document.getElementById('fdDispMaturity');
        const tdsAlert = document.getElementById('fdTdsAlert');

        if (dispInv) dispInv.innerText = `₹${d.principal.toLocaleString('en-IN')}`;
        if (dispInt) dispInt.innerText = `₹${d.totalInterest.toLocaleString('en-IN')}`;
        if (dispMat) dispMat.innerText = `₹${d.maturityAmount.toLocaleString('en-IN')}`;
        if (tdsAlert) tdsAlert.style.display = d.tdsApplicable ? 'block' : 'none';

        // Load Scenarios
        const compRes = await fetch(`${API_BASE}/fd/compare`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ principal, rate: annualRate, isSeniorCitizen })
        });
        const compData = await compRes.json();
        const scBody = document.getElementById('fdScenariosTableBody');
        if (scBody && compData.scenarios) {
            scBody.innerHTML = '';
            compData.scenarios.forEach(s => {
                scBody.innerHTML += `
                    <tr>
                        <td><strong>${s.label}</strong></td>
                        <td>${s.effectiveRate}%</td>
                        <td>₹${s.totalInterest.toLocaleString('en-IN')}</td>
                        <td style="font-weight:700;color:#10b981;">₹${s.maturityAmount.toLocaleString('en-IN')}</td>
                    </tr>
                `;
            });
        }
    } catch (e) {
        console.error(e);
    }
}

// ==========================================
// 7. VEHICLE FINANCE
// ==========================================

async function calculateVehicleLive() {
    const payload = {
        vehiclePrice: Number(document.getElementById('vehPrice')?.value) || 850000,
        downPayment: Number(document.getElementById('vehDown')?.value) || 170000,
        interestRate: Number(document.getElementById('vehRate')?.value) || 9.5,
        tenureMonths: Number(document.getElementById('vehTenure')?.value) || 60,
        monthlyIncome: 80000
    };

    try {
        const res = await fetch(`${API_BASE}/vehicle/calculate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const d = await res.json();

        const vLoan = document.getElementById('vehLoanAmt');
        const vDown = document.getElementById('vehDownRatio');
        const vEmi = document.getElementById('vehEmi');
        const vInt = document.getElementById('vehTotalInterest');
        const vCost = document.getElementById('vehTotalCost');

        if (vLoan) vLoan.innerText = `₹${d.loanAmount.toLocaleString('en-IN')}`;
        if (vDown) vDown.innerText = `${d.downPaymentRatio}% Down Payment`;
        if (vEmi) vEmi.innerText = `₹${d.emi.toLocaleString('en-IN')}`;
        if (vInt) vInt.innerText = `₹${d.totalInterest.toLocaleString('en-IN')}`;
        if (vCost) vCost.innerText = `Total Out of Pocket: ₹${d.totalCost.toLocaleString('en-IN')}`;
    } catch (e) {
        console.error(e);
    }
}

// ==========================================
// 8. AI FINANCIAL COPILOT
// ==========================================

function askPrompt(q) {
    const input = document.getElementById('aiChatQuery');
    if (input) {
        input.value = q;
        sendAIChat();
    }
}

async function sendAIChat() {
    const input = document.getElementById('aiChatQuery');
    const msg = input.value.trim();
    if (!msg) return;

    const stream = document.getElementById('aiChatStream');
    stream.innerHTML += `<div class="chat-bubble user">${msg}</div>`;
    input.value = '';
    stream.scrollTop = stream.scrollHeight;

    try {
        const res = await fetch(`${API_BASE}/ai/chat`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ message: msg })
        });
        const d = await res.json();
        const reply = d.reply || 'Analysis complete. Maintain your savings rate above 20%!';
        stream.innerHTML += `<div class="chat-bubble bot">${reply}</div>`;
    } catch (e) {
        stream.innerHTML += `<div class="chat-bubble bot">Indian Tax Advisory rule: In FY 2024-25, the New Tax Regime offers a standard deduction of ₹75,000 and zero tax up to ₹7,00,000. For salaries above ₹15L, compare deductions under 80C, 80D, and NPS.</div>`;
    }
    stream.scrollTop = stream.scrollHeight;
}

// ==========================================
// 9. REPORTS & STATEMENTS
// ==========================================

async function renderReportsCharts() {
    try {
        const res = await fetch(`${API_BASE}/reports/analytics`, { headers: getAuthHeaders() });
        const d = await res.json();
        const catMap = d.categoryBreakdown || { Food: 15000, Rent: 25000, Travel: 6000, Shopping: 8000, Utilities: 4000 };

        const labels = Object.keys(catMap);
        const data = Object.values(catMap);

        // Pie Chart
        const pieCtx = document.getElementById('reportsPieChart')?.getContext('2d');
        if (pieCtx) {
            if (reportsPieInstance) reportsPieInstance.destroy();
            reportsPieInstance = new Chart(pieCtx, {
                type: 'pie',
                data: {
                    labels,
                    datasets: [{ data, backgroundColor: ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'] }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }

        // Bar Chart
        const barCtx = document.getElementById('reportsBarChart')?.getContext('2d');
        if (barCtx) {
            if (reportsBarInstance) reportsBarInstance.destroy();
            reportsBarInstance = new Chart(barCtx, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [{ label: 'Expenditure (₹)', data, backgroundColor: '#2563eb' }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }
    } catch (e) {
        console.error(e);
    }
}

// Initialize on DOM Ready
window.addEventListener('DOMContentLoaded', () => {
    if (checkAuth()) {
        navigate('overview');
    }
});
