// src/commands/profile.js
// Purpose: Slash command to display a user's challenge profile.

const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const pointsService = require("../services/points");
const challengesService = require("../services/challenges");
const { createErrorEmbed, COLORS } = require("../utils/embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Displays your or another user's challenge profile.")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user whose profile you want to see (admin only).")
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const targetUserOption = interaction.options.getUser("user");
      let targetUser = interaction.user; // Default to the user who ran the command

      // If a target user was specified, check for admin permissions
      if (targetUserOption) {
        if (
          !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)
        ) {
          const errorEmbed = createErrorEmbed(
            "Permission Denied",
            "You must have the 'Manage Server' permission to view another user's profile."
          );
          return interaction.editReply({
            embeds: [errorEmbed],
            ephemeral: true,
          });
        }
        targetUser = targetUserOption;
      }

      const db = interaction.client.db;
      const guildId = interaction.guildId;
      const userId = targetUser.id;

      // --- Fetch Data from Services ---
      const { points } = pointsService.getUserPoints(db, guildId, userId);
      const rankInfo = pointsService.getUserRank(db, guildId, userId);
      const recentSubmissions = challengesService.getSubmissionsByUserId(
        db,
        guildId,
        userId,
        5
      );

      // --- Build the Profile Embed ---
      const profileEmbed = new EmbedBuilder()
        .setColor(COLORS.primary)
        .setAuthor({
          name: `${targetUser.username}'s Challenge Profile`,
          iconURL: targetUser.displayAvatarURL(),
        })
        .setThumbnail(targetUser.displayAvatarURL())
        .setTimestamp();

      // --- Add Stats Field ---
      const rankString = rankInfo
        ? `**Rank:** ${rankInfo.rank} / ${rankInfo.total}`
        : "**Rank:** Unranked";
      profileEmbed.addFields({
        name: "📊 Current Stats",
        value: `**Total Points:** ${points}\n${rankString}`,
      });

      // --- Add Submissions Field ---
      if (recentSubmissions && recentSubmissions.length > 0) {
        const submissionLinks = recentSubmissions
          .map((sub) => {
            // Create a Discord message link
            const messageLink = `https://discord.com/channels/${guildId}/${sub.channel_id}/${sub.message_id}`;
            // Truncate long submission text
            const submissionText = sub.content_text
              ? sub.content_text.length > 50
                ? sub.content_text.substring(0, 47) + "..."
                : sub.content_text
              : "Attachment/Link Submission";
            return `[Challenge #${sub.challenge_id}: ${submissionText}](${messageLink})`;
          })
          .join("\n");

        profileEmbed.addFields({
          name: "📝 Recent Submissions",
          value: submissionLinks,
        });
      } else {
        profileEmbed.addFields({
          name: "📝 Recent Submissions",
          value: "No submissions found.",
        });
      }

      await interaction.editReply({ embeds: [profileEmbed] });
    } catch (error) {
      console.error("Error in /profile command:", error);
      const errorEmbed = createErrorEmbed(
        "An unexpected error occurred while fetching the profile."
      );
      await interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
    }
  },
};
