// src/services/points.js
// Purpose: Encapsulates points logic, leaderboard queries, and badge awards.
// Gemini: Refactored for PostgreSQL (Async/Await, Date handling).

/**
 * Gets a user's current point total.
 * @param {object} db The database wrapper.
 * @param {string} guildId The guild ID.
 * @param {string} userId The user ID.
 * @returns {Promise<object>} An object like { points: number } or { points: 0 }.
 */
async function getUserPoints(db, guildId, userId) {
  const sql = "SELECT points FROM points WHERE guild_id = $1 AND user_id = $2";
  const result = await db.get(sql, [guildId, userId]);
  return result || { points: 0 };
}

/**
 * Checks a user's points against badge roles and awards them if necessary.
 * @param {object} db The database wrapper.
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
  if (!client) return;

  try {
    const guild = await client.guilds.fetch(guildId);
    const member = await guild.members.fetch(userId);
    if (!member) return;

    // Gemini: Must await this now as it's an async DB call
    const badgeRoles = await require("./challenges").getBadgeRoles(db, guildId);
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
 * @param {object} db The database wrapper.
 * @param {string} guildId
 * @param {string} userId
 * @param {number} amount
 * @param {string} reason The reason for the point change.
 * @param {import('discord.js').Client} client The Discord client instance.
 */
async function addPoints(db, guildId, userId, amount, reason, client) {
  // 1. Insert into Ledger
  const logSql = `
    INSERT INTO point_logs (guild_id, user_id, points_awarded, reason) 
    VALUES ($1, $2, $3, $4)
  `;
  await db.run(logSql, [guildId, userId, amount, reason]);

  // 2. Upsert into Cache
  // Gemini: Postgres specific ON CONFLICT syntax
  const upsertSql = `
    INSERT INTO points (guild_id, user_id, points)
    VALUES ($1, $2, $3)
    ON CONFLICT(guild_id, user_id) 
    DO UPDATE SET points = points.points + EXCLUDED.points
  `;
  await db.run(upsertSql, [guildId, userId, amount]);

  // 3. Check Badges
  const userRecord = await getUserPoints(db, guildId, userId);
  await checkAndAwardBadges(db, guildId, userId, userRecord.points, client);
}

/**
 * Recalculates points using guild settings for accuracy.
 * @param {object} db The database wrapper.
 * @param {string} userId
 * @param {string} guildId
 */
async function recalculateUserPoints(db, userId, guildId) {
  // Gemini: Await these service calls
  const settings = await require("./settings").getGuildSettings(db, guildId);
  const submissions = await require("./challenges").getSubmissionsByUser(
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

  const sql = `
    INSERT INTO points (guild_id, user_id, points)
    VALUES ($1, $2, $3)
    ON CONFLICT(guild_id, user_id) 
    DO UPDATE SET points = EXCLUDED.points
  `;
  await db.run(sql, [guildId, userId, newTotalPoints]);
}

/**
 * Retrieves the leaderboard for a guild, with optional time-based filtering.
 * @param {object} db The database wrapper.
 * @param {string} guildId The ID of the guild.
 * @param {number} [limit=10] The number of users to return.
 * @param {('all-time'|'monthly'|'weekly')} [period='all-time'] The time period.
 * @returns {Promise<Array<object>>} A list of user point objects.
 */
async function getLeaderboard(db, guildId, limit = 10, period = "all-time") {
  if (period === "all-time") {
    const sql = `SELECT user_id, points FROM points WHERE guild_id = $1 ORDER BY points DESC LIMIT $2`;
    return await db.all(sql, [guildId, limit]);
  }

  // Calculate Date for Postgres
  let days;
  if (period === "weekly") {
    days = 7;
  } else if (period === "monthly") {
    days = 30;
  } else {
    return getLeaderboard(db, guildId, limit, "all-time");
  }

  // Gemini: Create a Javascript Date object for the comparison
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - days);

  const sql = `
    SELECT
      user_id,
      SUM(points_awarded) as points
    FROM
      point_logs
    WHERE
      guild_id = $1 AND created_at >= $2
    GROUP BY
      user_id
    HAVING
      SUM(points_awarded) > 0
    ORDER BY
      points DESC
    LIMIT $3
  `;

  // Note: 'points' alias in ORDER BY works in Postgres, but standard SQL usually requires the aggregate in ORDER BY.
  // Postgres allows alias usage in ORDER BY.
  return await db.all(sql, [guildId, sinceDate, limit]);
}

/**
 * Calculates a user's rank on the leaderboard.
 * @param {object} db The database wrapper.
 * @param {string} guildId The ID of the guild.
 * @param {string} userId The ID of the user.
 * @returns {Promise<{rank: number, total: number} | null>} The rank/total or null.
 */
async function getUserRank(db, guildId, userId) {
  const sql = `SELECT user_id FROM points WHERE guild_id = $1 ORDER BY points DESC`;
  const rankedUsers = await db.all(sql, [guildId]);

  if (rankedUsers.length === 0) {
    return null;
  }

  const rank = rankedUsers.findIndex((user) => user.user_id === userId) + 1;

  if (rank === 0) {
    return null;
  }

  return { rank, total: rankedUsers.length };
}

module.exports = {
  addPoints,
  recalculateUserPoints,
  getLeaderboard,
  getUserPoints,
  getUserRank,
};
