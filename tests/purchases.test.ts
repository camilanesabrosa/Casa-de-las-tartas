import test from "node:test";
import assert from "node:assert/strict";
import { createDemo as baseDemo, normalizeBusiness, summary, type Business } from "../lib/business";
import { applyAction as baseApplyAction } from "../lib/actions";
const createDemo = () => normalizeBusiness(baseDemo());
const applyAction = (...args: Parameters<typeof baseApplyAction>) => normalizeBusiness(baseApplyAction(...args));
const invoice = {
  type: "purchase", supplierId: "s1", date: "2026-10-10", invoiceNumber: "A-101", paid: 100000,
  items: [{ productId: "p16", quantity: 500, cost: 480000 }, { productId: "p11", quantity: 2000, cost: 90000 }],
};
test("una factura mixta guarda artículos, costos, stock y un solo pago", () => {
  const b = createDemo();
  const next = applyAction(b, invoice, "2026-10-13T15:30:00Z");
  const purchase = next.purchases.at(-1)!;
  assert.equal(purchase.total, 420000);
  assert.equal(purchase.paid, 100000);
  assert.equal(purchase.invoiceNumber, "A-101");
  assert.equal(purchase.date, "2026-10-10T12:00:00-03:00");
  assert.equal(purchase.supplierName, "Alimentos del Valle");
  assert.deepEqual(purchase.items.map((i) => [i.name, i.quantity, i.unit, i.cost, i.total]), [
    ["Ravioles", 500, "kg", 480000, 240000], ["Empanadas · Carne", 2000, "unit", 90000, 180000],
  ]);
  assert.equal(next.products.find((p) => p.id === "p16")!.stock, 3250);
  assert.equal(next.products.find((p) => p.id === "p11")!.stock, 38000);
  assert.equal(next.products.find((p) => p.id === "p11")!.cost, 90000);
  assert.equal(next.movements.length, b.movements.length + 2);
  assert.equal(next.payments.length, b.payments.length + 1);
  assert.equal(next.payments.at(-1)!.reference, purchase.id);
  assert.equal(next.payments.at(-1)!.date, "2026-10-13T15:30:00Z");
  assert.equal(summary(next).debt, summary(b).debt + 320000);
  assert.equal(summary(next).balance, summary(b).balance - 100000);
});
test("los pagos sucesivos se vinculan a la factura y sus artículos sin recibir stock otra vez", () => {
  const b = applyAction(createDemo(), invoice);
  const purchase = b.purchases.at(-1)!;
  const first = applyAction(b, { type: "payPurchase", id: purchase.id, amount: 150000 }, "2026-10-14T15:00:00Z");
  const next = applyAction(first, { type: "payPurchase", id: purchase.id, amount: 170000 }, "2026-10-15T15:00:00Z");
  assert.equal(next.purchases.at(-1)!.paid, purchase.total);
  assert.deepEqual(next.products, b.products);
  assert.deepEqual(next.movements, b.movements);
  assert.deepEqual(next.purchases.at(-1)!.items, purchase.items);
  const payments = next.payments.filter((p) => p.reference === purchase.id && p.kind === "purchase");
  assert.deepEqual(payments.map((p) => p.amount), [100000, 150000, 170000]);
  assert.equal(payments.reduce((sum, p) => sum + p.amount, 0), purchase.total);
  assert.throws(() => applyAction(next, { type: "payPurchase", id: purchase.id, amount: 1 }), /supera la deuda/);
});
test("editar productos y proveedores conserva los datos históricos de las facturas", () => {
  const b = applyAction(createDemo(), invoice);
  const product = b.products.find((p) => p.id === "p11")!;
  const next = applyAction(applyAction(b, { type: "product", product: { ...product, name: "Empanadas nuevas", cost: 99999 } }), {
    type: "supplier", id: "s1", name: "Nuevo nombre", phone: "123456",
  });
  assert.deepEqual(next.purchases, b.purchases);
  assert.equal(next.suppliers[0].name, "Nuevo nombre");
});
test("una factura inválida no deja productos, proveedores, stock ni pagos a medio guardar", () => {
  const b = createDemo();
  const before = structuredClone(b);
  const badInvoices = [
    { ...invoice, items: [] },
    { ...invoice, items: [...invoice.items, { productId: "missing", quantity: 1000, cost: 100 }] },
    { ...invoice, items: [{ productId: "p11", quantity: 500, cost: 100 }] },
    { ...invoice, paid: 420001 },
    { ...invoice, supplierId: "missing" },
    { ...invoice, items: [{ productId: "p16", quantity: 1, cost: 1 }], paid: 0 },
    { ...invoice, date: "2026-02-30" },
    { ...invoice, items: [{ productId: "p16", quantity: 0, cost: 100 }] },
    { ...invoice, items: [{ productId: "p16", quantity: 1000, cost: -1 }] },
    { ...invoice, supplierId: undefined, supplier: { name: "Nuevo", phone: "" },
      items: [{ product: { name: "Artículo nuevo", unit: "unit" }, quantity: 1000, cost: 100 }], paid: 101 },
  ];
  for (const action of badInvoices) {
    assert.throws(() => applyAction(b, action));
    assert.deepEqual(b, before);
  }
});
test("un comprobante no se duplica para el mismo proveedor, y admite numeración de otro proveedor", () => {
  const b = applyAction(createDemo(), invoice);
  assert.throws(() => applyAction(b, { ...invoice, invoiceNumber: " a-101 " }), /Ya registraste/);
  assert.equal(applyAction(b, { ...invoice, supplierId: "s3" }).purchases.length, b.purchases.length + 1);
  const withoutNumber = applyAction(b, { ...invoice, invoiceNumber: "" });
  assert.equal(applyAction(withoutNumber, { ...invoice, invoiceNumber: "" }).purchases.length, b.purchases.length + 2);
});
test("proveedor y productos nuevos se crean dentro de la factura con el stock recibido", () => {
  const b = createDemo();
  const next = applyAction(b, {
    type: "purchase", supplier: { name: "Nuevo proveedor", phone: "261123456" }, paid: 500,
    items: [
      { product: { name: "Producto por kilo", unit: "kg" }, quantity: 250, cost: 4000 },
      { product: { name: "Producto por unidad", variety: "Prueba", category: "Varios", unit: "unit" }, quantity: 3000, cost: 200 },
    ],
  });
  const purchase = next.purchases.at(-1)!;
  assert.equal(purchase.total, 1600);
  assert.equal(purchase.paid, 500);
  assert.equal(purchase.items.length, 2);
  assert.equal(next.suppliers.at(-1)!.id, purchase.supplierId);
  assert.equal(next.suppliers.at(-1)!.phone, "261123456");
  assert.deepEqual(next.products.slice(-2).map((p) => [p.stock, p.price, p.published]), [[250, 0, false], [3000, 0, false]]);
  assert.equal(next.products.filter((p) => p.published).length, b.products.filter((p) => p.published).length);
  for (const product of next.products.slice(-2))
    assert.equal(next.movements.filter((m) => m.productId === product.id).reduce((sum, m) => sum + m.quantity, 0), product.stock);
  assert.throws(() => applyAction(next, { type: "sale", items: [
    { productId: purchase.items[0].productId, quantity: 100 }, { productId: "p11", quantity: 1000 },
  ], method: "Efectivo" }), /precio de venta/);
});
test("productos repetidos con distintos costos mantienen los renglones de la factura", () => {
  const b = createDemo();
  const next = applyAction(b, { ...invoice, paid: 0, items: [
    { productId: "p16", quantity: 250, cost: 400000 }, { productId: "p16", quantity: 250, cost: 500000 },
  ] });
  assert.equal(next.purchases.at(-1)!.total, 225000);
  assert.equal(next.purchases.at(-1)!.items.length, 2);
  assert.equal(next.products.find((p) => p.id === "p16")!.stock, 3250);
});
test("eliminar un proveedor sin compras y dar de baja uno con historial conserva cuentas y pagos", () => {
  const b = createDemo();
  const removed = applyAction(b, { type: "removeSupplier", id: "s2" });
  assert.ok(!removed.suppliers.some((s) => s.id === "s2"));
  const archived = applyAction(removed, { type: "removeSupplier", id: "s1" });
  assert.equal(archived.suppliers.find((s) => s.id === "s1")!.archived, true);
  assert.deepEqual(archived.purchases, b.purchases);
  assert.deepEqual(archived.payments, b.payments);
  assert.throws(() => applyAction(archived, invoice), /proveedor activo/);
  const paid = applyAction(archived, { type: "payPurchase", id: "c1", amount: 100000 });
  assert.equal(paid.purchases[0].paid, 340000);
  const restored = applyAction(paid, { type: "restoreSupplier", id: "s1" });
  assert.equal(restored.suppliers.find((s) => s.id === "s1")!.archived, false);
  assert.equal(applyAction(restored, invoice).purchases.length, b.purchases.length + 1);
  assert.throws(() => applyAction(b, { type: "removeSupplier", id: "missing" }), /no encontrado/);
});
test("compras anteriores se migran sin alterar revisiones, referencias, pagos ni stock", () => {
  const b = createDemo();
  const legacy: Business & { completedRequests: string[] } = {
    ...b, completedRequests: ["request-1"],
    purchases: b.purchases.map(({ items, supplierName: _name, invoiceNumber: _number, ...purchase }) => ({
      ...purchase, productId: items[0].productId, quantity: items[0].quantity,
    })),
  };
  const before = structuredClone(legacy);
  const next = normalizeBusiness(legacy);
  assert.deepEqual(legacy, before);
  assert.equal(next.version, b.version);
  assert.deepEqual(next.completedRequests, ["request-1"]);
  assert.deepEqual(next.products, b.products);
  assert.deepEqual(next.movements, b.movements);
  assert.deepEqual(next.payments, b.payments);
  assert.equal(summary(next).debt, summary(b).debt);
  assert.equal(next.purchases[0].items[0].cost, 480000);
  assert.equal(next.purchases[0].items[0].total, b.purchases[0].total);
  assert.equal(next.purchases[0].items[0].name, "Ravioles");
  assert.deepEqual(normalizeBusiness(next), next);
  const paid = applyAction(legacy, { type: "payPurchase", id: "c1", amount: 100000 });
  assert.equal(paid.purchases[0].paid, 340000);
  assert.deepEqual(paid.products, b.products);
});
