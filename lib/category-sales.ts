import { dateKey, getProductCategories, lineTotal, type Business } from "./business";
import { calendarDate, shiftDay, shiftPeriod } from "./calendar";

export type CategorySalesPeriod = "day" | "week" | "month";
export function categorySalesRange(period: CategorySalesPeriod, anchor: string) {
  if (period === "day") return { from: anchor, to: anchor };
  if (period === "month") {
    const from = `${anchor.slice(0, 7)}-01`;
    return { from, to: shiftDay(shiftPeriod(from, "month", 1), -1) };
  }
  const from = shiftDay(anchor, -((calendarDate(anchor).getUTCDay() + 6) % 7));
  return { from, to: shiftDay(from, 6) };
}

export function categorySalesSummary(data: Business, period: CategorySalesPeriod, anchor: string, today = dateKey()) {
  const range = categorySalesRange(period, anchor);
  const categories = new Map(data.products.map((product) => [product.id, product.category]));
  const rows = new Map(getProductCategories(data).map((name) => [name, {
    name, amount: 0, units: 0, grams: 0, salesCount: 0,
  }]));
  let salesCount = 0;
  for (const sale of data.sales) {
    const day = dateKey(new Date(sale.date));
    if (sale.cancelled || day < range.from || day > range.to || day > today) continue;
    salesCount++;
    const counted = new Set<string>();
    for (const item of sale.items) {
      const name = categories.get(item.productId) || "Sin categoría";
      let row = rows.get(name);
      if (!row) {
        row = { name, amount: 0, units: 0, grams: 0, salesCount: 0 };
        rows.set(name, row);
      }
      row.amount += lineTotal(item.price, item.quantity);
      if (item.unit === "kg") row.grams += item.quantity;
      else row.units += item.quantity;
      if (!counted.has(name)) { row.salesCount++; counted.add(name); }
    }
  }
  const ordered = [...rows.values()].sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, "es"));
  return { range, rows: ordered, total: ordered.reduce((sum, row) => sum + row.amount, 0), salesCount };
}
