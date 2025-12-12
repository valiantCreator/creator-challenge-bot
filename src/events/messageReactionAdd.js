// src/events/messageReactionAdd.js
// Purpose: Event handler for when a user ADDS a reaction to a message.
// Gemini: Updated to link vote points to the challenge_id.

const { Events } = require("discord.js");
const challengesService = require("../services/challenges");
const pointsService = require("../services/points");
const settingsService = require("../services/settings");

module.exports = {
  name: Events.MessageReactionAdd,
  async execute(reaction, user) {
    if (user.bot) return;

    if (reaction.message.partial) await reaction.message.fetch();
    if (reaction.partial) await reaction.fetch();

    if (
      !reaction.message.author ||
      reaction.message.author.id !== reaction.client.user.id
    ) {
      return;
    }

    const db = reaction.client.db;
    try {
      const settings = await settingsService.getGuildSettings(
        db,
        reaction.message.guildId
      );

      // Check against dynamic vote_emoji
      if (reaction.emoji.name !== settings.vote_emoji) return;

      const submission = await challengesService.getSubmissionByMessageId(
        db,
        reaction.message.id
      );

      if (!submission) return;

      if (user.id === submission.user_id) {
        await reaction.users.remove(user.id);
        try {
          // --- UPDATED: Use dynamic emoji in the DM ---
          await user.send(
            `You can't vote for your own submission! Your ${settings.vote_emoji} has been removed.`
          );
        } catch (dmError) {
          console.warn(`Could not send self-vote DM to user ${user.id}.`);
        }
        return;
      }

      await pointsService.addPoints(
        db,
        reaction.message.guildId,
        submission.user_id,
        settings.points_per_vote,
        "VOTE_RECEIVED",
        reaction.client,
        submission.challenge_id // Gemini: Added tracking!
      );

      await challengesService.incrementSubmissionVotes(db, submission.id);
      console.log(
        `[Vote] User ${user.username} voted for submission ${submission.id}.`
      );
    } catch (error) {
      console.error("Error processing reaction add:", error);
    }
  },
};
