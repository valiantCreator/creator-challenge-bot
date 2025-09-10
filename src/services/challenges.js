// src/services/challenges.js
// Purpose: Contains all database logic for challenges, submissions, and badges.

// --- Challenge Functions ---

/**
 * Creates a new challenge record in the database.
 * @param {import('better-sqlite3').Database} db The database connection.
 * @param {object} challengeData The data for the new challenge.
 * @returns {number} The ID of the newly created challenge.
 */
function createChallenge(
  db,
  {
    guildId,
    title,
    description,
    type,
    createdBy,
    channelId,
    isTemplate = 0,
    cronSchedule = null,
  }
) {
  const stmt = db.prepare(`
    INSERT INTO challenges (guild_id, title, description, type, created_by, channel_id, is_active, is_template, cron_schedule)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
  `);
  const info = stmt.run(
    guildId,
    title,
    description || "",
    type,
    createdBy,
    channelId || null,
    isTemplate,
    cronSchedule
  );
  return info.lastInsertRowid;
}

/**
 * Updates a challenge record with its message and thread ID.
 * @param {import('better-sqlite3').Database} db The database connection.
 * @param {object} data The IDs to attach.
 * @returns {boolean} True if the update was successful, false otherwise.
 */
function attachMessageAndThread(db, { challengeId, messageId, threadId }) {
  const stmt = db.prepare(
    "UPDATE challenges SET message_id = ?, thread_id = ? WHERE id = ?"
  );
  const info = stmt.run(messageId, threadId, challengeId);
  return info.changes > 0;
}

/**
 * Lists all active, non-template challenges for a guild.
 * @param {import('better-sqlite3').Database} db The database connection.
 * @param {string} guildId The ID of the guild.
 * @returns {Array<object>} A list of challenge objects.
 */
function listActiveChallenges(db, guildId) {
  const stmt = db.prepare(
    `SELECT * FROM challenges WHERE guild_id = ? AND is_active = 1 AND is_template = 0 ORDER BY id DESC`
  );
  return stmt.all(guildId);
}

/**
 * Retrieves all active recurring challenge templates.
 * @param {import('better-sqlite3').Database} db The database connection.
 * @returns {Array<object>} A list of challenge template objects.
 */
function getAllRecurringChallenges(db) {
  const stmt = db.prepare(
    `SELECT * FROM challenges WHERE is_template = 1 AND is_active = 1`
  );
  return stmt.all();
}

/**
 * Gets a single challenge by its ID.
 * @param {import('better-sqlite3').Database} db The database connection.
 * @param {number} challengeId The ID of the challenge.
 * @returns {object} The challenge object.
 */
function getChallengeById(db, challengeId) {
  const stmt = db.prepare("SELECT * FROM challenges WHERE id = ?");
  return stmt.get(challengeId);
}

/**
 * Marks a challenge as inactive.
 * @param {import('better-sqlite3').Database} db The database connection.
 * @param {number} challengeId The ID of the challenge to close.
 * @returns {boolean} True if the update was successful.
 */
function closeChallenge(db, challengeId) {
  const stmt = db.prepare("UPDATE challenges SET is_active = 0 WHERE id = ?");
  const info = stmt.run(challengeId);
  return info.changes > 0;
}

// --- Submission Functions ---

/**
 * Records a new submission in the database.
 * @param {import('better-sqlite3').Database} db The database connection.
 * @param {object} submissionData The data for the submission.
 * @returns {number} The ID of the new submission.
 */
function recordSubmission(db, submissionData) {
  const stmt = db.prepare(`
    INSERT INTO submissions (challenge_id, guild_id, user_id, username, channel_id, message_id, thread_id, content_text, attachment_url, link_url)
    VALUES (@challenge_id, @guild_id, @user_id, @username, @channel_id, @message_id, @thread_id, @content_text, @attachment_url, @link_url)
  `);
  const info = stmt.run(submissionData);
  return info.lastInsertRowid;
}

/**
 * Gets a single submission by its ID.
 * @param {import('better-sqlite3').Database} db The database connection.
 * @param {number} submissionId The ID of the submission.
 * @returns {object} The submission object.
 */
function getSubmissionById(db, submissionId) {
  const stmt = db.prepare("SELECT * FROM submissions WHERE id = ?");
  return stmt.get(submissionId);
}

/**
 * Deletes a submission from the database.
 * @param {import('better-sqlite3').Database} db The database connection.
 * @param {number} submissionId The ID of the submission to delete.
 * @returns {boolean} True if the deletion was successful.
 */
