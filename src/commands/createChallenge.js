// src/commands/create-challenge.js
// Purpose: Slash command handler for creating a new challenge.

const {
  SlashCommandBuilder,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const challengesService = require("../services/challenges");
const {
  createErrorEmbed,
  createSuccessEmbed,
  COLORS,
} = require("../utils/embeds");
const cron = require("node-cron");
const { scheduleChallenge } = require("../services/scheduler");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("create-challenge")
    .setDescription("Create a new one-time or recurring challenge.")
    .addStringOption((opt) =>
      opt
        .setName("title")
        .setDescription("The title of the challenge")
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("description")
        .setDescription("A detailed description of the challenge")
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("type")
        .setDescription(
          "A category for the challenge (e.g., 'Writing', 'Design')"
        )
        .setRequired(true)
    )
    .addChannelOption((opt) =>
      opt
        .setName("post_in")
        .setDescription("The channel where the challenge will be posted.")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("schedule")
        .setDescription(
          "Cron schedule to make this a recurring challenge (e.g., '0 10 * * 1')"
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const db = interaction.client.db;

    try {
      const title = interaction.options.getString("title", true);
      const description = interaction.options.getString("description", true);
      const type = interaction.options.getString("type", true);
      const postChannel = interaction.options.getChannel("post_in", true);
      const schedule = interaction.options.getString("schedule");

      if (schedule) {
        if (!cron.validate(schedule)) {
          return interaction.editReply({
            embeds: [
              createErrorEmbed(
                "Invalid Schedule",
                `The schedule \`${schedule}\` is not a valid cron string.`
              ),
            ],
          });
        }

        const newTemplateId = challengesService.createChallenge(db, {
          // (FIX) Changed all keys to camelCase to match the service function.
          guildId: interaction.guildId,
          title,
          description,
          type,
          createdBy: interaction.user.id,
          channelId: postChannel.id,
          isTemplate: 1,
          cronSchedule: schedule,
        });

        const newTemplate = challengesService.getChallengeById(
          db,
          newTemplateId
        );
        if (newTemplate) {
          scheduleChallenge(db, newTemplate, interaction.client);
        }

        return interaction.editReply({
          embeds: [
            createSuccessEmbed(
              "Recurring Challenge Scheduled",
              `You've successfully created the recurring challenge template **#${newTemplateId}**: "${title}".\nThe schedule \`${schedule}\` is now active.`
            ),
          ],
        });
      }

      // --- Logic Path 2: Create a ONE-TIME Challenge ---
      const newChallengeId = challengesService.createChallenge(db, {
        // (FIX) Changed all keys to camelCase to match the service function.
        guildId: interaction.guildId,
        title,
        description,
        type,
        createdBy: interaction.user.id,
        channelId: postChannel.id,
      });

      const challengeEmbed = new EmbedBuilder()
        .setColor(COLORS.primary)
        .setTitle(`🏁 New Challenge: ${title}`)
        .setDescription(description)
        .addFields(
          {
            name: "Challenge ID",
            value: `\`${newChallengeId}\``,
            inline: true,
          },
          { name: "Type", value: type, inline: true },
          {
            name: "How to participate",
            value: `Use the \`/submit challenge_id:${newChallengeId}\` command in this thread!`,
          }
        )
        .setFooter({
          text: "Community members can vote with 👍 to award points!",
        })
        .setTimestamp();

      const challengeMessage = await postChannel.send({
        embeds: [challengeEmbed],
      });

      const thread = await challengeMessage.startThread({
        name: `Submissions for Challenge #${newChallengeId}: ${title}`,
        autoArchiveDuration: 1440,
      });

      const updated = challengesService.attachMessageAndThread(db, {
        challengeId: newChallengeId,
        messageId: challengeMessage.id,
        threadId: thread.id,
      });

      if (!updated) {
        await thread.delete().catch(console.error);
        await challengeMessage.delete().catch(console.error);
        return interaction.editReply({
          embeds: [
            createErrorEmbed(
              "Database Error",
              "Failed to save the challenge thread ID. The challenge has been cancelled."
            ),
          ],
        });
      }

      await interaction.editReply({
        embeds: [
          createSuccessEmbed(
            "Challenge Created",
            `✅ Challenge **#${newChallengeId}** has been posted in ${postChannel} and its submission thread has been created.`
          ),
        ],
      });
    } catch (error) {
      console.error("Error creating challenge:", error);
      await interaction.editReply({
        embeds: [
          createErrorEmbed(
            "Error Creating Challenge",
            "An unexpected error occurred."
          ),
        ],
      });
    }
  },
};
