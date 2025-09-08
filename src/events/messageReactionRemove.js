// src/events/messageReactionRemove.js
// Purpose: Event handler for when a user REMOVES a reaction from a message.

const { Events } = require("discord.js");
const challengesService = require("../services/challenges");
const pointsService = require("../services/points");
const settingsService = require("../services/settings");

module.exports = {
  name: Events.MessageReactionRemove,
  async execute(reaction, user) {
    if (user.bot) return;

    // --- (FIX) Critical Null Check & Fetch Order ---
    if (reaction.message.partial) await reaction.message.fetch();
    if (reaction.partial) await reaction.fetch();

    if (
      !reaction.message.author ||
      reaction.message.author.id !== reaction.client.user.id
    ) {
      return;
    }

    if (reaction.emoji.name !== "👍") return;

    const db = reaction.client.db;

    try {
      const submission = challengesService.getSubmissionByMessageId(
        db,
        reaction.message.id
      );

      if (!submission) return;
      if (user.id === submission.user_id) return;

      const settings = settingsService.getGuildSettings(
        db,
        reaction.message.guildId
      );
      await pointsService.addPoints(
        db,
        reaction.message.guildId,
        submission.user_id,
        -settings.points_per_vote,
        reaction.client
      );

      challengesService.incrementSubmissionVotes(db, submission.id, -1);
      console.log(
        `[Vote Removed] User ${user.username} removed vote from submission ${submission.id}.`
      );
    } catch (error) {
      console.error("Error processing reaction removal:", error);
    }
  },
};
