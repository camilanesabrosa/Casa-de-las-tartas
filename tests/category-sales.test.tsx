import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { createFreshBusiness, money, type Sale } from "../lib/business";
import { categorySalesRange, categorySalesSummary } from "../lib/category-sales";
import { CategorySales } from "../app/category-sales";

const today = "2026-10-04";
function fixture() {
  const data = createFreshBusiness(new Date(`${today}T15:00:00Z`));
  data.productCategories = ["Congelados", "Tartas", "Pastas"];
  data.products = [
    { ...data.products[0], id: "MIL", category: "Congelados", unit: "kg" as const },
    { ...data.products[1], id: "TAR", category: "Tartas", unit: "unit" as const },
    { ...data.products[2], id: "TAR2", category: "Tartas", unit: "unit" as const },
  ];
  const sale = (id: string, date: string): Sale => ({ id, date, cancelled: false, total: 2300000, method: "Efectivo", items: [
    { productId: "MIL", name: "Milanesas", unit: "kg", quantity: 2000, price: 900000, cost: 700000 },
    { productId: "TAR", name: "Tarta", unit: "unit", quantity: 1000, price: 300000, cost: 100000 },
    { productId: "TAR2", name: "Otra tarta", unit: "unit", quantity: 1000, price: 200000, cost: 100000 },
  ] });
  data.sales = [sale("HOY", "2026-10-04T03:00:00.000Z"), sale("FIN-HOY", "2026-10-05T02:59:59.999Z"), sale("AYER", "2026-10-04T02:59:59.999Z"), sale("SEPTIEMBRE", "2026-09-28T15:00:00Z"), sale("FUTURO", "2026-10-05T03:00:00Z")];
  data.sales.push({ ...sale("ANULADA", "2026-10-04T15:00:00Z"), cancelled: true });
  return data;
}

test("categorías: día, semana de lunes a domingo y mes calendario, incluso bisiestos", () => {
  assert.deepEqual(categorySalesRange("day", today), { from: today, to: today });
  assert.deepEqual(categorySalesRange("week", today), { from: "2026-09-28", to: "2026-10-04" });
  assert.deepEqual(categorySalesRange("week", "2027-01-01"), { from: "2026-12-28", to: "2027-01-03" });
  assert.deepEqual(categorySalesRange("month", "2028-02-19"), { from: "2028-02-01", to: "2028-02-29" });
  assert.deepEqual(categorySalesRange("month", "2026-12-10"), { from: "2026-12-01", to: "2026-12-31" });
});

test("categorías: cada período filtra por fecha de Argentina sin anuladas ni futuros", () => {
  const data = fixture();
  assert.equal(categorySalesSummary(data, "day", today, today).salesCount, 2);
  assert.equal(categorySalesSummary(data, "week", today, today).salesCount, 4);
  assert.equal(categorySalesSummary(data, "month", today, today).salesCount, 3);
  assert.equal(categorySalesSummary(data, "month", "2026-09-15", today).salesCount, 1);
});

test("categorías: muestra todas, cuenta cada venta una vez por categoría y separa unidades/kilos", () => {
  const data = fixture();
  const before = structuredClone(data);
  const result = categorySalesSummary(data, "day", today, today);
  assert.deepEqual(result.rows, [
    { name: "Congelados", amount: 3600000, units: 0, grams: 4000, salesCount: 2 },
    { name: "Tartas", amount: 1000000, units: 4000, grams: 0, salesCount: 2 },
    { name: "Pastas", amount: 0, units: 0, grams: 0, salesCount: 0 },
  ]);
  assert.equal(result.total, 4600000);
  assert.deepEqual(data, before);
});

test("categorías: los borrados conservan el importe en Sin categoría y los nombres editados se actualizan", () => {
  const data = fixture();
  data.products = data.products.filter((product) => product.id !== "MIL");
  const deleted = categorySalesSummary(data, "day", today, today);
  assert.equal(deleted.rows.find((row) => row.name === "Sin categoría")?.amount, 3600000);
  assert.equal(deleted.total, 4600000);
  data.products = data.products.map((product) => ({ ...product, category: "Tartas nuevas" }));
  data.productCategories = ["Tartas nuevas"];
  assert.equal(categorySalesSummary(data, "day", today, today).rows.find((row) => row.name === "Tartas nuevas")?.amount, 1000000);
});

test("categorías: precios históricos y redondeo por gramos, no precios del catálogo", () => {
  const data = fixture();
  const sale = data.sales[0];
  data.products[0].price = 999999999;
  data.sales = [{ ...sale, total: 333, items: [{ ...sale.items[0], quantity: 333, price: 999 }] }];
  const result = categorySalesSummary(data, "day", today, today);
  assert.equal(result.total, 333);
  assert.equal(result.rows[0].grams, 333);
});

test("categorías: ordena de más a menos cobrado y recalcula el ranking al cambiar el período", () => {
  const data = fixture();
  const original = data.sales[0];
  const milanesas = original.items[0];
  const tarta = original.items[1];
  data.productCategories = ["Tartas", "Pastas", "Congelados"];
  data.sales = [
    { ...original, id: "SEPTIEMBRE", date: "2026-09-28T15:00:00Z", total: 1800000, items: [{ ...milanesas, quantity: 2000 }] },
    { ...original, id: "OCTUBRE", date: "2026-10-01T15:00:00Z", total: 1500000, items: [{ ...tarta, quantity: 5000 }] },
    { ...original, id: "HOY", date: "2026-10-04T15:00:00Z", total: 1200000, items: [{ ...milanesas, quantity: 1000 }, { ...tarta, quantity: 1000 }] },
  ];
  for (const period of ["day", "week", "month"] as const) {
    const rows = categorySalesSummary(data, period, today, today).rows;
    assert.deepEqual(rows.map((row) => row.name), period === "month"
      ? ["Tartas", "Congelados", "Pastas"] : ["Congelados", "Tartas", "Pastas"]);
    assert.equal(rows.at(-1)?.amount, 0, "las categorías sin ventas quedan al final");
    assert.ok(rows.every((row, index) => index === 0 || rows[index - 1].amount >= row.amount));
  }
  data.sales = [];
  assert.deepEqual(categorySalesSummary(data, "day", today, today).rows.map((row) => row.name),
    ["Congelados", "Pastas", "Tartas"], "a igual importe desempata por nombre");
});

test("categorías: interfaz con Día/Semana/Mes, importe exacto por categoría y categorías en cero", () => {
  const html = renderToStaticMarkup(<CategorySales data={fixture()} today={today} />);
  for (const label of ["Ventas por categoría", "Día", "Semana", "Mes", "Fecha de referencia", "Cantidad vendida", "Congelados", "Tartas", "Pastas", "4 kg", "4 un.", "Sin ventas", money(3600000), money(1000000), money(4600000)]) assert.ok(html.includes(label), label);
  assert.ok(html.includes('aria-pressed="true"'));
  assert.ok(html.includes('max="2026-10-04"'));
  assert.ok(html.includes('scope="row"'));
  assert.ok(!html.includes("Categoría más vendida"));
  const data = fixture();
  data.sales = [];
  assert.ok(renderToStaticMarkup(<CategorySales data={data} today={today} />).includes("No hay ventas en este período"));
  data.products = [];
  data.productCategories = [];
  assert.ok(renderToStaticMarkup(<CategorySales data={data} today={today} />).includes("Agregá categorías"));
});
