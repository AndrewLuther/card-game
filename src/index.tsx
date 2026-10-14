import "dotenv/config"; // allows us to read .env file

import {
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  Client,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  MessageFlags,
  type SlashCommandOptionsOnlyBuilder,
  type Interaction,
  type CacheType,
} from "discord.js";
import { serve } from "@hono/node-server";
import puppeteer, { Browser } from "puppeteer";
import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";

import {
  getUserCount,
  createNewUser,
  getVoucherCount,
  voucherReceiveCommand,
  buyPackCommand,
  openPackCommand,
  getCards,
  viewCollectionCommand,
  getSets,
  getPacks,
  goFishinCommand,
} from "./db/db";
import { CLIENT_ID, GUILD_ID, TOKEN } from "./config";
import { Card, Collection } from "./card-display";
import { BASE_URL } from "./config";
import type { Set } from "./types";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

let browser: Browser;

type Command = {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
};

const commands: Command[] = [
  {
    data: new SlashCommandBuilder()
      .setName("users")
      .setDescription("Get number of users from the db."),
    async execute(interaction) {
      const count = await getUserCount();
      await interaction.reply(`We have ${count} users in the db.`);
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("voucher-number")
      .setDescription("See how many vouchers you have."),
    async execute(interaction) {
      // creates a new user in the database if this user hasn't interacted yet
      await createNewUser(interaction.user.username!, interaction.user.id!);
      const voucher = await getVoucherCount(interaction.user.id!);
      await interaction.reply(`You have ${voucher} pack vouchers!`);
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("voucher-receive")
      .setDescription("Receive your daily pack vouchers."),
    async execute(interaction) {
      const user = await voucherReceiveCommand(
        interaction.user.username!,
        interaction.user.id!,
      );

      if (!user) {
        await interaction.reply(
          `You have already received your free voucher for the day! Check back tomorrow.`,
        );
      } else {
        await interaction.reply(
          `You now have ${user.packVouchers} pack vouchers!`,
        );
      }
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("go-fishin")
      .setDescription("See what you get! Can only do this once per day."),
    async execute(interaction) {
      const response = await goFishinCommand(
        interaction.user.username,
        interaction.user.id,
      );

      await interaction.reply(response.message);
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("buy-pack")
      .setDescription("Buy a pack using a pack voucher.")
      .addIntegerOption((option) =>
        option
          .setName("set")
          .setDescription("The set to buy a pack of")
          .setAutocomplete(true)
          .setRequired(true),
      ),
    async execute(interaction) {
      const buyPackResponse = await buyPackCommand(
        interaction.user.username,
        interaction.user.id!,
        interaction.options.getInteger("set", true),
      );

      // if nothing was returned, its because the user has no pack vouchers
      if (!buyPackResponse) {
        await interaction.reply(
          `You don't have any pack vouchers! If you haven't already, use /voucher-receive to receive your daily vouchers.`,
        );
      } else {
        await interaction.reply(
          `You now have ${buyPackResponse.packs.length} unopened packs! (${buyPackResponse.user.packVouchers} pack vouchers remaining)`,
        );
      }
    },
    async autocomplete(interaction) {
      const sets = await getSets();
      await interaction.respond(
        sets.map((set) => ({ name: set.name, value: set.id })),
      );
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("open-pack")
      .setDescription("Open one of your packs.")
      .addIntegerOption((option) =>
        option
          .setName("set")
          .setDescription("The set to open a pack from")
          .setAutocomplete(true)
          .setRequired(false),
      ),
    async execute(interaction) {
      // This can take a while because of image stuff, give bot time to process
      await interaction.deferReply();
      const setId = interaction.options.getInteger("set", false);

      if (!setId) {
        interaction.editReply(
          `You didn't select a set to open a pack from! If you don't own any packs, use /buy-pack to purchase a pack of cards to open.`,
        );
        return;
      }

      const openPackResponse = await openPackCommand(
        interaction.user.username!,
        interaction.user.id!,
        browser,
        setId,
      );

      // if response is null the user doesn't have any packs to open
      if (!openPackResponse) {
        interaction.editReply(
          `You don't have any packs! Use /buy-pack to purchase a pack of cards to open.`,
        );
      } else {
        await interaction.editReply({
          content: "Fished up four new cards!",
          files: openPackResponse.collectionImagePaths,
        });
      }
    },
    async autocomplete(interaction) {
      await createNewUser(interaction.user.username, interaction.user.id);
      const packs = await getPacks(interaction.user.id);
      const uniqueSetIds: Array<number> = [
        ...new Set(
          packs.map((pack) => {
            return pack.set_id;
          }),
        ),
      ];

      const sets = await getSets();

      await interaction.respond(
        uniqueSetIds.map((id) => ({
          name: sets.find((set) => set.id == id)!.name,
          value: id,
        })),
      );
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName("test-pack-open")
      .setDescription("Just do everything needed to open a pack."),
    async execute(interaction) {
      const setId = 0;
      await voucherReceiveCommand(
        interaction.user.username!,
        interaction.user.id!,
      );
      await buyPackCommand(
        interaction.user.username,
        interaction.user.id!,
        setId,
      );
      await interaction.deferReply();
      const openPackResponse = await openPackCommand(
        interaction.user.username!,
        interaction.user.id!,
        browser,
        setId,
      );
      await interaction.editReply({
        content: "Fished up four new cards!",
        files: openPackResponse!.collectionImagePaths,
      });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName("view-collection")
      .setDescription("View which cards you currently own.")
      .addIntegerOption((option) =>
        option
          .setName("set")
          .setDescription("The set to view your collection of")
          .setAutocomplete(true)
          .setRequired(true),
      ),
    async execute(interaction) {
      await interaction.deferReply();
      const setNumber = interaction.options.getInteger("set", true);
      const viewCollectionResponse = await viewCollectionCommand(
        setNumber,
        interaction.user.id!,
        interaction.user.username,
        browser,
      );
      const completionEmoji =
        viewCollectionResponse?.completion_percent == 100 ? "👑" : "";

      const sets = await getSets();
      const setName = sets.find((set) => set.id == setNumber)?.name;
      await interaction.editReply({
        content: `Your collection for **${setName}** is **${viewCollectionResponse?.completion_percent.toPrecision(3)}%** complete! ${completionEmoji}`,
        files: viewCollectionResponse!.collectionImagePaths,
      });
    },
    async autocomplete(interaction) {
      const sets = await getSets();
      await interaction.respond(
        sets.map((set) => ({ name: set.name, value: set.id })),
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
  if (interaction.isChatInputCommand()) {
    const command = commands.find(
      (c) => c.data.name === interaction.commandName,
    );
    if (!command) return;
    await command.execute(interaction);
  } else if (interaction.isAutocomplete()) {
    const command = commands.find(
      (c) => c.data.name === interaction.commandName,
    );
    if (!command || !command.autocomplete) return;
    await command.autocomplete(interaction);
  }

  return;
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

(async () => {
  await register();
  await client.login(TOKEN);

  const honoApp = new Hono();
  honoApp.use("/images/*", serveStatic({ root: "./public" }));
  honoApp.get("/card", (c) =>
    c.html(
      <Card
        cardName="guppy"
        imagePath="images/guppy.png"
        author="Andrew L."
        cardIndex={1}
        rarityId={2}
        cardsInSet={7}
        displayCount={21}
      />,
    ),
  );

  honoApp.get("/collection", (c) =>
    c.html(
      <Collection
        cardDisplays={[
          {
            cardName: "a",
            imagePath: "images/guppy.png",
            author: "AL",
            cardIndex: 0,
            rarityId: 1,
            cardsInSet: 2,
          },
          {
            cardName: "b",
            imagePath: "images/guppy.png",
            author: "AL",
            cardIndex: 0,
            rarityId: 2,
            cardsInSet: 2,
            displayCount: 4,
          },
          {
            cardName: "c",
            imagePath: "images/guppy.png",
            author: "AL",
            cardIndex: 0,
            rarityId: 0,
            cardsInSet: 2,
            displayCount: 3,
          },
          {
            cardName: "d",
            imagePath: "images/guppy.png",
            author: "AL",
            cardIndex: 0,
            rarityId: 2,
            cardsInSet: 2,
            displayCount: 1,
          },
          {
            cardName: "d",
            imagePath: "images/guppy.png",
            author: "AL",
            cardIndex: 0,
            rarityId: 2,
            cardsInSet: 2,
            displayCount: 0,
          },
        ]}
      />,
    ),
  );
  serve(honoApp);

  browser = await puppeteer.launch({
    headless: true,
  });
})();

process.on("SIGTERM", async () => {
  await browser.close();
  process.exit(0);
});
