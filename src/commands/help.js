// src/commands/help.js
// Purpose: A dynamic help command that lists available commands based on user permissions.

const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const { COLORS } = require("../utils/embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Displays a list of available commands.")
    .setDMPermission(false),

  async execute(interaction) {
    const commands = interaction.client.commands;
    const isAdmin = interaction.member.permissions.has(
      PermissionFlagsBits.ManageGuild
    );

    const userCommands = [];
    const adminCommands = [];

    commands.forEach((command) => {
      const commandIsAdmin = command.data.default_member_permissions;

      // --- UPDATED: Changed the format to use code blocks instead of clickable links ---
      // This is more reliable as it doesn't depend on fetching the command's ID.
      const commandInfo = `\`/${command.data.name}\`\n*${command.data.description}*`;

      if (commandIsAdmin) {
        adminCommands.push(commandInfo);
      } else {
        if (command.data.name !== "help") {
          userCommands.push(commandInfo);
        }
      }
    });

    const helpEmbed = new EmbedBuilder()
      .setColor(COLORS.primary)
      .setTitle("🤖 Bot Commands")
      .setDescription("Here is a list of commands you can use.");

    if (userCommands.length > 0) {
      helpEmbed.addFields({
        name: "👤 User Commands",
        value: userCommands.join("\n\n"),
        inline: false,
      });
    }

    if (isAdmin && adminCommands.length > 0) {
      helpEmbed.addFields({
        name: "👑 Admin Commands",
        value: adminCommands.join("\n\n"),
        inline: false,
      });
    }

    helpEmbed.setFooter({
      text: "Use the command name to see its specific options.",
    });
    helpEmbed.setTimestamp();

    await interaction.reply({ embeds: [helpEmbed], ephemeral: true });
  },
};
