const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const TaxProfile = require('../models/TaxProfile');
const LoanRecord = require('../models/LoanRecord');

async function getFinancialContext(userId) {
    const transactions = await Transaction.find({ userId }).sort({ date: -1 }).limit(100);
    const budgets = await Budget.find({ userId });
    const taxProfile = await TaxProfile.findOne({ userId }).sort({ updatedAt: -1 });
    const recentLoan = await LoanRecord.findOne({ userId }).sort({ createdAt: -1 });

    let totalIncome = 0;
    let totalExpense = 0;
    const expenseByCategory = {};

    transactions.forEach(t => {
        if (t.type === 'income') {
            totalIncome += t.amount;
        } else {
            totalExpense += t.amount;
            expenseByCategory[t.category] = (expenseByCategory[t.category] || 0) + t.amount;
        }
    });

    const netSavings = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? Number(((netSavings / totalIncome) * 100).toFixed(1)) : 0;

    return {
        totalIncome,
        totalExpense,
        netSavings,
        savingsRate,
        expenseByCategory,
        budgetsCount: budgets.length,
        hasTaxProfile: !!taxProfile,
        taxRecommendation: taxProfile?.results?.recommendation?.recommendedRegime || null,
        recentLoanEmi: recentLoan?.emi || null,
        recentLoanStatus: recentLoan?.affordabilityStatus || null
    };
}

async function askAIFinancialAssistant(userId, userMessage) {
    const context = await getFinancialContext(userId);
    const query = (userMessage || '').toLowerCase();

    // Rule-based contextual AI assistant analyzing actual authenticated financial records
    let reply = '';

    if (query.includes('tax') || query.includes('regime') || query.includes('80c')) {
        if (context.hasTaxProfile && context.taxRecommendation) {
            reply = `Based on your tax computation, the **${context.taxRecommendation}** is recommended. Remember to maximize Section 80C (up to ₹1,50,000) and Section 80D health insurance if you opt for the Old Regime.`;
        } else {
            reply = `You haven't calculated your income tax yet. Go to the Tax Assistant tab to enter your salary and see the exact comparison between Old and New regimes for FY 2024-25.`;
        }
    } else if (query.includes('spend') || query.includes('expense') || query.includes('budget')) {
        const topCategories = Object.entries(context.expenseByCategory)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([cat, amt]) => `${cat}: ₹${amt.toLocaleString('en-IN')}`)
            .join(', ');

        reply = `Your total recorded expenses are **₹${context.totalExpense.toLocaleString('en-IN')}**. ` +
            (topCategories ? `Top spending areas: ${topCategories}. ` : '') +
            (context.savingsRate < 20
                ? `Your current savings rate is ${context.savingsRate}%, which is below the recommended 20% benchmark. Try optimizing non-essential discretionary expenses.`
                : `Great job! Your savings rate is healthy at ${context.savingsRate}%.`);
    } else if (query.includes('loan') || query.includes('emi') || query.includes('afford')) {
        if (context.recentLoanEmi) {
            reply = `Your recent loan simulation indicated an EMI of ₹${context.recentLoanEmi.toLocaleString('en-IN')}/month with status: **${context.recentLoanStatus}**. Keep your total EMIs under 45-50% of your net monthly income (FOIR benchmark).`;
        } else {
            reply = `To assess loan affordability, use the Loan Assistant card. Ensure your total EMIs do not exceed 40-50% of your disposable monthly income.`;
        }
    } else if (query.includes('save') || query.includes('invest') || query.includes('fd')) {
        reply = `Financial rule of thumb: 50% for Needs, 30% for Wants, and 20% for Savings/Investments. With net savings of ₹${context.netSavings.toLocaleString('en-IN')}, consider starting an emergency fund in Fixed Deposits (currently yielding ~7-7.5%) or tax-advantaged instruments like PPF / ELSS.`;
    } else {
        reply = `Hello! Based on your financial records:
• Recorded Income: ₹${context.totalIncome.toLocaleString('en-IN')}
• Recorded Expenses: ₹${context.totalExpense.toLocaleString('en-IN')}
• Net Savings: ₹${context.netSavings.toLocaleString('en-IN')} (${context.savingsRate}% savings rate)
${context.taxRecommendation ? `• Tax Advice: Opt for ${context.taxRecommendation}\n` : ''}
Ask me about your taxes, spending breakdown, budget health, or loan feasibility!`;
    }

    return reply;
}

module.exports = {
    getFinancialContext,
    askAIFinancialAssistant
};
