// src/services/challenges.js
// Purpose: Contains all database logic for challenges, submissions, and badges.
// Gemini: Refactored for PostgreSQL (Async/Await, $1 placeholders, RETURNING id).

// --- Challenge Functions ---

/**
 * Creates a new challenge record in the database.
 * @param {object} db The database wrapper.
 * @param {object} challengeData The data for the new challenge.
 * @returns {Promise<number>} The ID of the newly created challenge.
 */
async function createChallenge(
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
  // Gemini: Added RETURNING id to get the new row ID immediately
  const sql = `
    INSERT INTO challenges (guild_id, title, description, type, created_by, channel_id, is_active, is_template, cron_schedule)
    VALUES ($1, $2, $3, $4, $5, $6, 1, $7, $8)
    RETURNING id
  `;

  const info = await db.run(sql, [
    guildId,
    title,
    description || "",
    type,
    createdBy,
    channelId || null,
    isTemplate,
    cronSchedule,
  ]);

  return info.lastInsertRowid;
}

/**
 * Updates a challenge record with its message and thread ID.
 * @param {object} db The database wrapper.
 * @param {object} data The IDs to attach.
 * @returns {Promise<boolean>} True if the update was successful, false otherwise.
 */
async function attachMessageAndThread(
  db,
  { challengeId, messageId, threadId }
) {
  const sql =
    "UPDATE challenges SET message_id = $1, thread_id = $2 WHERE id = $3";
  const info = await db.run(sql, [messageId, threadId, challengeId]);
  return info.changes > 0;
}

/**
 * Lists all active, non-template challenges for a guild.
 * @param {object} db The database wrapper.
 * @param {string} guildId The ID of the guild.
 * @returns {Promise<Array<object>>} A list of challenge objects.
 */
async function listActiveChallenges(db, guildId) {
  const sql = `SELECT * FROM challenges WHERE guild_id = $1 AND is_active = 1 AND is_template = 0 ORDER BY id DESC`;
  return await db.all(sql, [guildId]);
}

/**
 * Retrieves all active recurring challenge templates.
 * @param {object} db The database wrapper.
 * @returns {Promise<Array<object>>} A list of challenge template objects.
 */
async function getAllRecurringChallenges(db) {
  const sql = `SELECT * FROM challenges WHERE is_template = 1 AND is_active = 1`;
  return await db.all(sql);
}

/**
 * Gets a single challenge by its ID.
 * @param {object} db The database wrapper.
 * @param {number} challengeId The ID of the challenge.
 * @returns {Promise<object>} The challenge object.
 */
async function getChallengeById(db, challengeId) {
  const sql = "SELECT * FROM challenges WHERE id = $1";
  return await db.get(sql, [challengeId]);
}

/**
 * Marks a challenge as inactive.
 * @param {object} db The database wrapper.
 * @param {number} challengeId The ID of the challenge to close.
 * @returns {Promise<boolean>} True if the update was successful.
 */
async function closeChallenge(db, challengeId) {
  const sql = "UPDATE challenges SET is_active = 0 WHERE id = $1";
  const info = await db.run(sql, [challengeId]);
  return info.changes > 0;
}

// --- Submission Functions ---

/**
 * Records a new submission in the database.
 * @param {object} db The database wrapper.
 * @param {object} submissionData The data for the submission.
 * @returns {Promise<number>} The ID of the new submission.
 */
async function recordSubmission(db, submissionData) {
  // Gemini: Converted named params (@name) to positional params ($1)
  const sql = `
    INSERT INTO submissions (challenge_id, guild_id, user_id, username, channel_id, message_id, thread_id, content_text, attachment_url, link_url)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING id
  `;

  const params = [
    submissionData.challenge_id,
    submissionData.guild_id,
    submissionData.user_id,
    submissionData.username,
    submissionData.channel_id,
    submissionData.message_id,
    submissionData.thread_id,
    submissionData.content_text,
    submissionData.attachment_url,
    submissionData.link_url,
  ];

  const info = await db.run(sql, params);
  return info.lastInsertRowid;
}

/**
 * Gets a single submission by its ID.
 * @param {object} db The database wrapper.
 * @param {number} submissionId The ID of the submission.
 * @returns {Promise<object>} The submission object.
 */
async function getSubmissionById(db, submissionId) {
  const sql = "SELECT * FROM submissions WHERE id = $1";
  return await db.get(sql, [submissionId]);
}

/**
 * Deletes a submission from the database.
 * @param {object} db The database wrapper.
 * @param {number} submissionId The ID of the submission to delete.
 * @returns {Promise<boolean>} True if the deletion was successful.
 */
