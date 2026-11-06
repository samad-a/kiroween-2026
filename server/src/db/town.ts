// Stamps and the daily gift.
import type { DB } from "./index.js";
import { getPlayer } from "./players.js";

/** Record a stamp. True only the first time this player earns it. */
export function awardStamp(db: DB, playerId: number, stampId: string): boolean {
  const info = db
    .prepare("INSERT OR IGNORE INTO player_stamps (player_id, stamp_id, earned_at) VALUES (?, ?, ?)")
    .run(playerId, stampId, Date.now());
  return info.changes > 0;
}

export function listStamps(db: DB, playerId: number): string[] {
  const rows = db.prepare("SELECT stamp_id FROM player_stamps WHERE player_id = ?").all(playerId) as { stamp_id: string }[];
  return rows.map((r) => r.stamp_id);
}

/** Give today's gift if not yet given. Returns the new balance, or null if already claimed today. */
export function claimDailyGift(db: DB, playerId: number, day: string, coins: number): number | null {
  const info = db
    .prepare("UPDATE players SET coins = coins + ?, last_gift_day = ? WHERE id = ? AND last_gift_day <> ?")
    .run(coins, day, playerId, day);
  return info.changes > 0 ? (getPlayer(db, playerId)?.coins ?? null) : null;
}
