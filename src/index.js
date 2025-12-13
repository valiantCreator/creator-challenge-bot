// src/index.js
// Main bot entry point.
// Gemini: Added robust error handling (Safe Reply + Global Catch) to prevent crashes.

const fs = require("fs");
const path = require("path");
const {
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
  Events,
} = require("discord.js");
const config = require("./config");
const { initializeScheduler } = require("./services/scheduler");
const { db } = require("./db"); // Import the database instance
const { startServer } = require("./api"); // Gemini: Import the API starter function

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent, // Gemini: Added (often needed for reading content/captions)
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// --- Attach Database to Client ---
// This makes the db connection accessible in all command and event files
// via `interaction.client.db` or `reaction.client.db`.
client.db = db;

// --- Dynamic Command Loader ---
client.commands = new Collection();
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));
for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ("data" in command && "execute" in command) {
    client.commands.set(command.data.name, command);
  } else {
    console.warn(
      `[WARN] The command at ${filePath} is missing "data" or "execute".`
    );
  }
}

// --- Dynamic Event Loader ---
const eventsPath = path.join(__dirname, "events");
const eventFiles = fs
  .readdirSync(eventsPath)
  .filter((file) => file.endsWith(".js"));
for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

// --- Client Ready Event ---
client.once(Events.ClientReady, async (c) => {
  console.log(`✅ Logged in as ${c.user.tag}`);

  // Pass the db connection from the client to the scheduler.
  try {
    await initializeScheduler(c.db, c);
  } catch (error) {
    console.error("❌ Failed to initialize scheduler:", error);
  }

  // Start the Web API Server once the bot is ready
  startServer(c);
});

// --- Interaction Handler (Robust) ---
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error executing /${interaction.commandName}`, error);

    // Gemini: Double-Safe Error Reporting
    // If the interaction is dead (Unknown Interaction), trying to reply will throw ANOTHER error.
    // We wrap this in a try/catch to ensure the bot doesn't crash from the error handler itself.
    try {
      const errorMessage = {
        content: "There was an error while executing this command.",
        ephemeral: true,
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    } catch (replyError) {
      // Just log the warning. Do NOT crash the process.
      console.warn(
        `[Safe Reply] Could not notify user of error in /${interaction.commandName}. The interaction may have expired.`,
        replyError.message
      );
    }
  }
});

// --- Gemini: Global Error Handlers ---
// These capture random network errors or unhandled rejections preventing the bot from crashing.
process.on("unhandledRejection", (error) => {
  console.error("Unhandled Promise Rejection:", error);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

client.login(config.token);
