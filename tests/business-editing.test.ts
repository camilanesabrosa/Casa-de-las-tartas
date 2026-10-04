import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { applyAction } from "../lib/actions";
import { createFreshBusiness, getProductCategories, getProductCategoryCodes, categoryLetter, productCode, matchesCode, summary, type Business } from "../lib/business";
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
  assert.equal(productCode(created, getProductCategories(b)), "F1");
  assert.ok(matchesCode(created, "f 1", getProductCategories(b)));
  assert.ok(matchesCode(created, "1 f", getProductCategories(b)));
  assert.throws(() => applyAction(b, { type: "product", product }), /ya está usado/);
  b = applyAction(b, { type: "productCategory", name: "Postres" });
  assert.equal(productCode(created, getProductCategories(b)), "F1");
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

test("renombrar categorías iniciales y nuevas conserva letras, productos e historial", () => {
  let b = applyAction(createFreshBusiness(), { type: "productCategory", name: "Milanesas" });
  const product = b.products[0];
  b = applyAction(b, { type: "adjustStock", productId: product.id, quantity: 1000, reason: "Prueba" });
  b = applyAction(b, { type: "sale", items: [{ productId: product.id, quantity: 500 }], method: "Efectivo" });
  const sales = structuredClone(b.sales);
  const before = b.products.filter((p) => p.category === "Precocidos").map((p) => ({ ...p, category: "Listos para cocinar" }));
  b = applyAction(b, { type: "renameProductCategory", name: "Precocidos", newName: " Listos para cocinar " });
  assert.deepEqual(b.products.filter((p) => p.category === "Listos para cocinar"), before);
  assert.equal(categoryLetter("Listos para cocinar", getProductCategories(b), getProductCategoryCodes(b)), "A");
  assert.equal(getProductCategories(b)[0], "Listos para cocinar");
  assert.ok(!getProductCategories(b).includes("Precocidos"));
  b = applyAction(b, { type: "renameProductCategory", name: "Milanesas", newName: "milanesas caseras" });
  assert.equal(getProductCategoryCodes(b)["milanesas caseras"], "F");
  assert.deepEqual(b.sales, sales);
  assert.throws(() => applyAction(b, { type: "renameProductCategory", name: "Pastas", newName: "congelados" }), /ya existe/);
  assert.throws(() => applyAction(b, { type: "renameProductCategory", name: "Pastas", newName: "Todos" }), /otro nombre/);
  assert.throws(() => applyAction(b, { type: "renameProductCategory", name: "Inexistente", newName: "Otra" }), /No encontramos/);
});

test("eliminar una categoría vacía no la recrea ni cambia las letras de las demás", () => {
  let b = applyAction(createFreshBusiness(), { type: "productCategory", name: "Milanesas" });
  b = applyAction(b, { type: "productCategory", name: "Postres" });
  const codes = getProductCategoryCodes(b);
  b = applyAction(b, { type: "deleteProductCategory", name: "Milanesas" });
  b = applyAction(b, { type: "expense", name: "Internet", category: "Fijo", amount: 1000, paid: false });
  b = applyAction(b, { type: "resetBusiness" });
  assert.ok(!getProductCategories(b).includes("Milanesas"));
  assert.equal(getProductCategoryCodes(b).Postres, codes.Postres);
  b = applyAction(b, { type: "productCategory", name: "Panadería" });
  assert.equal(getProductCategoryCodes(b)["Panadería"], "H");
});

