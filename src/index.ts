import "dotenv/config"; // allows us to read .env file

import {
  ChatInputCommandInteraction,
  Client,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
} from "discord.js";
import { db } from "./db/db";
import {
  cardrarityTable,
  cardTable,
  cardtypeTable,
  packTable,
  userTable,
} from "./db/schema";
import { eq, and } from "drizzle-orm";

const TOKEN = process.env.DISCORD_BOT_TOKEN!;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID!;
const GUILD_ID = process.env.DISCORD_GUILD_ID; // optional

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// creates a new user in the db if the user isn't added yet
async function createNewUser(interaction: ChatInputCommandInteraction) {
  const users = await db
    .select()
    .from(userTable)
    .where(eq(userTable.discordSnowflake, interaction.user.id!));

  if (users.length == 0) {
    // add the user to the db
    await db.insert(userTable).values({
      name: interaction.user.username!,
      discordSnowflake: interaction.user.id!,
      packVouchers: 0,
    });
  }
}

async function getVoucherCount(interaction: ChatInputCommandInteraction) {
  const vouchers = await db
    .select({ vouchers: userTable.packVouchers })
    .from(userTable)
    .where(eq(userTable.discordSnowflake, interaction.user.id!));

  let voucher = vouchers[0]!["vouchers"];
  if (!voucher) voucher = 0;
  return voucher;
}

async function getUser(interaction: ChatInputCommandInteraction) {
  const userResult = await db
    .select()
    .from(userTable)
    .where(eq(userTable.discordSnowflake, interaction.user.id!));
  const user = userResult[0]!;
  return user;
}

async function getPacks(interaction: ChatInputCommandInteraction) {
  const user = await getUser(interaction);
  const packs = await db
    .select()
    .from(packTable)
    .where(eq(packTable.user_id, user.id));
  return packs;
}

type Command = {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
};

const commands: Command[] = [
  {
    data: new SlashCommandBuilder()
      .setName("users")
      .setDescription("Get Number of Users from the db."),
    async execute(interaction) {
      const count = await db.$count(userTable);
      await interaction.reply(`We have ${count} users in the db.`);
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("buy-pack")
      .setDescription("Buy a pack using a pack voucher."),
    async execute(interaction) {
      await createNewUser(interaction);
      const voucher = await getVoucherCount(interaction);
      if (voucher == 0) {
        interaction.reply(
          `You don't have any pack vouchers! If you haven't already, use voucher-receive to receive your daily vouchers.`,
        );
      } else {
        // should these multiple transactions happen with one command? Don't want things getting out of sync
        const userResult = await db
          .update(userTable)
          .set({ packVouchers: voucher - 1 })
          .where(eq(userTable.discordSnowflake, interaction.user.id!))
          .returning();
        const user = userResult[0]!;

        await db.insert(packTable).values({
          user_id: user.id,
          set_id: 0,
        });

        const packs = await getPacks(interaction);

        await interaction.reply(
          `You now have ${packs.length} unopened packs! (${user.packVouchers} pack vouchers remaining)`,
        );
      }
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("open-pack")
      .setDescription("Open one of your packs."),
    async execute(interaction) {
      await createNewUser(interaction);
      const packs = await getPacks(interaction);
      if (packs.length <= 0) {
        await interaction.reply(
          `You don't own any packs! Use /buy-pack to purchase one.`,
        );
      } else {
        const user = await getUser(interaction);

        // for now just open the first pack
        const packToOpen = packs[0];

        // define this somewhere else?
        const cardsPerPack = 5;

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
        const cardImagePaths: Array<string> = [];

        // create the cards
        for (let i = 0; i < cardsPerPack; i++) {
          // determine which cardrarity is randomly selected
          let rarity = cardrarities[0];
          const random = Math.random() * 100;
          console.log(random);
          for (let j = 0; j < cardrarities.length; j++) {
            if (random < cardrarities[j]!.value) {
              console.log(
                "The random value is " +
                  random +
                  " and the cardrarities value is " +
                  cardrarities[j]!.value,
              );
              rarity = cardrarities[j];
            }
          }
          console.log(rarity?.id);

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
          cardImagePaths.push(cardType?.image_path!);
        }

        await db.insert(cardTable).values(cards);

        // display the cards that were received
        await interaction.reply({
          content: "Here are your cards!",
          files: cardImagePaths,
        });
      }
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("voucher-number")
      .setDescription("See how many vouchers you have."),
    async execute(interaction) {
      await createNewUser(interaction);
      const voucher = await getVoucherCount(interaction);
      await interaction.reply(`You have ${voucher} pack vouchers!`);
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("voucher-receive")
      .setDescription("Receive your daily pack vouchers."),
    async execute(interaction) {
      await createNewUser(interaction);
      let voucher = await getVoucherCount(interaction);
      if (!voucher) voucher = 0;

      const userResult = await db
        .update(userTable)
        .set({ packVouchers: voucher + 1 })
        .where(eq(userTable.discordSnowflake, interaction.user.id!))
        .returning();
      const user = userResult[0]!;

      await interaction.reply(
        `You now have ${user.packVouchers} pack vouchers!`,
      );
    },
  },
];

// Register
const rest = new REST({ version: "10" }).setToken(TOKEN);

async function register() {
  const body = commands.map((c) => c.data.toJSON());

  if (GUILD_ID) {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body,
    });
  } else {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body });
  }

  console.log("Registered slash commands");
}

// Handle slash commands
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.find((c) => c.data.name === interaction.commandName);
  if (!command) return;

  await command.execute(interaction);
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

(async () => {
  await register();
  await client.login(TOKEN);
})();
