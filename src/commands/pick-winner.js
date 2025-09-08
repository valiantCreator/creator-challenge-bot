// src/commands/pick-winner.js
// Purpose: Admin command to select a winner for a challenge and award bonus points.

const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const pointsService = require("../services/points");
const challengesService = require("../services/challenges");
const {
  createErrorEmbed,
  createSuccessEmbed,
  COLORS,
} = require("../utils/embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("pick-winner")
    .setDescription("Selects a winner for a challenge and awards bonus points.")
    .addIntegerOption((option) =>
      option
        .setName("challenge_id")
        .setDescription("The ID of the challenge to pick a winner for.")
        .setRequired(true)
    )
    .addUserOption((option) =>
      option
        .setName("winner")
        .setDescription("The user to select as the winner.")
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("bonus_points")
        .setDescription("The number of bonus points to award the winner.")
        .setRequired(true)
        .setMinValue(1)
    )
    .addStringOption((option) =>
      option
        .setName("announcement")
        .setDescription(
          "A custom message to include in the winner announcement."
        )
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const db = interaction.client.db;
      const challengeId = interaction.options.getInteger("challenge_id", true);
      const winner = interaction.options.getUser("winner", true);
      const bonusPoints = interaction.options.getInteger("bonus_points", true);
      const announcementText = interaction.options.getString("announcement");

      // --- Validation ---
      const challenge = challengesService.getChallengeById(db, challengeId);
      if (!challenge || challenge.guild_id !== interaction.guildId) {
        return interaction.editReply({
          embeds: [
            createErrorEmbed(
              "Challenge Not Found",
              `Challenge #${challengeId} was not found in this server.`
            ),
          ],
        });
      }
      if (!challenge.thread_id) {
        return interaction.editReply({
          embeds: [
            createErrorEmbed(
              "Missing Thread",
              `Challenge #${challengeId} does not have a submission thread. Winners can only be announced in the challenge thread.`
            ),
          ],
        });
      }

      // --- Action 1: Award Points ---
      await pointsService.addPoints(
        db,
        interaction.guildId,
        winner.id,
        bonusPoints,
        interaction.client
      );

      // --- Action 2: Announce Winner in Thread (Detailed Announcement) ---
      const winnerEmbed = new EmbedBuilder()
        .setColor("#FFD700") // Gold
        .setTitle(`🏆 Winner Announced for Challenge #${challengeId}!`)
        .setAuthor({
          name: `Congratulations, ${winner.username}!`,
          iconURL: winner.displayAvatarURL(),
        })
        .setDescription(
          `A huge congratulations to <@${winner.id}> for winning the **${challenge.title}** challenge!`
        )
        .addFields(
          {
            name: "Bonus Points Awarded",
            value: `**${bonusPoints}** points`,
            inline: true,
          },
          {
            name: "Challenge",
            value: `[${challenge.title}](https://discord.com/channels/${interaction.guildId}/${challenge.thread_id})`,
            inline: true,
          }
        )
        .setThumbnail("https://i.imgur.com/343C1p4.png") // A simple trophy icon
        .setTimestamp();

      if (announcementText) {
        winnerEmbed.addFields({
          name: "A special note from the admins",
          value: announcementText,
        });
      }

      const thread = await interaction.client.channels
        .fetch(challenge.thread_id)
        .catch(() => null);
      if (thread) {
        await thread.send({
          content: `🎉 Congratulations <@${winner.id}>!`,
          embeds: [winnerEmbed],
        });
      } else {
        console.warn(
          `Could not find thread ${challenge.thread_id} to announce winner.`
        );
      }

      // --- (NEW) Action 3: Update Original Challenge Post (Public Announcement) ---
      try {
        const parentChannel = await interaction.client.channels
          .fetch(challenge.channel_id)
          .catch(() => null);
        if (parentChannel && challenge.message_id) {
          const originalMessage = await parentChannel.messages
            .fetch(challenge.message_id)
            .catch(() => null);
          if (originalMessage && originalMessage.embeds.length > 0) {
            const originalEmbed = originalMessage.embeds[0];
            const updatedEmbed = new EmbedBuilder(originalEmbed.data)
              .addFields({ name: "🏆 Winner", value: `<@${winner.id}>` })
              .setColor("#FFD700"); // Change color to gold to show it's completed

            await originalMessage.edit({ embeds: [updatedEmbed] });
          }
        }
      } catch (editError) {
        console.error(
          "Could not edit original challenge message to announce winner:",
          editError
        );
        // Don't stop the whole process if this fails, just log it.
      }

      // --- Action 4: Close Challenge and Archive Thread ---
      challengesService.closeChallenge(db, challengeId);
      if (thread) {
        await thread
          .setArchived(true, `Challenge #${challengeId} winner selected.`)
          .catch(console.error);
      }

      // --- Action 5: Confirm to Admin ---
      const successEmbed = createSuccessEmbed(
        "Winner Selected",
        `You have awarded **${bonusPoints}** bonus points to <@${winner.id}> for Challenge #${challengeId}. The announcement has been posted and the original message has been updated.`
      );
      await interaction.editReply({ embeds: [successEmbed] });
    } catch (error) {
      console.error("Error in /pick-winner command:", error);
      const errorEmbed = createErrorEmbed("An unexpected error occurred.");
      await interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
    }
  },
};
