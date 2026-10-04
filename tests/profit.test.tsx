import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { createFreshBusiness, money } from "../lib/business";
import { applyAction } from "../lib/actions";
import { profitRange, profitSummary } from "../lib/profit";
import { ProfitView } from "../app/profit-view";

const today = "2026-10-04";
const now = `${today}T15:00:00.000Z`;
function fixture() {
  const data = createFreshBusiness(new Date(now));
  data.products = [{ ...data.products[0], id: "MIL", name: "Milanesas", variety: "", unit: "kg", price: 900000, cost: 700000, stock: 0 }];
  data.suppliers = [{ id: "PROV", name: "Proveedor", phone: "" }];
  return data;
}
function sold() {
  const purchased = applyAction(fixture(), { type: "purchase", supplierId: "PROV", productId: "MIL", quantity: 10000, cost: 700000, paid: 2000000 }, now);
  return applyAction(purchased, { type: "sale", items: [{ productId: "MIL", quantity: 2000 }], method: "Efectivo" }, now);
}
const report = (data = sold()) => profitSummary(data, "month", today);
const render = (data = sold()) => renderToStaticMarkup(<ProfitView data={data} today={today} navigate={() => {}} />);

test("ganancias: comprar 10 kilos y vender 2 descuenta solo el costo de esos 2", () => {
  const data = sold();
  const original = structuredClone(data);
  const result = report(data);
  assert.equal(result.purchased, 7000000);
  assert.equal(result.purchasePayments, 2000000);
  assert.equal(result.revenue, 1800000);
  assert.equal(result.knownCost, 1400000);
  assert.equal(result.gross, 400000);
  assert.equal(result.net, 400000);
  assert.equal(result.loss, 0);
  assert.deepEqual(data, original, "consultar no modifica los registros");
});

test("ganancias: resta gastos fijos y variables, incluso pendientes, una sola vez", () => {
  let data = applyAction(sold(), { type: "expense", name: "Alquiler", category: "Fijo", amount: 100000, paid: false }, now);
  data = applyAction(data, { type: "expense", name: "Limpieza", category: "Variable", amount: 50000, paid: true }, now);
  const result = report(data);
  assert.equal(result.fixedExpenses, 100000);
  assert.equal(result.variableExpenses, 50000);
  assert.equal(result.pendingExpenses, 100000);
  assert.equal(result.net, 250000);
  const paid = applyAction(data, { type: "payExpense", id: data.expenses[0].id }, now);
  assert.equal(report(paid).net, result.net, "pagar una deuda no vuelve a descontar el gasto");
  assert.equal(report(paid).pendingExpenses, 0);
});

test("ganancias: pérdida es el neto negativo y comprar sin vender no es una pérdida", () => {
  const purchased = applyAction(fixture(), { type: "purchase", supplierId: "PROV", productId: "MIL", quantity: 10000, cost: 700000, paid: 0 }, now);
  assert.equal(report(purchased).gross, 0);
  assert.equal(report(purchased).net, 0);
  assert.equal(report(purchased).loss, 0);
  const data = applyAction(sold(), { type: "expense", name: "Alquiler", category: "Fijo", amount: 600000, paid: false }, now);
  assert.equal(report(data).gross, 400000);
  assert.equal(report(data).net, -200000);
  assert.equal(report(data).loss, 200000);
  assert.equal(report({ ...fixture(), expenses: data.expenses }).loss, 600000, "puede haber pérdida sin ventas");
});

test("ganancias: cambios de precio, costo o producto no reescriben el margen histórico", () => {
  let data = applyAction(sold(), { type: "productPrice", id: "MIL", price: 1100000 }, now);
  data = applyAction(data, { type: "purchase", supplierId: "PROV", productId: "MIL", quantity: 1000, cost: 800000, paid: 0 }, now);
  assert.equal(report(data).gross, 400000);
  data = applyAction(data, { type: "sale", items: [{ productId: "MIL", quantity: 1000 }], method: "Transferencia" }, now);
  assert.equal(report(data).gross, 700000);
  assert.equal(report({ ...data, products: [] }).gross, 700000, "se usan las líneas históricas, no el catálogo");
});

