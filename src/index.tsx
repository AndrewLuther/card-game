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
import {
  db,
  createNewUser,
  getVoucherCount,
  getUser,
  getPacks,
  voucherReceiveCommand,
  buyPackCommand,
  openPackCommand,
} from "./db/db";
import {
  cardrarityTable,
  cardTable,
  cardtypeTable,
  packTable,
  userTable,
} from "./db/schema";
import { eq, and } from "drizzle-orm";
import { serve } from "@hono/node-server";

import honoApp from "./card-svg";

import puppeteer, { Browser, Page } from "puppeteer";

export const baseUrl =
  process.env.NODE_ENV === "production"
    ? "https://myapp.com"
    : "http://localhost:3000";

const TOKEN = process.env.DISCORD_BOT_TOKEN!;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID!;
const GUILD_ID = process.env.DISCORD_GUILD_ID; // optional

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

let browser: Browser;

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
      await createNewUser(interaction.user.username!, interaction.user.id!);
      const voucher = await getVoucherCount(interaction.user.id!);
      if (voucher == 0) {
        interaction.reply(
          `You don't have any pack vouchers! If you haven't already, use voucher-receive to receive your daily vouchers.`,
        );
      } else {
        const packs = await buyPackCommand(interaction.user.id!);
        const user = await getUser(interaction.user.id!);
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
      const packs = await getPacks(interaction.user.id!);
      if (packs.length <= 0) {
        console.log("ERROR: No pack to open");
      } else {
        await interaction.deferReply();
        const cardImagePaths = await openPackCommand(
          interaction.user.username!,
          interaction.user.id!,
          browser,
        );
        // display the cards that were received
        await interaction.editReply({
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

      await interaction.reply(
        `You now have ${user.packVouchers} pack vouchers!`,
      );
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("test-pack-open")
      .setDescription("Just do everything needed to open a pack."),
    async execute(interaction) {
      await voucherReceiveCommand(
        interaction.user.username!,
        interaction.user.id!,
      );
      await buyPackCommand(interaction.user.id!);

      await interaction.deferReply();
      const cardImagePaths = await openPackCommand(
        interaction.user.username!,
        interaction.user.id!,
        browser,
      );
      // display the cards that were received
      await interaction.editReply({
        content: "Here are your cards!",
        files: cardImagePaths,
      });
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
  serve(honoApp);
  browser = await puppeteer.launch({
    headless: true,
  });
})();

process.on("SIGTERM", async () => {
  await browser.close();
  process.exit(0);
});
