// Friends lists and last-used ghost names. Takes the DB handle so tests can use :memory:.
import { MAX_FRIENDS } from "@club-kiro/shared";
import type { DB } from "./index.js";

/** Remember the ghost name a player last joined with (shown to their friends). */
export function setPlayerName(db: DB, playerId: number, name: string): void {
  db.prepare("UPDATE players SET name = ? WHERE id = ?").run(name, playerId);
}

/** The player's last ghost name, or "" if unknown. */
export function playerName(db: DB, playerId: number): string {
  const row = db.prepare("SELECT name FROM players WHERE id = ?").get(playerId) as { name: string } | undefined;
  return row?.name ?? "";
}

/**
 * Add `friendId` to `playerId`'s list. Refuses yourself, unknown players and a
 * full list. Adding someone already on the list is a no-op that still succeeds.
 */
export function addFriend(db: DB, playerId: number, friendId: number): boolean {
  if (playerId === friendId) return false;
  const exists = db.prepare("SELECT 1 FROM players WHERE id = ?").get(friendId);
  if (!exists) return false;
  const add = db.transaction((): boolean => {
    const { n } = db.prepare("SELECT COUNT(*) AS n FROM friends WHERE player_id = ?").get(playerId) as { n: number };
    const already = db.prepare("SELECT 1 FROM friends WHERE player_id = ? AND friend_id = ?").get(playerId, friendId);
    if (already) return true;
    if (n >= MAX_FRIENDS) return false;
    db.prepare("INSERT INTO friends (player_id, friend_id, created_at) VALUES (?, ?, ?)").run(playerId, friendId, Date.now());
    return true;
  });
  return add();
}

export function removeFriend(db: DB, playerId: number, friendId: number): void {
  db.prepare("DELETE FROM friends WHERE player_id = ? AND friend_id = ?").run(playerId, friendId);
}

/** The player's friends with their last ghost names, oldest first. */
export function listFriends(db: DB, playerId: number): { playerId: number; name: string }[] {
  return db
    .prepare(
      `SELECT p.id AS playerId, p.name AS name FROM friends f
       JOIN players p ON p.id = f.friend_id
       WHERE f.player_id = ? ORDER BY f.created_at`,
    )
    .all(playerId) as { playerId: number; name: string }[];
}
