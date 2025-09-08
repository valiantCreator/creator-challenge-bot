// src/db.js
// Purpose: Initializes and configures the better-sqlite3 database.

const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "bot.sqlite");
const db = new Database(dbPath);

try {
  db.exec("PRAGMA journal_mode = WAL;");

  // --- challenges table now includes thread_id ---
  db.exec(`CREATE TABLE IF NOT EXISTS challenges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL,
      created_by TEXT,
      starts_at INTEGER,
      ends_at INTEGER,
      channel_id TEXT,
      message_id TEXT,
      thread_id TEXT, 
      is_active INTEGER NOT NULL DEFAULT 1,
      is_template INTEGER NOT NULL DEFAULT 0,
      cron_schedule TEXT
  );`);

  db.exec(`CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      challenge_id INTEGER NOT NULL,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      message_id TEXT NOT NULL UNIQUE,
      thread_id TEXT,
      content_text TEXT,
      attachment_url TEXT,
      link_url TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      votes INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
  );`);

  db.exec(`CREATE TABLE IF NOT EXISTS points (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      points INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(guild_id, user_id)
  );`);

  db.exec(`CREATE TABLE IF NOT EXISTS guild_settings (
        guild_id TEXT PRIMARY KEY,
        points_per_submission INTEGER NOT NULL DEFAULT 1,
        points_per_vote INTEGER NOT NULL DEFAULT 1
  );`);

  db.exec(`CREATE TABLE IF NOT EXISTS badge_roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        role_id TEXT NOT NULL,
        points_required INTEGER NOT NULL,
        UNIQUE(guild_id, role_id)
  );`);

  console.log("Database initialized successfully.");
} catch (error) {
  console.error("Database initialization failed:", error);
  process.exit(1);
}

function closeDb() {
  if (db && db.open) {
    db.close();
  }
}

process.on("exit", closeDb);
process.on("SIGINT", () => process.exit());
process.on("SIGTERM", () => process.exit());

module.exports = {
  db,
};
