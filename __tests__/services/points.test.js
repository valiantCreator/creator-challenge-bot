// __tests__/services/points.test.js
// REWRITTEN: Converted to the standard testing pattern using test-db helper.

const { setupTestDb, cleanupTestDb } = require("../helpers/test-db.js");
const pointsService = require("../../src/services/points");

describe("Points Service", () => {
  let db;

  beforeEach(() => {
    db = setupTestDb();
  });

  afterEach(() => {
    cleanupTestDb(db);
  });

  describe("addPoints", () => {
    // Tests for async functions must also be async.
    test("should add points for a new user correctly", async () => {
      const guildId = "test-guild-1";
      const userId = "test-user-1";
      const amount = 100;
      // --- UPDATED: Provided a valid reason to satisfy the NOT NULL constraint ---
      await pointsService.addPoints(
        db,
        guildId,
        userId,
        amount,
        "ADMIN_ADD",
        null
      );
      const result = pointsService.getUserPoints(db, guildId, userId);

      expect(result).toBeDefined();
      expect(result.points).toBe(100);
    });

    test("should correctly add more points to an existing user", async () => {
      const guildId = "test-guild-1";
      const userId = "test-user-1";
      // --- UPDATED: Provided a valid reason ---
      await pointsService.addPoints(
        db,
        guildId,
        userId,
        100,
        "ADMIN_ADD",
        null
      );

      const amountToAdd = 50;
      // --- UPDATED: Provided a valid reason ---
      await pointsService.addPoints(
        db,
        guildId,
        userId,
        amountToAdd,
        "ADMIN_ADD",
        null
      );
      const result = pointsService.getUserPoints(db, guildId, userId);

      expect(result.points).toBe(150);
    });

    test("should correctly subtract points from a user", async () => {
      const guildId = "test-guild-1";
      const userId = "test-user-1";
      // --- UPDATED: Provided a valid reason ---
      await pointsService.addPoints(
        db,
        guildId,
        userId,
        100,
        "ADMIN_ADD",
        null
      );

      const amountToSubtract = -25;
      // --- UPDATED: Provided a valid reason ---
      await pointsService.addPoints(
        db,
        guildId,
        userId,
        amountToSubtract,
        "ADMIN_ADD",
        null
      );
      const result = pointsService.getUserPoints(db, guildId, userId);

      expect(result.points).toBe(75);
    });

    test("should create a point_logs entry when points are added", async () => {
      // Arrange: Define parameters for the transaction
      const guildId = "test-guild-log";
      const userId = "test-user-log";
      const amount = 50;
      const reason = "ADMIN_ADD"; // The reason for the point change

      // Act: Call addPoints with the new 'reason' parameter
      await pointsService.addPoints(db, guildId, userId, amount, reason, null);

      // Assert: Check that a log was created with the correct details
      const log = db
        .prepare("SELECT * FROM point_logs WHERE guild_id = ? AND user_id = ?")
        .get(guildId, userId);

      expect(log).toBeDefined();
      expect(log.points_awarded).toBe(amount);
      expect(log.reason).toBe(reason);
      expect(log.user_id).toBe(userId);
    });
  });

  // --- NEW TEST SUITE FOR V0.6 LEADERBOARD LOGIC ---
  describe("getLeaderboard", () => {
    test("should return a weekly leaderboard summing points only from the last 7 days", () => {
      // Arrange: Seed the database with time-stamped point logs
      const guildId = "leaderboard-guild";
      const user1 = "user-A"; // Should have 15 points this week
      const user2 = "user-B"; // Should have 10 points this week (and 100 old points)
      const user3 = "user-C"; // Should have 0 points this week (only old points)

      const now = Math.floor(Date.now() / 1000);
      const threeDaysAgo = now - 3 * 24 * 60 * 60;
      const tenDaysAgo = now - 10 * 24 * 60 * 60;

      // --- UPDATED: Changed 'TEST' to 'ADMIN_ADD' to satisfy the CHECK constraint ---
      const insertLog = db.prepare(`
        INSERT INTO point_logs (guild_id, user_id, points_awarded, reason, created_at) 
        VALUES (?, ?, ?, 'ADMIN_ADD', ?)`);
      // User 1's points (all recent)
      insertLog.run(guildId, user1, 10, threeDaysAgo);
      insertLog.run(guildId, user1, 5, now);
      // User 2's points (one recent, one old)
      insertLog.run(guildId, user2, 10, threeDaysAgo);
      insertLog.run(guildId, user2, 100, tenDaysAgo);
      // User 3's points (all old)
      insertLog.run(guildId, user3, 50, tenDaysAgo);

      // Act: Call the service function with the 'weekly' period
      const leaderboard = pointsService.getLeaderboard(
        db,
        guildId,
        10,
        "weekly"
      );

      // Assert: Check the results
      expect(leaderboard).toBeDefined();
      expect(leaderboard).toHaveLength(2); // Only user1 and user2 should be on the weekly leaderboard

      // user1 should be first with 15 points
      expect(leaderboard[0].user_id).toBe(user1);
      expect(leaderboard[0].points).toBe(15);

      // user2 should be second with 10 points
      expect(leaderboard[1].user_id).toBe(user2);
      expect(leaderboard[1].points).toBe(10);
    });
  });
});
