import "dotenv/config"; // allows us to read .env file
import { db } from "./db/db";
import { cardtypeTable } from "./db/schema";

async function main() {
  // delete all cardTypes so they can be recreated
  await db.delete(cardtypeTable);

  // insert all the cardTypes again
  await db.insert(cardtypeTable).values([
    {
      set_id: 0,
      name: "smiley",
      image_path: "public/images/smiley.png",
      rarity: 1,
    },
    {
      set_id: 0,
      name: "frowney",
      image_path: "public/images/frowney.png",
      rarity: 1,
    },
  ]);
}

main();
