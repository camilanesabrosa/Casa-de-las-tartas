import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, isAbsolute } from "node:path";

let database: DatabaseSync | undefined;
function connection() {
  if (database) return database;
  const path = process.env.MOSTRADOR_DATABASE_PATH;
  if (!path || !isAbsolute(path)) throw new Error("MOSTRADOR_DATABASE_PATH must be an absolute SQLite file path.");
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  database = new DatabaseSync(path);
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = FULL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS businesses (
      owner_id TEXT PRIMARY KEY NOT NULL,
      revision INTEGER NOT NULL DEFAULT 0,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS demo_sessions (
      token_hash TEXT PRIMARY KEY NOT NULL,
      expires_at INTEGER NOT NULL
    );
  `);
  return database;
}

// The app uses this small subset of D1. Run batches synchronously inside one
// SQLite transaction so stock revisions and session writes stay atomic.
class Statement {
  constructor(private sql: string, private values: SQLInputValue[] = []) {}
  bind(...values: SQLInputValue[]) { return new Statement(this.sql, values); }
  async first<T = Record<string, unknown>>(): Promise<T | null> {
    return (connection().prepare(this.sql).get(...this.values) as T | undefined) ?? null;
  }
  async all<T = Record<string, unknown>>() {
    return { success: true, results: connection().prepare(this.sql).all(...this.values) as T[] };
  }
  execute() {
    const result = connection().prepare(this.sql).run(...this.values);
    return { success: true, meta: { changes: Number(result.changes) } };
  }
  async run() { return this.execute(); }
}

export const env = {
  DB: {
    prepare(sql: string) { return new Statement(sql); },
    async batch(statements: Statement[]) {
      const db = connection();
      db.exec("BEGIN IMMEDIATE");
      try {
        const results = statements.map((statement) => statement.execute());
        db.exec("COMMIT");
        return results;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  },
};
