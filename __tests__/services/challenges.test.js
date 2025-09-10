// __tests__/services/challenges.test.js
// REWRITTEN: Converted to the standard testing pattern using test-db helper.

const { setupTestDb, cleanupTestDb } = require("../helpers/test-db.js");
const challengesService = require("../../src/services/challenges");

describe("Challenges Service", () => {
  let db;

  // Create a fresh, isolated database before each test.
  beforeEach(() => {
    db = setupTestDb();
  });

  // Close the database connection after each test.
  afterEach(() => {
    cleanupTestDb(db);
  });

  test("should create a new challenge and retrieve it by ID", () => {
    const challengeData = {
      guildId: "test-guild-1",
      title: "Test Writing Challenge",
      type: "one-time",
    };
    // Pass the test `db` instance to the service function.
    const challengeId = challengesService.createChallenge(db, challengeData);
    const retrieved = challengesService.getChallengeById(db, challengeId);

    expect(retrieved).toBeDefined();
    expect(retrieved.id).toBe(challengeId);
    expect(retrieved.title).toBe(challengeData.title);
  });

  test("should record a submission and retrieve it", () => {
    const challengeId = challengesService.createChallenge(db, {
      guildId: "g1",
      title: "t1",
      type: "one-time",
    });

    // --- UPDATED: Added missing keys required by the SQL query ---
    // The INSERT statement requires all named parameters to be present in the data object.
    const submissionData = {
      challenge_id: challengeId,
      guild_id: "g1",
      user_id: "u1",
      username: "TestUser",
      channel_id: "c1",
      message_id: "m1",
      thread_id: "th1",
      content_text: "This is a test submission.", // Added this key
      attachment_url: null, // Added this key
      link_url: null, // Added this key
    };
    const submissionId = challengesService.recordSubmission(db, submissionData);
    const retrieved = challengesService.getSubmissionById(db, submissionId);

    expect(retrieved).toBeDefined();
    expect(retrieved.id).toBe(submissionId);
    expect(retrieved.thread_id).toBe("th1");
  });

  test("should add and retrieve badge roles", () => {
    const guildId = "test-guild-badges";
    challengesService.addBadgeRole(db, {
      guildId,
      roleId: "role1",
      pointsRequired: 100,
    });
    challengesService.addBadgeRole(db, {
      guildId,
      roleId: "role2",
      pointsRequired: 50,
    });
    const roles = challengesService.getBadgeRoles(db, guildId);

    expect(roles).toHaveLength(2);
    // The query sorts by points ascending.
    expect(roles[0].role_id).toBe("role2");
  });

  test("should close an active challenge", () => {
    const challengeId = challengesService.createChallenge(db, {
      guildId: "g1",
      title: "t1",
      type: "one-time",
    });
    challengesService.closeChallenge(db, challengeId);
    const retrieved = challengesService.getChallengeById(db, challengeId);
    expect(retrieved.is_active).toBe(0);
  });
});
