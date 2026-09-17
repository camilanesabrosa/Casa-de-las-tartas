export type Product = {
  id: string;
  number: number;
  name: string;
  variety: string;
  category: string;
  unit: "unit" | "kg";
  price: number;
  cost: number;
  stock: number;
  minimum: number;
  published: boolean;
  imageUrl?: string;
};
export type Line = {
  productId: string;
  name: string;
  quantity: number;
  unit: Product["unit"];
  price: number;
  cost: number;
};
export type Sale = {
  id: string;
  date: string;
  items: Line[];
  total: number;
  method: string;
  cancelled: boolean;
};
export type Supplier = { id: string; name: string; phone: string };
export type Purchase = {
  id: string;
  date: string;
  supplierId: string;
  productId: string;
  quantity: number;
  total: number;
  paid: number;
};
export type Expense = {
  id: string;
  date: string;
  name: string;
  category: "Fijo" | "Variable";
  amount: number;
  paid: boolean;
};
export type Movement = {
  id: string;
  date: string;
  productId: string;
  quantity: number;
  reason: string;
};
export type Payment = {
  id: string;
  date: string;
  amount: number;
  kind: "purchase" | "expense" | "deposit" | "withdrawal";
  reference: string;
};
export type Business = {
  version: number;
  settings: { name: string; whatsapp: string; address: string };
  products: Product[];
  sales: Sale[];
  suppliers: Supplier[];
  purchases: Purchase[];
  expenses: Expense[];
  movements: Movement[];
  payments: Payment[];
};
export const categories = [
  "Precocidos",
  "Congelados",
  "Pastas",
  "Varios",
  "Tartas",
] as const;
export const categoryLetter = (category: string) => {
  const i = categories.indexOf(category as (typeof categories)[number]);
  return i < 0 ? "" : String.fromCharCode(65 + i);
};
export const productCode = (p: Pick<Product, "number" | "category">) =>
  `${p.number}${categoryLetter(p.category)}`;
export const matchesCode = (p: Pick<Product, "number" | "category">, q: string) =>
  productCode(p).toLowerCase() === q.trim().toLowerCase().replace(/\s+/g, "");
const hasNumber = (p: Product) => Number.isInteger(p.number) && p.number > 0;
// Los documentos guardados antes del cartel numerado no traen `number`.
// Se completa por orden de aparición sin pisar los números ya asignados.
export function withProductNumbers<T extends Business>(b: T): T {
  if (b.products.every(hasNumber)) return b;
  const taken = new Map<string, Set<number>>();
  const slots = (category: string) => {
    let set = taken.get(category);
    if (!set) taken.set(category, (set = new Set()));
    return set;
  };
  for (const p of b.products) if (hasNumber(p)) slots(p.category).add(p.number);
  return {
    ...b,
    products: b.products.map((p) => {
      if (hasNumber(p)) return p;
      const set = slots(p.category);
      let n = 1;
      while (set.has(n)) n++;
      set.add(n);
      return { ...p, number: n };
    }),
  };
}
export const money = (cents: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: cents % 100 ? 2 : 0,
  }).format(cents / 100);
export const quantityLabel = (quantity: number, unit: Product["unit"]) =>
  unit === "kg"
    ? quantity < 1000
      ? `${quantity} g`
      : `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 }).format(quantity / 1000)} kg`
    : `${quantity / 1000} un.`;
export const dateKey = (date = new Date()) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Argentina/Mendoza",
  }).format(date);
export const lineTotal = (price: number, quantity: number) =>
  (() => {
    if (!Number.isSafeInteger(price) || !Number.isSafeInteger(quantity))
      throw new Error("Precio o cantidad no válidos.");
    const cents = Number((BigInt(price) * BigInt(quantity) + BigInt(500)) / BigInt(1000));
    if (!Number.isSafeInteger(cents))
      throw new Error("El importe supera el máximo permitido.");
    return cents;
  })();
