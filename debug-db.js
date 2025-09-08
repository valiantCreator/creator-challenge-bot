// debug-db.js
// Purpose: To execute the CREATE TABLE statement in complete isolation from Jest.

const Database = require("better-sqlite3");

const sql = `CREATE TABLE IF NOT EXISTS challenges (
    id INTEGER PRIMARY KEY,
    guild_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL,
    created_by TEXT,
    starts_at INTEGER,
    ends_at INTEGER,
    channel_id TEXT,
    message_id TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    is_template INTEGER NOT NULL DEFAULT 0,
    cron_schedule TEXT
);`;

try {
  console.log(
    "Attempting to create an in-memory database and run the schema..."
  );
  const db = new Database(":memory:");
  db.exec(sql);
  console.log(
    "\n✅ Success! The SQL statement is valid and executed without errors."
  );
  console.log(
    "This proves the problem is not with the SQL, but with the Jest environment."
  );
  db.close();
} catch (error) {
  console.error("\n❌ Failure! The script threw an error:");
  console.error(error);
}
