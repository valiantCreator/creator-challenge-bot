// src/deploy-commands.js
// This is a utility script to register or update slash commands with Discord.
// It should be run manually by a developer whenever a command is added or changed.

const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v10");
const fs = require("fs");
const path = require("path");
const config = require("./config");

// --- Configuration Check ---
if (!config.token || !config.clientId || !config.guildId) {
  console.error(
    "FATAL: Missing DISCORD_TOKEN, CLIENT_ID, or GUILD_ID in your config.js or .env file."
  );
  process.exit(1);
}

const commands = [];
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

console.log("🔍 Found the following command files:");
for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  if (command.data) {
    commands.push(command.data.toJSON());
    console.log(`   - ${file}`);
  } else {
    console.warn(`[WARN] The command at ${file} is missing the 'data' export.`);
  }
}

const rest = new REST({ version: "10" }).setToken(config.token);

(async () => {
  try {
    console.log(
      `\n🚀 Started refreshing ${commands.length} application (/) commands.`
    );

    // The put method is used to fully refresh all commands in the guild with the current set.
    // This is ideal for development servers for instant updates.
    const data = await rest.put(
      Routes.applicationGuildCommands(config.clientId, config.guildId),
      { body: commands }
    );

    console.log(
      `✅ Successfully reloaded ${data.length} application (/) commands for guild ${config.guildId}.`
    );
  } catch (error) {
    console.error("❌ Failed to refresh commands:", error);
  }
})();
