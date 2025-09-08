// scripts/reset-db.js
// Purpose: A utility script to completely reset the database for development.
// WARNING: This script is destructive and will delete all data.

const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const dbPath = path.join(__dirname, "..", "data", "bot.sqlite");

if (!fs.existsSync(dbPath)) {
  console.log(
    "Database file not found. Nothing to reset. A new one will be created on bot start."
  );
  process.exit(0);
}

console.log("Connecting to the database to reset...");
const db = new Database(dbPath);

try {
  console.log("Dropping existing tables...");
  db.exec("DROP TABLE IF EXISTS points;");
  db.exec("DROP TABLE IF EXISTS submissions;");
  db.exec("DROP TABLE IF EXISTS challenges;");
  db.exec("DROP TABLE IF EXISTS guild_settings;");
  db.exec("DROP TABLE IF EXISTS badge_roles;"); // (NEW) Drop the new table
  console.log("Tables dropped successfully.");

  console.log("Recreating schema with updated structure...");
  db.exec("PRAGMA journal_mode = WAL;");

  db.exec(`
        CREATE TABLE challenges (
            id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT,
            type TEXT NOT NULL, created_by TEXT, starts_at INTEGER, ends_at INTEGER, channel_id TEXT,
            message_id TEXT, is_active INTEGER NOT NULL DEFAULT 1, is_template INTEGER NOT NULL DEFAULT 0, cron_schedule TEXT
        );
    `);
  db.exec(`
        CREATE TABLE submissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT, challenge_id INTEGER NOT NULL, guild_id TEXT NOT NULL, user_id TEXT NOT NULL,
            username TEXT NOT NULL, channel_id TEXT NOT NULL, message_id TEXT NOT NULL UNIQUE, content_text TEXT,
            attachment_url TEXT, link_url TEXT, created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
            votes INTEGER NOT NULL DEFAULT 0, FOREIGN KEY(challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
        );
    `);
  db.exec(`
        CREATE TABLE points (
            guild_id TEXT NOT NULL, user_id TEXT NOT NULL, points INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(guild_id, user_id)
        );
    `);
  db.exec(`
        CREATE TABLE guild_settings (
            guild_id TEXT PRIMARY KEY,
            points_per_submission INTEGER NOT NULL DEFAULT 1,
            points_per_vote INTEGER NOT NULL DEFAULT 1
        );
    `);
  // (NEW) Recreate the badge_roles table
  db.exec(`
        CREATE TABLE badge_roles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT NOT NULL,
            role_id TEXT NOT NULL,
            points_required INTEGER NOT NULL,
            UNIQUE(guild_id, role_id)
        );
    `);

  console.log("\n✅ Database has been successfully reset.");
} catch (error) {
  console.error("\n❌ An error occurred during database reset:", error);
} finally {
  if (db && db.open) {
    db.close();
    console.log("Database connection closed.");
  }
}
