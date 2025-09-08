// src/commands/leaderboard.js
// Purpose: Slash command handler for displaying the points leaderboard.

const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getLeaderboard } = require("../services/points");
const { createErrorEmbed, COLORS } = require("../utils/embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Show the top participants by points")
    .setDMPermission(false),

  async execute(interaction) {
    await interaction.deferReply();
    // (FIX) Get the database connection from the client.
    const db = interaction.client.db;

    try {
      // (FIX) Pass the database connection as the first argument.
      const leaderboardRows = getLeaderboard(db, interaction.guildId, 10);

      if (!leaderboardRows || leaderboardRows.length === 0) {
        const warningEmbed = new EmbedBuilder()
          .setColor(COLORS.warning)
          .setTitle("📊 Leaderboard is Empty")
          .setDescription(
            "No points have been awarded yet. Participate in a challenge by using `/submit` to get on the board!"
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

      const leaderboardEmbed = new EmbedBuilder()
        .setTitle("🏆 Creator Challenge Leaderboard")
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
