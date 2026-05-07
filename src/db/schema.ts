import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const userTable = sqliteTable("user", {
  id: int().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  discordSnowflake: text().notNull().unique(),
  packVouchers: int(),
});

export const packTable = sqliteTable("pack", {
  id: int().primaryKey({ autoIncrement: true }),
  user_id: int().notNull(),
  set_id: int().notNull(),
});

export const cardTable = sqliteTable("card", {
  id: int().primaryKey({ autoIncrement: true }),
  user_id: int().notNull(),
  cardtype_id: int().notNull(),
});

export const cardtypeTable = sqliteTable("cardtype", {
  id: int().primaryKey({ autoIncrement: true }),
  set_id: int().notNull(),
  name: text().notNull(),
  image_path: text().notNull(),
  rarity: int().notNull(),
});

export const setTable = sqliteTable("set", {
  id: int().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  imagePath: text().notNull(),
  packsRemaining: int().notNull(),
});
