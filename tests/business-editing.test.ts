import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { applyAction } from "../lib/actions";
import { createFreshBusiness, getProductCategories, productCode, matchesCode, summary, type Business } from "../lib/business";
import { dailyBalances } from "../lib/calendar";
import { readBusiness, updateBusiness } from "../db/business-store";

test("gastos: conserva el tipo elegido al crear, editar y pagar", () => {
  for (const category of ["Fijo", "Variable"] as const) {
    let b = applyAction(createFreshBusiness(), { type: "expense", name: "Prueba", category, amount: 150000, paid: false });
    const expense = b.expenses[0];
    assert.equal(expense.category, category);
    b = applyAction(b, { type: "payExpense", id: expense.id });
    assert.equal(b.expenses[0].category, category);
    const other = category === "Fijo" ? "Variable" : "Fijo";
    const edited = applyAction(b, { type: "expense", id: expense.id, name: "Corregido", category: other, amount: 150000, paid: true });
    assert.equal(edited.expenses[0].category, other);
    assert.equal(edited.expenses[0].id, expense.id);
    assert.deepEqual(edited.payments, b.payments, "editar el tipo no vuelve a pagar");
    assert.equal(edited.expenses[0].date, expense.date);
  }
});

test("editar y eliminar un gasto pagado corrige hoy sin reescribir el pago ni la caja cerrada", () => {
  let b = applyAction(createFreshBusiness(), { type: "openRegister", opening: 500000 }, "2026-10-01T09:00:00Z");
  b = applyAction(b, { type: "expense", name: "Internet", category: "Fijo", amount: 200000, paid: true }, "2026-10-01T10:00:00Z");
  b = applyAction(b, { type: "closeRegister", counted: 300000 }, "2026-10-01T11:00:00Z");
  const closed = structuredClone(b.registers[0]);
  const originalPayment = structuredClone(b.payments[0]);
  const expense = b.expenses[0];
  b = applyAction(b, { type: "expense", id: expense.id, name: "Internet", category: "Fijo", amount: 150000, paid: true }, "2026-10-02T10:00:00Z");
  assert.equal(summary(b).balance, -150000);
  assert.deepEqual(b.payments[0], originalPayment);
  assert.equal(b.payments.at(-1)!.amount, -50000);
  assert.deepEqual(b.registers[0], closed);
  assert.equal(dailyBalances(b).get("2026-10-01")!.expenses, 200000);
  assert.equal(dailyBalances(b).get("2026-10-02")!.balance, 50000);
  b = applyAction(b, { type: "deleteExpense", id: expense.id }, "2026-10-03T10:00:00Z");
  assert.equal(b.expenses.length, 0);
  assert.equal(summary(b).balance, 0);
  assert.deepEqual(b.payments[0], originalPayment);
  assert.deepEqual(b.registers[0], closed);
  assert.equal(dailyBalances(b).get("2026-10-03")!.balance, 150000);
  assert.throws(() => applyAction(b, { type: "deleteExpense", id: expense.id }), /No encontramos/);
});

test("editar el importe de un pendiente actualiza la deuda y pagarlo una vez descuenta el nuevo importe", () => {
  let b = applyAction(createFreshBusiness(), { type: "expense", name: "Envases", category: "Variable", amount: 100000, paid: false });
  const id = b.expenses[0].id;
  b = applyAction(b, { type: "expense", id, name: "Envases", category: "Variable", amount: 250000, paid: false });
  assert.equal(summary(b).debt, 250000);
  assert.equal(summary(b).balance, 0);
  assert.equal(b.payments.length, 0);
  b = applyAction(b, { type: "payExpense", id });
  assert.equal(summary(b).debt, 0);
  assert.equal(summary(b).balance, -250000);
  assert.throws(() => applyAction(b, { type: "payExpense", id }), /ya está pagado/);
});

test("un gasto puede pasar de pagado a pendiente y volver a pagarse sin duplicar dinero", () => {
  let b = applyAction(createFreshBusiness(), { type: "expense", name: "Envases", category: "Variable", amount: 100000, paid: true });
  const expense = b.expenses[0];
  b = applyAction(b, { type: "expense", ...expense, paid: false });
  assert.equal(summary(b).balance, 0);
  assert.equal(summary(b).debt, 100000);
  b = applyAction(b, { type: "payExpense", id: expense.id });
  assert.equal(summary(b).balance, -100000);
  b = applyAction(b, { type: "deleteExpense", id: expense.id });
  assert.equal(summary(b).balance, 0);
});

