import {
  dateKey,
  getProductCategories,
  lineTotal,
  normalizeBusiness,
  type Business,
  type Product,
} from "./business";
import { categorySalesRange } from "./category-sales";
import { shiftDay } from "./calendar";

export type ReportPeriod = "day" | "week" | "month" | "all";
export function validReportDate(day: string, today: string) {
  const parsed = new Date(`${day}T12:00:00Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === day &&
    day <= today
  );
}
export function operationsRange(
  period: ReportPeriod,
  anchor: string,
  today: string,
) {
  const selected = validReportDate(anchor, today) ? anchor : today;
  const range =
    period === "all"
      ? { from: null, to: selected }
      : categorySalesRange(period, selected);
  return { from: range.from, to: range.to < today ? range.to : today };
}
const inRange = (
  timestamp: string,
  range: { from: string | null; to: string },
) => {
  const parsed = new Date(timestamp);
  if (!Number.isFinite(parsed.getTime())) return false;
  const day = dateKey(parsed);
  return (!range.from || day >= range.from) && day <= range.to;
};
const productName = (product: Product) =>
  [product.name, product.variety].filter(Boolean).join(" · ");
const byAmount = <T extends { amount: number; name: string }>(a: T, b: T) =>
  b.amount - a.amount || a.name.localeCompare(b.name, "es");

export type PurchasedArticle = {
  key: string;
  productId: string;
  name: string;
  unit: Product["unit"];
  quantity: number;
  amount: number;
  invoices: number;
  suppliers: number;
  averageCost: number | null;
  currentPrice: number | null;
  estimatedMargin: number | null;
};
export type SalesMargin = {
  key: string;
  name: string;
  unit: Product["unit"];
  quantity: number;
  revenue: number;
  cost: number;
  gross: number | null;
  margin: number | null;
  missingCosts: number;
};
export function purchasesSummary(
  original: Business,
  period: ReportPeriod,
  anchor: string,
  today = dateKey(),
) {
  const data = normalizeBusiness(original);
  const range = operationsRange(period, anchor, today);
  const products = new Map(data.products.map((p) => [p.id, p]));
  const supplierNames = new Map(data.suppliers.map((s) => [s.id, s.name]));
  const invoicesById = new Map(data.purchases.map((p) => [p.id, p]));
  const invoices = data.purchases.filter((p) => inRange(p.date, range));
  const suppliers = new Map<
    string,
    {
      id: string;
      name: string;
      amount: number;
      invoices: number;
      paid: number;
      outstanding: number;
    }
  >();
  const articles = new Map<
    string,
    PurchasedArticle & {
      weightedCost: bigint;
      missingCosts: number;
      invoiceIds: Set<string>;
      supplierIds: Set<string>;
    }
  >();
  for (const invoice of invoices) {
    const supplier = suppliers.get(invoice.supplierId) || {
      id: invoice.supplierId,
      name: supplierNames.get(invoice.supplierId) || invoice.supplierName,
      amount: 0,
      invoices: 0,
      paid: 0,
      outstanding: 0,
    };
    supplier.amount += invoice.total;
    supplier.invoices++;
    supplier.outstanding += invoice.total - invoice.paid;
    suppliers.set(supplier.id, supplier);
    for (const item of invoice.items) {
      const key = `${item.productId}:${item.unit}`;
      const product = products.get(item.productId);
      const row = articles.get(key) || {
        key,
        productId: item.productId,
        name: product ? productName(product) : item.name,
        unit: item.unit,
        quantity: 0,
        amount: 0,
        invoices: 0,
        suppliers: 0,
        averageCost: null,
        currentPrice:
          product && product.unit === item.unit && product.price > 0
            ? product.price
            : null,
        estimatedMargin: null,
        weightedCost: BigInt(0),
        missingCosts: 0,
        invoiceIds: new Set<string>(),
        supplierIds: new Set<string>(),
      };
      row.quantity += item.quantity;
      row.amount += item.total;
      row.invoiceIds.add(invoice.id);
      row.supplierIds.add(invoice.supplierId);
      if (Number.isSafeInteger(item.cost) && item.cost > 0)
        row.weightedCost += BigInt(item.cost) * BigInt(item.quantity);
      else row.missingCosts++;
      articles.set(key, row);
    }
  }
  let paidInPeriod = 0;
  for (const payment of data.payments) {
    if (payment.kind !== "purchase" || !inRange(payment.date, range)) continue;
    paidInPeriod += payment.amount;
    const invoice = invoicesById.get(payment.reference);
    if (!invoice) continue;
    const supplier = suppliers.get(invoice.supplierId) || {
      id: invoice.supplierId,
      name: supplierNames.get(invoice.supplierId) || invoice.supplierName,
      amount: 0,
      invoices: 0,
      paid: 0,
      outstanding: 0,
    };
    supplier.paid += payment.amount;
    suppliers.set(supplier.id, supplier);
  }
  const purchasedArticles: PurchasedArticle[] = [...articles.values()].map(
    (row) => {
      const averageCost =
        !row.missingCosts && row.quantity > 0
          ? Number(
              (row.weightedCost + BigInt(Math.floor(row.quantity / 2))) /
                BigInt(row.quantity),
            )
          : null;
      return {
        key: row.key,
        productId: row.productId,
        name: row.name,
        unit: row.unit,
        quantity: row.quantity,
        amount: row.amount,
        invoices: row.invoiceIds.size,
        suppliers: row.supplierIds.size,
        averageCost,
        currentPrice: row.currentPrice,
        estimatedMargin:
          averageCost !== null && row.currentPrice !== null
            ? ((row.currentPrice - averageCost) / row.currentPrice) * 100
            : null,
      };
    },
  );
  const margins = new Map<string, SalesMargin>();
  for (const sale of data.sales) {
    if (sale.cancelled || !inRange(sale.date, range)) continue;
    for (const item of sale.items) {
      const key = `${item.productId}:${item.unit}`;
      const product = products.get(item.productId);
      const row = margins.get(key) || {
        key,
        name: product ? productName(product) : item.name,
        unit: item.unit,
        quantity: 0,
        revenue: 0,
        cost: 0,
        gross: null,
        margin: null,
        missingCosts: 0,
      };
      row.quantity += item.quantity;
      row.revenue += lineTotal(item.price, item.quantity);
      if (!Number.isSafeInteger(item.cost) || item.cost <= 0)
        row.missingCosts++;
      else row.cost += lineTotal(item.cost, item.quantity);
      margins.set(key, row);
    }
  }
  for (const row of margins.values()) {
    row.gross = row.missingCosts ? null : row.revenue - row.cost;
    row.margin =
      row.gross !== null && row.revenue > 0
        ? (row.gross / row.revenue) * 100
        : null;
  }
  return {
    range,
    purchased: invoices.reduce((sum, p) => sum + p.total, 0),
    paidInPeriod,
    outstanding: invoices.reduce((sum, p) => sum + p.total - p.paid, 0),
    invoicesCount: invoices.length,
    suppliersCount: new Set(invoices.map((p) => p.supplierId)).size,
    suppliers: [...suppliers.values()].sort(byAmount),
    articles: purchasedArticles.sort(byAmount),
    quantities: {
      unit: purchasedArticles
        .filter((p) => p.unit === "unit")
        .sort((a, b) => b.quantity - a.quantity || byAmount(a, b)),
      kg: purchasedArticles
        .filter((p) => p.unit === "kg")
        .sort((a, b) => b.quantity - a.quantity || byAmount(a, b)),
    },
    margins: [...margins.values()].sort(
      (a, b) =>
        (b.margin ?? -Infinity) - (a.margin ?? -Infinity) ||
        b.revenue - a.revenue ||
        a.name.localeCompare(b.name, "es"),
    ),
    estimatedMargins: [...purchasedArticles].sort(
      (a, b) =>
        (b.estimatedMargin ?? -Infinity) - (a.estimatedMargin ?? -Infinity) ||
        byAmount(a, b),
    ),
  };
}

export type StockArticle = {
  product: Product;
  name: string;
  amount: number;
  knownCost: boolean;
  toMinimum: number | null;
  sold30Days: number;
  lastSale: string | null;
  coverageDays: number | null;
};
export type StockCategory = { name: string; rows: StockArticle[] };
export function stockSummary(data: Business, today = dateKey()) {
  const from = shiftDay(today, -29);
  const demand = new Map<string, { quantity: number; last: string | null }>();
  for (const sale of data.sales) {
    if (sale.cancelled || !inRange(sale.date, { from: null, to: today }))
      continue;
    const day = dateKey(new Date(sale.date));
    for (const item of sale.items) {
      const key = `${item.productId}:${item.unit}`;
      const row = demand.get(key) || { quantity: 0, last: null };
      if (day >= from) row.quantity += item.quantity;
      if (!row.last || Date.parse(sale.date) > Date.parse(row.last))
        row.last = sale.date;
      demand.set(key, row);
    }
  }
  const rows: StockArticle[] = data.products.map((product) => {
    const sold = demand.get(`${product.id}:${product.unit}`);
    const knownCost = Number.isSafeInteger(product.cost) && product.cost > 0;
    return {
      product,
      name: productName(product),
      knownCost,
      amount: knownCost ? lineTotal(product.cost, product.stock) : 0,
      toMinimum:
        product.minimum > 0
          ? Math.max(0, product.minimum - product.stock)
          : null,
      sold30Days: sold?.quantity || 0,
      lastSale: sold?.last || null,
      coverageDays: sold?.quantity
        ? Math.floor((product.stock * 30) / sold.quantity)
        : null,
    };
  });
  const low = rows
    .filter((row) => row.product.stock <= row.product.minimum)
    .sort(
      (a, b) =>
        Number(b.product.stock === 0) - Number(a.product.stock === 0) ||
        (a.product.minimum ? a.product.stock / a.product.minimum : 0) -
          (b.product.minimum ? b.product.stock / b.product.minimum : 0) ||
        a.name.localeCompare(b.name, "es"),
    );
  const withStock = rows.filter((row) => row.product.stock > 0);
  const categoryKey = (name: string) => name.trim().toLocaleLowerCase("es-AR");
  const categories = new Map<string, StockCategory>(
    getProductCategories(data).map((name) => [
      categoryKey(name),
      { name, rows: [] },
    ]),
  );
  for (const row of rows)
    categories.get(categoryKey(row.product.category))!.rows.push(row);
  for (const category of categories.values())
    category.rows.sort((a, b) => a.name.localeCompare(b.name, "es"));
  return {
    today,
    from,
    low,
    rows,
    inStock: withStock.length,
    empty: rows.filter((row) => row.product.stock === 0).length,
    value: withStock.reduce((sum, row) => sum + row.amount, 0),
    missingCosts: withStock.filter((row) => !row.knownCost).length,
    quantities: {
      unit: withStock
        .filter((row) => row.product.unit === "unit")
        .sort(
          (a, b) =>
            b.product.stock - a.product.stock ||
            a.name.localeCompare(b.name, "es"),
        ),
      kg: withStock
        .filter((row) => row.product.unit === "kg")
        .sort(
          (a, b) =>
            b.product.stock - a.product.stock ||
            a.name.localeCompare(b.name, "es"),
        ),
    },
    byValue: [...withStock].sort(byAmount),
    byCategory: [...categories.values()],
    idle: withStock.filter((row) => row.sold30Days === 0).sort(byAmount),
  };
}
