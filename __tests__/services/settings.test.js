// __tests__/services/settings.test.js
// REWRITTEN: Converted to the standard testing pattern using test-db helper.

const { setupTestDb, cleanupTestDb } = require("../helpers/test-db.js");
const settingsService = require("../../src/services/settings");

describe("Settings Service", () => {
  let db;

  beforeEach(() => {
    db = setupTestDb();
  });

  afterEach(() => {
    cleanupTestDb(db);
  });

  test("should return default settings for a new guild", () => {
    const guildId = "new-guild-1";
    const settings = settingsService.getGuildSettings(db, guildId);

    expect(settings).toBeDefined();
    expect(settings.points_per_submission).toBe(1);
    expect(settings.points_per_vote).toBe(1);
  });

  test("should update and retrieve settings for a guild", () => {
    const guildId = "configured-guild-2";
    const newSettings = {
      points_per_submission: 10,
      points_per_vote: 5,
    };

    settingsService.updateGuildSettings(db, guildId, newSettings);
    const retrievedSettings = settingsService.getGuildSettings(db, guildId);

    expect(retrievedSettings).toBeDefined();
    expect(retrievedSettings.points_per_submission).toBe(10);
    expect(retrievedSettings.points_per_vote).toBe(5);
  });

  test("should handle partial updates without resetting other values", () => {
    const guildId = "partial-update-guild-3";
    const initialSettings = { points_per_submission: 100, points_per_vote: 50 };
    settingsService.updateGuildSettings(db, guildId, initialSettings);

    const partialUpdate = { points_per_submission: 123 };
    settingsService.updateGuildSettings(db, guildId, partialUpdate);
    const retrievedSettings = settingsService.getGuildSettings(db, guildId);

    expect(retrievedSettings.points_per_submission).toBe(123);
    expect(retrievedSettings.points_per_vote).toBe(50);
  });
});