test("eliminar un pendiente quita la deuda sin crear movimientos de dinero", () => {
  const before = applyAction(createFreshBusiness(), { type: "expense", name: "Luz", category: "Fijo", amount: 100000, paid: false });
  const next = applyAction(before, { type: "deleteExpense", id: before.expenses[0].id });
  assert.equal(summary(next).debt, 0);
  assert.deepEqual(next.payments, before.payments);
});

test("categorías nuevas tienen códigos estables, aparecen vacías y se conservan al reiniciar el negocio", () => {
  let b = applyAction(createFreshBusiness(), { type: "productCategory", name: "Milanesas" });
  assert.ok(getProductCategories(b).includes("Milanesas"));
  assert.throws(() => applyAction(b, { type: "productCategory", name: " milanesas " }), /ya existe/);
  assert.throws(() => applyAction(b, { type: "productCategory", name: "Todos" }), /otro nombre/);
  const product = { ...b.products[0], id: undefined, category: "milanesas", number: 1, stock: 1000 };
  b = applyAction(b, { type: "product", product });
  const created = b.products.at(-1)!;
  assert.equal(created.category, "Milanesas");
  assert.equal(productCode(created, getProductCategories(b)), "1F");
  assert.ok(matchesCode(created, "1 f", getProductCategories(b)));
  assert.throws(() => applyAction(b, { type: "product", product }), /ya está usado/);
  b = applyAction(b, { type: "productCategory", name: "Postres" });
  assert.equal(productCode(created, getProductCategories(b)), "1F");
  b = applyAction(b, { type: "resetBusiness" });
  assert.ok(getProductCategories(b).includes("Postres"));
});

test("cambiar milanesas de $7000 a $9000 solo cambia la siguiente venta, incluyendo venta por peso", () => {
  let b = createFreshBusiness();
  const product = b.products[0];
  b = applyAction(b, { type: "adjustStock", productId: product.id, quantity: 3000, reason: "Prueba" });
  b = applyAction(b, { type: "productPrice", id: product.id, price: 700000 });
  b = applyAction(b, { type: "sale", items: [{ productId: product.id, quantity: 1000 }], method: "Efectivo" });
  const originalSale = structuredClone(b.sales[0]);
  const beforeStock = b.products[0].stock;
  b = applyAction(b, { type: "productPrice", id: product.id, price: 900000 });
  assert.equal(b.products[0].stock, beforeStock);
  assert.deepEqual(b.sales[0], originalSale);
  b = applyAction(b, { type: "sale", items: [{ productId: product.id, quantity: 500 }], method: "Efectivo" });
  assert.equal(b.sales[0].items[0].price, 700000);
  assert.equal(b.sales[0].total, 700000);
  assert.equal(b.sales[1].items[0].price, 900000);
  assert.equal(b.sales[1].total, 450000);
  assert.throws(() => applyAction(b, { type: "productPrice", id: product.id, price: 0 }));
});

test("SQLite conserva categorías vacías, gastos editados y precios históricos al volver a leer", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cdt-editing-test-"));
  process.env.MOSTRADOR_DATABASE_PATH = join(directory, "business.sqlite");
  const owner = "editing-tests";
  let b: Business = await readBusiness(owner);
  const save = async (action: unknown) => {
    b = await updateBusiness(owner, b.version, randomUUID(), action);
    b = await readBusiness(owner);
  };
  try {
    await save({ type: "productCategory", name: "Panadería" });
    assert.ok(getProductCategories(b).includes("Panadería"));
    assert.equal(b.products.filter((p) => p.category === "Panadería").length, 0);
    await save({ type: "expense", name: "Luz", category: "Fijo", amount: 100000, paid: true });
    const expenseId = b.expenses[0].id;
    await save({ type: "expense", id: expenseId, name: "Luz corregida", category: "Variable", amount: 150000, paid: true });
    assert.equal(b.expenses[0].name, "Luz corregida");
    assert.equal(b.expenses[0].category, "Variable");
    assert.equal(summary(b).balance, -150000);
    await save({ type: "deleteExpense", id: expenseId });
    assert.equal(b.expenses.length, 0);
    assert.equal(summary(b).balance, 0);
    const id = b.products[0].id;
    await save({ type: "adjustStock", productId: id, quantity: 2000, reason: "Prueba" });
    await save({ type: "productPrice", id, price: 700000 });
    await save({ type: "sale", items: [{ productId: id, quantity: 1000 }], method: "Efectivo" });
    await save({ type: "productPrice", id, price: 900000 });
    assert.equal(b.products[0].price, 900000);
    assert.equal(b.sales[0].items[0].price, 700000);
    assert.equal(b.sales[0].total, 700000);
    await save({ type: "resetBusiness" });
    assert.ok(getProductCategories(b).includes("Panadería"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
