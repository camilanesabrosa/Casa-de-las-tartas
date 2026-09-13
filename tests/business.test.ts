import test from "node:test";
import assert from "node:assert/strict";
import { createDemo, lineTotal, summary } from "../lib/business";
import { applyAction } from "../lib/actions";
test("250 gramos se cobran a un cuarto del precio por kilo, con redondeo al centavo", () => {
  assert.equal(lineTotal(850000, 250), 212500);
  assert.equal(lineTotal(999, 333), 333);
});
test("cada stock de muestra se explica por sus movimientos", () => {
  const b = createDemo();
  for (const p of b.products)
    assert.equal(
      b.movements
        .filter((m) => m.productId === p.id)
        .reduce((a, m) => a + m.quantity, 0),
      p.stock,
      p.name,
    );
});
test("una venta mixta descuenta gramos y unidades de forma atómica", () => {
  const b = createDemo();
  const n = applyAction(b, {
    type: "sale",
    items: [
      { productId: "p16", quantity: 250 },
      { productId: "p11", quantity: 2000 },
    ],
    method: "Efectivo",
  });
  assert.equal(n.products.find((p) => p.id === "p16")!.stock, 2500);
  assert.equal(n.products.find((p) => p.id === "p11")!.stock, 34000);
  assert.equal(n.sales.at(-1)!.total, 532500);
  assert.equal(b.products.find((p) => p.id === "p16")!.stock, 2750);
});
test("una cantidad repetida se acumula antes de validar el stock", () => {
  const b = createDemo();
  assert.throws(
    () =>
      applyAction(b, {
        type: "sale",
        items: [
          { productId: "p16", quantity: 2000 },
          { productId: "p16", quantity: 1000 },
        ],
        method: "Efectivo",
      }),
    /Stock insuficiente/,
  );
  assert.equal(b.products.find((p) => p.id === "p16")!.stock, 2750);
});
test("no permite vender una fracción de un artículo por unidad", () => {
  assert.throws(
    () =>
      applyAction(createDemo(), {
        type: "sale",
        items: [{ productId: "p11", quantity: 500 }],
        method: "Tarjeta",
      }),
    /unidades enteras/,
  );
});
test("pagar una compra parcialmente reduce deuda y caja, no stock", () => {
  const b = createDemo();
  const n = applyAction(b, { type: "payPurchase", id: "c1", amount: 100000 });
  assert.equal(summary(n).debt, summary(b).debt - 100000);
  assert.equal(summary(n).balance, summary(b).balance - 100000);
  assert.deepEqual(n.products, b.products);
  assert.throws(
    () => applyAction(n, { type: "payPurchase", id: "c1", amount: 999999999 }),
    /supera la deuda/,
  );
});
test("registrar mercadería recibe gramos y calcula deuda correctamente", () => {
  const b = createDemo();
  const n = applyAction(b, {
    type: "purchase",
    supplierId: "s1",
    productId: "p16",
    quantity: 500,
    cost: 480000,
    paid: 100000,
  });
  assert.equal(n.products.find((p) => p.id === "p16")!.stock, 3250);
  assert.equal(n.purchases.at(-1)!.total, 240000);
  assert.equal(summary(n).debt, summary(b).debt + 140000);
});
test("gasto pendiente no toca caja hasta pagarlo, y no se paga dos veces", () => {
  const b = createDemo();
  const n = applyAction(b, {
    type: "expense",
    name: "Prueba",
    category: "Fijo",
    amount: 50000,
    paid: false,
  });
  assert.equal(summary(n).balance, summary(b).balance);
  const p = applyAction(n, { type: "payExpense", id: n.expenses.at(-1)!.id });
  assert.equal(summary(p).balance, summary(b).balance - 50000);
  assert.throws(
    () => applyAction(p, { type: "payExpense", id: n.expenses.at(-1)!.id }),
    /ya está pagado/,
  );
});
test("anular venta repone stock y revierte exactamente su cobro una sola vez", () => {
  const b = createDemo();
  const n = applyAction(b, {
    type: "sale",
    items: [{ productId: "p16", quantity: 333 }],
    method: "Transferencia",
  });
  const v = n.sales.at(-1)!;
  const c = applyAction(n, { type: "cancelSale", id: v.id });
  assert.deepEqual(c.products, b.products);
  assert.equal(summary(c).balance, summary(b).balance);
  assert.throws(
    () => applyAction(c, { type: "cancelSale", id: v.id }),
    /ya está anulada/,
  );
});
test("editar precios no reescribe ni el stock ni los importes de ventas anteriores", () => {
  const b = createDemo();
  const p = b.products[0];
  const n = applyAction(b, {
    type: "product",
    product: { ...p, price: p.price + 10000, stock: 0 },
  });
  assert.equal(n.products[0].stock, p.stock);
  assert.deepEqual(n.sales, b.sales);
});
test("cantidades negativas, cero y precios inválidos se rechazan", () => {
  for (const quantity of [0, -1, NaN, Infinity])
    assert.throws(() =>
      applyAction(createDemo(), {
        type: "sale",
        items: [{ productId: "p16", quantity }],
        method: "Efectivo",
      }),
    );
});
test("ajuste de merma no puede producir stock negativo", () => {
  assert.throws(
    () =>
      applyAction(createDemo(), {
        type: "adjustStock",
        productId: "p16",
        quantity: -3000,
        reason: "Merma",
      }),
    /suficiente stock/,
  );
});
test("las fechas de la muestra siguen el día de Argentina aunque UTC ya sea el siguiente", () => {
  const b = createDemo(new Date("2026-09-13T00:30:00Z"));
  assert.ok(b.sales.every((s) => s.date < "2026-09-13T00:30:00Z"));
});
