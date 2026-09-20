import test from "node:test";
import assert from "node:assert/strict";
import { createDemo, summary } from "../lib/business";
import {
  calendarRange,
  dailyBalances,
  shiftDay,
  shiftPeriod,
} from "../lib/calendar";
import { applyAction } from "../lib/actions";

function emptyBusiness() {
  return {
    ...createDemo(new Date("2026-09-20T15:00:00Z")),
    sales: [],
    payments: [],
    expenses: [],
    purchases: [],
    registers: [],
  };
}

test("el calendario combina ventas y pagos reales sin duplicar compras ni aperturas", () => {
  let b = applyAction(
    emptyBusiness(),
    { type: "openRegister", opening: 500000 },
    "2026-09-20T10:00:00Z",
  );
  b = applyAction(
    b,
    {
      type: "sale",
      items: [{ productId: "p11", quantity: 1000 }],
      method: "Transferencia",
    },
    "2026-09-20T11:00:00Z",
  );
  b = applyAction(
    b,
    { type: "cash", kind: "deposit", amount: 30000, reason: "Aporte" },
    "2026-09-20T12:00:00Z",
  );
  b = applyAction(
    b,
    { type: "cash", kind: "withdrawal", amount: 10000, reason: "Retiro" },
    "2026-09-20T13:00:00Z",
  );
  b = applyAction(
    b,
    {
      type: "expense",
      name: "Luz",
      category: "Fijo",
      amount: 20000,
      paid: true,
    },
    "2026-09-20T14:00:00Z",
  );
  const day = dailyBalances(b).get("2026-09-20")!;
  assert.equal(day.salesCount, 1);
  assert.equal(day.sales, b.sales[0].total);
  assert.equal(day.income, b.sales[0].total + 30000);
  assert.equal(day.outgoing, 30000);
  assert.equal(day.balance, b.sales[0].total);
  assert.equal(day.registers.length, 1);
  assert.equal(day.balance, summary(b).balance);
});

test("el gasto pendiente sale del saldo el día que se paga", () => {
  let b = applyAction(
    emptyBusiness(),
    {
      type: "expense",
      name: "Alquiler",
      category: "Fijo",
      amount: 90000,
      paid: false,
    },
    "2026-09-19T13:00:00Z",
  );
  assert.equal(dailyBalances(b).size, 0);
  b = applyAction(
    b,
    { type: "payExpense", id: b.expenses[0].id },
    "2026-09-20T13:00:00Z",
  );
  assert.equal(dailyBalances(b).has("2026-09-19"), false);
  assert.equal(dailyBalances(b).get("2026-09-20")!.balance, -90000);
});

test("los pagos parciales a proveedores se asignan a su propia fecha", () => {
  let b = applyAction(
    emptyBusiness(),
    {
      type: "purchase",
      supplierId: emptyBusiness().suppliers[0].id,
      productId: "p11",
      quantity: 1000,
      cost: 10000,
      paid: 2000,
    },
    "2026-09-19T13:00:00Z",
  );
  b = applyAction(
    b,
    { type: "payPurchase", id: b.purchases[0].id, amount: 3000 },
    "2026-09-20T13:00:00Z",
  );
  const days = dailyBalances(b);
  assert.equal(days.get("2026-09-19")!.purchases, 2000);
  assert.equal(days.get("2026-09-20")!.purchases, 3000);
});

test("el saldo del calendario coincide con el historial actual de ventas anuladas", () => {
  let b = applyAction(
    emptyBusiness(),
    {
      type: "sale",
      items: [{ productId: "p11", quantity: 1000 }],
      method: "Efectivo",
    },
    "2026-09-20T13:00:00Z",
  );
  b = applyAction(
    b,
    { type: "cancelSale", id: b.sales[0].id },
    "2026-09-20T14:00:00Z",
  );
  assert.equal(dailyBalances(b).size, 0);
  assert.equal(summary(b).balance, 0);
});

test("agrupa por la fecha de Mendoza incluso después de medianoche UTC", () => {
  const b = applyAction(
    emptyBusiness(),
    { type: "cash", kind: "deposit", amount: 15000, reason: "Aporte" },
    "2026-09-21T02:30:00Z",
  );
  assert.equal(dailyBalances(b).get("2026-09-20")!.balance, 15000);
  assert.equal(dailyBalances(b).has("2026-09-21"), false);
});

test("una caja que cruza medianoche se muestra al abrir y al cerrar sin repetir ingresos", () => {
  let b = applyAction(
    emptyBusiness(),
    { type: "openRegister", opening: 50000 },
    "2026-09-20T22:00:00Z",
  );
  b = applyAction(
    b,
    { type: "closeRegister", counted: 48000 },
    "2026-09-21T04:00:00Z",
  );
  const days = dailyBalances(b);
  assert.equal(days.get("2026-09-20")!.balance, 0);
  assert.equal(days.get("2026-09-21")!.balance, -2000);
  assert.equal(days.get("2026-09-20")!.registers.length, 1);
  assert.equal(days.get("2026-09-21")!.registers.length, 1);
});

test("la suma diaria reproduce el saldo general de la muestra", () => {
  const b = createDemo(new Date("2026-09-20T15:00:00Z"));
  assert.equal(
    [...dailyBalances(b).values()].reduce(
      (total, day) => total + day.balance,
      0,
    ),
    summary(b).balance,
  );
});

test("semanas de lunes a domingo, meses completos y años bisiestos", () => {
  const week = calendarRange("2026-09-20", "week");
  assert.equal(week[0], "2026-09-14");
  assert.equal(week.at(-1), "2026-09-20");
  assert.equal(week.length, 7);
  assert.ok(calendarRange("2028-02-15", "month").includes("2028-02-29"));
  assert.equal(
    calendarRange("2026-02-15", "month").includes("2026-02-29"),
    false,
  );
  assert.equal(calendarRange("2026-08-15", "month").length, 42);
  assert.equal(shiftPeriod("2026-01-31", "month", 1), "2026-02-01");
  assert.equal(shiftPeriod("2026-12-31", "month", 1), "2027-01-01");
  assert.equal(shiftPeriod("2026-01-03", "week", -1), "2025-12-27");
  assert.equal(shiftDay("2028-02-28", 1), "2028-02-29");
});
