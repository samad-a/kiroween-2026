// SQLite persistence. One process, one connection, synchronous queries (fine inside
// the Colyseus tick). The schema is created on open; migrations are additive and
// tracked by user_version so a reopen is a no-op.
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

export type DB = Database.Database;

/** Default on-disk location. Overridable with DB_PATH; ":memory:" in tests. */
export function defaultDbPath(): string {
  return process.env.DB_PATH ?? fileURLToPath(new URL("../../data/club-kiro.db", import.meta.url));
}

const MIGRATIONS: ((db: DB) => void)[] = [
  // v1: players and their owned items.
  (db) => {
    db.exec(`
      CREATE TABLE players (
        id            INTEGER PRIMARY KEY,
        guest_id      TEXT NOT NULL UNIQUE,
        recovery_code TEXT NOT NULL UNIQUE,
        coins         INTEGER NOT NULL DEFAULT 0 CHECK (coins >= 0),
        created_at    INTEGER NOT NULL
      );
      CREATE TABLE player_items (
        player_id INTEGER NOT NULL REFERENCES players(id),
        item_id   TEXT NOT NULL,
        bought_at INTEGER NOT NULL,
        PRIMARY KEY (player_id, item_id)
      );
    `);
  },
  // v2: one personal room per player, layout stored as a JSON blob (read/written whole).
  (db) => {
    db.exec(`
      CREATE TABLE rooms (
        player_id  INTEGER PRIMARY KEY REFERENCES players(id),
        layout     TEXT NOT NULL DEFAULT '[]',
        updated_at INTEGER NOT NULL
      );
    `);
  },
  // v3: the ghost name a player last used (display only), and one-way friends lists.
  (db) => {
    db.exec(`
      ALTER TABLE players ADD COLUMN name TEXT NOT NULL DEFAULT '';
      CREATE TABLE friends (
        player_id  INTEGER NOT NULL REFERENCES players(id),
        friend_id  INTEGER NOT NULL REFERENCES players(id),
        created_at INTEGER NOT NULL,
        PRIMARY KEY (player_id, friend_id),
        CHECK (player_id <> friend_id)
      );
    `);
  },
  // v4: Graveyard Dash personal bests, one per player per track.
  (db) => {
    db.exec(`
      CREATE TABLE dash_records (
        player_id  INTEGER NOT NULL REFERENCES players(id),
        map        TEXT NOT NULL,
        best_ms    INTEGER NOT NULL CHECK (best_ms > 0),
        set_at     INTEGER NOT NULL,
        PRIMARY KEY (player_id, map)
      );
    `);
  },
  // v5: the stamp book, and the day of the last daily gift.
  (db) => {
    db.exec(`
      CREATE TABLE player_stamps (
        player_id  INTEGER NOT NULL REFERENCES players(id),
        stamp_id   TEXT NOT NULL,
        earned_at  INTEGER NOT NULL,
        PRIMARY KEY (player_id, stamp_id)
      );
      ALTER TABLE players ADD COLUMN last_gift_day TEXT NOT NULL DEFAULT '';
    `);
  },
];

/** Run any migrations the database has not seen yet, tracked by user_version. */
function migrate(db: DB): void {
  const current = db.pragma("user_version", { simple: true }) as number;
  for (let v = current; v < MIGRATIONS.length; v++) {
    const run = db.transaction(() => {
      MIGRATIONS[v]!(db);
      db.pragma(`user_version = ${v + 1}`);
    });
    run();
  }
}

/**
 * Open (or create) the database at `path` and bring it up to the latest schema.
 * Pass ":memory:" for a throwaway database in tests.
 */
export function openDb(path: string = defaultDbPath()): DB {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}
