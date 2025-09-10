// src/commands/set-vote-emoji.js
// Purpose: Admin command to set a custom emoji for voting.

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  parseEmoji,
} = require("discord.js");
const { setVoteEmoji } = require("../services/settings");
const { createSuccessEmbed, createErrorEmbed } = require("../utils/embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("set-vote-emoji")
    .setDescription("Sets the custom emoji for voting on submissions.")
    .addStringOption((option) =>
      option
        .setName("emoji")
        .setDescription(
          "The emoji to use for votes. Must be a single, valid emoji."
        )
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const db = interaction.client.db;
    const emojiString = interaction.options.getString("emoji", true).trim();

    // --- NEW: Robust, Cache-Based Validation ---
    const parsedEmoji = parseEmoji(emojiString);

    // If it's a custom emoji (it has an ID), we check if the bot has access to it.
    if (parsedEmoji && parsedEmoji.id) {
      // The bot's emoji cache contains all emojis from all servers it's in.
      if (!interaction.client.emojis.cache.has(parsedEmoji.id)) {
        const errorEmbed = createErrorEmbed(
          "Inaccessible Emoji",
          `The custom emoji "${emojiString}" is from a server that this bot is not in. Please use a standard emoji or a custom emoji from a shared server.`
        );
        return interaction.editReply({ embeds: [errorEmbed] });
      }
    }
    // parseEmoji returns null if the string is not a valid emoji format at all.
    // Unicode emojis don't have an ID and are always valid.
    else if (!parsedEmoji || !parsedEmoji.name) {
      const errorEmbed = createErrorEmbed(
        "Invalid Emoji Format",
        `The provided input "${emojiString}" is not a valid emoji. Please provide a single standard or custom emoji.`
      );
      return interaction.editReply({ embeds: [errorEmbed] });
    }

    // --- Action: Save to Database ---
    try {
      setVoteEmoji(db, interaction.guildId, emojiString);

      const successEmbed = createSuccessEmbed(
        "Vote Emoji Updated",
        `The emoji for voting has been successfully set to: ${emojiString}`
      );
      await interaction.editReply({ embeds: [successEmbed] });
    } catch (dbError) {
      console.error("Failed to save vote emoji:", dbError);
      const errorEmbed = createErrorEmbed(
        "Database Error",
        "There was an error saving the new emoji to the database."
      );
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  },
};
