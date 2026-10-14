import test from "node:test";
import assert from "node:assert/strict";
import {
  categories,
  categoryRanking,
  createDemo,
  lineTotal,
  matchesCode,
  productCode,
  summary,
  withProductNumbers,
  withRegisters,
  openRegister,
  registerBreakdown,
  registerExpected,
} from "../lib/business";
import { applyAction } from "../lib/actions";
test("editar fotos acepta HTTPS y rechaza contenido ejecutable o incrustado", () => {
  const b = createDemo();
  for (const imageUrl of ["javascript:alert(1)", "data:image/svg+xml,abc", "http://example.com/a.jpg", "https://user:pass@example.com/a.jpg"]) {
    assert.throws(() => applyAction(b, { type: "product", product: { ...b.products[0], imageUrl } }));
  }
  const next = applyAction(b, { type: "product", product: { ...b.products[0], imageUrl: "https://example.com/a.jpg" } });
  assert.equal(next.products[0].imageUrl, "https://example.com/a.jpg");
});
test("el código muestra primero la letra de su categoría y luego el número del cartel", () => {
  const b = createDemo();
  const code = (id: string) => productCode(b.products.find((p) => p.id === id)!);
  assert.equal(code("p1"), "A1");
  assert.equal(code("p4"), "A4");
  assert.equal(code("p11"), "B1");
  assert.equal(code("p16"), "C1");
  assert.equal(code("p21"), "D1");
  assert.equal(code("p26"), "E1");
  assert.equal(code("p38"), "E13");
});
test("cada categoría numera desde 1 y no repite códigos", () => {
  const b = createDemo();
  const codes = b.products.map((p) => productCode(p));
  assert.equal(new Set(codes).size, codes.length);
  for (const category of categories) {
    const numbers = b.products
      .filter((p) => p.category === category)
      .map((p) => p.number)
      .sort((x, y) => x - y);
    assert.ok(numbers.length > 0, category);
    assert.deepEqual(
      numbers,
      numbers.map((_, i) => i + 1),
      category,
    );
  }
});
test("la búsqueda por código ignora mayúsculas y espacios, y no hace coincidencias parciales", () => {
  const b = createDemo();
  const tarta = b.products.find((p) => p.id === "p26")!;
  for (const q of ["E1", "e1", " e 1 ", "E  1", "1E", "1e", " 1 e ", "1  E"])
    assert.ok(matchesCode(tarta, q), q);
  for (const q of ["1", "E", "E11", "11E", "D1", "1D", "E01", "01E", ""])
    assert.ok(!matchesCode(tarta, q), q);
});
test("los productos guardados sin número reciben uno sin pisar los existentes", () => {
  const b = createDemo();
  const legacy = {
    ...b,
    products: b.products
      .filter((p) => p.category === "Pastas")
      .map((p, i) =>
        i === 1 ? { ...p, number: 4 } : { ...p, number: undefined as never },
      ),
  };
  const fixed = withProductNumbers(legacy);
  assert.deepEqual(
    fixed.products.map((p) => productCode(p)),
    ["C1", "C4", "C2", "C3", "C5"],
  );
  assert.equal(withProductNumbers(b), b, "sin cambios no copia el negocio");
});
test("250 gramos se cobran a un cuarto del precio por kilo, con redondeo al centavo", () => {
  assert.equal(lineTotal(850000, 250), 212500);
  assert.equal(lineTotal(999, 333), 333);
});
test("el ranking suma por categoría, ordena de mayor a menor y no pierde importe", () => {
  const b = createDemo();
  const sales = summary(b, 30).sales;
  const ranking = categoryRanking(b.products, sales);
  assert.ok(ranking.length > 0);
  for (let i = 1; i < ranking.length; i++)
    assert.ok(ranking[i - 1].amount >= ranking[i].amount);
  assert.equal(
    ranking.reduce((a, c) => a + c.amount, 0),
    sales.reduce(
      (a, s) => a + s.items.reduce((t, i) => t + lineTotal(i.price, i.quantity), 0),
      0,
    ),
  );
  assert.ok(ranking.every((c) => b.products.some((p) => p.category === c.name)));
});
test("el ranking agrupa bajo Sin categoría los productos borrados", () => {
  const b = createDemo();
  const sales = summary(b, 30).sales;
  assert.ok(sales.length > 0);
  const ranking = categoryRanking([], sales);
  assert.deepEqual(
    ranking.map((c) => c.name),
    ["Sin categoría"],
  );
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
test("ajustar existencias reemplaza el stock actual y admite cero", () => {
  const b = createDemo();
  const p = b.products.find((p) => p.id === "p16")!;
  const n = applyAction(b, { type: "adjustStock", productId: "p16", stock: p.stock + 5000, reason: "Recuento" });
  assert.equal(n.products.find((p) => p.id === "p16")!.stock, p.stock + 5000);
  assert.equal(n.movements.at(-1)!.quantity, 5000);
  const z = applyAction(n, { type: "adjustStock", productId: "p16", stock: 0, reason: "Merma" });
  assert.equal(z.products.find((p) => p.id === "p16")!.stock, 0);
  assert.equal(z.movements.at(-1)!.quantity, -(p.stock + 5000));
  assert.throws(() => applyAction(z, { type: "adjustStock", productId: "p16", stock: -1000, reason: "Merma" }));
});
test("los nombres se guardan sin espacios de más", () => {
  const b = createDemo();
  const p = applyAction(b, { type: "product", product: { ...b.products[0], name: "  Tarta   de  jamón ", variety: " Grande  " } });
  assert.equal(p.products.find((x) => x.id === b.products[0].id)!.name, "Tarta de jamón");
  assert.equal(p.products.find((x) => x.id === b.products[0].id)!.variety, "Grande");
  const s = applyAction(p, { type: "supplier", name: " Don   Pepe ", phone: " 261  555 " });
  assert.deepEqual(s.suppliers.at(-1), { ...s.suppliers.at(-1)!, name: "Don Pepe", phone: "261 555" });
  const e = applyAction(s, { type: "expense", name: "Luz \t del  local", category: "Fijo", amount: 100, paid: false });
  assert.equal(e.expenses.at(-1)!.name, "Luz del local");
  const c = applyAction(e, { type: "productCategory", name: "  Postres   fríos " });
  assert.ok(c.productCategories!.includes("Postres fríos"));
  assert.throws(() => applyAction(c, { type: "productCategory", name: "postres  FRÍOS" }), /ya existe/);
  assert.throws(() => applyAction(c, { type: "supplier", name: "   ", phone: "" }));
});
test("para la casa descuenta stock sin registrar venta ni cobro", () => {
  const b = createDemo();
  const p = b.products.find((p) => p.id === "p16")!;
  const n = applyAction(b, { type: "homeUse", items: [{ productId: "p16", quantity: 250 }] });
  assert.equal(n.products.find((p) => p.id === "p16")!.stock, p.stock - 250);
  assert.deepEqual(n.movements.at(-1)!, { ...n.movements.at(-1)!, productId: "p16", quantity: -250, reason: "Para la casa" });
  assert.deepEqual(n.sales, b.sales);
  assert.deepEqual(n.payments, b.payments);
  assert.throws(() => applyAction(n, { type: "homeUse", items: [{ productId: "p16", quantity: p.stock }] }), /suficiente stock/);
});
test("eliminar un producto conserva sus ventas y permite anularlas", () => {
  const b = createDemo();
  const n = applyAction(b, { type: "sale", items: [{ productId: "p16", quantity: 333 }], method: "Efectivo" });
  const v = n.sales.at(-1)!;
  const d = applyAction(n, { type: "deleteProduct", id: "p16" });
  assert.ok(!d.products.some((p) => p.id === "p16"));
  assert.deepEqual(d.sales, n.sales);
  const c = applyAction(d, { type: "cancelSale", id: v.id });
  assert.ok(c.sales.at(-1)!.cancelled);
  assert.throws(() => applyAction(d, { type: "deleteProduct", id: "p16" }), /No encontramos/);
});
test("las fechas de la muestra siguen el día de Argentina aunque UTC ya sea el siguiente", () => {
  const b = createDemo(new Date("2026-09-13T00:30:00Z"));
  assert.ok(b.sales.every((s) => s.date < "2026-09-13T00:30:00Z"));
});
test("abrir caja registra el saldo inicial y no permite dos abiertas", () => {
  const b = createDemo();
  assert.equal(openRegister(b), undefined);
  const o = applyAction(b, { type: "openRegister", opening: 2000000 });
  const caja = openRegister(o)!;
  assert.equal(caja.opening, 2000000);
  assert.equal(caja.closedAt, undefined);
  // Abrir no mueve dinero: solo declara lo que ya estaba en el cajón.
  assert.deepEqual(o.payments, b.payments);
  assert.throws(
    () => applyAction(o, { type: "openRegister", opening: 1000 }),
    /Ya hay una caja abierta/,
  );
});
test("el arqueo solo cuenta el efectivo y muestra los demás medios de pago", () => {
  const b = applyAction(createDemo(new Date("2026-09-20T23:00:00Z")), { type: "openRegister", opening: 2000000 }, "2026-09-21T09:00:00Z");
  let n = b;
  for (const method of ["Efectivo", "Transferencia", "Tarjeta"] as const)
    n = applyAction(n, {
      type: "sale",
      items: [{ productId: "p11", quantity: 1000 }],
      method,
    }, "2026-09-21T10:00:00Z");
  n = applyAction(n, { type: "cash", kind: "withdrawal", amount: 50000, reason: "Retiro" }, "2026-09-21T11:00:00Z");
  const caja = openRegister(n)!;
  const d = registerBreakdown(n, caja);
  assert.equal(d.salesCount, 3);
  assert.deepEqual(
    d.sales.map((s) => s.method).sort(),
    ["Efectivo", "Tarjeta", "Transferencia"],
  );
  assert.equal(d.withdrawals, 50000);
  const efectivo = d.sales.find((s) => s.method === "Efectivo")!.amount;
  assert.equal(d.cashSales, efectivo);
  assert.ok(efectivo < d.salesTotal);
  assert.equal(d.expected, 2000000 + efectivo - 50000);
  // Las ventas anteriores a la apertura no entran en el turno.
  assert.ok(d.salesTotal < n.sales.reduce((a, s) => a + s.total, 0));
});
test("el arqueo solo resta los pagos a proveedores hechos en efectivo", () => {
  let b = applyAction(createDemo(new Date("2026-09-20T23:00:00Z")), { type: "openRegister", opening: 2000000 }, "2026-09-21T09:00:00Z");
  const base = registerExpected(b, openRegister(b)!);
  b = applyAction(b, { type: "purchase", supplierId: b.suppliers[0].id, items: [{ productId: "p11", quantity: 1000, cost: 100000 }], paid: 100000, method: "Transferencia" }, "2026-09-21T10:00:00Z");
  const purchaseId = b.purchases.at(-1)!.id;
  assert.equal(b.payments.at(-1)!.method, "Transferencia");
  assert.equal(registerExpected(b, openRegister(b)!), base);
  b = applyAction(b, { type: "purchase", supplierId: b.suppliers[0].id, items: [{ productId: "p11", quantity: 1000, cost: 100000 }], paid: 40000, method: "Efectivo" }, "2026-09-21T11:00:00Z");
  assert.equal(registerExpected(b, openRegister(b)!), base - 40000);
  b = applyAction(b, { type: "payPurchase", id: b.purchases.at(-1)!.id, amount: 60000, method: "Tarjeta" }, "2026-09-21T12:00:00Z");
  assert.equal(registerExpected(b, openRegister(b)!), base - 40000);
  const d = registerBreakdown(b, openRegister(b)!);
  assert.equal(d.purchases, 40000);
  assert.deepEqual(d.otherPayments.sort((x, y) => x.method.localeCompare(y.method)), [
    { kind: "purchase", method: "Tarjeta", amount: 60000 },
    { kind: "purchase", method: "Transferencia", amount: 100000 },
  ]);
  assert.ok(b.purchases.find((p) => p.id === purchaseId)!.paid === 100000);
});
test("el arqueo solo resta los gastos pagados en efectivo, también al editarlos", () => {
  let b = applyAction(createDemo(new Date("2026-09-20T23:00:00Z")), { type: "openRegister", opening: 2000000 }, "2026-09-21T09:00:00Z");
  const expected = () => registerExpected(b, openRegister(b)!);
  const base = expected();
  b = applyAction(b, { type: "expense", name: "Luz", category: "Fijo", amount: 30000, paid: true, method: "Transferencia" }, "2026-09-21T10:00:00Z");
  const luz = b.expenses.at(-1)!;
  assert.equal(luz.method, "Transferencia");
  assert.equal(expected(), base);
  b = applyAction(b, { type: "expense", id: luz.id, name: "Luz", category: "Fijo", amount: 30000, paid: true, method: "Efectivo" }, "2026-09-21T11:00:00Z");
  assert.equal(expected(), base - 30000);
  b = applyAction(b, { type: "expense", id: luz.id, name: "Luz", category: "Fijo", amount: 30000, paid: true, method: "Tarjeta" }, "2026-09-21T11:30:00Z");
  assert.equal(expected(), base);
  b = applyAction(b, { type: "expense", name: "Envases", category: "Variable", amount: 5000, paid: false }, "2026-09-21T12:00:00Z");
  b = applyAction(b, { type: "payExpense", id: b.expenses.at(-1)!.id, method: "Efectivo" }, "2026-09-21T12:30:00Z");
  assert.equal(expected(), base - 5000);
  const before = summary(b).balance;
  b = applyAction(b, { type: "deleteExpense", id: luz.id }, "2026-09-21T13:00:00Z");
  assert.equal(expected(), base - 5000);
  assert.equal(summary(b).balance, before + 30000);
  const d = registerBreakdown(b, openRegister(b)!);
  assert.equal(d.expenses, 5000);
  assert.deepEqual(d.otherPayments, []);
});
test("cerrar caja asienta la diferencia y el saldo sigue al arqueo", () => {
  const b = applyAction(createDemo(new Date("2026-09-20T23:00:00Z")), { type: "openRegister", opening: 2000000 }, "2026-09-21T09:00:00Z");
  const antes = summary(b).balance;
  const esperado = registerExpected(b, openRegister(b)!);
  const faltante = applyAction(b, { type: "closeRegister", counted: esperado - 30000 }, "2026-09-21T22:00:00Z");
  const caja = faltante.registers.at(-1)!;
  assert.equal(caja.expected, esperado);
  assert.equal(caja.difference, -30000);
  assert.ok(caja.closedAt);
  assert.equal(openRegister(faltante), undefined);
  assert.equal(summary(faltante).balance, antes - 30000);
  const sobrante = applyAction(b, { type: "closeRegister", counted: esperado + 30000 }, "2026-09-21T22:00:00Z");
  assert.equal(sobrante.registers.at(-1)!.difference, 30000);
  assert.equal(summary(sobrante).balance, antes + 30000);
  const exacto = applyAction(b, { type: "closeRegister", counted: esperado }, "2026-09-21T22:00:00Z");
  assert.equal(exacto.registers.at(-1)!.difference, 0);
  assert.equal(summary(exacto).balance, antes);
  assert.deepEqual(exacto.payments, b.payments, "sin diferencia no se mueve dinero");
});
test("no se puede cerrar una caja que no está abierta", () => {
  const b = createDemo();
  assert.throws(
    () => applyAction(b, { type: "closeRegister", counted: 1000 }),
    /No hay ninguna caja abierta/,
  );
});
test("los negocios guardados sin caja siguen abriendo", () => {
  const b = createDemo();
  const legacy = { ...b, registers: undefined as never };
  assert.deepEqual(withRegisters(legacy).registers, []);
  assert.equal(withRegisters(b), b, "si ya tiene caja no copia el negocio");
});
