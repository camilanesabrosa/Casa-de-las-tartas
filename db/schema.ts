import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
// One versioned aggregate keeps stock, sales, payments and history atomic in this pilot.
export const businesses = sqliteTable("businesses", {
  ownerId: text("owner_id").primaryKey(),
  revision: integer("revision").notNull().default(0),
  payload: text("payload").notNull(),
  updatedAt: text("updated_at").notNull(),
});
