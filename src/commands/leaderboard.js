// src/commands/leaderboard.js
// Purpose: Slash command handler for displaying the points leaderboard.
// Gemini: Updated to use Async/Await for PostgreSQL migration.

const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getLeaderboard } = require("../services/points");
const { createErrorEmbed, COLORS } = require("../utils/embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Show the top participants by points")
    .setDMPermission(false)
    .addStringOption((option) =>
      option
        .setName("period")
        .setDescription("The time period for the leaderboard.")
        .setRequired(false)
        .addChoices(
          { name: "Weekly", value: "weekly" },
          { name: "Monthly", value: "monthly" },
          { name: "All-Time", value: "all-time" }
        )
    ),

  async execute(interaction) {
    await interaction.deferReply();
    const db = interaction.client.db;

    try {
      const period = interaction.options.getString("period") ?? "all-time";

      // Gemini: Added await
      const leaderboardRows = await getLeaderboard(
        db,
        interaction.guildId,
        10,
        period
      );

      if (!leaderboardRows || leaderboardRows.length === 0) {
        const warningEmbed = new EmbedBuilder()
          .setColor(COLORS.warning)
          .setTitle("📊 Leaderboard is Empty")
          .setDescription(
            "No points have been awarded yet for this period. Participate in a challenge by using `/submit` to get on the board!"
          )
          .setTimestamp(new Date());

        return interaction.editReply({
          embeds: [warningEmbed],
          ephemeral: true,
        });
      }

      const medals = ["🥇", "🥈", "🥉"];
      const descriptionLines = leaderboardRows.map(
        (row, index) =>
          `${medals[index] || `**${index + 1}.**`} <@${row.user_id}> — **${
            row.points
          }** points`
      );

      const titleMap = {
        weekly: "📅 Weekly Leaderboard",
        monthly: "🗓️ Monthly Leaderboard",
        "all-time": "🏆 All-Time Leaderboard",
      };
      const embedTitle = titleMap[period];

      const leaderboardEmbed = new EmbedBuilder()
        .setTitle(embedTitle)
        .setColor(COLORS.primary)
        .setDescription(descriptionLines.join("\n"))
        .setTimestamp(new Date())
        .setFooter({ text: "Points are awarded for submissions and votes." });

      await interaction.editReply({ embeds: [leaderboardEmbed] });
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      const errorEmbed = createErrorEmbed(
        "An error occurred while fetching the leaderboard."
      );
      await interaction.editReply({
        embeds: [errorEmbed],
        ephemeral: true,
      });
    }
  },
};
