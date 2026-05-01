import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const userTable = sqliteTable("user", {
  id: int().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  discordSnowflake: text().notNull().unique(),
  packVouchers: int(),
});
