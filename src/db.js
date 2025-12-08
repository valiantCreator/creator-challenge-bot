// src/db.js
// Purpose: Database connection and schema management for PostgreSQL (Supabase).
// Gemini: Refactored with explicit .env path loading (v2.0.2).

const path = require("path");
// Gemini: Explicitly point to the .env file in the root directory
// This fixes the issue where dotenv can't find the file when run from inside src/
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const { Pool } = require("pg");

// Gemini: Debug logging to verify the variable is loaded
// We print the TYPE of the variable, not the value, for security.
console.log(
  `[DB] Loading DATABASE_URL... Type: ${typeof process.env.DATABASE_URL}`
);

if (!process.env.DATABASE_URL) {
  console.error("❌ FATAL ERROR: DATABASE_URL is missing from .env file.");
  console.error(
    "   Please ensure your .env file is in the project root and contains DATABASE_URL=..."
  );
  process.exit(1);
}

// 1. Create the Connection Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Required for Supabase/Render connections
  },
});

// 2. Helper to query the database
const db = {
  // Generic query
  query: (text, params) => pool.query(text, params),

  // Helper to get a single row
  get: async (text, params) => {
    const res = await pool.query(text, params);
    return res.rows[0];
  },

  // Helper to get all rows
  all: async (text, params) => {
    const res = await pool.query(text, params);
    return res.rows;
  },

  // Helper for inserts/updates
  run: async (text, params) => {
    const res = await pool.query(text, params);
    return {
      changes: res.rowCount,
      lastInsertRowid: res.rows[0]?.id,
    };
  },
};

// 3. Initialize Schema
async function init() {
  // Gemini: Connect logic wrapped in try/catch to debug connection errors
  let client;
  try {
    client = await pool.connect();
    console.log("🔌 Connected to PostgreSQL successfully.");

    await client.query("BEGIN");

    // Table: Challenges
    await client.query(`
      CREATE TABLE IF NOT EXISTS challenges (
        id SERIAL PRIMARY KEY,
        guild_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL,
        created_by TEXT,
        starts_at BIGINT,
        ends_at BIGINT,
        channel_id TEXT,
        message_id TEXT,
        thread_id TEXT,
        is_active INTEGER DEFAULT 1,
        is_template INTEGER DEFAULT 0,
        cron_schedule TEXT
      );
    `);

    // Table: Submissions
    await client.query(`
      CREATE TABLE IF NOT EXISTS submissions (
        id SERIAL PRIMARY KEY,
        challenge_id INTEGER REFERENCES challenges(id) ON DELETE CASCADE,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        message_id TEXT NOT NULL UNIQUE,
        thread_id TEXT,
        content_text TEXT,
        attachment_url TEXT,
        link_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        votes INTEGER DEFAULT 0
      );
    `);

    // Table: Points (Cache)
    await client.query(`
      CREATE TABLE IF NOT EXISTS points (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        points INTEGER DEFAULT 0,
        PRIMARY KEY (guild_id, user_id)
      );
    `);

    // Table: Guild Settings
    await client.query(`
      CREATE TABLE IF NOT EXISTS guild_settings (
        guild_id TEXT PRIMARY KEY,
        points_per_submission INTEGER DEFAULT 1,
        points_per_vote INTEGER DEFAULT 1,
        vote_emoji TEXT DEFAULT '👍'
      );
    `);

    // Table: Badge Roles
    await client.query(`
      CREATE TABLE IF NOT EXISTS badge_roles (
        id SERIAL PRIMARY KEY,
        guild_id TEXT NOT NULL,
        role_id TEXT NOT NULL,
        points_required INTEGER NOT NULL,
        UNIQUE(guild_id, role_id)
      );
    `);

    // Table: Point Logs (Ledger)
    await client.query(`
      CREATE TABLE IF NOT EXISTS point_logs (
        log_id SERIAL PRIMARY KEY,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        points_awarded INTEGER NOT NULL,
        reason TEXT NOT NULL CHECK(reason IN ('SUBMISSION', 'VOTE_RECEIVED', 'WINNER_BONUS', 'ADMIN_ADD', 'ADMIN_REMOVE', 'SUBMISSION_DELETED')),
        related_id TEXT,
        operator_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Indexes
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_point_logs_guild_timestamp ON point_logs (guild_id, created_at DESC);`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_point_logs_user ON point_logs (guild_id, user_id);`
    );

    await client.query("COMMIT");
    console.log("✅ PostgreSQL Schema initialized.");
  } catch (err) {
    if (client) await client.query("ROLLBACK");
    console.error("❌ Database initialization failed:", err);
    process.exit(1);
  } finally {
    if (client) client.release();
  }
}

// Auto-run init on first import
init();

module.exports = { db };
