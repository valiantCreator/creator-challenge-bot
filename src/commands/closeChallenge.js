// src/commands/close-challenge.js
// Purpose: Slash command for admins to manually close an active challenge.
// Gemini: Updated to use Async/Await for PostgreSQL migration.

const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const challengesService = require("../services/challenges");
const { createErrorEmbed, createSuccessEmbed } = require("../utils/embeds");
const { cancelChallenge } = require("../services/scheduler");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("close-challenge")
    .setDescription("Closes an active challenge or stops a recurring schedule.")
    .addIntegerOption((option) =>
      option
        .setName("challenge_id")
        .setDescription("The ID of the challenge or template to close.")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    // (FIX) Get the database connection from the client.
    const db = interaction.client.db;
    const challengeId = interaction.options.getInteger("challenge_id", true);

    try {
      // (FIX) Pass the database connection to the service.
      // Gemini: Added await
      const challenge = await challengesService.getChallengeById(
        db,
        challengeId
      );

      if (!challenge) {
        const errorEmbed = createErrorEmbed(
          "Not Found",
          `No challenge with the ID \`#${challengeId}\` exists.`
        );
        return interaction.editReply({ embeds: [errorEmbed] });
      }

      if (!challenge.is_active) {
        const errorEmbed = createErrorEmbed(
          "Already Inactive",
          `Challenge \`#${challengeId}: ${challenge.title}\` is already inactive.`
        );
        return interaction.editReply({ embeds: [errorEmbed] });
      }

      if (challenge.is_template) {
        // (FIX) Pass the database connection to the service.
        // Gemini: Added await
        await challengesService.closeChallenge(db, challengeId);
        cancelChallenge(challengeId); // This manages its own state, no db needed here.

        const successEmbed = createSuccessEmbed(
          "Recurring Schedule Stopped",
          `You have stopped the recurring schedule for \`#${challengeId}: ${challenge.title}\`. It will no longer post automatically.`
        );
        return interaction.editReply({ embeds: [successEmbed] });
      }

      // (FIX) Pass the database connection to the service.
      // Gemini: Added await
      const success = await challengesService.closeChallenge(db, challengeId);
      if (!success) throw new Error("Database update failed unexpectedly.");

      const successEmbed = createSuccessEmbed(
        "Challenge Closed",
        `You have closed challenge \`#${challengeId}: ${challenge.title}\`. New submissions are no longer allowed.`
      );
      await interaction.editReply({ embeds: [successEmbed] });
    } catch (error) {
      console.error(`Error closing challenge #${challengeId}:`, error);
      const errorEmbed = createErrorEmbed(
        "An error occurred while closing the challenge."
      );
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  },
};
