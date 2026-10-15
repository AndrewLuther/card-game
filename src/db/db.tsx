import { drizzle } from "drizzle-orm/libsql";

import {
  cardrarityTable,
  cardTable,
  cardtypeTable,
  packTable,
  setTable,
  userTable,
} from "./schema";

import type { User, Pack, CardDisplay, CardType } from "../types";

import { eq, and } from "drizzle-orm";

import { Browser, Page } from "puppeteer";

import { createCardPNG, createCollectionPNG } from "../card-display";

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

export async function getSets() {
  const sets = await db.select().from(setTable);
  return sets;
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
        lastFishin: 0,
      })
      .returning();

    return userResult[0]!;
  } else {
    return users[0]!;
  }
}

export async function getVoucherCount(discordId: string): Promise<number> {
  const vouchers = await db
    .select({ vouchers: userTable.packVouchers })
    .from(userTable)
    .where(eq(userTable.discordSnowflake, discordId));

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

export async function getPacksFromSet(userId: string, setId: number) {
  const user = await getUser(userId);
  const packs = await db
    .select()
    .from(packTable)
    .where(and(eq(packTable.user_id, user.id), eq(packTable.set_id, setId)));
  return packs;
}

export async function addVouchers(user: User, voucherNumber: number) {
  // get the number of vouchers the user currently has
  let voucher = await getVoucherCount(user.discordSnowflake);
  if (!voucher) voucher = 0;

  // add the number of vouchers to the user's total
  const userResult = await db
    .update(userTable)
    .set({ packVouchers: voucher + voucherNumber })
    .where(eq(userTable.discordSnowflake, user.discordSnowflake));
}

// MAIN API FUNCTIONS // -------------------------------------------------------------

const waitTime = 86400000;
//const waitTime = 1;

type VoucherReceiveResponse = { message: string };

export async function voucherReceiveCommand(
  username: string,
  discordId: string,
): Promise<VoucherReceiveResponse> {
  const user = await createNewUser(username, discordId);
  const timeUntilNextVoucher: string = formatTimeFromMs(
    waitTime - (Date.now() - user.lastFreeVoucher),
  );

  const voucherReceiveResponse = {
    message: `You already received a free voucher today! Try again in ${timeUntilNextVoucher}.`,
  };

  if (Date.now() - user.lastFreeVoucher > waitTime) {
    const userResult = await db
      .update(userTable)
      .set({ lastFreeVoucher: Date.now() })
      .where(eq(userTable.discordSnowflake, user.discordSnowflake))
      .returning();

    voucherReceiveResponse.message = `You now have ${userResult[0]!.packVouchers} pack vouchers!`;
  }

  return voucherReceiveResponse;
}

function formatTimeFromMs(totalMs: number): string {
  const totalSeconds = Math.floor(totalMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours}h ${minutes}m ${seconds}s`;
}

export async function goFishinCommand(username: string, userId: string) {
  const user = await createNewUser(username, userId);

  const timeUntilNextFishin: string = formatTimeFromMs(
    waitTime - (Date.now() - user.lastFishin),
  );

  const fishResponse = {
    message: `You already went fishin today! Try again in ${timeUntilNextFishin}.`,
  };

  if (Date.now() - user.lastFishin > waitTime) {
    const random = Math.random() * 100;

    if (random < 1) {
      // very rare event 1%
      addVouchers(user, 20);
      fishResponse.message = "Woah!! You got 20 pack vouchers!!";
    } else if (random < 6) {
      // rare event 5%
      addVouchers(user, 10);
      fishResponse.message = "Woah! You got 10 pack vouchers!";
    } else if (random < 16) {
      // pretty uncommon event 10%
      addVouchers(user, 5);
      fishResponse.message = "Nice! You got 5 pack vouchers!";
    } else if (random < 41) {
      // uncommon event 25%
      addVouchers(user, 2);
      fishResponse.message = "You got 2 pack vouchers!";
    } else {
      // common event 59%
      addVouchers(user, 1);
      fishResponse.message = "You got 1 pack voucher!";
    }

    await db
      .update(userTable)
      .set({ lastFishin: Date.now() })
      .where(eq(userTable.discordSnowflake, user.discordSnowflake));
  }

  return fishResponse;
}

export async function buyPackCommand(
  username: string,
  userId: string,
  setId: number,
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
    set_id: setId,
  });

  const packs = await getPacks(userId);
  return { packs, user };
}

export async function viewCollectionCommand(
  setId: number,
  userId: string,
  username: string,
  browser: Browser,
): Promise<{
  collectionImagePaths: Buffer[];
  completion_percent: number;
} | null> {
  const user = await createNewUser(username, userId);
  const userCardsInSet = await db
    .select()
    .from(cardTable)
    .leftJoin(cardtypeTable, eq(cardTable.cardtype_id, cardtypeTable.id))
    .where(
      and(eq(cardTable.user_id, user.id), eq(cardtypeTable.set_id, setId)),
    );

  const allCardTypesInSet = await db
    .select()
    .from(cardtypeTable)
    .where(eq(cardtypeTable.set_id, setId));

  const cardCounts: Map<number, number> = new Map();

  userCardsInSet.forEach((card) => {
    cardCounts.set(
      card.cardtype?.id!,
      (cardCounts.get(card.cardtype?.id!) || 0) + 1,
    );
  });

  const cardDisplays: Array<CardDisplay> = [];

  allCardTypesInSet.forEach((cardType) => {
    const cardInfo: CardDisplay = {
      cardName: `${cardType?.name!}`,
      imagePath: `${cardType?.image_path}`,
      author: `${cardType?.illustrator}`,
      cardIndex: cardType?.id!,
      rarityId: cardType?.rarity_id!,
      cardsInSet: allCardTypesInSet.length,
      displayCount: cardCounts.has(cardType.id)
        ? cardCounts.get(cardType.id)
        : 0,
    };
    cardDisplays.push(cardInfo);
  });

  cardDisplays.sort((a, b) => a.cardIndex - b.cardIndex);

  const collectionBuffer = await getCollectionBufferFromCardDisplays(
    cardDisplays,
    browser,
  );

  return {
    collectionImagePaths: collectionBuffer,
    completion_percent: (cardCounts.size / allCardTypesInSet.length) * 100,
  };
}

export async function openPackCommand(
  username: string,
  userId: string,
  browser: Browser,
  setId: number,
): Promise<{ collectionImagePaths: Buffer[] } | null> {
  await createNewUser(username, userId);
  const packs = await getPacksFromSet(userId, setId);
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
    const cardTypes = await db // TODO get everything I need with a join here to also have rarity stuff
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

    type CardData = { user_id: number; cardtype_id: number };
    const cards: Array<CardData> = [];

    const cardDisplays: Array<CardDisplay> = [];

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

      const cardInfo: CardDisplay = {
        cardName: `${cardType?.name!}`,
        imagePath: `${cardType?.image_path}`,
        author: `${cardType?.illustrator}`,
        cardIndex: cardType?.id!,
        rarityId: cardType?.rarity_id!,
        cardsInSet: cardTypes.length,
      };

      cardDisplays.push(cardInfo);
    }

    await db.insert(cardTable).values(cards);

    const collectionBuffer = await getCollectionBufferFromCardDisplays(
      cardDisplays,
      browser,
    );

    return { collectionImagePaths: collectionBuffer };
  }
}

export async function getCollectionBufferFromCardDisplays(
  cardDisplays: Array<CardDisplay>,
  browser: Browser,
): Promise<Buffer[]> {
  const page: Page = await browser.newPage();
  const collectionImagePathArray: Array<Buffer> = [];

  try {
    const pngBuffer = await createCollectionPNG(page, cardDisplays);
    collectionImagePathArray.push(pngBuffer);
  } finally {
    await page.close();
  }

  return collectionImagePathArray;
}
