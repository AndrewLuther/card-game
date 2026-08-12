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
  getUserCount,
  createNewUser,
  getVoucherCount,
  voucherReceiveCommand,
  buyPackCommand,
  openPackCommand,
} from "./db/db";

import { serve } from "@hono/node-server";

import honoApp from "./card-svg";

import puppeteer, { Browser } from "puppeteer";

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

      await interaction.reply(
        `You now have ${user.packVouchers} pack vouchers!`,
      );
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("buy-pack")
      .setDescription("Buy a pack using a pack voucher."),
    async execute(interaction) {
      const buyPackResponse = await buyPackCommand(
        interaction.user.username,
        interaction.user.id!,
      );

      // if nothing was returned, its because the user has no pack vouchers
      if (!buyPackResponse) {
        interaction.reply(
          `You don't have any pack vouchers! If you haven't already, use /voucher-receive to receive your daily vouchers.`,
        );
      } else {
        await interaction.reply(
          `You now have ${buyPackResponse.packs.length} unopened packs! (${buyPackResponse.user.packVouchers} pack vouchers remaining)`,
        );
      }
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("open-pack")
      .setDescription("Open one of your packs."),
    async execute(interaction) {
      // This can take a while because of image stuff, give bot time to process
      await interaction.deferReply();
      const openPackResponse = await openPackCommand(
        interaction.user.username!,
        interaction.user.id!,
        browser,
      );

      // if response is null the user doesn't have any packs to open
      if (!openPackResponse) {
        interaction.editReply(
          `You don't have any packs! Use /buy-pack to purchase a pack of cards to open.`,
        );
      } else {
        await interaction.editReply({
          content: "Fished up four new cards!",
          files: openPackResponse.cardImagePaths,
        });
      }
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
      await buyPackCommand(interaction.user.username, interaction.user.id!);
      await interaction.deferReply();
      const openPackResponse = await openPackCommand(
        interaction.user.username!,
        interaction.user.id!,
        browser,
      );
      await interaction.editReply({
        content: "Fished up four new cards!",
        files: openPackResponse!.cardImagePaths,
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
