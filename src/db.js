// src/db.js
// Purpose: Database connection and schema management for PostgreSQL (Supabase).
// ARCHITECTURE CHANGE: Switched from pg.Pool to Single-Use Client per query.
// Reason: Render/Supabase network layers aggressively kill idle TCP connections ("Zombie Sockets").
// By connecting and disconnecting for every query, we bypass network timeouts entirely.

const path = require("path");
// Explicitly point to the .env file in the root directory
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const { Client } = require("pg");

console.log(
  `[DB] Loading DATABASE_URL... Type: ${typeof process.env.DATABASE_URL}`
);

if (!process.env.DATABASE_URL) {
  console.error("❌ FATAL ERROR: DATABASE_URL is missing from .env file.");
  console.error(
    "    Please ensure your .env file is in the project root and contains DATABASE_URL=..."
  );
  process.exit(1);
}

/**
 * Execute a function with a fresh database client.
 * Handles connection, execution, and cleanup/error handling automatically.
 * This guarantees we never reuse a dead "zombie" connection.
 */
async function withDb(operation) {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false, // Required for Supabase/Render connections
    },
    connectionTimeoutMillis: 10000, // Fail fast if the DB is actually down (10s)
  });

  try {
    await client.connect();
    return await operation(client);
  } catch (err) {
    // Log error but throw it up so the caller knows it failed
    console.error("[DB Error] Operation failed:", err.message);
    throw err;
  } finally {
    // CRITICAL: Always close the connection immediately after use
    await client
      .end()
      .catch((e) =>
        console.error("[DB Warning] Error closing client:", e.message)
      );
  }
}

// 2. Helper to query the database
// These wrappers ensure the rest of the app doesn't need to change its syntax.
const db = {
  // Generic query
  query: async (text, params) => {
    return withDb((client) => client.query(text, params));
  },

  // Helper to get a single row
  get: async (text, params) => {
    return withDb(async (client) => {
      const res = await client.query(text, params);
      return res.rows[0];
    });
  },

  // Helper to get all rows
  all: async (text, params) => {
    return withDb(async (client) => {
      const res = await client.query(text, params);
      return res.rows;
    });
  },

  // Helper for inserts/updates
  run: async (text, params) => {
    return withDb(async (client) => {
      const res = await client.query(text, params);
      return {
        changes: res.rowCount,
        // PostgreSQL doesn't return ID by default, so we rely on the query having "RETURNING id"
        lastInsertRowid: res.rows[0]?.id,
      };
    });
  },
};

// 3. Initialize Schema (Run once at startup)
async function init() {
  console.log("[DB] Initializing Schema...");
  try {
    await withDb(async (client) => {
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

      // Table: Submission Votes
      await client.query(`
        CREATE TABLE IF NOT EXISTS submission_votes (
          submission_id INTEGER REFERENCES submissions(id) ON DELETE CASCADE,
          user_id TEXT NOT NULL,
          guild_id TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (submission_id, user_id)
        );
      `);

      // Indexes
      await client.query(
        `CREATE INDEX IF NOT EXISTS idx_point_logs_guild_timestamp ON point_logs (guild_id, created_at DESC);`
      );
      await client.query(
        `CREATE INDEX IF NOT EXISTS idx_point_logs_user ON point_logs (guild_id, user_id);`
      );
      await client.query(
        `CREATE INDEX IF NOT EXISTS idx_submission_votes_user ON submission_votes (user_id);`
      );

      await client.query("COMMIT");
      console.log("✅ PostgreSQL Schema initialized.");
    });
  } catch (err) {
    console.error("❌ Database initialization failed:", err);
    // We exit here because if the schema fails, the bot cannot function.
    process.exit(1);
  }
}

// Auto-run init on first import
init();

module.exports = { db };