test("eliminar una categoría con productos exige un destino válido y resuelve números repetidos", () => {
  let b = applyAction(createFreshBusiness(), { type: "productCategory", name: "Milanesas" });
  const product = { ...b.products[0], id: undefined, category: "Milanesas", number: 1, stock: 2000, price: 700000 };
  b = applyAction(b, { type: "product", product });
  const first = b.products.at(-1)!;
  b = applyAction(b, { type: "product", product: { ...product, number: 11 } });
  const second = b.products.at(-1)!;
  b = applyAction(b, { type: "sale", items: [{ productId: first.id, quantity: 500 }], method: "Efectivo" });
  const sales = structuredClone(b.sales);
  const totalStock = b.products.reduce((sum, p) => sum + p.stock, 0);
  assert.throws(() => applyAction(b, { type: "deleteProductCategory", name: "Milanesas" }), /donde se moverán/);
  assert.throws(() => applyAction(b, { type: "deleteProductCategory", name: "Milanesas", targetCategory: "Milanesas" }), /otra categoría/);
  assert.throws(() => applyAction(b, { type: "deleteProductCategory", name: "Milanesas", targetCategory: "Inexistente" }), /No encontramos/);
  b = applyAction(b, { type: "deleteProductCategory", name: "Milanesas", targetCategory: "Precocidos" });
  const moved = b.products.find((p) => p.id === first.id)!;
  assert.equal(moved.category, "Precocidos");
  assert.notEqual(moved.number, 1, "resuelve un cartel repetido sin pisar el existente");
  assert.equal(b.products.find((p) => p.id === second.id)!.number, 11, "conserva los números libres");
  assert.equal(moved.stock, 1500);
  assert.equal(moved.price, 700000);
  assert.equal(b.products.reduce((sum, p) => sum + p.stock, 0), totalStock);
  const numbers = b.products.filter((p) => p.category === "Precocidos").map((p) => p.number);
  assert.equal(new Set(numbers).size, numbers.length);
  assert.deepEqual(b.sales, sales);
  assert.ok(!getProductCategories(b).includes("Milanesas"));
});

test("se pueden eliminar todas las categorías vacías y crear productos sin categorías iniciales", () => {
  let b: Business = { ...createFreshBusiness(), products: [] };
  for (const name of getProductCategories(b)) b = applyAction(b, { type: "deleteProductCategory", name });
  assert.deepEqual(getProductCategories(b), []);
  b = applyAction(b, { type: "resetBusiness" });
  assert.deepEqual(getProductCategories(b), []);
  b = applyAction(b, { type: "product", product: { ...createFreshBusiness().products[0], id: undefined, category: "Nueva", stock: 0 } });
  assert.deepEqual(getProductCategories(b), ["Nueva"]);
  assert.equal(getProductCategoryCodes(b).Nueva, "A");
});

test("las letras siguen siendo únicas después de Z y admiten nombres especiales", () => {
  let b = createFreshBusiness();
  for (let index = 0; index < 23; index++) b = applyAction(b, { type: "productCategory", name: `Categoría ${index}` });
  assert.equal(getProductCategoryCodes(b)["Categoría 22"], "AB");
  b = applyAction(b, { type: "renameProductCategory", name: "Categoría 22", newName: "__proto__" });
  assert.equal(getProductCategoryCodes(b).__proto__, "AB");
  const product = { category: "__proto__", number: 12 };
  assert.equal(productCode(product, getProductCategories(b), getProductCategoryCodes(b)), "AB12");
  for (const query of ["ab12", " A B 1 2 ", "12AB", "12 a b"])
    assert.ok(matchesCode(product, query, getProductCategories(b), getProductCategoryCodes(b)));
  for (const query of ["AB1", "AB", "12", "A12", "AB120"])
    assert.ok(!matchesCode(product, query, getProductCategories(b), getProductCategoryCodes(b)));
  assert.equal(new Set(Object.values(getProductCategoryCodes(b))).size, getProductCategories(b).length);
});

