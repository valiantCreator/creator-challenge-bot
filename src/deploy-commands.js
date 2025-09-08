const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');
const config = require('./config');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command?.data?.toJSON) commands.push(command.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(config.token);

(async () => {
  try {
    console.log(`Deploying ${commands.length} slash commands...`);
    if (config.guildId) {
      const data = await rest.put(
        Routes.applicationGuildCommands(config.clientId, config.guildId),
        { body: commands },
      );
      console.log(`✅ Registered guild commands (${data.length}).`);
    } else {
      const data = await rest.put(
        Routes.applicationCommands(config.clientId),
        { body: commands },
      );
      console.log(`✅ Registered global commands (${data.length}).`);
    }
  } catch (error) {
    console.error('Failed to deploy commands:', error);
  }
})();
