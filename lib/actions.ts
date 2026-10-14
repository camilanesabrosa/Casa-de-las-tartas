import { z } from "zod";
import {
  type Business,
  normalizeBusiness,
  type Product,
  lineTotal,
  openRegister,
  registerExpected,
  PAYMENT_METHODS,
  CASH_METHOD,
  getProductCategories,
  getProductCategoryCodes,
  autoCloseRegisters,
  registerClosingAt,
} from "./business";
const amount = z.number().int().min(0).max(100_000_000_000);
const quantity = z.number().int().positive().max(1_000_000_000);
const text = z.string().trim().min(1).max(160);
const paymentMethod = z.enum(PAYMENT_METHODS);
const supplierFields = { name: text, phone: z.string().trim().max(40) };
const purchaseProduct = z.object({
  name: text,
  variety: z.string().trim().max(160).default(""),
  category: text.default("Varios"),
  unit: z.enum(["unit", "kg"]),
});
const purchaseDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((date) => {
  const parsed = new Date(`${date}T12:00:00-03:00`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}, "Ingresá una fecha válida.");
const categoryCode = z.string().trim().toUpperCase().regex(/^[A-Z]{1,3}$/, "Usá entre 1 y 3 letras de A a Z, sin números ni símbolos.");
const productSchema = z.object({
  id: z.string().optional(),
  number: z
    .number()
    .int()
    .min(1, "El número del cartel debe ser 1 o mayor.")
    .max(999, "El número del cartel no puede pasar de 999."),
  name: text,
  variety: z.string().trim().max(160),
  category: text,
  unit: z.enum(["unit", "kg"]),
  price: amount.refine((n) => n > 0, "El precio debe ser mayor que cero."),
  cost: amount,
  stock: amount,
  minimum: amount,
  published: z.boolean(),
  imageUrl: z.string().trim().max(2048).refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password;
    } catch { return false; }
  }, "Usá un enlace de imagen que empiece con https://.").optional(),
});
export const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("resetBusiness") }),
  z.object({ type: z.literal("product"), product: productSchema }),
  z.object({ type: z.literal("deleteProduct"), id: text }),
  z.object({ type: z.literal("productCategory"), name: text, code: categoryCode.optional() }),
  z.object({ type: z.literal("renameProductCategory"), name: text, newName: text, code: categoryCode.optional() }),
  z.object({ type: z.literal("deleteProductCategory"), name: text, targetCategory: text.optional() }),
  z.object({ type: z.literal("productPrice"), id: text, price: amount.refine((n) => n > 0, "El precio debe ser mayor que cero.") }),
  z.object({
    type: z.literal("sale"),
    items: z
      .array(z.object({ productId: text, quantity }))
      .min(1)
      .max(100),
    method: paymentMethod,
  }),
  z.object({ type: z.literal("cancelSale"), id: text }),
  z.object({
    type: z.literal("adjustStock"),
    productId: text,
    stock: amount,
    reason: text,
  }),
  z.object({
    type: z.literal("supplier"),
    id: text.optional(),
    ...supplierFields,
  }),
  z.object({ type: z.literal("removeSupplier"), id: text }),
  z.object({ type: z.literal("restoreSupplier"), id: text }),
  z.object({
    type: z.literal("purchase"),
    supplierId: text.optional(),
    supplier: z.object(supplierFields).optional(),
    date: purchaseDate.optional(),
    invoiceNumber: z.string().trim().max(80).default(""),
    productId: text.optional(),
    quantity: quantity.optional(),
    cost: amount.refine((n) => n > 0).optional(),
    items: z.array(z.union([
      z.object({ productId: text, quantity, cost: amount.refine((n) => n > 0) }),
      z.object({ product: purchaseProduct, quantity, cost: amount.refine((n) => n > 0) }),
    ])).min(1, "Agregá al menos un artículo.").max(100).optional(),
    paid: amount,
    method: paymentMethod.default("Efectivo"),
  }),
  z.object({
    type: z.literal("payPurchase"),
    id: text,
    amount: amount.refine((n) => n > 0),
    method: paymentMethod.default("Efectivo"),
  }),
  z.object({
    type: z.literal("expense"),
    id: text.optional(),
    name: text,
    category: z.enum(["Fijo", "Variable"]),
    amount: amount.refine((n) => n > 0),
    paid: z.boolean(),
    method: paymentMethod.default("Efectivo"),
  }),
  z.object({ type: z.literal("payExpense"), id: text, method: paymentMethod.default("Efectivo") }),
  z.object({ type: z.literal("deleteExpense"), id: text }),
  z.object({
    type: z.literal("cash"),
    kind: z.enum(["deposit", "withdrawal"]),
    amount: amount.refine((n) => n > 0),
    reason: text,
  }),
  z.object({
    type: z.literal("openRegister"),
    opening: amount,
  }),
  z.object({
    type: z.literal("closeRegister"),
    counted: amount,
  }),
  z.object({
    type: z.literal("settings"),
    name: text,
    whatsapp: z
      .string()
      .regex(
        /^$|^\d{8,15}$/,
        "Ingresá el número completo, sin +, espacios ni guiones.",
      ),
    address: z.string().trim().max(250),
  }),
]);
export type Action = z.infer<typeof actionSchema>;
export function applyAction(
  original: Business,
  raw: unknown,
  now = new Date().toISOString(),
): Business {
  const a = actionSchema.parse(raw);
  const b = structuredClone(normalizeBusiness(autoCloseRegisters(original, now)));
  b.productCategories = getProductCategories(b);
  b.productCategoryCodes = getProductCategoryCodes(b);
  const id = (prefix: string) =>
    `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const getProduct = (pid: string) => {
    const p = b.products.find((p) => p.id === pid);
    if (!p)
      throw new Error("No encontramos ese producto. Actualizá la página.");
    return p;
  };
  const validQty = (p: Product, q: number) => {
    if (p.unit === "unit" && q % 1000)
      throw new Error(`${p.name} se vende por unidades enteras.`);
  };
  const move = (p: Product, q: number, reason: string) => {
    validQty(p, q);
    if (p.stock + q < 0)
      throw new Error(`No hay suficiente stock de ${p.name}.`);
    p.stock += q;
    b.movements.push({
      id: id("M"),
      date: now,
      productId: p.id,
      quantity: q,
      reason,
    });
  };
  const payment = (
    kind: Business["payments"][number]["kind"],
    amount: number,
    reference: string,
    method?: string,
  ) => {
    if (amount > 0)
      b.payments.push({ id: id("P"), date: now, amount, kind, reference, ...(method ? { method } : {}) });
  };
  const categoryName = (name: string) => {
    if (name.toLocaleLowerCase("es-AR") === "todos")
      throw new Error('Usá otro nombre de categoría. "Todos" se usa para mostrar todos los productos.');
    const existing = b.productCategories!.find((category) => category.toLocaleLowerCase("es-AR") === name.toLocaleLowerCase("es-AR"));
    if (existing) return existing;
    if (b.productCategories!.length >= 100) throw new Error("Podés guardar hasta 100 categorías.");
    b.productCategories!.push(name);
    b.productCategoryCodes = getProductCategoryCodes(b);
    return name;
  };
  const existingCategory = (name: string) => {
    const existing = b.productCategories!.find((category) => category.toLocaleLowerCase("es-AR") === name.toLocaleLowerCase("es-AR"));
    if (!existing) throw new Error("No encontramos esa categoría. Actualizá los datos.");
    return existing;
  };
  const assignCategoryCode = (name: string, code: string) => {
    if (Object.entries(b.productCategoryCodes!).some(([other, value]) => other !== name && value === code))
      throw new Error(`La letra ${code} ya está usada en otra categoría. Elegí una diferente.`);
    b.productCategoryCodes = Object.fromEntries([...Object.entries(b.productCategoryCodes!).filter(([other]) => other !== name), [name, code]]);
  };
  // Keep original payment dates and closed-register figures. Corrections belong
  // to today, including negative expense entries that reverse a mistaken charge.
  // Deja lo pagado del gasto en `target`, todo con el medio `method`. Si cambió
  // el medio, revierte lo registrado con el anterior para que el arqueo lo siga.
  const reconcileExpense = (expenseId: string, target: number, method = CASH_METHOD) => {
    const recorded = new Map<string, number>([[method, 0]]);
    for (const p of b.payments)
      if (p.kind === "expense" && p.reference === expenseId) {
        const m = p.method || CASH_METHOD;
        recorded.set(m, (recorded.get(m) || 0) + p.amount);
      }
    for (const [m, total] of recorded) {
      const difference = (m === method ? target : 0) - total;
      if (difference !== 0) b.payments.push({ id: id("P"), date: now, amount: difference, kind: "expense", reference: expenseId, method: m });
    }
  };
  switch (a.type) {
    case "productCategory":
      if (b.productCategories.some((name) => name.toLocaleLowerCase("es-AR") === a.name.toLocaleLowerCase("es-AR")))
        throw new Error("Esa categoría ya existe.");
      categoryName(a.name);
      if (a.code) assignCategoryCode(a.name, a.code);
      break;
    case "renameProductCategory": {
      const oldName = existingCategory(a.name);
      if (a.newName.toLocaleLowerCase("es-AR") === "todos") throw new Error('Usá otro nombre de categoría. "Todos" se usa para mostrar todos los productos.');
      if (b.productCategories.some((name) => name !== oldName && name.toLocaleLowerCase("es-AR") === a.newName.toLocaleLowerCase("es-AR")))
        throw new Error("Esa categoría ya existe.");
      b.productCategories = b.productCategories.map((name) => name === oldName ? a.newName : name);
      b.productCategoryCodes = Object.fromEntries(Object.entries(b.productCategoryCodes).map(([name, code]) => [name === oldName ? a.newName : name, code]));
      if (a.code) assignCategoryCode(a.newName, a.code);
      for (const product of b.products) if (product.category === oldName) product.category = a.newName;
      break;
    }
    case "deleteProductCategory": {
      const name = existingCategory(a.name);
      const products = b.products.filter((product) => product.category === name);
      const target = a.targetCategory ? existingCategory(a.targetCategory) : undefined;
      if (target === name) throw new Error("Elegí otra categoría para mover los productos.");
      if (products.length && !target) throw new Error("Elegí la categoría donde se moverán los productos.");
      if (target) {
        const taken = new Set(b.products.filter((product) => product.category === target).map((product) => product.number));
        const collisions = products.filter((product) => taken.has(product.number));
        for (const product of products) if (!taken.has(product.number)) taken.add(product.number);
        for (const product of collisions) {
          let number = 1;
          while (taken.has(number)) number++;
          product.number = number;
          taken.add(number);
        }
        for (const product of products) product.category = target;
      }
      b.productCategories = b.productCategories.filter((category) => category !== name);
      b.productCategoryCodes = Object.fromEntries(Object.entries(b.productCategoryCodes).filter(([category]) => category !== name));
      break;
    }
    case "productPrice":
      getProduct(a.id).price = a.price;
      break;
    case "resetBusiness":
      b.products = b.products.map((product) => ({ ...product, stock: 0 }));
      b.suppliers = [];
      b.sales = [];
      b.purchases = [];
      b.expenses = [];
      b.movements = [];
      b.payments = [];
      b.registers = [];
      break;
    case "product": {
      if (b.products.length >= 500 && !a.product.id)
        throw new Error(
          "Esta muestra admite hasta 500 variedades de productos.",
        );
      const p = a.product;
      p.category = categoryName(p.category);
      if (b.products.some((other) => other.id !== p.id && other.category === p.category && other.number === p.number))
        throw new Error("Ese número de cartel ya está usado en esta categoría. Elegí otro número.");
      validQty(p as Product, p.stock);
      validQty(p as Product, p.minimum);
      if (p.id) {
        const old = getProduct(p.id);
        if (old.unit !== p.unit)
          throw new Error(
            "Para cambiar la unidad de venta, creá otro producto y ajustá las existencias.",
          );
        Object.assign(old, p, { stock: old.stock });
      } else {
        const fresh = { ...p, id: id("ART"), stock: 0 };
        b.products.push(fresh);
        move(fresh, p.stock, "Stock inicial");
      }
      break;
    }
    case "deleteProduct": {
      const p = getProduct(a.id);
      b.products = b.products.filter((other) => other !== p);
      break;
    }
    case "sale": {
      const combined = new Map<string, number>();
      for (const i of a.items)
        combined.set(
          i.productId,
          (combined.get(i.productId) || 0) + i.quantity,
        );
      const items = Array.from(combined, ([pid, q]) => {
        const p = getProduct(pid);
        if (p.price <= 0) throw new Error(`Cargá el precio de venta de ${p.name} en Productos antes de venderlo.`);
        validQty(p, q);
        if (p.stock < q)
          throw new Error(
            `Stock insuficiente de ${p.name}. Disponible: ${p.stock / 1000} ${p.unit === "kg" ? "kg" : "unidades"}.`,
          );
        return {
          productId: p.id,
          name: [p.name, p.variety].filter(Boolean).join(" · "),
          quantity: q,
          unit: p.unit,
          price: p.price,
          cost: p.cost,
        };
      });
      const total = items.reduce(
        (sum, i) => sum + lineTotal(i.price, i.quantity),
        0,
      );
      if (total <= 0)
        throw new Error("El total de la venta debe ser mayor que cero.");
      const saleId = id("V");
      for (const i of items)
        move(getProduct(i.productId), -i.quantity, `Venta ${saleId}`);
      b.sales.push({
        id: saleId,
        date: now,
        items,
        total,
        method: a.method,
        cancelled: false,
      });
      break;
    }
    case "cancelSale": {
      const sale = b.sales.find((s) => s.id === a.id);
      if (!sale || sale.cancelled)
        throw new Error("La venta no existe o ya está anulada.");
      sale.cancelled = true;
      for (const i of sale.items) {
        const p = b.products.find((p) => p.id === i.productId);
        if (p) move(p, i.quantity, `Anulación ${sale.id}`);
      }
      break;
    }
    case "adjustStock": {
      const p = getProduct(a.productId);
      validQty(p, a.stock);
      if (a.stock === p.stock)
        throw new Error("Las existencias ya tienen ese valor.");
      move(p, a.stock - p.stock, a.reason);
      break;
    }
    case "supplier": {
      if (a.id) {
        const s = b.suppliers.find((s) => s.id === a.id);
        if (!s) throw new Error("Proveedor no encontrado.");
        Object.assign(s, { name: a.name, phone: a.phone });
      } else b.suppliers.push({ id: id("PROV"), name: a.name, phone: a.phone });
      break;
    }
    case "removeSupplier": {
      const supplier = b.suppliers.find((s) => s.id === a.id);
      if (!supplier) throw new Error("Proveedor no encontrado.");
      if (b.purchases.some((p) => p.supplierId === a.id)) supplier.archived = true;
      else b.suppliers = b.suppliers.filter((s) => s.id !== a.id);
      break;
    }
    case "restoreSupplier": {
      const supplier = b.suppliers.find((s) => s.id === a.id);
      if (!supplier) throw new Error("Proveedor no encontrado.");
      supplier.archived = false;
      break;
    }
    case "purchase": {
      if (Boolean(a.supplierId) === Boolean(a.supplier))
        throw new Error("Seleccioná un proveedor o cargá uno nuevo.");
      const supplier = a.supplier
        ? { id: id("PROV"), ...a.supplier, archived: false }
        : b.suppliers.find((s) => s.id === a.supplierId);
      if (!supplier || supplier.archived)
        throw new Error("Seleccioná un proveedor activo.");
      if (a.invoiceNumber && b.purchases.some((p) =>
        p.supplierId === supplier.id && p.invoiceNumber.toLowerCase() === a.invoiceNumber.toLowerCase()))
        throw new Error("Ya registraste ese comprobante para este proveedor.");
      const inputItems = a.items ?? (a.productId && a.quantity && a.cost ? [{ productId: a.productId, quantity: a.quantity, cost: a.cost }] : []);
      if (!inputItems.length) throw new Error("Agregá al menos un artículo.");
      const items = inputItems.map((item) => {
        let product: Product;
        if ("productId" in item) product = getProduct(item.productId);
        else {
          if (b.products.length >= 500) throw new Error("Esta muestra admite hasta 500 variedades de productos.");
          const fresh = item.product;
          if (b.products.some((p) => p.name.toLowerCase() === fresh.name.toLowerCase()
            && p.variety.toLowerCase() === fresh.variety.toLowerCase()))
            throw new Error(`Ya existe ${fresh.name}. Seleccionalo en la lista de productos.`);
          const category = categoryName(fresh.category);
          const used = new Set(b.products.filter((p) => p.category === category).map((p) => p.number));
          let number = 1;
          while (used.has(number)) number++;
          if (number > 999) throw new Error("Esta categoría no tiene números de cartel disponibles.");
          product = { ...fresh, category, number, id: id("ART"), price: 0, cost: item.cost, stock: 0, minimum: 0, published: false };
          b.products.push(product);
        }
        validQty(product, item.quantity);
        const total = lineTotal(item.cost, item.quantity);
        if (total <= 0) throw new Error("El importe de cada artículo debe ser mayor que cero.");
        return {
          productId: product.id,
          name: [product.name, product.variety].filter(Boolean).join(" · "),
          unit: product.unit,
          quantity: item.quantity,
          cost: item.cost,
          total,
        };
      });
      const total = items.reduce((sum, item) => sum + item.total, 0);
      if (!Number.isSafeInteger(total) || total > 100_000_000_000)
        throw new Error("El importe supera el máximo permitido.");
      if (a.paid > total)
        throw new Error("El pago no puede superar el total de la compra.");
      const purchaseId = id("C");
      if (a.supplier) b.suppliers.push(supplier);
      for (const item of items) {
        const product = getProduct(item.productId);
        move(product, item.quantity, `Compra ${purchaseId}`);
        product.cost = item.cost;
      }
      b.purchases.push({
        id: purchaseId,
        date: a.date ? `${a.date}T12:00:00-03:00` : now,
        supplierId: supplier.id,
        supplierName: supplier.name,
        invoiceNumber: a.invoiceNumber,
        items,
        productId: items[0].productId,
        quantity: items[0].quantity,
        total,
        paid: a.paid,
      });
      payment("purchase", a.paid, purchaseId, a.method);
      break;
    }
    case "payPurchase": {
      const p = b.purchases.find((p) => p.id === a.id);
      if (!p) throw new Error("Compra no encontrada.");
      if (a.amount > p.total - p.paid)
        throw new Error("El pago supera la deuda pendiente.");
      p.paid += a.amount;
      payment("purchase", a.amount, p.id, a.method);
      break;
    }
    case "expense": {
      if (a.id) {
        const expense = b.expenses.find((e) => e.id === a.id);
        if (!expense) throw new Error("No encontramos ese gasto. Actualizá los datos.");
        Object.assign(expense, { name: a.name, category: a.category, amount: a.amount, paid: a.paid });
        if (a.paid) expense.method = a.method;
        else delete expense.method;
        reconcileExpense(expense.id, expense.paid ? expense.amount : 0, a.method);
        break;
      }
      const expenseId = id("G");
      b.expenses.push({
        id: expenseId,
        date: now,
        name: a.name,
        category: a.category,
        amount: a.amount,
        paid: a.paid,
        ...(a.paid ? { method: a.method } : {}),
      });
      if (a.paid) payment("expense", a.amount, expenseId, a.method);
      break;
    }
    case "deleteExpense": {
      const expense = b.expenses.find((e) => e.id === a.id);
      if (!expense) throw new Error("No encontramos ese gasto. Actualizá los datos.");
      reconcileExpense(expense.id, 0);
      b.expenses = b.expenses.filter((e) => e.id !== expense.id);
      break;
    }
    case "payExpense": {
      const e = b.expenses.find((e) => e.id === a.id);
      if (!e || e.paid) throw new Error("El gasto no existe o ya está pagado.");
      e.paid = true;
      e.method = a.method;
      payment("expense", e.amount, e.id, a.method);
      break;
    }
    case "cash":
      payment(a.kind, a.amount, a.reason);
      break;
    case "openRegister": {
      if (registerClosingAt(now) <= now)
        throw new Error("La caja del día se cierra a las 23:59. Podés abrir una nueva desde las 00:00.");
      if (openRegister(b))
        throw new Error("Ya hay una caja abierta. Cerrala antes de abrir otra.");
      b.registers.push({
        id: id("CAJA"),
        openedAt: now,
        opening: a.opening,
      });
      break;
    }
    case "closeRegister": {
      const open = openRegister(b);
      if (!open) throw new Error("No hay ninguna caja abierta.");
      const expected = registerExpected(b, open, now);
      const difference = a.counted - expected;
      open.closedAt = now;
      open.counted = a.counted;
      open.expected = expected;
      open.difference = difference;
      // El arqueo manda: si lo contado no coincide, se deja asentada la
      // diferencia para que el dinero del sistema siga a la realidad.
      if (difference !== 0)
        payment(
          difference > 0 ? "deposit" : "withdrawal",
          Math.abs(difference),
          `Diferencia de caja ${open.id}`,
        );
      break;
    }
    case "settings":
      b.settings = { name: a.name, whatsapp: a.whatsapp, address: a.address };
      break;
  }
  b.version++;
  return b;
}