function deleteSubmission(db, submissionId) {
  const stmt = db.prepare("DELETE FROM submissions WHERE id = ?");
  const info = stmt.run(submissionId);
  return info.changes > 0;
}

/**
 * Gets all submissions by a specific user in a guild.
 * @param {import('better-sqlite3').Database} db The database connection.
 * @param {string} userId The user's ID.
 * @param {string} guildId The guild's ID.
 * @returns {Array<object>} A list of submission objects.
 */
function getSubmissionsByUser(db, userId, guildId) {
  const stmt = db.prepare(
    "SELECT * FROM submissions WHERE user_id = ? AND guild_id = ?"
  );
  return stmt.all(userId, guildId);
}

/**
 * (NEW) Retrieves a list of submissions made by a specific user for the profile command.
 * @param {import('better-sqlite3').Database} db The database connection.
 * @param {string} guildId The ID of the guild.
 * @param {string} userId The ID of the user.
 * @param {number} limit The maximum number of submissions to return.
 * @returns {Array<object>} A list of the user's recent submissions.
 */
function getSubmissionsByUserId(db, guildId, userId, limit = 5) {
  const stmt = db.prepare(
    `SELECT id, challenge_id, message_id, channel_id, content_text FROM submissions 
          WHERE guild_id = ? AND user_id = ? 
          ORDER BY created_at DESC 
          LIMIT ?`
  );
  return stmt.all(guildId, userId, limit);
}

/**
 * Gets a single submission by its unique message ID.
 * @param {import('better-sqlite3').Database} db The database connection.
 * @param {string} messageId The message's ID.
 * @returns {object} The submission object.
 */
function getSubmissionByMessageId(db, messageId) {
  const stmt = db.prepare("SELECT * FROM submissions WHERE message_id = ?");
  return stmt.get(messageId);
}

/**
 * Increments the vote count for a submission.
 * @param {import('better-sqlite3').Database} db The database connection.
 * @param {number} submissionId The ID of the submission.
 * @param {number} delta The amount to change the vote count by (usually 1 or -1).
 */
function incrementSubmissionVotes(db, submissionId, delta = 1) {
  const stmt = db.prepare(
    "UPDATE submissions SET votes = votes + ? WHERE id = ?"
  );
  stmt.run(delta, submissionId);
}

/**
 * Updates the content of an existing submission.
 * @param {import('better-sqlite3').Database} db The database connection.
 * @param {number} submissionId The ID of the submission to update.
 * @param {object} newData An object with the new data ({ contentText, linkUrl, attachmentUrl }).
 * @returns {object} The updated submission object.
 */
function updateSubmission(db, submissionId, newData) {
  const fields = [];
  const values = [];

  if (newData.contentText !== undefined) {
    fields.push("content_text = ?");
    values.push(newData.contentText);
  }
  if (newData.linkUrl !== undefined) {
    fields.push("link_url = ?");
    values.push(newData.linkUrl);
  }
  if (newData.attachmentUrl !== undefined) {
    fields.push("attachment_url = ?");
    values.push(newData.attachmentUrl);
  }

  if (fields.length === 0) {
    return getSubmissionById(db, submissionId);
  }

  const stmt = db.prepare(`
        UPDATE submissions
        SET ${fields.join(", ")}
        WHERE id = ?
    `);

  stmt.run(...values, submissionId);
  return getSubmissionById(db, submissionId);
}

// --- Badge Role Functions ---

function addBadgeRole(db, { guildId, roleId, pointsRequired }) {
  const stmt = db.prepare(
    "INSERT INTO badge_roles (guild_id, role_id, points_required) VALUES (?, ?, ?)"
  );
  const info = stmt.run(guildId, roleId, pointsRequired);
  return info.lastInsertRowid;
}

function getBadgeRoles(db, guildId) {
  const stmt = db.prepare(
    "SELECT * FROM badge_roles WHERE guild_id = ? ORDER BY points_required ASC"
  );
  return stmt.all(guildId);
}

function removeBadgeRole(db, badgeId) {
  const stmt = db.prepare("DELETE FROM badge_roles WHERE id = ?");
  const info = stmt.run(badgeId);
  return info.changes > 0;
}

module.exports = {
  createChallenge,
  attachMessageAndThread,
  listActiveChallenges,
  getAllRecurringChallenges,
  getChallengeById,
  closeChallenge,
  recordSubmission,
  getSubmissionById,
  deleteSubmission,
  getSubmissionsByUser,
  getSubmissionByMessageId,
  incrementSubmissionVotes,
  updateSubmission,
  addBadgeRole,
  getBadgeRoles,
  removeBadgeRole,
  getSubmissionsByUserId, // Added new function
};
