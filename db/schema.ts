import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// SQLite schema used by the desktop app. Amounts are stored as integer cents and
// quantities as thousandths, avoiding floating-point rounding in financial data.
export const businessMeta = sqliteTable("business_meta", {
  ownerId: text("owner_id").primaryKey(), revision: integer("revision").notNull(),
  name: text("name").notNull(), whatsapp: text("whatsapp").notNull(),
  address: text("address").notNull(), completedRequests: text("completed_requests").notNull(), updatedAt: text("updated_at").notNull(),
});
export const products = sqliteTable("products", {
  ownerId: text("owner_id").notNull(), id: text("id").notNull(), number: integer("number").notNull(),
  name: text("name").notNull(), variety: text("variety").notNull(), category: text("category").notNull(), unit: text("unit").notNull(),
  price: integer("price").notNull(), cost: integer("cost").notNull(), stock: integer("stock").notNull(), minimum: integer("minimum").notNull(), published: integer("published").notNull(), imageUrl: text("image_url"),
});
export const suppliers = sqliteTable("suppliers", { ownerId: text("owner_id").notNull(), id: text("id").notNull(), name: text("name").notNull(), phone: text("phone").notNull() });
export const sales = sqliteTable("sales", { ownerId: text("owner_id").notNull(), id: text("id").notNull(), date: text("date").notNull(), total: integer("total").notNull(), method: text("method").notNull(), cancelled: integer("cancelled").notNull() });
export const saleItems = sqliteTable("sale_items", { ownerId: text("owner_id").notNull(), saleId: text("sale_id").notNull(), position: integer("position").notNull(), productId: text("product_id").notNull(), name: text("name").notNull(), quantity: integer("quantity").notNull(), unit: text("unit").notNull(), price: integer("price").notNull(), cost: integer("cost").notNull() });
export const purchases = sqliteTable("purchases", { ownerId: text("owner_id").notNull(), id: text("id").notNull(), date: text("date").notNull(), supplierId: text("supplier_id").notNull(), productId: text("product_id").notNull(), quantity: integer("quantity").notNull(), total: integer("total").notNull(), paid: integer("paid").notNull() });
export const expenses = sqliteTable("expenses", { ownerId: text("owner_id").notNull(), id: text("id").notNull(), date: text("date").notNull(), name: text("name").notNull(), category: text("category").notNull(), amount: integer("amount").notNull(), paid: integer("paid").notNull() });
export const movements = sqliteTable("movements", { ownerId: text("owner_id").notNull(), id: text("id").notNull(), date: text("date").notNull(), productId: text("product_id").notNull(), quantity: integer("quantity").notNull(), reason: text("reason").notNull() });
export const payments = sqliteTable("payments", { ownerId: text("owner_id").notNull(), id: text("id").notNull(), date: text("date").notNull(), amount: integer("amount").notNull(), kind: text("kind").notNull(), reference: text("reference").notNull() });
export const registers = sqliteTable("registers", { ownerId: text("owner_id").notNull(), id: text("id").notNull(), openedAt: text("opened_at").notNull(), opening: integer("opening").notNull(), closedAt: text("closed_at"), counted: integer("counted"), expected: integer("expected"), difference: integer("difference") });
