// src/commands/listBadgeRoles.js
// Purpose: Command to display all configured badge roles for the server.

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");
const challengesService = require("../services/challenges");
const { createErrorEmbed } = require("../utils/embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("list-badge-roles")
    .setDescription("Displays all configured badge roles for this server.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    // (FIX) Get the database connection from the client.
    const db = interaction.client.db;

    try {
      // (FIX) Pass the database connection to the service.
      const badgeRoles = challengesService.getBadgeRoles(
        db,
        interaction.guildId
      );

      if (!badgeRoles || badgeRoles.length === 0) {
        const errorEmbed = createErrorEmbed(
          "No Badge Roles Found",
          "No badge roles have been configured for this server yet. Use `/add-badge-role` to create one."
        );
        return interaction.editReply({ embeds: [errorEmbed] });
      }

      const description = badgeRoles
        .map(
          (badge) =>
            `**ID: ${badge.id}** | <@&${badge.role_id}> — **Points:** ${badge.points_required}`
        )
        .join("\n");

      const listEmbed = new EmbedBuilder()
        .setTitle("🏆 Configured Badge Roles")
        .setDescription(description)
        .setColor("#FFD700") // Gold color
        .setFooter({
          text: "Use /remove-badge-role with the ID to remove a badge.",
        });

      await interaction.editReply({ embeds: [listEmbed] });
    } catch (error) {
      console.error("Error in /list-badge-roles command:", error);
      const errorEmbed = createErrorEmbed(
        "An error occurred while fetching the badge roles."
      );
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  },
};
