import { z } from "zod";
import { type Business, type Product, lineTotal } from "./business";
const amount = z.number().int().min(0).max(100_000_000_000);
const quantity = z.number().int().positive().max(1_000_000_000);
const text = z.string().trim().min(1).max(160);
const productSchema = z.object({
  id: z.string().optional(),
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
  z.object({ type: z.literal("product"), product: productSchema }),
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
    name: text,
    category: z.enum(["Fijo", "Variable"]),
    amount: amount.refine((n) => n > 0),
    paid: z.boolean(),
  }),
  z.object({ type: z.literal("payExpense"), id: text }),
  z.object({
    type: z.literal("cash"),
    kind: z.enum(["deposit", "withdrawal"]),
    amount: amount.refine((n) => n > 0),
    reason: text,
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
  switch (a.type) {
    case "product": {
      if (b.products.length >= 500 && !a.product.id)
        throw new Error(
          "Esta muestra admite hasta 500 variedades de productos.",
        );
      const p = a.product;
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
    case "settings":
      b.settings = { name: a.name, whatsapp: a.whatsapp, address: a.address };
      break;
  }
  b.version++;
  return b;
}