test("se puede elegir y cambiar la letra de una categoría sin modificar productos ni ventas anteriores", () => {
  let b = applyAction(createFreshBusiness(), { type: "productCategory", name: "Milanesas", code: " m " });
  assert.equal(getProductCategoryCodes(b).Milanesas, "M");
  const product = b.products[0];
  b = applyAction(b, { type: "adjustStock", productId: product.id, quantity: 1000, reason: "Prueba" });
  b = applyAction(b, { type: "sale", items: [{ productId: product.id, quantity: 500 }], method: "Efectivo" });
  const products = structuredClone(b.products);
  const sales = structuredClone(b.sales);
  b = applyAction(b, { type: "renameProductCategory", name: "Precocidos", newName: "Precocidos", code: "x" });
  assert.deepEqual(b.products, products);
  assert.deepEqual(b.sales, sales);
  const updated = b.products[0];
  const names = getProductCategories(b);
  const codes = getProductCategoryCodes(b);
  assert.equal(productCode(updated, names, codes), "X1");
  assert.ok(matchesCode(updated, "x1", names, codes));
  assert.ok(matchesCode(updated, "1x", names, codes));
  assert.ok(!matchesCode(updated, "A1", names, codes));
  assert.throws(() => applyAction(b, { type: "productCategory", name: "Otra", code: "X" }), /ya está usada/);
  assert.throws(() => applyAction(b, { type: "renameProductCategory", name: "Milanesas", newName: "Milanesas", code: "c" }), /ya está usada/);
  for (const code of ["", "A1", "Ñ", "AAAA", "A-B"]) assert.throws(() => applyAction(b, { type: "productCategory", name: "Otra", code }));
});

test("las letras elegidas no duplican las asignaciones automáticas ni superan tres caracteres", () => {
  let b = applyAction(createFreshBusiness(), { type: "productCategory", name: "Última", code: "ZZZ" });
  b = applyAction(b, { type: "productCategory", name: "Nueva" });
  assert.equal(getProductCategoryCodes(b).Nueva, "F");
  assert.equal(getProductCategoryCodes(b)["Última"], "ZZZ");
  b = applyAction(b, { type: "renameProductCategory", name: "Nueva", newName: "Nueva", code: "AA" });
  b = applyAction(b, { type: "productCategory", name: "Otra" });
  const codes = Object.values(getProductCategoryCodes(b));
  assert.equal(new Set(codes).size, codes.length);
  assert.ok(codes.every((code) => /^[A-Z]{1,3}$/.test(code)));
});

test("SQLite conserva categorías vacías, gastos editados y precios históricos al volver a leer", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cdt-editing-test-"));
  process.env.MOSTRADOR_DATABASE_PATH = join(directory, "business.sqlite");
  // Simulate an installed version whose category table predates editable codes.
  const legacyDatabase = new DatabaseSync(process.env.MOSTRADOR_DATABASE_PATH);
  legacyDatabase.exec("CREATE TABLE product_categories (owner_id TEXT NOT NULL, position INTEGER NOT NULL, name TEXT NOT NULL, PRIMARY KEY (owner_id, name))");
  legacyDatabase.close();
  const owner = "editing-tests";
  let b: Business = await readBusiness(owner);
  const save = async (action: unknown) => {
    b = await updateBusiness(owner, b.version, randomUUID(), action);
    b = await readBusiness(owner);
  };
  try {
    await save({ type: "productCategory", name: "Panadería", code: "P" });
    assert.ok(getProductCategories(b).includes("Panadería"));
    assert.equal(getProductCategoryCodes(b)["Panadería"], "P");
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
    const previousSales = structuredClone(b.sales);
    await save({ type: "renameProductCategory", name: "Precocidos", newName: "Listos", code: "L" });
    assert.equal(getProductCategoryCodes(b).Listos, "L");
    assert.equal(productCode(b.products.find((p) => p.id === id)!, getProductCategories(b), getProductCategoryCodes(b)), "L1");
    assert.equal(b.products.find((p) => p.id === id)!.category, "Listos");
    assert.ok(!getProductCategories(b).includes("Precocidos"));
    await save({ type: "deleteProductCategory", name: "Congelados", targetCategory: "Listos" });
    assert.ok(!getProductCategories(b).includes("Congelados"));
    assert.equal(getProductCategoryCodes(b).Pastas, "C");
    assert.deepEqual(b.sales, previousSales);
    await save({ type: "resetBusiness" });
    assert.ok(getProductCategories(b).includes("Panadería"));
    await save({ type: "deleteProductCategory", name: "Panadería" });
    await save({ type: "productCategory", name: "Postres" });
    assert.ok(!getProductCategories(b).includes("Panadería"));
    assert.equal(getProductCategoryCodes(b).Pastas, "C");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
