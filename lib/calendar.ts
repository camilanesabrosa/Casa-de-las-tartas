import { dateKey, type Business } from "./business";

export type CalendarMode = "month" | "week";
export type DayBalance = {
  date: string;
  sales: number;
  salesCount: number;
  deposits: number;
  withdrawals: number;
  purchases: number;
  expenses: number;
  income: number;
  outgoing: number;
  balance: number;
  entries: number;
  registers: Business["registers"];
};

export function emptyDay(date: string): DayBalance {
  return {
    date,
    sales: 0,
    salesCount: 0,
    deposits: 0,
    withdrawals: 0,
    purchases: 0,
    expenses: 0,
    income: 0,
    outgoing: 0,
    balance: 0,
    entries: 0,
    registers: [],
  };
}

// Payments use their actual payment date, not the date a debt was created.
// Opening a register declares existing funds; it is never counted as income.
export function dailyBalances(business: Business): Map<string, DayBalance> {
  const days = new Map<string, DayBalance>();
  function get(timestamp: string) {
    const key = dateKey(new Date(timestamp));
    if (!days.has(key)) days.set(key, emptyDay(key));
    return days.get(key)!;
  }
  for (const sale of business.sales) {
    if (sale.cancelled) continue;
    const day = get(sale.date);
    day.sales += sale.total;
    day.salesCount++;
    day.entries++;
  }
  for (const payment of business.payments) {
    const day = get(payment.date);
    if (payment.kind === "deposit") day.deposits += payment.amount;
    else if (payment.kind === "withdrawal") day.withdrawals += payment.amount;
    else if (payment.kind === "purchase") day.purchases += payment.amount;
    else day.expenses += payment.amount;
    day.entries++;
  }
  for (const register of business.registers) {
    get(register.openedAt).registers.push(register);
    if (
      register.closedAt &&
      dateKey(new Date(register.closedAt)) !==
        dateKey(new Date(register.openedAt))
    ) {
      get(register.closedAt).registers.push(register);
    }
  }
  for (const day of days.values()) {
    day.income = day.sales + day.deposits;
    day.outgoing = day.purchases + day.expenses + day.withdrawals;
    day.balance = day.income - day.outgoing;
  }
  return days;
}

// Calendar arithmetic uses UTC date-only values, independent of the PC timezone.
export const calendarDate = (key: string) => new Date(`${key}T12:00:00Z`);
export function shiftDay(key: string, amount: number) {
  const date = calendarDate(key);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}
export function shiftPeriod(key: string, mode: CalendarMode, amount: number) {
  if (mode === "week") return shiftDay(key, amount * 7);
  const date = calendarDate(key);
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + amount);
  return date.toISOString().slice(0, 10);
}
export function calendarRange(key: string, mode: CalendarMode) {
  const first = mode === "month" ? `${key.slice(0, 7)}-01` : key;
  const start = shiftDay(first, -((calendarDate(first).getUTCDay() + 6) % 7));
  const nextMonth = shiftPeriod(first, "month", 1);
  const last = mode === "month" ? shiftDay(nextMonth, -1) : shiftDay(start, 6);
  const count =
    mode === "week"
      ? 7
      : Math.ceil(
          (calendarDate(last).getTime() -
            calendarDate(start).getTime() +
            86_400_000) /
            (7 * 86_400_000),
        ) * 7;
  return Array.from({ length: count }, (_, index) => shiftDay(start, index));
}
