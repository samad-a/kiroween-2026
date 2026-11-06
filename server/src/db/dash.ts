// Graveyard Dash personal bests. Takes the DB handle so tests can use :memory:.
import type { DashMapId } from "@club-kiro/shared";
import type { DB } from "./index.js";

/** Your best time per track, in ms. Tracks you've never finished are missing. */
export function getRecords(db: DB, playerId: number): Partial<Record<DashMapId, number>> {
  const rows = db.prepare("SELECT map, best_ms FROM dash_records WHERE player_id = ?").all(playerId) as { map: DashMapId; best_ms: number }[];
  return Object.fromEntries(rows.map((r) => [r.map, r.best_ms]));
}

/**
 * Record a finish. Keeps only the fastest per track.
 * Returns the best time after this run, and whether this run set it.
 */
export function recordFinish(db: DB, playerId: number, map: DashMapId, timeMs: number): { bestMs: number; newRecord: boolean } {
  const ms = Math.max(1, Math.round(timeMs));
  const save = db.transaction(() => {
    const row = db.prepare("SELECT best_ms FROM dash_records WHERE player_id = ? AND map = ?").get(playerId, map) as { best_ms: number } | undefined;
    if (row && row.best_ms <= ms) return { bestMs: row.best_ms, newRecord: false };
    db.prepare(
      `INSERT INTO dash_records (player_id, map, best_ms, set_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (player_id, map) DO UPDATE SET best_ms = excluded.best_ms, set_at = excluded.set_at`,
    ).run(playerId, map, ms, Date.now());
    return { bestMs: ms, newRecord: true };
  });
  return save();
}
