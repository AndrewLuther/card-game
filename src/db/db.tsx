import { drizzle } from "drizzle-orm/libsql";

import {
  cardrarityTable,
  cardTable,
  cardtypeTable,
  packTable,
  userTable,
} from "./schema";

import type { User, Pack } from "../types";

import { eq, and } from "drizzle-orm";

import { Browser, Page } from "puppeteer";

import { createCardPNG } from "../card";

export const db = drizzle(process.env.DB_FILE_NAME!);

export async function getUserCount() {
  return await db.$count(userTable);
}

// HELPER FUNCTIONS // -------------------------------------------------------------

export async function getCards(username: string, userId: string) {
  const user = await createNewUser(username, userId);
  const cards = await db
    .select()
    .from(cardTable)
    .where(eq(cardTable.user_id, user.id));

  return cards;
}

// creates a new user in the db if the user isn't added yet
export async function createNewUser(
  username: string,
  userId: string,
): Promise<User> {
  const users = await db
    .select()
    .from(userTable)
    .where(eq(userTable.discordSnowflake, userId));

  if (users.length == 0) {
    // add the user to the db
    const userResult = await db
      .insert(userTable)
      .values({
        name: username,
        discordSnowflake: userId,
        packVouchers: 0,
        lastFreeVoucher: 0,
      })
      .returning();

    return userResult[0]!;
  } else {
    return users[0]!;
  }
}

export async function getVoucherCount(userId: string): Promise<number> {
  const vouchers = await db
    .select({ vouchers: userTable.packVouchers })
    .from(userTable)
    .where(eq(userTable.discordSnowflake, userId));

  let voucher = vouchers[0]!["vouchers"];
  if (!voucher) voucher = 0;
  return voucher;
}

export async function getUser(userId: string): Promise<User> {
  const userResult = await db
    .select()
    .from(userTable)
    .where(eq(userTable.discordSnowflake, userId));
  const user = userResult[0]!;
  return user;
}

export async function getPacks(userId: string): Promise<Pack[]> {
  const user = await getUser(userId);
  const packs = await db
    .select()
    .from(packTable)
    .where(eq(packTable.user_id, user.id));
  return packs;
}

// MAIN API FUNCTIONS // -------------------------------------------------------------

export async function voucherReceiveCommand(
  username: string,
  userId: string,
): Promise<User | null> {
  const user = await createNewUser(username, userId);
  let voucher = await getVoucherCount(userId);
  if (!voucher) voucher = 0;

  // const waitTime = 86400000
  const waitTime = 1;

  if (Date.now() - user.lastFreeVoucher > waitTime) {
    const userResult = await db
      .update(userTable)
      .set({ packVouchers: voucher + 1, lastFreeVoucher: Date.now() })
      .where(eq(userTable.discordSnowflake, userId))
      .returning();
    return userResult[0]!;
  } else {
    return null;
  }
}

export async function buyPackCommand(
  username: string,
  userId: string,
): Promise<{ packs: Pack[]; user: User } | null> {
  await createNewUser(username, userId);
  let voucher = await getVoucherCount(userId);

  if (voucher == 0) {
    return null;
  }

  // decrease the number of vouchers the user has by 1
  const userResult = await db
    .update(userTable)
    .set({ packVouchers: voucher - 1 })
    .where(eq(userTable.discordSnowflake, userId))
    .returning();
  const user = userResult[0]!; // will always return one because userId is unique

  // add a pack to packTable associated with this user
  await db.insert(packTable).values({
    user_id: user.id,
    set_id: 0, // currently only support one set
  });

  const packs = await getPacks(userId);
  return { packs, user };
}

export async function openPackCommand(
  username: string,
  userId: string,
  browser: Browser,
): Promise<{ cardImagePaths: Buffer[] } | null> {
  await createNewUser(username, userId);
  const packs = await getPacks(userId);
  if (packs.length <= 0) {
    return null;
  } else {
    const user = await getUser(userId);

    // for now just open the first pack (eventually we will want to get a way for the user to select a pack)
    const packToOpen = packs[0];

    // define this somewhere else?
    const cardsPerPack = 4;

    // remove pack from db
    await db.delete(packTable).where(eq(packTable.id, packToOpen?.id!));

    // get the cardTypes that may exist within this pack
    const cardTypes = await db // TODO get everything I need with a join here to also have rarity stuffs
      .select()
      .from(cardtypeTable)
      .where(eq(cardtypeTable.set_id, packToOpen?.set_id!));

    type Rarity = { id: number; value: number };
    const cardrarities: Array<Rarity> = [];

    for (let i = 0; i < cardTypes.length; i++) {
      const cardType = cardTypes[i];
      const cardTypeRarities = await db
        .select()
        .from(cardrarityTable)
        .where(eq(cardrarityTable.id, cardType?.rarity_id!));
      const cardTypeRarity = cardTypeRarities[0];

      cardrarities.push(cardTypeRarity!);
    }

    cardrarities.sort((a, b) => b.value - a.value);

    type Card = { user_id: number; cardtype_id: number };
    const cards: Array<Card> = [];
    const cardImagePaths: Array<Buffer> = [];

    // create the cards
    for (let i = 0; i < cardsPerPack; i++) {
      // determine which cardrarity is randomly selected
      let rarity = cardrarities[0];
      const random = Math.random() * 100;
      for (let j = 0; j < cardrarities.length; j++) {
        if (random < cardrarities[j]!.value) {
          rarity = cardrarities[j];
        }
      }

      // get all card with this rarity from db
      const cardTypesWithRarity = await db
        .select()
        .from(cardtypeTable)
        .where(
          and(
            eq(cardtypeTable.rarity_id, rarity?.id!),
            eq(cardtypeTable.set_id, packToOpen?.set_id!),
          ),
        );

      const cardtypeIndex = Math.floor(
        Math.random() * cardTypesWithRarity.length,
      );
      const cardType = cardTypesWithRarity[cardtypeIndex];
      cards.push({ user_id: user.id, cardtype_id: cardType?.id! });

      const page: Page = await browser.newPage();
      try {
        const pngBuffer = await createCardPNG(
          page,
          `${cardType?.name!}`,
          `${cardType?.image_path}`,
          `${cardType?.illustrator}`,
          cardType?.id!,
          cardType?.rarity_id!,
          cardTypes.length,
        );

        cardImagePaths.push(pngBuffer);
      } finally {
        await page.close();
      }
    }

    await db.insert(cardTable).values(cards);

    return { cardImagePaths };
  }
}
