import "dotenv/config"; // allows us to read .env file
import { db } from "./db/db";
import { userTable } from "./db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const userResult = await db
    .insert(userTable)
    .values({
      name: "Andrew",
      discordSnowflake: "194910567188791297",
      packVouchers: 0,
    })
    .returning();

  const user = userResult[0]!;

  console.log("New user created!", user);
  const users = await db.select().from(userTable);
  console.log("Getting all users from the database: ", users);
}

main();

// await db
//   .update(userTable)
//   .set({
//     name: "thedollylama",
//   })
//   .where(eq(userTable.id, user.id));

// console.log("User info updated!");
//await db.delete(userTable).where(eq(userTable.id, user.id));
//console.log("User deleted!");
