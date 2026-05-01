#!/usr/bin/env node
import { loadConfig } from "./config.js";
import { VesperCore } from "./core.js";
import { VesperDiscordBot } from "./discord-bot.js";

const config = loadConfig();
const core = new VesperCore(config);

console.log(`[vesper] Runtime mode: ${config.runtimeMode}`);
console.log(`[vesper] Database: ${config.databasePath}`);
console.log(`[vesper] Artifacts: ${config.artifactRoot}`);
if (config.runtimeMode === "local-dev") {
  console.warn("[vesper] local-dev mode is for solo development only. Automatic mode is disabled.");
}

if (!config.discord.token || !config.discord.clientId || !config.discord.guildId) {
  console.error("[vesper] Missing Discord config. Set DISCORD_TOKEN, DISCORD_CLIENT_ID, and DISCORD_GUILD_ID.");
  process.exit(1);
}

const bot = new VesperDiscordBot(core, {
  token: config.discord.token,
  clientId: config.discord.clientId,
  guildId: config.discord.guildId,
  ownerIds: config.discord.ownerIds,
});

process.on("SIGINT", () => {
  void shutdown();
});
process.on("SIGTERM", () => {
  void shutdown();
});

async function shutdown(): Promise<void> {
  console.log("[vesper] Shutting down...");
  await bot.stop().catch(() => undefined);
  core.db.close();
  process.exit(0);
}

await bot.start();
console.log("[vesper] Discord bot is running.");
