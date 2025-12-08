// src/services/settings.js
// Purpose: Contains all database logic for guild-specific settings.
// Gemini: Refactored for PostgreSQL (Async/Await, $ placeholders).

const defaultSettings = {
  points_per_submission: 1,
  points_per_vote: 1,
  // --- NEW: Add vote_emoji to default settings ---
  vote_emoji: "👍",
};

/**
 * Gets the settings for a specific guild.
 * @param {object} db The database wrapper.
 * @param {string} guildId The ID of the guild to fetch settings for.
 * @returns {Promise<object>} The guild's settings object.
 */
async function getGuildSettings(db, guildId) {
  const sql = "SELECT * FROM guild_settings WHERE guild_id = $1";
  const settings = await db.get(sql, [guildId]);
  return { ...defaultSettings, ...settings };
}

/**
 * Updates the point settings for a specific guild.
 * @param {object} db The database wrapper.
 * @param {string} guildId The ID of the guild.
 * @param {object} newSettings An object with the settings to update.
 * @returns {Promise<object>} The result of the database operation.
 */
async function updateGuildSettings(db, guildId, newSettings) {
  const currentSettings = await getGuildSettings(db, guildId);
  const updated = { ...currentSettings, ...newSettings };

  // --- UPDATED: The upsert now includes the vote_emoji column ---
  const sql = `
    INSERT INTO guild_settings (guild_id, points_per_submission, points_per_vote, vote_emoji)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT(guild_id) DO UPDATE SET
      points_per_submission = EXCLUDED.points_per_submission,
      points_per_vote = EXCLUDED.points_per_vote
  `;

  return await db.run(sql, [
    guildId,
    updated.points_per_submission,
    updated.points_per_vote,
    updated.vote_emoji, // Persist the existing emoji setting
  ]);
}

/**
 * --- NEW: Sets the custom vote emoji for a guild ---
 * @param {object} db The database wrapper.
 * @param {string} guildId The ID of the guild.
 * @param {string} emoji The new emoji to use for votes.
 * @returns {Promise<object>} The result of the database operation.
 */
async function setVoteEmoji(db, guildId, emoji) {
  const sql = `
    INSERT INTO guild_settings (guild_id, vote_emoji)
    VALUES ($1, $2)
    ON CONFLICT(guild_id) DO UPDATE SET
      vote_emoji = EXCLUDED.vote_emoji
  `;

  return await db.run(sql, [guildId, emoji]);
}

module.exports = {
  getGuildSettings,
  updateGuildSettings,
  // --- NEW: Export the new function ---
  setVoteEmoji,
};
