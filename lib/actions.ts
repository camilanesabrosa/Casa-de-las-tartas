import { z } from "zod";
import {
  type Business,
  type Product,
  lineTotal,
  openRegister,
  registerExpected,
  getProductCategories,
  getProductCategoryCodes,
} from "./business";
const amount = z.number().int().min(0).max(100_000_000_000);
const quantity = z.number().int().positive().max(1_000_000_000);
const text = z.string().trim().min(1).max(160);
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
  z.object({ type: z.literal("productCategory"), name: text }),
  z.object({ type: z.literal("renameProductCategory"), name: text, newName: text }),
  z.object({ type: z.literal("deleteProductCategory"), name: text, targetCategory: text.optional() }),
  z.object({ type: z.literal("productPrice"), id: text, price: amount.refine((n) => n > 0, "El precio debe ser mayor que cero.") }),
  z.object({
    type: z.literal("sale"),
    items: z
      .array(z.object({ productId: text, quantity }))
      .min(1)
      .max(100),
    method: z.enum(["Efectivo", "Transferencia", "Tarjeta"]),
  }),
  z.object({ type: z.literal("cancelSale"), id: text }),
  z.object({
    type: z.literal("adjustStock"),
    productId: text,
    quantity: z
      .number()
      .int()
      .min(-1_000_000_000)
      .max(1_000_000_000)
      .refine((n) => n !== 0),
    reason: text,
  }),
  z.object({
    type: z.literal("supplier"),
    id: z.string().optional(),
    name: text,
    phone: z.string().trim().max(40),
  }),
  z.object({
    type: z.literal("purchase"),
    supplierId: text,
    productId: text,
    quantity,
    cost: amount.refine((n) => n > 0),
    paid: amount,
  }),
  z.object({
    type: z.literal("payPurchase"),
    id: text,
    amount: amount.refine((n) => n > 0),
  }),
  z.object({
    type: z.literal("expense"),
    id: text.optional(),
    name: text,
    category: z.enum(["Fijo", "Variable"]),
    amount: amount.refine((n) => n > 0),
    paid: z.boolean(),
  }),
  z.object({ type: z.literal("payExpense"), id: text }),
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
  const b = structuredClone(original);
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
  ) => {
    if (amount > 0)
      b.payments.push({ id: id("P"), date: now, amount, kind, reference });
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
  // Keep original payment dates and closed-register figures. Corrections belong
  // to today, including negative expense entries that reverse a mistaken charge.
  const reconcileExpense = (expenseId: string, target: number) => {
    const recorded = b.payments.filter((p) => p.kind === "expense" && p.reference === expenseId)
      .reduce((total, p) => total + p.amount, 0);
    const difference = target - recorded;
    if (difference !== 0) b.payments.push({ id: id("P"), date: now, amount: difference, kind: "expense", reference: expenseId });
  };
  switch (a.type) {
    case "productCategory":
      if (b.productCategories.some((name) => name.toLocaleLowerCase("es-AR") === a.name.toLocaleLowerCase("es-AR")))
        throw new Error("Esa categoría ya existe.");
      categoryName(a.name);
      break;
    case "renameProductCategory": {
      const oldName = existingCategory(a.name);
      if (a.newName.toLocaleLowerCase("es-AR") === "todos") throw new Error('Usá otro nombre de categoría. "Todos" se usa para mostrar todos los productos.');
      if (b.productCategories.some((name) => name !== oldName && name.toLocaleLowerCase("es-AR") === a.newName.toLocaleLowerCase("es-AR")))
        throw new Error("Esa categoría ya existe.");
      b.productCategories = b.productCategories.map((name) => name === oldName ? a.newName : name);
      b.productCategoryCodes = Object.fromEntries(Object.entries(b.productCategoryCodes).map(([name, code]) => [name === oldName ? a.newName : name, code]));
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
    case "sale": {
      const combined = new Map<string, number>();
      for (const i of a.items)
        combined.set(
          i.productId,
          (combined.get(i.productId) || 0) + i.quantity,
        );
      const items = Array.from(combined, ([pid, q]) => {
        const p = getProduct(pid);
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
      for (const i of sale.items)
        move(getProduct(i.productId), i.quantity, `Anulación ${sale.id}`);
      break;
    }
    case "adjustStock":
      move(getProduct(a.productId), a.quantity, a.reason);
      break;
    case "supplier": {
      if (a.id) {
        const s = b.suppliers.find((s) => s.id === a.id);
        if (!s) throw new Error("Proveedor no encontrado.");
        Object.assign(s, { name: a.name, phone: a.phone });
      } else b.suppliers.push({ id: id("PROV"), name: a.name, phone: a.phone });
      break;
    }
    case "purchase": {
      if (!b.suppliers.some((s) => s.id === a.supplierId))
        throw new Error("Seleccioná un proveedor.");
      const p = getProduct(a.productId);
      validQty(p, a.quantity);
      const total = lineTotal(a.cost, a.quantity);
      if (a.paid > total)
        throw new Error("El pago no puede superar el total de la compra.");
      const purchaseId = id("C");
      move(p, a.quantity, `Compra ${purchaseId}`);
      p.cost = a.cost;
      b.purchases.push({
        id: purchaseId,
        date: now,
        supplierId: a.supplierId,
        productId: p.id,
        quantity: a.quantity,
        total,
        paid: a.paid,
      });
      payment("purchase", a.paid, purchaseId);
      break;
    }
    case "payPurchase": {
      const p = b.purchases.find((p) => p.id === a.id);
      if (!p) throw new Error("Compra no encontrada.");
      if (a.amount > p.total - p.paid)
        throw new Error("El pago supera la deuda pendiente.");
      p.paid += a.amount;
      payment("purchase", a.amount, p.id);
      break;
    }
    case "expense": {
      if (a.id) {
        const expense = b.expenses.find((e) => e.id === a.id);
        if (!expense) throw new Error("No encontramos ese gasto. Actualizá los datos.");
        Object.assign(expense, { name: a.name, category: a.category, amount: a.amount, paid: a.paid });
        reconcileExpense(expense.id, expense.paid ? expense.amount : 0);
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
      });
      if (a.paid) payment("expense", a.amount, expenseId);
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
      payment("expense", e.amount, e.id);
      break;
    }
    case "cash":
      payment(a.kind, a.amount, a.reason);
      break;
    case "openRegister": {
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
