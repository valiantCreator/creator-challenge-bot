// src/services/settings.js
// Purpose: Contains all database logic for guild-specific settings.
// REFACTORED: All functions now accept a `db` instance for testability.

const defaultSettings = {
  points_per_submission: 1,
  points_per_vote: 1,
  // --- NEW: Add vote_emoji to default settings ---
  vote_emoji: "👍",
};

/**
 * Gets the settings for a specific guild.
 * @param {import('better-sqlite3').Database} db The database connection instance.
 * @param {string} guildId The ID of the guild to fetch settings for.
 * @returns {object} The guild's settings object.
 */
function getGuildSettings(db, guildId) {
  const stmt = db.prepare("SELECT * FROM guild_settings WHERE guild_id = ?");
  const settings = stmt.get(guildId);
  return { ...defaultSettings, ...settings };
}

/**
 * Updates the point settings for a specific guild.
 * @param {import('better-sqlite3').Database} db The database connection instance.
 * @param {string} guildId The ID of the guild.
 * @param {object} newSettings An object with the settings to update.
 * @returns {object} The result of the database operation.
 */
function updateGuildSettings(db, guildId, newSettings) {
  const currentSettings = getGuildSettings(db, guildId);
  const updated = { ...currentSettings, ...newSettings };

  // --- UPDATED: The upsert now includes the vote_emoji column ---
  // This ensures that when we update point values, we don't lose the custom emoji setting.
  const stmt = db.prepare(`
    INSERT INTO guild_settings (guild_id, points_per_submission, points_per_vote, vote_emoji)
    VALUES (@guild_id, @points_per_submission, @points_per_vote, @vote_emoji)
    ON CONFLICT(guild_id) DO UPDATE SET
      points_per_submission = excluded.points_per_submission,
      points_per_vote = excluded.points_per_vote
  `);

  return stmt.run({
    guild_id: guildId,
    points_per_submission: updated.points_per_submission,
    points_per_vote: updated.points_per_vote,
    vote_emoji: updated.vote_emoji, // Persist the existing emoji setting
  });
}

/**
 * --- NEW: Sets the custom vote emoji for a guild ---
 * @param {import('better-sqlite3').Database} db The database connection instance.
 * @param {string} guildId The ID of the guild.
 * @param {string} emoji The new emoji to use for votes.
 * @returns {object} The result of the database operation.
 */
function setVoteEmoji(db, guildId, emoji) {
  const stmt = db.prepare(`
    INSERT INTO guild_settings (guild_id, vote_emoji)
    VALUES (@guild_id, @vote_emoji)
    ON CONFLICT(guild_id) DO UPDATE SET
      vote_emoji = excluded.vote_emoji
  `);

  return stmt.run({
    guild_id: guildId,
    vote_emoji: emoji,
  });
}

module.exports = {
  getGuildSettings,
  updateGuildSettings,
  // --- NEW: Export the new function ---
  setVoteEmoji,
};
