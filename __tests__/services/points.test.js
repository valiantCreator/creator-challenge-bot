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

  // Tests for async functions must also be async.
  test("should add points for a new user correctly", async () => {
    const guildId = "test-guild-1";
    const userId = "test-user-1";
    const amount = 100;
    // The client is null in this test because we are only testing the database logic.
    await pointsService.addPoints(db, guildId, userId, amount, null);
    const result = pointsService.getUserPoints(db, guildId, userId);

    expect(result).toBeDefined();
    expect(result.points).toBe(100);
  });

  test("should correctly add more points to an existing user", async () => {
    const guildId = "test-guild-1";
    const userId = "test-user-1";
    // First, give the user some initial points.
    await pointsService.addPoints(db, guildId, userId, 100, null);

    const amountToAdd = 50;
    await pointsService.addPoints(db, guildId, userId, amountToAdd, null);
    const result = pointsService.getUserPoints(db, guildId, userId);

    expect(result.points).toBe(150);
  });

  test("should correctly subtract points from a user", async () => {
    const guildId = "test-guild-1";
    const userId = "test-user-1";
    await pointsService.addPoints(db, guildId, userId, 100, null);

    const amountToSubtract = -25;
    await pointsService.addPoints(db, guildId, userId, amountToSubtract, null);
    const result = pointsService.getUserPoints(db, guildId, userId);

    expect(result.points).toBe(75);
  });
});
