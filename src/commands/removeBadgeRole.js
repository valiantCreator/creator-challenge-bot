// src/commands/removeBadgeRole.js
// Purpose: Command to delete a configured badge role milestone.

const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const challengesService = require("../services/challenges");
const { createErrorEmbed, createSuccessEmbed } = require("../utils/embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("remove-badge-role")
    .setDescription("Removes a configured badge role milestone.")
    .addIntegerOption((option) =>
      option
        .setName("badge_id")
        .setDescription("The ID of the badge to remove (see /list-badge-roles)")
        .setRequired(true)
        .setMinValue(1)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    // (FIX) Get the database connection from the client.
    const db = interaction.client.db;

    const badgeId = interaction.options.getInteger("badge_id");

    try {
      // (FIX) Pass the database connection to the service.
      const success = challengesService.removeBadgeRole(db, badgeId);

      if (!success) {
        const errorEmbed = createErrorEmbed(
          "Badge Role Not Found",
          `No badge role with the ID \`${badgeId}\` exists. Use \`/list-badge-roles\` to see a list of valid IDs.`
        );
        return interaction.editReply({ embeds: [errorEmbed] });
      }

      const successEmbed = createSuccessEmbed(
        "Badge Role Removed",
        `Successfully removed the badge role configuration with ID \`${badgeId}\`.`
      );
      await interaction.editReply({ embeds: [successEmbed] });
    } catch (error) {
      console.error("Error in /remove-badge-role command:", error);
      const errorEmbed = createErrorEmbed(
        "An error occurred while removing the badge role."
      );
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  },
};