test("ganancias: excluye anuladas, aportes, retiros, arqueos y pagos duplicados del resultado", () => {
  const data = sold();
  data.payments.push({ id: "AP", date: now, kind: "deposit", amount: 9900000, reference: "Aporte" }, { id: "RE", date: now, kind: "withdrawal", amount: 8800000, reference: "Arqueo" });
  assert.equal(report(data).net, 400000);
  const cancelled = applyAction(data, { type: "cancelSale", id: data.sales[0].id }, now);
  assert.equal(report(cancelled).revenue, 0);
  assert.equal(report(cancelled).knownCost, 0);
  assert.equal(report(cancelled).net, 0);
});

test("ganancias: respeta gramos y redondeo por línea, también al vender debajo del costo", () => {
  const data = sold();
  data.sales = [{ ...data.sales[0], total: 25000, items: [{ ...data.sales[0].items[0], price: 100000, cost: 140001, quantity: 250 }] }];
  assert.equal(report(data).knownCost, 35000);
  assert.equal(report(data).gross, -10000);
  assert.equal(report(data).loss, 10000);
});

test("ganancias: fechas de Argentina, cambios de año y períodos inclusivos sin futuros", () => {
  assert.deepEqual(profitRange("week", "2027-01-03"), { from: "2026-12-28", to: "2027-01-03" });
  assert.deepEqual(profitRange("30days", "2026-03-01"), { from: "2026-01-31", to: "2026-03-01" });
  const data = sold();
  const sale = data.sales[0];
  data.sales = ["2026-10-04T02:59:59.999Z", "2026-10-04T03:00:00.000Z", "2026-10-05T02:59:59.999Z", "2026-10-05T03:00:00.000Z"].map((date, index) => ({ ...sale, id: `V${index}`, date }));
  assert.equal(profitSummary(data, "today", today).salesCount, 2);
  assert.equal(profitSummary(data, "all", today).salesCount, 3);
  data.payments = [{ ...data.payments[0], date: "2026-09-20T15:00:00Z" }];
  assert.equal(report(data).purchasePayments, 0);
  assert.equal(report(data).purchased, 7000000);
});

test("ganancias: no inventa costos cero ni usa costos actuales para completar ventas viejas", () => {
  for (const cost of [0, undefined, Number.NaN]) {
    const data = sold();
    data.sales[0].items[0].cost = cost as number;
    const result = report(data);
    assert.equal(result.missingCostLines, 1);
    assert.equal(result.gross, null);
    assert.equal(result.net, null);
    assert.equal(result.loss, null);
    assert.ok(render(data).includes("No mostramos una ganancia ni una pérdida porque sería incompleta"));
    assert.ok(render(data).includes("Faltan costos"));
  }
});

test("ganancias: cambios en gastos recalculan el resultado al editar o eliminar", () => {
  let data = applyAction(sold(), { type: "expense", name: "Limpieza", category: "Variable", amount: 50000, paid: true }, now);
  data = applyAction(data, { type: "expense", id: data.expenses[0].id, name: "Limpieza", category: "Fijo", amount: 75000, paid: false }, now);
  assert.equal(report(data).net, 325000);
  assert.equal(report(data).fixedExpenses, 75000);
  assert.equal(report(data).variableExpenses, 0);
  data = applyAction(data, { type: "deleteExpense", id: data.expenses[0].id }, now);
  assert.equal(report(data).net, 400000);
});

test("ganancias: interfaz explica bruto, neto, compras y pérdida sin confundirlos con caja", () => {
  const html = render();
  for (const label of ["Ganancia bruta", "Ganancia neta", "Pérdida del período", "Mercadería recibida", "Pagos a proveedores", "Período", "no es el saldo de caja", "No incluye mermas"]) assert.ok(html.includes(label), label);
  assert.ok(html.includes("Este período dejó ganancia"));
  assert.ok(html.includes(money(400000)));
  assert.ok(html.includes("Mientras no se venda, queda en stock"));
  const loss = applyAction(sold(), { type: "expense", name: "Alquiler", category: "Fijo", amount: 600000, paid: true }, now);
  assert.ok(render(loss).includes("Este período hubo pérdida"));
  assert.ok(render(loss).includes(money(200000)));
  assert.ok(render(fixture()).includes("Todavía no hay movimientos en este período"));
});
