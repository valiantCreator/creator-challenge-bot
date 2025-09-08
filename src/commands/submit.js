// src/commands/submit.js
// Purpose: Slash command handler for submitting an entry to a challenge.

const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const challengesService = require("../services/challenges");
const pointsService = require("../services/points");
const settingsService = require("../services/settings");
const { createErrorEmbed, createSuccessEmbed } = require("../utils/embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("submit")
    .setDescription("Submit your entry to a challenge")
    .addIntegerOption((opt) =>
      opt
        .setName("challenge_id")
        .setDescription("The ID of the challenge to submit to.")
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("text").setDescription("Text description for your entry.")
    )
    .addAttachmentOption((opt) =>
      opt
        .setName("attachment")
        .setDescription("An image, video, or file for your entry.")
    )
    .addStringOption((opt) =>
      opt
        .setName("link")
        .setDescription("A URL to your content (e.g., YouTube, Figma).")
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const db = interaction.client.db;
      const challengeId = interaction.options.getInteger("challenge_id", true);
      const text = interaction.options.getString("text");
      const link = interaction.options.getString("link");
      const attachment = interaction.options.getAttachment("attachment");

      if (!text && !link && !attachment) {
        return interaction.editReply({
          embeds: [
            createErrorEmbed(
              "No Content Provided",
              "You must provide at least one of the following: text, link, or attachment."
            ),
          ],
        });
      }

      const challenge = challengesService.getChallengeById(db, challengeId);
      if (!challenge || !challenge.is_active || !challenge.thread_id) {
        return interaction.editReply({
          embeds: [
            createErrorEmbed(
              "Challenge Not Found or Ready",
              `Challenge #${challengeId} was not found, is no longer active, or is not ready for submissions.`
            ),
          ],
        });
      }

      // Fetch the dedicated challenge thread.
      const thread = await interaction.guild.channels.fetch(
        challenge.thread_id
      );
      if (!thread) {
        return interaction.editReply({
          embeds: [
            createErrorEmbed(
              "Submission Thread Not Found",
              `Could not find the submission thread for challenge #${challengeId}.`
            ),
          ],
        });
      }

      // First, we need to create the submission in the database to get its ID.
      // We will post a temporary message in the thread and edit it later.
      const placeholderMessage = await thread.send({
        content: "Processing your submission...",
      });

      const submissionId = challengesService.recordSubmission(db, {
        challenge_id: challengeId,
        guild_id: interaction.guildId,
        user_id: interaction.user.id,
        username: interaction.user.username,
        channel_id: thread.id, // The submission is in the thread
        message_id: placeholderMessage.id,
        thread_id: thread.id,
        content_text: text,
        attachment_url: attachment?.url,
        link_url: link,
      });

      // Build the final embed now that we have the submissionId.
      const submissionEmbed = new EmbedBuilder()
        .setColor("#57F287")
        .setAuthor({
          name: `Submission from ${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setTitle(`Entry for: #${challenge.id} — ${challenge.title}`);

      if (text) submissionEmbed.addFields({ name: "📝 Notes", value: text });
      if (link) submissionEmbed.addFields({ name: "🔗 Link", value: link });
      if (attachment) {
        if (attachment.contentType?.startsWith("image/")) {
          submissionEmbed.setImage(attachment.url);
        } else {
          submissionEmbed.addFields({
            name: "📎 Attachment",
            value: `[${attachment.name}](${attachment.url})`,
          });
        }
      }

      // Set the timestamp and then the footer to ensure the footer text is not overwritten.
      submissionEmbed.setTimestamp(new Date());
      submissionEmbed.setFooter({
        text: `Submission ID: ${submissionId} • Vote with 👍`,
      });

      // Now, edit the placeholder message with the final, complete embed.
      await placeholderMessage.edit({
        content: "", // Remove the placeholder text
        embeds: [submissionEmbed],
      });

      // Add the reaction for voting.
      await placeholderMessage.react("👍");

      // Award points for the submission.
      const settings = settingsService.getGuildSettings(
        db,
        interaction.guildId
      );
      await pointsService.addPoints(
        db,
        interaction.guildId,
        interaction.user.id,
        settings.points_per_submission,
        interaction.client
      );

      await interaction.editReply({
        embeds: [
          createSuccessEmbed(
            "Submission Recorded",
            `Your submission has been recorded in the challenge thread. [View Submission](${placeholderMessage.url})`
          ),
        ],
      });
    } catch (error) {
      console.error("Error processing submission:", error);
      const errorEmbed = createErrorEmbed(
        "Submission Failed",
        `There was an issue processing your submission.\n\n*${error.message}*`
      );
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  },
};
