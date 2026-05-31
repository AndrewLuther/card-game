import "dotenv/config"; // allows us to read .env file
import { db } from "./db/db";
import { cardtypeTable, cardrarityTable } from "./db/schema";

async function main() {
  // delete all cardTypes so they can be recreated
  await db.delete(cardtypeTable);
  await db.delete(cardrarityTable);

  await db.insert(cardrarityTable).values([
    {
      id: 0,
      value: 100,
    },
    {
      id: 1,
      value: 30,
    },
    {
      id: 2,
      value: 5,
    },
  ]);

  // insert all the cardTypes again
  await db.insert(cardtypeTable).values([
    {
      set_id: 0,
      name: "guppy",
      image_path: "images/guppy.png",
      rarity_id: 0,
    },
    {
      set_id: 0,
      name: "equi",
      image_path: "images/equi.png",
      rarity_id: 1,
    },
    {
      set_id: 0,
      name: "jeff",
      image_path: "images/jeff.png",
      rarity_id: 0,
    },
    {
      set_id: 0,
      name: "ort",
      image_path: "images/ort.png",
      rarity_id: 1,
    },
    {
      set_id: 0,
      name: "anabelle",
      image_path: "images/anabelle.png",
      rarity_id: 2,
    },
    {
      set_id: 0,
      name: "globby",
      image_path: "images/globby.png",
      rarity_id: 2,
    },
  ]);
}

main();
