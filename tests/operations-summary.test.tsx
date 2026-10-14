import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import {
  createFreshBusiness,
  lineTotal,
  type PurchaseLine,
  type Sale,
} from "../lib/business";
import {
  operationsRange,
  validReportDate,
  purchasesSummary,
  stockSummary,
} from "../lib/operations-summary";
import {
  PurchasesOverview,
  StockOverview,
  StockCategoryChart,
  SummaryTabs,
} from "../app/operations-summary";
const today = "2026-10-14";
function fixture() {
  const b = createFreshBusiness(new Date(`${today}T15:00:00Z`));
  b.products = [
    {
      ...b.products[0],
      id: "a",
      name: "Tarta",
      variety: "",
      unit: "unit",
      price: 1000,
      cost: 600,
      stock: 2000,
      minimum: 4000,
    },
    {
      ...b.products[1],
      id: "b",
      name: "Pasta",
      variety: "",
      unit: "kg",
      price: 2000,
      cost: 1000,
      stock: 5000,
      minimum: 1000,
    },
    {
      ...b.products[2],
      id: "c",
      name: "Sin costo",
      variety: "",
      unit: "unit",
      cost: 0,
      stock: 1000,
      minimum: 1000,
    },
    {
      ...b.products[3],
      id: "d",
      name: "Vacío",
      variety: "",
      stock: 0,
      minimum: 0,
    },
  ];
  b.suppliers = [
    { id: "s1", name: "Proveedor uno", phone: "" },
    { id: "s2", name: "Proveedor dos", phone: "", archived: true },
  ];
  b.purchases = [];
  b.payments = [];
  b.sales = [];
  const item = (id: string, q: number, cost: number): PurchaseLine => ({
    productId: id,
    name: id,
    unit: id === "b" ? "kg" : "unit",
    quantity: q,
    cost,
    total: lineTotal(cost, q),
  });
  const purchase = (
    id: string,
    date: string,
    supplierId: string,
    items: PurchaseLine[],
    paid = 0,
  ) => ({
    id,
    date: `${date}T15:00:00Z`,
    supplierId,
    supplierName: "Histórico",
    invoiceNumber: id,
    items,
    productId: items[0].productId,
    quantity: items[0].quantity,
    total: items.reduce((s, i) => s + i.total, 0),
    paid,
  });
  b.purchases = [
    purchase(
      "p1",
      today,
      "s1",
      [item("a", 1000, 400), item("a", 3000, 600), item("b", 500, 1000)],
      100,
    ),
    purchase("p2", "2026-10-01", "s2", [item("b", 1500, 2000)]),
    purchase("old", "2026-09-01", "s2", [item("a", 1000, 500)], 500),
  ];
  b.payments = [
    {
      id: "pay",
      kind: "purchase",
      date: `${today}T15:00:00Z`,
      reference: "old",
      amount: 500,
    },
    {
      id: "initial",
      kind: "purchase",
      date: `${today}T15:00:00Z`,
      reference: "p1",
      amount: 100,
    },
    {
      id: "expense",
      kind: "expense",
      date: `${today}T15:00:00Z`,
      reference: "e",
      amount: 999,
    },
  ];
  return b;
}
function sale(
  id: string,
  date = `${today}T15:00:00Z`,
  quantity = 1000,
  cost = 300,
): Sale {
  return {
    id,
    date,
    cancelled: false,
    method: "Efectivo",
    total: 800,
    items: [
      {
        productId: "a",
        name: "Histórico",
        unit: "unit",
        price: 800,
        cost,
        quantity,
      },
    ],
  };
}
test("compras: períodos calendario, Argentina, fecha inválida y corte hasta hoy", () => {
  assert.equal(validReportDate("2026-02-30", today), false);
  assert.equal(validReportDate("2026-10-15", today), false);
  assert.deepEqual(operationsRange("month", "2026-02-30", today), {
    from: "2026-10-01",
    to: today,
  });
  assert.deepEqual(operationsRange("week", today, today), {
    from: "2026-10-12",
    to: today,
  });
  assert.deepEqual(operationsRange("all", today, today), {
    from: null,
    to: today,
  });
  const b = fixture();
  b.purchases = [b.purchases[0]];
  b.purchases.push(
    { ...b.purchases[0], id: "tomorrow", date: "2026-10-15T03:00:00Z" },
    { ...b.purchases[0], id: "tonight", date: "2026-10-15T02:59:59Z" },
  );
  assert.equal(purchasesSummary(b, "day", today, today).invoicesCount, 2);
});
test("compras: importe por proveedor, facturas sin duplicar líneas y pagos por fecha propia", () => {
  const b = fixture(),
    before = structuredClone(b);
  const r = purchasesSummary(b, "month", today, today);
  assert.equal(r.purchased, 5700);
  assert.equal(r.paidInPeriod, 600);
  assert.equal(r.outstanding, 5600);
  assert.equal(r.invoicesCount, 2);
  assert.equal(r.suppliersCount, 2);
  assert.deepEqual(
    r.suppliers.map((s) => [s.id, s.amount, s.invoices, s.paid]),
    [
      ["s2", 3000, 1, 500],
      ["s1", 2700, 1, 100],
    ],
  );
  const day = purchasesSummary(b, "day", today, today);
  assert.equal(day.suppliers.find((s) => s.id === "s2")!.amount, 0);
  assert.equal(day.suppliersCount, 1);
  assert.deepEqual(b, before);
});
test("compras: costos ponderados por cantidad, kilos separados y margen sobre precio", () => {
  const r = purchasesSummary(fixture(), "month", today, today);
  const a = r.articles.find((i) => i.productId === "a")!,
    b = r.articles.find((i) => i.productId === "b")!;
  assert.equal(a.averageCost, 550);
  assert.equal(a.estimatedMargin, 45);
  assert.equal(a.invoices, 1);
  assert.equal(b.averageCost, 1750);
  assert.equal(b.suppliers, 2);
  assert.equal(b.invoices, 2);
  assert.equal(r.quantities.unit[0].quantity, 4000);
  assert.equal(r.quantities.kg[0].quantity, 2000);
  assert.equal(r.articles[0].productId, "b");
});
test("compras: historial de borrados, costos ausentes y precios actuales ausentes", () => {
  const b = fixture();
  b.products = b.products.filter((p) => p.id !== "a");
  b.suppliers = [];
  b.purchases[0].items![2].cost = 0;
  const r = purchasesSummary(b, "month", today, today);
  assert.equal(r.articles.find((i) => i.productId === "a")!.name, "a");
  assert.equal(
    r.articles.find((i) => i.productId === "a")!.estimatedMargin,
    null,
  );
  assert.equal(r.articles.find((i) => i.productId === "b")!.averageCost, null);
  assert.equal(r.suppliers[0].name, "Histórico");
});
test("margen real: costos históricos, anuladas excluidas, margen negativo y datos incompletos", () => {
  const b = fixture();
  b.sales = [
    sale("s"),
    { ...sale("cancelled"), cancelled: true },
    sale("future", "2026-10-15T03:00:00Z"),
  ];
  b.products[0].cost = 9999;
  let r = purchasesSummary(b, "month", today, today);
  assert.equal(r.margins[0].gross, 500);
  assert.equal(r.margins[0].margin, 62.5);
  b.sales = [sale("loss", undefined, 1000, 900)];
  r = purchasesSummary(b, "month", today, today);
  assert.equal(r.margins[0].margin, -12.5);
  b.sales.push(sale("unknown", undefined, 1000, 0));
  assert.equal(
    purchasesSummary(b, "month", today, today).margins[0].gross,
    null,
  );
});
test("stock: mínimos, sin stock, valor parcial y unidades separadas", () => {
  const b = fixture(),
    before = structuredClone(b),
    r = stockSummary(b, today);
  assert.equal(r.inStock, 3);
  assert.equal(r.empty, 1);
  assert.equal(r.low.length, 3);
  assert.equal(r.low[0].product.id, "d");
  assert.equal(r.low[0].toMinimum, null);
  assert.equal(r.low.find((i) => i.product.id === "a")!.toMinimum, 2000);
  assert.equal(r.low.find((i) => i.product.id === "c")!.toMinimum, 0);
  assert.equal(r.value, 6200);
  assert.equal(r.missingCosts, 1);
  assert.equal(r.quantities.unit[0].product.id, "a");
  assert.equal(r.quantities.kg[0].product.id, "b");
  assert.deepEqual(b, before);
});
test("stock: agrupa los productos por categoría con su mínimo", () => {
  const b = fixture();
  b.productCategories = ["Tartas", "Pastas", "Postres"];
  for (const p of b.products) p.category = p.id === "b" ? "Pastas" : "tartas ";
  const categories = stockSummary(b, today).byCategory;
  assert.deepEqual(
    categories.map((c) => [c.name, c.rows.map((r) => r.product.id)]),
    [
      ["Tartas", ["c", "a", "d"]],
      ["Pastas", ["b"]],
      ["Postres", []],
    ],
  );
  const html = renderToStaticMarkup(
    <StockCategoryChart categories={categories} />,
  );
  assert.match(html, /aria-pressed="true"[^>]*>Tartas</);
  assert.match(html, />Pastas</);
  // Tarta: 2 de mínimo 4 → la escala es 4 × 1,15 y la línea queda al 87 %.
  assert.match(html, /stock-chart-row low[\s\S]*?left:86\.9/);
  assert.match(html, /Sin stock/);
  assert.match(html, /Mínimo 4 un\./);
  assert.doesNotMatch(html, />Pasta</);
});
test("stock: demanda de 30 días, fechas locales y última venta con distintos husos", () => {
  const b = fixture();
  b.sales = [
    sale("boundary", "2026-09-15T03:00:00Z", 1000),
    sale("old", "2026-09-15T02:59:59Z"),
    sale("recent", "2026-10-14T03:30:00Z", 2000),
    sale("later", "2026-10-14T01:00:00-03:00", 3000),
    { ...sale("cancel"), cancelled: true },
    sale("future", "2026-10-15T03:00:00Z"),
  ];
  const r = stockSummary(b, today),
    row = r.rows.find((i) => i.product.id === "a")!;
  assert.equal(row.sold30Days, 6000);
  assert.equal(row.coverageDays, 10);
  assert.equal(row.lastSale, "2026-10-14T01:00:00-03:00");
  assert.equal(
    r.idle.some((i) => i.product.id === "a"),
    false,
  );
  assert.equal(r.idle.length, 2);
});
test("resúmenes: vacíos y controles accesibles sin inventar datos", () => {
  const b = fixture();
  b.purchases = [];
  b.payments = [];
  b.products = [];
  const purchases = renderToStaticMarkup(
    <PurchasesOverview data={b} today={today} navigate={() => {}} />,
  );
  const stock = renderToStaticMarkup(
    <StockOverview data={b} today={today} navigate={() => {}} />,
  );
  assert.match(purchases, /Resumen de compras/);
  assert.match(purchases, /Registrá una compra/);
  assert.match(purchases, /Mayor gasto/);
  assert.match(purchases, /Mejor margen/);
  assert.match(stock, /Todos los artículos están por encima/);
  assert.match(stock, /Sin ventas \(30 días\)/);
  assert.match(
    renderToStaticMarkup(<SummaryTabs value="stock" onChange={() => {}} />),
    /aria-pressed="true">Stock/,
  );
});
test("stock: un cambio de unidad no mezcla demanda histórica incompatible", () => {
  const b = fixture();
  b.sales = [sale("s")];
  b.products[0].unit = "kg";
  assert.equal(stockSummary(b, today).rows[0].sold30Days, 0);
});
test("compras: promedio redondeado por gramos y margen desconocido sin precio", () => {
  const b = fixture();
  b.purchases = [b.purchases[0]];
  b.purchases[0].items = [
    {
      productId: "b",
      name: "Pasta",
      quantity: 333,
      unit: "kg",
      cost: 999,
      total: 333,
    },
    {
      productId: "b",
      name: "Pasta",
      quantity: 667,
      unit: "kg",
      cost: 1999,
      total: 1333,
    },
  ];
  b.products[1].price = 0;
  const row = purchasesSummary(b, "month", today, today).articles[0];
  assert.equal(row.averageCost, 1666);
  assert.equal(row.estimatedMargin, null);
});
