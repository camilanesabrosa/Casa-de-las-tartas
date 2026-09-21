import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { SidebarProvider } from "../components/ui/sidebar";
import { DailySalesShortcut } from "../app/daily-sales";
import { SalesView } from "../app/views";
import { createDemo, money, type Sale } from "../lib/business";
import { allSalesFilters, todaySalesFilters, filterSales, salesForDay, nextBusinessDayDelay } from "../lib/sales";

const day = "2026-09-21";
const makeSale = (id: string, date: string, total: number, cancelled = false): Sale => ({
  id, date, total, cancelled, method: "Efectivo",
  items: [{ productId: "p1", name: "Tarta de verduras", quantity: 1000, unit: "unit", price: total, cost: 0 }],
});
const sales = [
  makeSale("AYER", "2026-09-21T02:59:59.999Z", 90000),
  makeSale("HOY-1", "2026-09-21T03:00:00.000Z", 10050),
  { ...makeSale("HOY-2", "2026-09-22T02:59:59.999Z", 20000), method: "Transferencia" },
  makeSale("ANULADA", "2026-09-21T16:00:00.000Z", 40000, true),
  makeSale("MANANA", "2026-09-22T03:00:00.000Z", 80000),
];

test("ventas de hoy: usa el día de Mendoza y suma todos los medios, sin anuladas", () => {
  const today = salesForDay(sales, day);
  assert.deepEqual(today.map((sale) => sale.id), ["HOY-1", "HOY-2"]);
  assert.equal(today.reduce((total, sale) => total + sale.total, 0), 30050);
  assert.deepEqual(filterSales(sales, todaySalesFilters, day), [...today].reverse());
  assert.equal(sales[0].id, "AYER", "filtrar no reordena el estado original");
});

test("ventas de hoy: cambiar la fecha, estado o búsqueda mantiene filtros independientes", () => {
  assert.equal(filterSales(sales, allSalesFilters, day).length, sales.length);
  assert.deepEqual(filterSales(sales, { ...todaySalesFilters, status: "Anuladas" }, day).map((sale) => sale.id), ["ANULADA"]);
  assert.equal(filterSales(sales, { ...todaySalesFilters, query: "  tarta  " }, day).length, 2);
  assert.deepEqual(filterSales(sales, { ...todaySalesFilters, query: "hoy-1" }, day).map((sale) => sale.id), ["HOY-1"]);
  assert.equal(filterSales(sales, { ...todaySalesFilters, period: "all" }, day).length, 4);
});

test("ventas de hoy: al anular o cambiar de día se actualizan importe y cantidad", () => {
  const cancelled = sales.map((sale) => sale.id === "HOY-1" ? { ...sale, cancelled: true } : sale);
  assert.equal(salesForDay(cancelled, day).length, 1);
  assert.equal(salesForDay(cancelled, day)[0].total, 20000);
  assert.deepEqual(salesForDay(sales, "2026-09-22").map((sale) => sale.id), ["MANANA"]);
  assert.deepEqual(salesForDay(sales, "2026-09-23"), []);
  assert.equal(nextBusinessDayDelay(new Date("2026-09-22T02:59:59.999Z")), 1);
  assert.equal(nextBusinessDayDelay(new Date("2026-09-22T03:00:00.000Z")), 86400000);
});

function shortcut(values: Sale[]) {
  return renderToStaticMarkup(<SidebarProvider><DailySalesShortcut sales={values} day={day} onOpen={() => {}} /></SidebarProvider>);
}

test("acceso a ventas de hoy: botón accesible con importe exacto y cantidad", () => {
  const html = shortcut(sales);
  assert.ok(html.includes('aria-label="Ver ventas cobradas de hoy:'));
  assert.ok(html.includes("Vendido hoy"));
  assert.ok(html.includes(money(30050)));
  assert.ok(html.includes("2 ventas"));
  assert.ok(html.includes("Ver detalle"));
  assert.ok(!html.includes("Mi negocio"));
});

test("acceso a ventas de hoy: cero ventas sigue siendo accesible y respeta el singular", () => {
  assert.ok(shortcut([]).includes("0 ventas"));
  assert.ok(shortcut([]).includes(money(0)));
  assert.ok(!shortcut([]).includes("disabled"));
  const one = shortcut([sales[1]]);
  assert.ok(one.includes("1 venta"));
  assert.ok(!one.includes("1 ventas"));
  const large = 99999999999;
  assert.ok(shortcut([{ ...sales[1], total: large }]).includes(money(large)));
});

test("detalle de hoy: tabla y total coinciden con el acceso lateral, sin aportes ni gastos", () => {
  const data = { ...createDemo(new Date(`${day}T15:00:00Z`)), sales };
  const html = renderToStaticMarkup(<SalesView data={data} save={async () => {}} newSale={() => {}}
    today={day} filters={todaySalesFilters} setFilters={() => {}} />);
  assert.ok(html.includes("HOY-1"));
  assert.ok(html.includes("HOY-2"));
  for (const id of ["AYER", "ANULADA", "MANANA"]) assert.ok(!html.includes(id));
  assert.ok(html.includes(money(30050)));
  assert.match(html, /<option value="today" selected="">Hoy<\/option>/);
  assert.ok(html.includes("Todas las fechas"));
});
