// src/services/settings.js
// Purpose: Contains all database logic for guild-specific settings.
// REFACTORED: All functions now accept a `db` instance for testability.

const defaultSettings = {
  points_per_submission: 1,
  points_per_vote: 1,
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
 * Updates the settings for a specific guild.
 * @param {import('better-sqlite3').Database} db The database connection instance.
 * @param {string} guildId The ID of the guild.
 * @param {object} newSettings An object with the settings to update.
 * @returns {object} The result of the database operation.
 */
function updateGuildSettings(db, guildId, newSettings) {
  const currentSettings = getGuildSettings(db, guildId);
  const updated = { ...currentSettings, ...newSettings };

  const stmt = db.prepare(`
    INSERT INTO guild_settings (guild_id, points_per_submission, points_per_vote)
    VALUES (@guild_id, @points_per_submission, @points_per_vote)
    ON CONFLICT(guild_id) DO UPDATE SET
      points_per_submission = excluded.points_per_submission,
      points_per_vote = excluded.points_per_vote
  `);

  return stmt.run({
    guild_id: guildId,
    points_per_submission: updated.points_per_submission,
    points_per_vote: updated.points_per_vote,
  });
}

module.exports = {
  getGuildSettings,
  updateGuildSettings,
};
