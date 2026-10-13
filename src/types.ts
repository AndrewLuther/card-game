import {
  cardTable,
  cardtypeTable,
  packTable,
  setTable,
  userTable,
} from "./db/schema";

export type User = typeof userTable.$inferSelect;
export type Pack = typeof packTable.$inferSelect;
export type Card = typeof cardTable.$inferSelect;
export type CardType = typeof cardtypeTable.$inferSelect;
export type Set = typeof setTable.$inferSelect;

export type CardDisplay = {
  cardName: string;
  imagePath: string;
  author: string;
  cardIndex: number;
  rarityId: number;
  cardsInSet: number;
  displayCount?: number | undefined;
};
