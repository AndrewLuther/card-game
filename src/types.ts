import {
  cardrarityTable,
  cardTable,
  cardtypeTable,
  packTable,
  userTable,
} from "./db/schema";

export type User = typeof userTable.$inferSelect;
export type Pack = typeof packTable.$inferSelect;
export type Card = typeof cardTable.$inferSelect;