export function createDemo(now = new Date()): Business {
  const products: Product[] = [
    {
      id: "p1",
      number: 1,
      name: "Medallón de pollo",
      variety: "Jamón y queso",
      category: "Precocidos",
      unit: "kg",
      price: 920000,
      cost: 520000,
      stock: 3200,
      minimum: 2000,
      published: true,
    },
    {
      id: "p2",
      number: 2,
      name: "Medallón de pollo",
      variety: "Queso cheddar",
      category: "Precocidos",
      unit: "kg",
      price: 980000,
      cost: 560000,
      stock: 1800,
      minimum: 2000,
      published: true,
    },
    {
      id: "p3",
      number: 3,
      name: "Milanesa de merluza",
      variety: "Finas hierbas",
      category: "Precocidos",
      unit: "kg",
      price: 1250000,
      cost: 750000,
      stock: 2400,
      minimum: 2000,
      published: true,
    },
    {
      id: "p4",
      number: 4,
      name: "Medallón de merluza",
      variety: "Espinaca y queso",
      category: "Precocidos",
      unit: "kg",
      price: 1150000,
      cost: 680000,
      stock: 3500,
      minimum: 2000,
      published: true,
    },
    {
      id: "p5",
      number: 5,
      name: "Patitas de pollo",
      variety: "",
      category: "Precocidos",
      unit: "kg",
      price: 890000,
      cost: 510000,
      stock: 4000,
      minimum: 2000,
      published: true,
    },
    {
      id: "p6",
      number: 6,
      name: "Papas noisette",
      variety: "",
      category: "Precocidos",
      unit: "kg",
      price: 650000,
      cost: 370000,
      stock: 5000,
      minimum: 2000,
      published: true,
    },
    {
      id: "p7",
      number: 7,
      name: "Bastoncitos de muzzarella",
      variety: "",
      category: "Precocidos",
      unit: "kg",
      price: 1380000,
      cost: 820000,
      stock: 2500,
      minimum: 2000,
      published: true,
    },
    {
      id: "p8",
      number: 8,
      name: "Caritas",
      variety: "",
      category: "Precocidos",
      unit: "kg",
      price: 650000,
      cost: 380000,
      stock: 3000,
      minimum: 2000,
      published: true,
    },
    {
      id: "p9",
      number: 9,
      name: "Papas bastón",
      variety: "",
      category: "Precocidos",
      unit: "kg",
      price: 520000,
      cost: 280000,
      stock: 6000,
      minimum: 2000,
      published: true,
    },
    {
      id: "p10",
      number: 10,
      name: "Filet a la romana",
      variety: "",
      category: "Precocidos",
      unit: "kg",
      price: 1320000,
      cost: 780000,
      stock: 2500,
      minimum: 2000,
      published: true,
    },
    {
      id: "p11",
      number: 1,
      name: "Empanadas",
      variety: "Carne",
      category: "Congelados",
      unit: "unit",
      price: 160000,
      cost: 85000,
      stock: 36000,
      minimum: 12000,
      published: true,
    },
    {
      id: "p12",
      number: 2,
      name: "Empanadas",
      variety: "Jamón y queso",
      category: "Congelados",
      unit: "unit",
      price: 160000,
      cost: 85000,
      stock: 24000,
      minimum: 12000,
      published: true,
    },
    {
      id: "p13",
      number: 3,
      name: "Tortitas",
      variety: "",
      category: "Congelados",
      unit: "unit",
      price: 60000,
      cost: 28000,
      stock: 30000,
      minimum: 12000,
      published: true,
    },
    {
      id: "p14",
      number: 4,
      name: "Medialunas",
      variety: "Manteca",
      category: "Congelados",
      unit: "unit",
      price: 85000,
      cost: 42000,
      stock: 24000,
      minimum: 12000,
      published: true,
    },
    {
      id: "p15",
      number: 5,
      name: "Pan",
      variety: "",
      category: "Congelados",
      unit: "kg",
      price: 320000,
      cost: 180000,
      stock: 5000,
      minimum: 2000,
      published: true,
    },
    {
      id: "p16",
      number: 1,
      name: "Ravioles",
      variety: "",
      category: "Pastas",
      unit: "kg",
      price: 850000,
      cost: 480000,
      stock: 2750,
      minimum: 3000,
      published: true,
    },
    {
      id: "p17",
      number: 2,
      name: "Fideos",
      variety: "",
      category: "Pastas",
      unit: "kg",
      price: 580000,
      cost: 290000,
      stock: 4000,
      minimum: 2000,
      published: true,
    },
    {
      id: "p18",
      number: 3,
      name: "Sorrentinos",
      variety: "",
      category: "Pastas",
      unit: "kg",
      price: 1050000,
      cost: 590000,
      stock: 1800,
      minimum: 2000,
      published: true,
    },
    {
      id: "p19",
      number: 4,
      name: "Ñoquis",
      variety: "",
      category: "Pastas",
      unit: "kg",
      price: 680000,
      cost: 340000,
      stock: 3000,
      minimum: 2000,
      published: true,
    },
    {
      id: "p20",
      number: 5,
      name: "Canelones",
      variety: "",
      category: "Pastas",
      unit: "unit",
      price: 230000,
      cost: 115000,
      stock: 18000,
      minimum: 6000,
      published: true,
    },
    {
      id: "p21",
      number: 1,
      name: "Ensaladas",
      variety: "",
      category: "Varios",
      unit: "unit",
      price: 480000,
      cost: 230000,
      stock: 8000,
      minimum: 4000,
      published: true,
    },
    {
      id: "p22",
      number: 2,
      name: "Yogurlac",
      variety: "",
      category: "Varios",
      unit: "unit",
      price: 180000,
      cost: 115000,
      stock: 12000,
      minimum: 4000,
      published: true,
    },
    {
      id: "p23",
      number: 3,
      name: "Mendosoja",
      variety: "",
      category: "Varios",
      unit: "unit",
      price: 150000,
      cost: 95000,
      stock: 12000,
      minimum: 4000,
      published: true,
    },
    {
      id: "p24",
      number: 4,
      name: "Milanesa de pollo",
      variety: "",
      category: "Varios",
      unit: "kg",
      price: 880000,
      cost: 520000,
      stock: 4500,
      minimum: 2000,
      published: true,
    },
    {
      id: "p25",
      number: 5,
      name: "Rollito de pollo",
      variety: "Jamón y queso",
      category: "Varios",
      unit: "kg",
      price: 1100000,
      cost: 640000,
      stock: 3000,
      minimum: 2000,
      published: true,
    },
    ...varieties.map((variety, i) => ({
      id: `p${26 + i}`,
      number: i + 1,
      name: "Tarta",
      variety,
      category: "Tartas",
      unit: "unit" as const,
      price: 950000,
      cost: 540000,
      stock: 6000,
      minimum: 3000,
      published: true,
    })),
  ];
  const sales: Sale[] = [];
  for (let day = 6; day >= 0; day--) {
    for (let k = 0; k < 3 + (day % 3); k++) {
      const dayDate = new Date(`${dateKey(now)}T12:00:00-03:00`);
      dayDate.setUTCDate(dayDate.getUTCDate() - day);
      const d = new Date(
        `${dateKey(dayDate)}T${String(11 + k).padStart(2, "0")}:${String(15 + k * 7).padStart(2, "0")}:00-03:00`,
      );
      const p = products[(day + k) % products.length];
      const quantity =
        p.unit === "kg" ? [250, 500, 750][k % 3] : ((k % 2) + 1) * 1000;
      const line = {
        productId: p.id,
        name: p.name,
        quantity,
        unit: p.unit,
        price: p.price,
        cost: p.cost,
      };
      sales.push({
        id: `V-${101 + sales.length}`,
        date: d.toISOString(),
        items: [line],
        total: lineTotal(p.price, quantity),
        method: ["Efectivo", "Transferencia", "Tarjeta"][k % 3],
        cancelled: false,
      });
    }
  }
  const dt = now.toISOString();
  const suppliers = [
    { id: "s1", name: "Alimentos del Valle", phone: "" },
    { id: "s2", name: "Huerta de origen", phone: "" },
    { id: "s3", name: "Distribuidora Semilla", phone: "" },
  ];
  const purchases = [
    {
      id: "c1",
      date: dt,
      supplierId: "s1",
      productId: "p16",
      quantity: 1000,
      total: 480000,
      paid: 240000,
    },
    {
      id: "c2",
      date: dt,
      supplierId: "s3",
      productId: "p18",
      quantity: 1000,
      total: 590000,
      paid: 300000,
    },
  ];
  const expenses: Expense[] = [
    {
      id: "e1",
      date: dt,
      name: "Envases para viandas",
      category: "Variable",
      amount: 850000,
      paid: true,
    },
    {
      id: "e2",
      date: dt,
      name: "Servicio de internet",
      category: "Fijo",
      amount: 2200000,
      paid: false,
    },
  ];
  const payments: Payment[] = [
    {
      id: "pay0",
      date: dt,
      amount: 5000000,
      kind: "deposit",
      reference: "Saldo inicial de ejemplo",
    },
    ...purchases.map((p) => ({
      id: `pay-${p.id}`,
      date: dt,
      amount: p.paid,
      kind: "purchase" as const,
      reference: p.id,
    })),
    {
      id: "pay-e1",
      date: dt,
      amount: 850000,
      kind: "expense",
      reference: "e1",
    },
  ];
  const openingDate = new Date(now);
  openingDate.setDate(openingDate.getDate() - 7);
  const movements: Movement[] = products.map((p) => ({
    id: `m-${p.id}`,
    date: openingDate.toISOString(),
    productId: p.id,
    quantity:
      p.stock +
      sales
        .flatMap((s) => s.items)
        .filter((i) => i.productId === p.id)
        .reduce((n, i) => n + i.quantity, 0) -
      purchases
        .filter((c) => c.productId === p.id)
        .reduce((n, c) => n + c.quantity, 0),
    reason: "Stock inicial de ejemplo",
  }));
  for (const c of purchases)
    movements.push({
      id: `m-${c.id}`,
      date: c.date,
      productId: c.productId,
      quantity: c.quantity,
      reason: `Compra ${c.id}`,
    });
  for (const s of sales)
    for (const i of s.items)
      movements.push({
        id: `m-${s.id}-${i.productId}`,
        date: s.date,
        productId: i.productId,
        quantity: -i.quantity,
        reason: `Venta ${s.id}`,
      });
  movements.sort((a, b) => a.date.localeCompare(b.date));
  return {
    version: 0,
    settings: {
      name: "Mi cocina",
      whatsapp: "",
      address: "Retiro en el local · Coordinamos por WhatsApp",
    },
    products,
    sales,
    suppliers,
    purchases,
    expenses,
    payments,
    movements,
  };
}
export function summary(b: Business, days = 7) {
  const today = dateKey();
  const start = new Date(`${today}T12:00:00-03:00`);
  start.setDate(start.getDate() - days + 1);
  const first = dateKey(start);
  const within = (s: { date: string }) => {
    const d = dateKey(new Date(s.date));
    return d >= first && d <= today;
  };
  const sales = b.sales.filter((s) => !s.cancelled && within(s));
  const received = sales.reduce((a, s) => a + s.total, 0);
  const paid = b.payments
    .filter((p) => within(p) && (p.kind === "purchase" || p.kind === "expense"))
    .reduce((a, p) => a + p.amount, 0);
  const debt =
    b.purchases.reduce((a, p) => a + p.total - p.paid, 0) +
    b.expenses.filter((e) => !e.paid).reduce((a, e) => a + e.amount, 0);
  const balance =
    b.sales.filter((s) => !s.cancelled).reduce((a, s) => a + s.total, 0) +
    b.payments.reduce(
      (a, p) => a + (p.kind === "deposit" ? p.amount : -p.amount),
      0,
    );
  return {
    sales,
    received,
    paid,
    debt,
    balance,
    low: b.products.filter((p) => p.stock <= p.minimum),
    cost: b.products.reduce((a, p) => a + lineTotal(p.cost, p.stock), 0),
    within,
  };
}

export function categoryRanking(products: Product[], sales: Sale[]) {
  const category = new Map(products.map((p) => [p.id, p.category]));
  const totals = new Map<string, number>();
  for (const sale of sales)
    for (const item of sale.items) {
      const name = category.get(item.productId) || "Sin categoría";
      totals.set(
        name,
        (totals.get(name) || 0) + lineTotal(item.price, item.quantity),
      );
    }
  return [...totals]
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, "es"));
}

export const varieties = [
  "Verdura y queso",
  "Verdura y ricota",
  "Acelga y huevo",
  "Acelga, jamón y queso",
  "Verdura, calabaza y queso",
  "Calabaza y queso",
  "Pollo y verdura",
  "Pollo y queso",
  "Pastel de papa",
  "Jamón y queso",
  "Jamón, queso, huevo y tomate",
  "Choclo y queso",
  "Cebolla y queso",
];
