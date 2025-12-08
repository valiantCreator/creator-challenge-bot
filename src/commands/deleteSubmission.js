// src/commands/delete-submission.js
// Purpose: Deletes a submission by its ID. (Admin only)
// Gemini: Updated to use Async/Await for PostgreSQL migration.

const { SlashCommandBuilder, PermissionsBitField } = require("discord.js");
const challengesService = require("../services/challenges");
const pointsService = require("../services/points");
const { createErrorEmbed, createSuccessEmbed } = require("../utils/embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("delete-submission")
    .setDescription("Deletes a submission by its ID. (Admin only)")
    .addIntegerOption((option) =>
      option
        .setName("id")
        .setDescription("The ID of the submission to delete")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    // (FIX) Get the database connection from the client.
    const db = interaction.client.db;
    const submissionId = interaction.options.getInteger("id");
    const guildId = interaction.guild.id;

    try {
      // (FIX) Pass the database connection to the service.
      // Gemini: Added await
      const submission = await challengesService.getSubmissionById(
        db,
        submissionId
      );

      if (!submission || submission.guild_id !== guildId) {
        const errorEmbed = createErrorEmbed(
          "Submission Not Found",
          `No submission with ID \`${submissionId}\` was found in this server.`
        );
        return interaction.editReply({ embeds: [errorEmbed] });
      }

      try {
        const channel = await interaction.client.channels.fetch(
          submission.channel_id
        );
        // Find the submission message inside the challenge thread
        if (channel && channel.isThread()) {
          const message = await channel.messages.fetch(submission.message_id);
          await message.delete();
        } else if (channel) {
          // Fallback for older submissions not in a thread
          const message = await channel.messages.fetch(submission.message_id);
          await message.delete();
        }
      } catch (error) {
        console.warn(
          `Could not delete submission message ${submission.message_id}. It may have already been deleted.`,
          error.message
        );
      }

      // (FIX) Pass the database connection to the service.
      // Gemini: Added await
      const deleted = await challengesService.deleteSubmission(
        db,
        submissionId
      );
      if (!deleted) {
        throw new Error(
          `Failed to delete submission ${submissionId} from the database.`
        );
      }

      // (FIX) Pass the database connection to the service.
      // Gemini: Added await
      await pointsService.recalculateUserPoints(
        db,
        submission.user_id,
        guildId
      );

      const successEmbed = createSuccessEmbed(
        "Submission Deleted",
        `Successfully deleted submission \`${submissionId}\` by <@${submission.user_id}> and recalculated their points.`
      );
      await interaction.editReply({ embeds: [successEmbed] });
    } catch (error) {
      console.error("Error in /delete-submission command:", error);
      const errorEmbed = createErrorEmbed(
        "An Error Occurred",
        "Something went wrong while trying to delete the submission."
      );
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  },
};
