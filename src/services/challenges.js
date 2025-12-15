// src/services/challenges.js
// Purpose: Contains all database logic for challenges, submissions, and badges.
// Gemini: Updated getSubmissionsByUser to JOIN challenges for Profile titles.

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
    startsAt = null,
    endsAt = null,
  }
) {
  const sql = `
    INSERT INTO challenges (guild_id, title, description, type, created_by, channel_id, is_active, is_template, cron_schedule, starts_at, ends_at)
    VALUES ($1, $2, $3, $4, $5, $6, 1, $7, $8, $9, $10)
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
    startsAt,
    endsAt,
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
 * Lists ALL challenges (Active & Closed) for the Admin Archive.
 * @param {object} db The database wrapper.
 * @param {string} guildId The ID of the guild.
 * @returns {Promise<Array<object>>} A list of challenge objects.
 */
async function listAllChallenges(db, guildId) {
  const sql = `SELECT * FROM challenges WHERE guild_id = $1 AND is_template = 0 ORDER BY id DESC`;
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
 * Permanently deletes a challenge and all its related submissions/votes.
 * @param {object} db The database wrapper.
 * @param {number} challengeId The ID of the challenge to delete.
 */
async function deleteChallenge(db, challengeId) {
  // 1. Delete submission votes (Linked to submissions)
  await db.run(
    `DELETE FROM submission_votes WHERE submission_id IN (SELECT id FROM submissions WHERE challenge_id = $1)`,
    [challengeId]
  );

  // 2. Delete submissions
  await db.run(`DELETE FROM submissions WHERE challenge_id = $1`, [
    challengeId,
  ]);

  // 3. Delete the challenge
  const info = await db.run(`DELETE FROM challenges WHERE id = $1`, [
    challengeId,
  ]);
  return info.changes > 0;
}

// --- Submission Functions ---

async function recordSubmission(db, submissionData) {
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
 * Gemini: Updated with DEBUG LOGS to verify Title fetching.
 * @param {object} db The database wrapper.
 * @param {string} userId The user's ID.
 * @param {string} guildId The guild's ID.
 * @returns {Promise<Array<object>>} A list of submission objects with challenge_title.
 */
async function getSubmissionsByUser(db, userId, guildId) {
  // Gemini: Explicitly casting IDs to ensure integer matching
  const sql = `
    SELECT s.*, c.title as challenge_title 
    FROM submissions s
    LEFT JOIN challenges c ON s.challenge_id = c.id
    WHERE s.user_id = $1 AND s.guild_id = $2
    ORDER BY s.created_at DESC
  `;

  const results = await db.all(sql, [userId, guildId]);

  // --- DEBUG LOG ---
  if (results.length > 0) {
    console.log("[DEBUG] getSubmissionsByUser sample:", {
      id: results[0].id,
      challenge_id: results[0].challenge_id,
      challenge_title: results[0].challenge_title, // This should NOT be undefined
    });
  } else {
    console.log("[DEBUG] getSubmissionsByUser found 0 records.");
  }
  // -----------------

  return results;
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
 * Increments the vote count for a submission (Legacy/Discord method).
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

  // Dynamically build the query with $1, $2, etc.
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

// --- Voting Functions ---

/**
 * Checks if a user has already voted for a submission.
 * @param {object} db The database wrapper.
 * @param {number} submissionId The ID of the submission.
 * @param {string} userId The ID of the user.
 * @returns {Promise<boolean>} True if the user has voted.
 */
async function checkUserVote(db, submissionId, userId) {
  const sql =
    "SELECT 1 FROM submission_votes WHERE submission_id = $1 AND user_id = $2";
  const res = await db.get(sql, [submissionId, userId]);
  return !!res;
}

/**
 * Adds a vote from a specific user.
 * Updates both the submission count and the vote tracking table.
 * @param {object} db The database wrapper.
 * @param {object} params { submissionId, userId, guildId }
 */
async function addVote(db, { submissionId, userId, guildId }) {
  // 1. Insert tracking record (This will fail if they already voted due to Primary Key)
  const sqlTrack =
    "INSERT INTO submission_votes (submission_id, user_id, guild_id) VALUES ($1, $2, $3)";
  await db.run(sqlTrack, [submissionId, userId, guildId]);

  // 2. Increment the total count
  await incrementSubmissionVotes(db, submissionId, 1);
}

/**
 * Removes a vote from a specific user.
 * @param {object} db The database wrapper.
 * @param {object} params { submissionId, userId }
 */
async function removeVote(db, { submissionId, userId }) {
  // 1. Delete tracking record
  const sqlTrack =
    "DELETE FROM submission_votes WHERE submission_id = $1 AND user_id = $2";
  const info = await db.run(sqlTrack, [submissionId, userId]);

  // 2. Decrement only if a row was actually deleted (user had voted)
  if (info.changes > 0) {
    await incrementSubmissionVotes(db, submissionId, -1);
    return true;
  }
  return false;
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
  listAllChallenges, // Exported new function
  getAllRecurringChallenges,
  getChallengeById,
  closeChallenge,
  deleteChallenge, // Exported new function
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
  checkUserVote,
  addVote,
  removeVote,
};
