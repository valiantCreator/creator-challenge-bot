// src/commands/set-points.js
// Purpose: Allows admins to configure point values for the server.
// Gemini: Updated to use Async/Await for PostgreSQL migration.

const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const settingsService = require("../services/settings");
const { createErrorEmbed, createSuccessEmbed } = require("../utils/embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("set-points")
    .setDescription(
      "Sets the custom point values for challenges in this server."
    )
    .addIntegerOption((option) =>
      option
        .setName("submission_points")
        .setDescription("The number of points awarded for a new submission.")
        .setMinValue(0)
    )
    .addIntegerOption((option) =>
      option
        .setName("vote_points")
        .setDescription("The number of points awarded for each upvote.")
        .setMinValue(0)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    //Get the database connection from the client.
    const db = interaction.client.db;

    try {
      const submissionPoints =
        interaction.options.getInteger("submission_points");
      const votePoints = interaction.options.getInteger("vote_points");
      const guildId = interaction.guild.id;

      if (submissionPoints === null && votePoints === null) {
        // Gemini: Added await
        const currentSettings = await settingsService.getGuildSettings(
          db,
          guildId
        );
        const errorEmbed = createErrorEmbed(
          "No Values Provided",
          `You must provide a value for at least one option.\n\n**Current Settings:**\n- Submissions: **${currentSettings.points_per_submission}** points\n- Votes: **${currentSettings.points_per_vote}** points`
        );
        return interaction.editReply({ embeds: [errorEmbed] });
      }

      const newSettings = {};
      if (submissionPoints !== null) {
        newSettings.points_per_submission = submissionPoints;
      }
      if (votePoints !== null) {
        newSettings.points_per_vote = votePoints;
      }

      // Gemini: Added await
      await settingsService.updateGuildSettings(db, guildId, newSettings);

      // Gemini: Added await
      const updatedSettings = await settingsService.getGuildSettings(
        db,
        guildId
      );

      const successEmbed = createSuccessEmbed(
        "Point Values Updated",
        `The point settings for this server have been updated.\n\n**New Settings:**\n- Submissions: **${updatedSettings.points_per_submission}** points\n- Votes: **${updatedSettings.points_per_vote}** points`
      );
      await interaction.editReply({ embeds: [successEmbed] });
    } catch (error) {
      console.error("Error in /set-points command:", error);
      const errorEmbed = createErrorEmbed(
        "An error occurred while updating settings."
      );
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  },
};
