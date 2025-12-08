// src/commands/edit-submission.js
// Purpose: Slash command for users to edit their own submissions.
// Gemini: Updated to use Async/Await and fixed parameter casing for Postgres service.

const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const challengesService = require("../services/challenges");
const { createErrorEmbed, createSuccessEmbed } = require("../utils/embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("edit-submission")
    .setDescription("Edits a submission you have made.")
    .addIntegerOption((option) =>
      option
        .setName("submission_id")
        .setDescription("The ID of the submission you want to edit.")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("new_text")
        .setDescription("The new text for your submission.")
    )
    .addAttachmentOption((option) =>
      option
        .setName("new_attachment")
        .setDescription("The new attachment for your submission.")
    )
    .addStringOption((option) =>
      option
        .setName("new_link")
        .setDescription("The new link for your submission.")
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const db = interaction.client.db;
      const submissionId = interaction.options.getInteger(
        "submission_id",
        true
      );
      const newText = interaction.options.getString("new_text");
      const newAttachment = interaction.options.getAttachment("new_attachment");
      const newLink = interaction.options.getString("new_link");

      if (!newText && !newAttachment && !newLink) {
        return interaction.editReply({
          embeds: [
            createErrorEmbed(
              "No Changes Provided",
              "You must provide at least one new value to edit."
            ),
          ],
        });
      }

      // 1. Fetch the original submission from the database.
      // Gemini: Added await
      const originalSubmission = await challengesService.getSubmissionById(
        db,
        submissionId
      );

      if (!originalSubmission) {
        return interaction.editReply({
          embeds: [
            createErrorEmbed(
              "Not Found",
              `No submission with ID \`${submissionId}\` exists.`
            ),
          ],
        });
      }

      // 2. Security Check: Ensure the user is the original author.
      if (originalSubmission.user_id !== interaction.user.id) {
        return interaction.editReply({
          embeds: [
            createErrorEmbed(
              "Permission Denied",
              "You can only edit your own submissions."
            ),
          ],
        });
      }

      // 3. Update the database record.
      // Gemini: Updated keys to camelCase to match src/services/challenges.js updateSubmission logic
      const updatedData = {
        contentText: newText ?? originalSubmission.content_text,
        attachmentUrl: newAttachment?.url ?? originalSubmission.attachment_url,
        linkUrl: newLink ?? originalSubmission.link_url,
      };

      // Gemini: Added await
      await challengesService.updateSubmission(db, submissionId, updatedData);

      // 4. Fetch the original Discord message to edit it.
      const channel = await interaction.client.channels.fetch(
        originalSubmission.channel_id
      );
      const submissionMessage = await channel.messages.fetch(
        originalSubmission.message_id
      );

      if (!submissionMessage) {
        // The original message was deleted, so we can't edit it.
        // We still updated the DB, so we can just inform the user.
        return interaction.editReply({
          embeds: [
            createSuccessEmbed(
              "Submission Updated",
              "Your submission has been updated in the database, but the original Discord message could not be found to be edited."
            ),
          ],
        });
      }

      // 5. Rebuild the embed with the updated information.
      const originalEmbed = submissionMessage.embeds[0];
      const editedEmbed = new EmbedBuilder(originalEmbed.toJSON()); // Clone the original embed

      // Clear existing fields that will be replaced
      editedEmbed.setFields([]);

      if (updatedData.contentText)
        editedEmbed.addFields({
          name: "📝 Notes",
          value: updatedData.contentText,
        });
      if (updatedData.linkUrl)
        editedEmbed.addFields({ name: "🔗 Link", value: updatedData.linkUrl });

      editedEmbed.setImage(null); // Clear the old image before setting a new one
      if (updatedData.attachmentUrl) {
        if (newAttachment?.contentType?.startsWith("image/")) {
          editedEmbed.setImage(updatedData.attachmentUrl);
        } else {
          editedEmbed.addFields({
            name: "📎 Attachment",
            value: `[${newAttachment?.name ?? "View Attachment"}](${
              updatedData.attachmentUrl
            })`,
          });
        }
      }

      // (MODIFIED) Update the footer to preserve the ID and add an "Edited" status.
      editedEmbed.setFooter({
        text: `Submission ID: ${submissionId} • Edited • Vote with 👍`,
      });
      editedEmbed.setTimestamp(new Date()); // Update the timestamp to the edit time

      await submissionMessage.edit({ embeds: [editedEmbed] });

      await interaction.editReply({
        embeds: [
          createSuccessEmbed(
            "Submission Updated",
            `You have successfully edited your submission. [View Submission](${submissionMessage.url})`
          ),
        ],
      });
    } catch (error) {
      console.error("Error editing submission:", error);
      await interaction.editReply({
        embeds: [
          createErrorEmbed(
            "An Error Occurred",
            "There was an issue editing your submission."
          ),
        ],
      });
    }
  },
};
