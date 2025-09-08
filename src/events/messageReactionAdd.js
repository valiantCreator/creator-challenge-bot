// src/events/messageReactionAdd.js
// Purpose: Event handler for when a user ADDS a reaction to a message.

const { Events } = require("discord.js");
const challengesService = require("../services/challenges");
const pointsService = require("../services/points");
const settingsService = require("../services/settings");

module.exports = {
  name: Events.MessageReactionAdd,
  async execute(reaction, user) {
    if (user.bot) return;

    // --- (FIX) Critical Null Check & Fetch Order ---
    // We must fetch partials first. Then, we can safely check the author.
    if (reaction.message.partial) await reaction.message.fetch();
    if (reaction.partial) await reaction.fetch();

    // The message author can be null in some edge cases. If so, ignore.
    if (
      !reaction.message.author ||
      reaction.message.author.id !== reaction.client.user.id
    ) {
      return;
    }

    // We only care about the thumbs-up emoji for points.
    if (reaction.emoji.name !== "👍") return;

    const db = reaction.client.db;

    try {
      const submission = challengesService.getSubmissionByMessageId(
        db,
        reaction.message.id
      );

      if (!submission) return;

      // --- Self-Vote Prevention ---
      if (user.id === submission.user_id) {
        await reaction.users.remove(user.id);
        try {
          await user.send(
            "You can't vote for your own submission! Your 👍 has been removed."
          );
        } catch (dmError) {
          console.warn(`Could not send self-vote DM to user ${user.id}.`);
        }
        return;
      }

      // --- Award Points for a Valid Vote ---
      const settings = settingsService.getGuildSettings(
        db,
        reaction.message.guildId
      );
      await pointsService.addPoints(
        db,
        reaction.message.guildId,
        submission.user_id,
        settings.points_per_vote,
        reaction.client
      );

      challengesService.incrementSubmissionVotes(db, submission.id);
      console.log(
        `[Vote] User ${user.username} voted for submission ${submission.id}.`
      );
    } catch (error) {
      console.error("Error processing reaction add:", error);
    }
  },
};
