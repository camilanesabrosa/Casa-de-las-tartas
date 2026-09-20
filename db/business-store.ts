import { env } from "cloudflare:workers";
import { createDemo, withProductNumbers, withRegisters, type Business } from "@/lib/business";
import { applyAction } from "@/lib/actions";

type Stored = Business & { completedRequests?: string[] };
type Statement = ReturnType<ReturnType<typeof db>["prepare"]>;
function db() {
  if (!env.DB) throw new Error("La base de datos no está disponible.");
  return env.DB;
}

// All editable business data lives in local SQLite tables. `businesses` remains
// only as a one-time import source for installations from the JSON prototype.
const tables = [
  `CREATE TABLE IF NOT EXISTS business_meta (owner_id TEXT PRIMARY KEY NOT NULL, revision INTEGER NOT NULL DEFAULT 0, name TEXT NOT NULL, whatsapp TEXT NOT NULL, address TEXT NOT NULL, completed_requests TEXT NOT NULL DEFAULT '[]', updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS products (owner_id TEXT NOT NULL, id TEXT NOT NULL, number INTEGER NOT NULL, name TEXT NOT NULL, variety TEXT NOT NULL, category TEXT NOT NULL, unit TEXT NOT NULL, price INTEGER NOT NULL, cost INTEGER NOT NULL, stock INTEGER NOT NULL, minimum INTEGER NOT NULL, published INTEGER NOT NULL, image_url TEXT, PRIMARY KEY (owner_id, id))`,
  `CREATE TABLE IF NOT EXISTS suppliers (owner_id TEXT NOT NULL, id TEXT NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL, PRIMARY KEY (owner_id, id))`,
  `CREATE TABLE IF NOT EXISTS sales (owner_id TEXT NOT NULL, id TEXT NOT NULL, date TEXT NOT NULL, total INTEGER NOT NULL, method TEXT NOT NULL, cancelled INTEGER NOT NULL, PRIMARY KEY (owner_id, id))`,
  `CREATE TABLE IF NOT EXISTS sale_items (owner_id TEXT NOT NULL, sale_id TEXT NOT NULL, position INTEGER NOT NULL, product_id TEXT NOT NULL, name TEXT NOT NULL, quantity INTEGER NOT NULL, unit TEXT NOT NULL, price INTEGER NOT NULL, cost INTEGER NOT NULL, PRIMARY KEY (owner_id, sale_id, position))`,
  `CREATE TABLE IF NOT EXISTS purchases (owner_id TEXT NOT NULL, id TEXT NOT NULL, date TEXT NOT NULL, supplier_id TEXT NOT NULL, product_id TEXT NOT NULL, quantity INTEGER NOT NULL, total INTEGER NOT NULL, paid INTEGER NOT NULL, PRIMARY KEY (owner_id, id))`,
  `CREATE TABLE IF NOT EXISTS expenses (owner_id TEXT NOT NULL, id TEXT NOT NULL, date TEXT NOT NULL, name TEXT NOT NULL, category TEXT NOT NULL, amount INTEGER NOT NULL, paid INTEGER NOT NULL, PRIMARY KEY (owner_id, id))`,
  `CREATE TABLE IF NOT EXISTS movements (owner_id TEXT NOT NULL, id TEXT NOT NULL, date TEXT NOT NULL, product_id TEXT NOT NULL, quantity INTEGER NOT NULL, reason TEXT NOT NULL, PRIMARY KEY (owner_id, id))`,
  `CREATE TABLE IF NOT EXISTS payments (owner_id TEXT NOT NULL, id TEXT NOT NULL, date TEXT NOT NULL, amount INTEGER NOT NULL, kind TEXT NOT NULL, reference TEXT NOT NULL, PRIMARY KEY (owner_id, id))`,
  `CREATE TABLE IF NOT EXISTS registers (owner_id TEXT NOT NULL, id TEXT NOT NULL, opened_at TEXT NOT NULL, opening INTEGER NOT NULL, closed_at TEXT, counted INTEGER, expected INTEGER, difference INTEGER, PRIMARY KEY (owner_id, id))`,
  `CREATE TABLE IF NOT EXISTS businesses (owner_id TEXT PRIMARY KEY NOT NULL, revision INTEGER NOT NULL DEFAULT 0, payload TEXT NOT NULL, updated_at TEXT NOT NULL)`,
];
let schemaReady: Promise<void> | undefined;
async function ensureSchema() {
  schemaReady ??= db().batch(tables.map((sql) => db().prepare(sql).bind())).then(() => undefined);
  return schemaReady;
}
async function first<T>(sql: string, ...values: unknown[]) { return db().prepare(sql).bind(...values).first<T>(); }

