import { dateKey, lineTotal, type Business } from "./business";
import { shiftDay } from "./calendar";

export type ProfitPeriod = "today" | "week" | "30days" | "month" | "all";
export function profitRange(period: ProfitPeriod, today: string) {
  const from = period === "all" ? null : period === "today" ? today
    : period === "month" ? `${today.slice(0, 7)}-01`
    : shiftDay(today, period === "week" ? -6 : -29);
  return { from, to: today };
}

// This is a management report based on recorded costs, not a cash balance or
// a tax statement. Purchases enter stock; only the sold portion affects margin.
export function profitSummary(business: Business, period: ProfitPeriod, today = dateKey()) {
  const range = profitRange(period, today);
  const within = (timestamp: string) => {
    const day = dateKey(new Date(timestamp));
    return (!range.from || day >= range.from) && day <= range.to;
  };
  const sales = business.sales.filter((sale) => !sale.cancelled && within(sale.date));
  let revenue = 0;
  let knownCost = 0;
  let missingCostLines = 0;
  const missingCostNames = new Set<string>();
  for (const sale of sales) {
    revenue += sale.total;
    for (const item of sale.items) {
      // Never replace a historical line's cost with today's product cost.
      if (!Number.isSafeInteger(item.cost) || item.cost <= 0) {
        missingCostLines++;
        missingCostNames.add(item.name);
      } else knownCost += lineTotal(item.cost, item.quantity);
    }
  }
  const expenses = business.expenses.filter((expense) => within(expense.date));
  const fixedExpenses = expenses.filter((expense) => expense.category === "Fijo").reduce((sum, expense) => sum + expense.amount, 0);
  const variableExpenses = expenses.filter((expense) => expense.category === "Variable").reduce((sum, expense) => sum + expense.amount, 0);
  const pendingExpenses = expenses.filter((expense) => !expense.paid).reduce((sum, expense) => sum + expense.amount, 0);
  const totalExpenses = fixedExpenses + variableExpenses;
  const gross = missingCostLines ? null : revenue - knownCost;
  const net = gross === null ? null : gross - totalExpenses;
  const purchases = business.purchases.filter((purchase) => within(purchase.date));
  const purchased = purchases.reduce((sum, purchase) => sum + purchase.total, 0);
  const purchasePayments = business.payments.filter((payment) => payment.kind === "purchase" && within(payment.date)).reduce((sum, payment) => sum + payment.amount, 0);
  return {
    range, salesCount: sales.length, revenue, knownCost, missingCostLines,
    missingCostNames: [...missingCostNames], fixedExpenses, variableExpenses,
    pendingExpenses, totalExpenses, gross, net,
    loss: net === null ? null : Math.max(0, -net),
    purchased, purchasesCount: purchases.length, purchasePayments,
    hasActivity: sales.length > 0 || expenses.length > 0 || purchases.length > 0 || purchasePayments > 0,
  };
}