async function deleteSubmission(db, submissionId) {
  const sql = "DELETE FROM submissions WHERE id = $1";
  const info = await db.run(sql, [submissionId]);
  return info.changes > 0;
}

/**
 * Gets all submissions by a specific user in a guild.
 * @param {object} db The database wrapper.
 * @param {string} userId The user's ID.
 * @param {string} guildId The guild's ID.
 * @returns {Promise<Array<object>>} A list of submission objects.
 */
async function getSubmissionsByUser(db, userId, guildId) {
  const sql = "SELECT * FROM submissions WHERE user_id = $1 AND guild_id = $2";
  return await db.all(sql, [userId, guildId]);
}

/**
 * Retrieves a list of submissions made by a specific user for the profile command.
 * @param {object} db The database wrapper.
 * @param {string} guildId The ID of the guild.
 * @param {string} userId The ID of the user.
 * @param {number} limit The maximum number of submissions to return.
 * @returns {Promise<Array<object>>} A list of the user's recent submissions.
 */
async function getSubmissionsByUserId(db, guildId, userId, limit = 5) {
  const sql = `
    SELECT id, challenge_id, message_id, channel_id, content_text 
    FROM submissions 
    WHERE guild_id = $1 AND user_id = $2 
    ORDER BY created_at DESC 
    LIMIT $3
  `;
  return await db.all(sql, [guildId, userId, limit]);
}

/**
 * Retrieves all submissions for a specific challenge.
 * @param {object} db The database wrapper.
 * @param {number} challengeId The ID of the challenge.
 * @returns {Promise<Array<object>>} A list of submission objects.
 */
async function getSubmissionsByChallengeId(db, challengeId) {
  const sql =
    "SELECT * FROM submissions WHERE challenge_id = $1 ORDER BY votes DESC, created_at ASC";
  return await db.all(sql, [challengeId]);
}

/**
 * Gets a single submission by its unique message ID.
 * @param {object} db The database wrapper.
 * @param {string} messageId The message's ID.
 * @returns {Promise<object>} The submission object.
 */
async function getSubmissionByMessageId(db, messageId) {
  const sql = "SELECT * FROM submissions WHERE message_id = $1";
  return await db.get(sql, [messageId]);
}

/**
 * Increments the vote count for a submission.
 * @param {object} db The database wrapper.
 * @param {number} submissionId The ID of the submission.
 * @param {number} delta The amount to change the vote count by (usually 1 or -1).
 */
async function incrementSubmissionVotes(db, submissionId, delta = 1) {
  const sql = "UPDATE submissions SET votes = votes + $1 WHERE id = $2";
  await db.run(sql, [delta, submissionId]);
}

/**
 * Updates the content of an existing submission.
 * @param {object} db The database wrapper.
 * @param {number} submissionId The ID of the submission to update.
 * @param {object} newData An object with the new data ({ contentText, linkUrl, attachmentUrl }).
 * @returns {Promise<object>} The updated submission object.
 */
async function updateSubmission(db, submissionId, newData) {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  // Gemini: Dynamically build the query with $1, $2, etc.
  if (newData.contentText !== undefined) {
    fields.push(`content_text = $${paramIndex++}`);
    values.push(newData.contentText);
  }
  if (newData.linkUrl !== undefined) {
    fields.push(`link_url = $${paramIndex++}`);
    values.push(newData.linkUrl);
  }
  if (newData.attachmentUrl !== undefined) {
    fields.push(`attachment_url = $${paramIndex++}`);
    values.push(newData.attachmentUrl);
  }

  if (fields.length === 0) {
    return await getSubmissionById(db, submissionId);
  }

  // Add the ID as the final parameter
  values.push(submissionId);

  const sql = `
    UPDATE submissions
    SET ${fields.join(", ")}
    WHERE id = $${paramIndex}
  `;

  await db.run(sql, values);
  return await getSubmissionById(db, submissionId);
}

// --- Badge Role Functions ---

async function addBadgeRole(db, { guildId, roleId, pointsRequired }) {
  const sql =
    "INSERT INTO badge_roles (guild_id, role_id, points_required) VALUES ($1, $2, $3) RETURNING id";
  const info = await db.run(sql, [guildId, roleId, pointsRequired]);
  return info.lastInsertRowid;
}

async function getBadgeRoles(db, guildId) {
  const sql =
    "SELECT * FROM badge_roles WHERE guild_id = $1 ORDER BY points_required ASC";
  return await db.all(sql, [guildId]);
}

async function removeBadgeRole(db, badgeId) {
  const sql = "DELETE FROM badge_roles WHERE id = $1";
  const info = await db.run(sql, [badgeId]);
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
  getSubmissionsByUserId,
  getSubmissionsByChallengeId,
};
