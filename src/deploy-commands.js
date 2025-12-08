// scripts/deploy-commands.js
// Purpose: Registers slash commands with Discord API.
// Gemini: Updated paths to point to ../src/ and added explicit .env loading.

const fs = require("fs");
const path = require("path");
const { REST, Routes } = require("discord.js");

// 1. Load Environment Variables (Crucial: Point to root .env)
require("dotenv").config({ path: path.join(__dirname, "../.env") });

// 2. Load Config (Crucial: Point to src/config.js)
// We use path.join to go up one level (..) then into src
const config = require("../src/config");

const commands = [];
// 3. Point to src/commands
const commandsPath = path.join(__dirname, "../src/commands");

// Verify directory exists before reading
if (!fs.existsSync(commandsPath)) {
  console.error(
    `❌ Error: Could not find commands directory at: ${commandsPath}`
  );
  process.exit(1);
}

const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if (command?.data?.toJSON) {
    commands.push(command.data.toJSON());
  } else {
    console.warn(
      `[WARNING] The command at ${filePath} is missing "data" or "toJSON" property.`
    );
  }
}

const rest = new REST({ version: "10" }).setToken(config.token);

(async () => {
  try {
    console.log(`Deploying ${commands.length} slash commands...`);

    // Check if we have the necessary IDs
    if (!config.clientId) {
      throw new Error("Missing CLIENT_ID in config/env");
    }

    if (config.guildId) {
      const data = await rest.put(
        Routes.applicationGuildCommands(config.clientId, config.guildId),
        { body: commands }
      );
      console.log(`✅ Registered guild commands (${data.length}).`);
    } else {
      const data = await rest.put(Routes.applicationCommands(config.clientId), {
        body: commands,
      });
      console.log(`✅ Registered global commands (${data.length}).`);
    }
  } catch (error) {
    console.error("Failed to deploy commands:", error);
  }
})();
