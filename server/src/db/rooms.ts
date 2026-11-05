// Room layout persistence: one JSON blob per player. A room is small and always
// read/written whole, so a blob beats a row-per-item table. Validation (owned +
// in-bounds decorations) happens here before anything is stored.
import { parseRoomLayout, type PlacedItem } from "@club-kiro/shared";
import type { DB } from "./index.js";
import { ownsItem } from "./players.js";

/** The saved layout for a player, or an empty room. Always safe (validated on read). */
export function getLayout(db: DB, playerId: number): PlacedItem[] {
  const row = db.prepare("SELECT layout FROM rooms WHERE player_id = ?").get(playerId) as
    | { layout: string }
    | undefined;
  if (!row) return [];
  try {
    return parseRoomLayout(JSON.parse(row.layout));
  } catch {
    return []; // corrupt JSON: treat as an empty room rather than crash
  }
}

/**
 * Save a layout, keeping only items the player owns and that pass shared validation
 * (known decoration, in bounds, capped count). Returns the stored layout so the
 * caller can sync exactly what was kept.
 */
export function saveLayout(db: DB, playerId: number, raw: unknown): PlacedItem[] {
  const valid = parseRoomLayout(raw).filter((item) => ownsItem(db, playerId, item.itemId));
  const json = JSON.stringify(valid);
  db.prepare(
    `INSERT INTO rooms (player_id, layout, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(player_id) DO UPDATE SET layout = excluded.layout, updated_at = excluded.updated_at`,
  ).run(playerId, json, Date.now());
  return valid;
}
