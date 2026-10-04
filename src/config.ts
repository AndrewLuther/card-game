export const BASE_URL =
  process.env.NODE_ENV === "production"
    ? "https://myapp.com"
    : "http://localhost:3000";

export const TOKEN = process.env.DISCORD_BOT_TOKEN!;
export const CLIENT_ID = process.env.DISCORD_CLIENT_ID!;
export const GUILD_ID = process.env.DISCORD_GUILD_ID; // optional
