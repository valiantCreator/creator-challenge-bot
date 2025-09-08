// __tests__/submissions.test.js

const { setupTestDb, cleanupTestDb } = require("./helpers/test-db.js");
const {
  createSubmission,
  getSubmissionByMessageId,
} = require("../src/database/submissions.js");

describe("Submission Database Operations", () => {
  let db;

  beforeEach(() => {
    db = setupTestDb();
  });

  afterEach(() => {
    cleanupTestDb(db);
  });

  test("should create a new submission successfully", () => {
    // Arrange
    const challengeId = db
      .prepare(
        `INSERT INTO challenges (guild_id, title, type) VALUES (?, ?, ?)`
      )
      .run("guild123", "Test Challenge", "one-time").lastInsertRowid;

    // Test data now explicitly includes all possible fields, even if null.
    const submissionData = {
      challenge_id: challengeId,
      guild_id: "guild123",
      user_id: "user456",
      username: "testuser",
      channel_id: "channel789",
      message_id: "message111",
      content_text: "This is my submission.",
      attachment_url: null,
      link_url: "http://example.com",
    };

    // Act
    const result = createSubmission(db, submissionData);

    // Assert
    expect(result).toBeDefined();
    expect(result.id).toBe(1);
    expect(result.link_url).toBe("http://example.com");
  });

  test("should fail to create a submission with a non-existent challenge_id", () => {
    // Arrange
    const submissionData = {
      challenge_id: 999, // Does not exist
      guild_id: "guild123",
      user_id: "user456",
      username: "testuser",
      channel_id: "channel789",
      message_id: "message222",
    };

    // Act & Assert
    expect(() => createSubmission(db, submissionData)).toThrow(
      "FOREIGN KEY constraint failed"
    );
  });

  test("should retrieve a submission by its message_id", () => {
    // Arrange
    const challengeId = db
      .prepare(
        `INSERT INTO challenges (guild_id, title, type) VALUES (?, ?, ?)`
      )
      .run("guild123", "Another Challenge", "one-time").lastInsertRowid;

    db.prepare(
      `
      INSERT INTO submissions (challenge_id, guild_id, user_id, username, channel_id, message_id, content_text)
      VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      challengeId,
      "guild123",
      "user456",
      "testuser",
      "channel789",
      "message333",
      "Content to be found."
    );

    // Act
    const foundSubmission = getSubmissionByMessageId(db, "message333");

    // Assert
    expect(foundSubmission).toBeDefined();
    expect(foundSubmission.id).toBe(1);
  });
});