async function load(ownerId: string): Promise<Stored | undefined> {
  const meta = await first<{ revision: number; name: string; whatsapp: string; address: string; completed_requests: string }>("SELECT revision, name, whatsapp, address, completed_requests FROM business_meta WHERE owner_id = ?", ownerId);
  if (!meta) return undefined;
  const [products, suppliers, sales, purchases, expenses, movements, payments, registers, items] = await Promise.all([
    db().prepare("SELECT id, number, name, variety, category, unit, price, cost, stock, minimum, published, image_url FROM products WHERE owner_id = ?").bind(ownerId).all(), db().prepare("SELECT id, name, phone FROM suppliers WHERE owner_id = ?").bind(ownerId).all(), db().prepare("SELECT id, date, total, method, cancelled FROM sales WHERE owner_id = ?").bind(ownerId).all(), db().prepare("SELECT id, date, supplier_id, product_id, quantity, total, paid FROM purchases WHERE owner_id = ?").bind(ownerId).all(), db().prepare("SELECT id, date, name, category, amount, paid FROM expenses WHERE owner_id = ?").bind(ownerId).all(), db().prepare("SELECT id, date, product_id, quantity, reason FROM movements WHERE owner_id = ?").bind(ownerId).all(), db().prepare("SELECT id, date, amount, kind, reference FROM payments WHERE owner_id = ?").bind(ownerId).all(), db().prepare("SELECT id, opened_at, opening, closed_at, counted, expected, difference FROM registers WHERE owner_id = ?").bind(ownerId).all(), db().prepare("SELECT sale_id, position, product_id, name, quantity, unit, price, cost FROM sale_items WHERE owner_id = ? ORDER BY sale_id, position").bind(ownerId).all(),
  ]);
  const grouped = new Map<string, any[]>();
  for (const i of items.results as any[]) grouped.set(i.sale_id, [...(grouped.get(i.sale_id) || []), { productId: i.product_id, name: i.name, quantity: i.quantity, unit: i.unit, price: i.price, cost: i.cost }]);
  return { version: meta.revision, settings: { name: meta.name, whatsapp: meta.whatsapp, address: meta.address }, products: (products.results as any[]).map((p) => ({ id: p.id, number: p.number, name: p.name, variety: p.variety, category: p.category, unit: p.unit, price: p.price, cost: p.cost, stock: p.stock, minimum: p.minimum, published: Boolean(p.published), ...(p.image_url ? { imageUrl: p.image_url } : {}) })), suppliers: suppliers.results as any[], sales: (sales.results as any[]).map((s) => ({ id: s.id, date: s.date, total: s.total, method: s.method, cancelled: Boolean(s.cancelled), items: grouped.get(s.id) || [] })), purchases: (purchases.results as any[]).map((p) => ({ id: p.id, date: p.date, supplierId: p.supplier_id, productId: p.product_id, quantity: p.quantity, total: p.total, paid: p.paid })), expenses: (expenses.results as any[]).map((e) => ({ id: e.id, date: e.date, name: e.name, category: e.category, amount: e.amount, paid: Boolean(e.paid) })), movements: (movements.results as any[]).map((m) => ({ id: m.id, date: m.date, productId: m.product_id, quantity: m.quantity, reason: m.reason })), payments: payments.results as any[], registers: (registers.results as any[]).map((r) => ({ id: r.id, openedAt: r.opened_at, opening: r.opening, ...(r.closed_at ? { closedAt: r.closed_at, counted: r.counted, expected: r.expected, difference: r.difference } : {}) })), completedRequests: JSON.parse(meta.completed_requests || "[]") };
}

