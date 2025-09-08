// src/commands/listChallenges.js
// Purpose: Slash command handler for listing all active challenges.

const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { listActiveChallenges } = require("../services/challenges");
const { createErrorEmbed, COLORS } = require("../utils/embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("list-challenges")
    .setDescription("Show all active challenges in this server")
    .setDMPermission(false),

  async execute(interaction) {
    await interaction.deferReply();
    // (FIX) Get the database connection from the client.
    const db = interaction.client.db;

    try {
      // (FIX) Pass the database connection as the first argument.
      const challenges = listActiveChallenges(db, interaction.guildId);

      if (!challenges || challenges.length === 0) {
        const warningEmbed = new EmbedBuilder()
          .setColor(COLORS.warning)
          .setTitle("🤔 No Active Challenges Found")
          .setDescription(
            "There are currently no active challenges in this server. An admin can create one using `/create-challenge`."
          )
          .setTimestamp(new Date());

        return interaction.editReply({
          embeds: [warningEmbed],
          ephemeral: true,
        });
      }

      const listEmbed = new EmbedBuilder()
        .setTitle("🏆 Active Challenges")
        .setColor(COLORS.primary)
        .setDescription(
          "Here are all the currently active challenges. Use `/submit` to participate!"
        )
        .setTimestamp(new Date());

      challenges.forEach((ch) => {
        listEmbed.addFields({
          name: `🏁 #${ch.id}: ${ch.title}`,
          value: `> **Description:** ${ch.description}\n> **Type:** ${ch.type}\n> **Submit with:** \`/submit challenge_id:${ch.id}\``,
        });
      });

      await interaction.editReply({ embeds: [listEmbed] });
    } catch (error) {
      console.error("Error fetching active challenges:", error);
      const errorEmbed = createErrorEmbed(
        "An error occurred while fetching the challenge list."
      );
      await interaction.editReply({
        embeds: [errorEmbed],
        ephemeral: true,
      });
    }
  },
};
