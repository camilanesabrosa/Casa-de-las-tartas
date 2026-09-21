import { dateKey, type Sale } from "./business";

export type SalesFilters = {
  query: string;
  status: "Todas" | "Cobradas" | "Anuladas";
  period: "all" | "today";
};

export const allSalesFilters: SalesFilters = { query: "", status: "Todas", period: "all" };
export const todaySalesFilters: SalesFilters = { query: "", status: "Cobradas", period: "today" };

export function salesForDay(sales: Sale[], day: string) {
  return sales.filter((sale) => !sale.cancelled && dateKey(new Date(sale.date)) === day);
}

export function filterSales(sales: Sale[], filters: SalesFilters, today: string) {
  const query = filters.query.trim().toLowerCase();
  return sales.filter((sale) =>
    (filters.period === "all" || dateKey(new Date(sale.date)) === today) &&
    (filters.status === "Todas" || (filters.status === "Anuladas" ? sale.cancelled : !sale.cancelled)) &&
    `${sale.id} ${sale.items.map((item) => item.name).join(" ")}`.toLowerCase().includes(query),
  ).slice().reverse();
}

// The business calendar uses Mendoza's UTC-3 day, independently of the PC zone.
export function nextBusinessDayDelay(now: Date) {
  const midnight = new Date(`${dateKey(now)}T00:00:00-03:00`).getTime();
  return midnight + 24 * 60 * 60 * 1000 - now.getTime();
}