function replaceStatements(ownerId: string, b: Stored): Statement[] {
  const out: Statement[] = [...["products", "suppliers", "sales", "sale_items", "purchases", "expenses", "movements", "payments", "registers"].map((table) => db().prepare(`DELETE FROM ${table} WHERE owner_id = ?`).bind(ownerId)), db().prepare("INSERT INTO business_meta (owner_id, revision, name, whatsapp, address, completed_requests, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(owner_id) DO UPDATE SET revision = excluded.revision, name = excluded.name, whatsapp = excluded.whatsapp, address = excluded.address, completed_requests = excluded.completed_requests, updated_at = excluded.updated_at").bind(ownerId, b.version, b.settings.name, b.settings.whatsapp, b.settings.address, JSON.stringify(b.completedRequests || []), new Date().toISOString())];
  for (const p of b.products) out.push(db().prepare("INSERT INTO products (owner_id, id, number, name, variety, category, unit, price, cost, stock, minimum, published, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(ownerId, p.id, p.number, p.name, p.variety, p.category, p.unit, p.price, p.cost, p.stock, p.minimum, p.published ? 1 : 0, p.imageUrl || null));
  for (const s of b.suppliers) out.push(db().prepare("INSERT INTO suppliers (owner_id, id, name, phone) VALUES (?, ?, ?, ?)").bind(ownerId, s.id, s.name, s.phone));
  for (const s of b.sales) { out.push(db().prepare("INSERT INTO sales (owner_id, id, date, total, method, cancelled) VALUES (?, ?, ?, ?, ?, ?)").bind(ownerId, s.id, s.date, s.total, s.method, s.cancelled ? 1 : 0)); s.items.forEach((i, position) => out.push(db().prepare("INSERT INTO sale_items (owner_id, sale_id, position, product_id, name, quantity, unit, price, cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(ownerId, s.id, position, i.productId, i.name, i.quantity, i.unit, i.price, i.cost))); }
  for (const p of b.purchases) out.push(db().prepare("INSERT INTO purchases (owner_id, id, date, supplier_id, product_id, quantity, total, paid) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(ownerId, p.id, p.date, p.supplierId, p.productId, p.quantity, p.total, p.paid));
  for (const e of b.expenses) out.push(db().prepare("INSERT INTO expenses (owner_id, id, date, name, category, amount, paid) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(ownerId, e.id, e.date, e.name, e.category, e.amount, e.paid ? 1 : 0));
  for (const m of b.movements) out.push(db().prepare("INSERT INTO movements (owner_id, id, date, product_id, quantity, reason) VALUES (?, ?, ?, ?, ?, ?)").bind(ownerId, m.id, m.date, m.productId, m.quantity, m.reason));
  for (const p of b.payments) out.push(db().prepare("INSERT INTO payments (owner_id, id, date, amount, kind, reference) VALUES (?, ?, ?, ?, ?, ?)").bind(ownerId, p.id, p.date, p.amount, p.kind, p.reference));
  for (const r of b.registers) out.push(db().prepare("INSERT INTO registers (owner_id, id, opened_at, opening, closed_at, counted, expected, difference) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(ownerId, r.id, r.openedAt, r.opening, r.closedAt || null, r.counted ?? null, r.expected ?? null, r.difference ?? null));
  return out;
}
async function save(ownerId: string, b: Stored) { await db().batch(replaceStatements(ownerId, b)); }
export async function readBusiness(ownerId: string): Promise<Stored> { await ensureSchema(); let stored = await load(ownerId); if (!stored) { const legacy = await first<{ payload: string }>("SELECT payload FROM businesses WHERE owner_id = ?", ownerId); stored = legacy ? JSON.parse(legacy.payload) as Stored : createDemo(); stored = withRegisters(withProductNumbers(stored)); await save(ownerId, stored); } return withRegisters(withProductNumbers(stored)); }
export async function updateBusiness(ownerId: string, version: number, requestId: string, action: unknown) { const previous = await readBusiness(ownerId); if (previous.completedRequests?.includes(requestId)) return previous; if (previous.version !== version) throw new Error("Los datos cambiaron en otra ventana. Actualizá los datos y volvé a guardar."); const next: Stored = applyAction(previous, action); next.completedRequests = [...(previous.completedRequests || []), requestId].slice(-500); await save(ownerId, next); return next; }
