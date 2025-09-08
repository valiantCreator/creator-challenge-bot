// __tests__/helpers/test-db.js
// Manages an in-memory test database, mirroring the production schema.

const Database = require("better-sqlite3");

let db;

function setupTestDb() {
  db = new Database(":memory:");

  // This schema MUST be an exact 1:1 copy of the schema in src/db.js
  db.exec("PRAGMA foreign_keys = ON;");

  db.exec(`CREATE TABLE challenges (
      id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL, title TEXT NOT NULL,
      description TEXT, type TEXT NOT NULL, created_by TEXT, starts_at INTEGER,
      ends_at INTEGER, channel_id TEXT, message_id TEXT, thread_id TEXT, -- MODIFIED: Added thread_id
      is_active INTEGER NOT NULL DEFAULT 1, is_template INTEGER NOT NULL DEFAULT 0,
      cron_schedule TEXT
  );`);
  db.exec(`CREATE TABLE submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, challenge_id INTEGER NOT NULL, guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL, username TEXT NOT NULL, channel_id TEXT NOT NULL,
      message_id TEXT NOT NULL UNIQUE, thread_id TEXT, content_text TEXT,
      attachment_url TEXT, link_url TEXT, created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      votes INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
  );`);
  db.exec(`CREATE TABLE points (
      guild_id TEXT NOT NULL, user_id TEXT NOT NULL, points INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(guild_id, user_id)
  );`);
  db.exec(`CREATE TABLE guild_settings (
      guild_id TEXT PRIMARY KEY, points_per_submission INTEGER NOT NULL DEFAULT 1,
      points_per_vote INTEGER NOT NULL DEFAULT 1
  );`);
  db.exec(`CREATE TABLE badge_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL,
      role_id TEXT NOT NULL, points_required INTEGER NOT NULL,
      UNIQUE(guild_id, role_id)
  );`);

  return db;
}

function cleanupTestDb(dbInstance) {
  if (dbInstance && dbInstance.open) {
    dbInstance.close();
  }
}

module.exports = { setupTestDb, cleanupTestDb };
