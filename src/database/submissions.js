// src/database/submissions.js
// Contains all database logic for the 'submissions' table.

/**
 * Inserts a new submission record into the database.
 * @param {import('better-sqlite3').Database} db The database connection instance.
 * @param {object} submissionData The data for the new submission.
 * @returns {object} The newly created submission object from the database.
 */
function createSubmission(db, submissionData) {
  // Ensure all optional fields have a default value to prevent 'Missing named parameter' errors.
  const fullSubmissionData = {
    content_text: null,
    attachment_url: null,
    link_url: null,
    ...submissionData,
  };

  const stmt = db.prepare(`
    INSERT INTO submissions (
      challenge_id,
      guild_id,
      user_id,
      username,
      channel_id,
      message_id,
      content_text,
      attachment_url,
      link_url
    ) VALUES (
      @challenge_id,
      @guild_id,
      @user_id,
      @username,
      @channel_id,
      @message_id,
      @content_text,
      @attachment_url,
      @link_url
    )
  `);

  const info = stmt.run(fullSubmissionData);
  const submissionId = info.lastInsertRowid;

  return db.prepare("SELECT * FROM submissions WHERE id = ?").get(submissionId);
}

/**
 * Retrieves a single submission by its unique Discord message ID.
 * @param {import('better-sqlite3').Database} db The database connection instance.
 * @param {string} messageId The Discord message ID of the submission.
 * @returns {object | undefined} The submission object if found, otherwise undefined.
 */
function getSubmissionByMessageId(db, messageId) {
  const stmt = db.prepare("SELECT * FROM submissions WHERE message_id = ?");
  return stmt.get(messageId);
}

module.exports = {
  createSubmission,
  getSubmissionByMessageId,
};
