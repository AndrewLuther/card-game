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
import { userTable } from "./db/schema";
import { eq } from "drizzle-orm";

const TOKEN = process.env.DISCORD_BOT_TOKEN!;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID!;
const GUILD_ID = process.env.DISCORD_GUILD_ID; // optional

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

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
      .setName("voucher-number")
      .setDescription("See how many vouchers you have."),
    async execute(interaction) {
      const vouchers = await db
        .select({ vouchers: userTable.packVouchers })
        .from(userTable)
        .where(eq(userTable.discordSnowflake, interaction.member?.user.id!));

      let voucher = vouchers[0]!["vouchers"];
      console.log(voucher);
      await interaction.reply(`You have ${voucher} pack vouchers!`);
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("voucher-receive")
      .setDescription("Receive your daily pack vouchers."),
    async execute(interaction) {
      const vouchers = await db
        .select({ vouchers: userTable.packVouchers })
        .from(userTable)
        .where(eq(userTable.discordSnowflake, interaction.member?.user.id!));

      let voucher = vouchers[0]!["vouchers"];
      if (!voucher) voucher = 0;

      const newCount = voucher + 1;

      const userResult = await db
        .update(userTable)
        .set({ packVouchers: newCount })
        .where(eq(userTable.discordSnowflake, interaction.member?.user.id!))
        .returning();

      const user = userResult[0]!;

      await interaction.reply(
        `You now have ${user.packVouchers} pack vouchers.`,
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
