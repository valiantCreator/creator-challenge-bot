// src/services/points.js
// Purpose: Encapsulates points logic, leaderboard queries, and badge awards.

/**
 * Gets a user's current point total.
 * @param {import('better-sqlite3').Database} db The database connection.
 * @param {string} guildId The guild ID.
 * @param {string} userId The user ID.
 * @returns {object} An object like { points: number } or { points: 0 } if no record exists.
 */
function getUserPoints(db, guildId, userId) {
  const stmt = db.prepare(
    "SELECT points FROM points WHERE guild_id = ? AND user_id = ?"
  );
  return stmt.get(guildId, userId) || { points: 0 };
}

/**
 * Checks a user's points against badge roles and awards them if necessary.
 * @param {import('better-sqlite3').Database} db The database connection.
 * @param {string} guildId
 * @param {string} userId
 * @param {number} newTotalPoints
 * @param {import('discord.js').Client} client The Discord client instance.
 */
async function checkAndAwardBadges(
  db,
  guildId,
  userId,
  newTotalPoints,
  client
) {
  // --- NEW: Guard clause for test environments ---
  // If no client is provided (e.g., in a unit test), exit immediately.
  if (!client) return;

  try {
    const guild = await client.guilds.fetch(guildId);
    const member = await guild.members.fetch(userId);
    if (!member) return;

    const badgeRoles = require("./challenges").getBadgeRoles(db, guildId);
    if (badgeRoles.length === 0) return;

    const memberRoleIds = new Set(member.roles.cache.map((r) => r.id));

    for (const badge of badgeRoles) {
      if (
        newTotalPoints >= badge.points_required &&
        !memberRoleIds.has(badge.role_id)
      ) {
        await member.roles.add(badge.role_id);
      }
    }
  } catch (error) {
    console.error(
      `[Badges] Failed to check or award badges for user ${userId} in guild ${guildId}:`,
      error
    );
  }
}

/**
 * Adds points, logs the transaction, and triggers a check for badge roles.
 * @param {import('better-sqlite3').Database} db The database connection.
 * @param {string} guildId
 * @param {string} userId
 * @param {number} amount
 * @param {string} reason The reason for the point change (e.g., 'SUBMISSION', 'ADMIN_ADD').
 * @param {import('discord.js').Client} client The Discord client instance.
 */
async function addPoints(db, guildId, userId, amount, reason, client) {
  // --- REFACTORED FOR V0.6 ---
  // This function now uses a transaction to ensure data integrity. Both the log
  // and the point total must be updated together, or not at all.
  const transaction = db.transaction((data) => {
    // Step 1: Insert a record into the point_logs ledger.
    const logStmt = db.prepare(
      `INSERT INTO point_logs (guild_id, user_id, points_awarded, reason) VALUES (?, ?, ?, ?)`
    );
    logStmt.run(data.guildId, data.userId, data.amount, data.reason);

    // Step 2: Update the user's total score in the points cache table.
    const upsertStmt = db.prepare(`
      INSERT INTO points (guild_id, user_id, points)
      VALUES (?, ?, ?)
      ON CONFLICT(guild_id, user_id) DO UPDATE SET points = points + excluded.points
    `);
    upsertStmt.run(data.guildId, data.userId, data.amount);
  });

  // Execute the transaction with the provided data.
  transaction({ guildId, userId, amount, reason });

  // After the transaction is successful, check for badges.
  const { points } = getUserPoints(db, guildId, userId);
  await checkAndAwardBadges(db, guildId, userId, points, client);
}

/**
 * Recalculates points using guild settings for accuracy.
 * @param {import('better-sqlite3').Database} db The database connection.
 * @param {string} userId
 * @param {string} guildId
 */
function recalculateUserPoints(db, userId, guildId) {
  const settings = require("./settings").getGuildSettings(db, guildId);
  const submissions = require("./challenges").getSubmissionsByUser(
    db,
    userId,
    guildId
  );

  const submissionPoints = submissions.length * settings.points_per_submission;
  const votePoints = submissions.reduce(
    (total, sub) => total + sub.votes * settings.points_per_vote,
    0
  );
  const newTotalPoints = submissionPoints + votePoints;

  const stmt = db.prepare(`
    INSERT INTO points (guild_id, user_id, points)
    VALUES (?, ?, ?)
    ON CONFLICT(guild_id, user_id) DO UPDATE SET points = excluded.points
  `);
  stmt.run(guildId, userId, newTotalPoints);
}

/**
 * Retrieves the leaderboard for a guild, with optional time-based filtering.
 * @param {import('better-sqlite3').Database} db The database connection.
 * @param {string} guildId The ID of the guild.
 * @param {number} [limit=10] The number of users to return.
 * @param {('all-time'|'monthly'|'weekly')} [period='all-time'] The time period for the leaderboard.
 * @returns {Array<object>} A list of user point objects.
 */
function getLeaderboard(db, guildId, limit = 10, period = "all-time") {
  // --- REFACTORED FOR V0.6 ---
  // Handles both all-time and time-filtered leaderboards.

  if (period === "all-time") {
    // For all-time, we use the fast, cached 'points' table.
    const stmt = db.prepare(`
      SELECT user_id, points FROM points WHERE guild_id = ? ORDER BY points DESC LIMIT ?
    `);
    return stmt.all(guildId, limit);
  }

  // For weekly or monthly, we calculate the start time and query the logs.
  let days;
  if (period === "weekly") {
    days = 7;
  } else if (period === "monthly") {
    days = 30;
  } else {
    // Fallback to all-time for any invalid period string.
    return getLeaderboard(db, guildId, limit, "all-time");
  }

  // Calculate the UNIX timestamp for the start of the period.
  const since = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;

  // This query sums all points from the logs within the time period for each user.
  const stmt = db.prepare(`
    SELECT
      user_id,
      SUM(points_awarded) as points
    FROM
      point_logs
    WHERE
      guild_id = ? AND created_at >= ?
    GROUP BY
      user_id
    HAVING
        points > 0
    ORDER BY
      points DESC
    LIMIT ?
  `);
  return stmt.all(guildId, since, limit);
}

/**
 * (NEW) Calculates a user's rank on the leaderboard.
 * @param {import('better-sqlite3').Database} db The database connection.
 * @param {string} guildId The ID of the guild.
 * @param {string} userId The ID of the user.
 * @returns {{rank: number, total: number} | null} The user's rank and total participants, or null if not ranked.
 */
function getUserRank(db, guildId, userId) {
  const rankedUsers = db
    .prepare(
      `SELECT user_id FROM points WHERE guild_id = ? ORDER BY points DESC`
    )
    .all(guildId);

  if (rankedUsers.length === 0) {
    return null;
  }

  const rank = rankedUsers.findIndex((user) => user.user_id === userId) + 1;

  if (rank === 0) {
    // findIndex returns -1 if not found, so rank would be 0
    return null;
  }

  return { rank, total: rankedUsers.length };
}

module.exports = {
  addPoints,
  recalculateUserPoints,
  getLeaderboard,
  getUserPoints,
  getUserRank, // Export the new function
};
