// A single process-wide database handle shared by all plaza rooms.
// Opened lazily on first use; tests call setDb() with an in-memory database.
import { openDb, type DB } from "./index.js";

let instance: DB | null = null;

/** The shared database, opened on first use. */
export function getDb(): DB {
  if (!instance) instance = openDb();
  return instance;
}

/** Override the shared database (tests use an in-memory one). */
export function setDb(db: DB): void {
  instance = db;
}
