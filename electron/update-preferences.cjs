const { DatabaseSync } = require("node:sqlite");

// Separate table in the existing database: business data is never rewritten.
function openUpdatePreferences(databasePath) {
  const db = new DatabaseSync(databasePath);
  db.exec(`
    PRAGMA busy_timeout = 5000;
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS desktop_preferences (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);
  const read = db.prepare("SELECT value FROM desktop_preferences WHERE key = ?");
  const write = db.prepare(`INSERT INTO desktop_preferences (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value`);
  return {
    read() {
      return {
        automatic: read.get("updates.automatic")?.value !== "false",
        skippedVersion: read.get("updates.skippedVersion")?.value || null,
      };
    },
    write(key, value) {
      if (!["automatic", "skippedVersion"].includes(key)) throw new Error("Preferencia inválida.");
      write.run(`updates.${key}`, value === null ? "" : String(value));
    },
    close() { db.close(); },
  };
}

module.exports = { openUpdatePreferences };
