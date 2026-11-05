// Thin repository over the players / player_items tables. Keeps SQL out of PlazaRoom
// and takes the DB handle so tests can pass an in-memory database.
import { formatRecoveryCode, generateRecoveryCode, parseRecoveryCode } from "@club-kiro/shared";
import type { DB } from "./index.js";

export interface Player {
  id: number;
  guestId: string;
  /** Canonical code (no dash). Use formatRecoveryCode() for display. */
  recoveryCode: string;
  coins: number;
}

interface PlayerRow {
  id: number;
  guest_id: string;
  recovery_code: string;
  coins: number;
}

const toPlayer = (r: PlayerRow): Player => ({
  id: r.id,
  guestId: r.guest_id,
  recoveryCode: r.recovery_code,
  coins: r.coins,
});

/** Look up a player by id, or null. */
export function getPlayer(db: DB, id: number): Player | null {
  const row = db.prepare("SELECT id, guest_id, recovery_code, coins FROM players WHERE id = ?").get(id) as
    | PlayerRow
    | undefined;
  return row ? toPlayer(row) : null;
}

function byGuestId(db: DB, guestId: string): Player | null {
  const row = db.prepare("SELECT id, guest_id, recovery_code, coins FROM players WHERE guest_id = ?").get(guestId) as
    | PlayerRow
    | undefined;
  return row ? toPlayer(row) : null;
}

function byRecoveryCode(db: DB, code: string): Player | null {
  const row = db
    .prepare("SELECT id, guest_id, recovery_code, coins FROM players WHERE recovery_code = ?")
    .get(code) as PlayerRow | undefined;
  return row ? toPlayer(row) : null;
}

/** Generate a recovery code not already used by another player. */
function uniqueRecoveryCode(db: DB, random: () => number): string {
  for (let attempt = 0; attempt < 50; attempt++) {
    const code = generateRecoveryCode(random).replace("-", "");
    if (!byRecoveryCode(db, code)) return code;
  }
  throw new Error("could not generate a unique recovery code");
}

/**
 * Resolve the player for a connection. Order: a valid recovery code restores that
 * player; otherwise a known guest id returns it; otherwise a new player is created.
 * `recoveryInput` is the raw string the client typed (may be null).
 */
export function resolvePlayer(
  db: DB,
  guestId: string,
  recoveryInput: string | null,
  random: () => number = Math.random,
): Player {
  const code = parseRecoveryCode(recoveryInput);
  if (code) {
    const byCode = byRecoveryCode(db, code);
    if (byCode) return byCode;
  }

  const existing = byGuestId(db, guestId);
  if (existing) return existing;

  const recoveryCode = uniqueRecoveryCode(db, random);
  const info = db
    .prepare("INSERT INTO players (guest_id, recovery_code, coins, created_at) VALUES (?, ?, 0, ?)")
    .run(guestId, recoveryCode, Date.now());
  return { id: Number(info.lastInsertRowid), guestId, recoveryCode, coins: 0 };
}

/** Recovery code formatted for display, e.g. "MANE-7823". */
export function displayRecoveryCode(player: Player): string {
  return formatRecoveryCode(player.recoveryCode);
}

/**
 * Add coins (positive earn, or negative spend) and return the new balance.
 * Refuses a spend the balance cannot afford; the DB CHECK is the backstop.
 * Returns null if the spend is rejected.
 */
export function addCoins(db: DB, playerId: number, delta: number): number | null {
  if (!Number.isInteger(delta)) return null;
  const result = db
    .prepare("UPDATE players SET coins = coins + ? WHERE id = ? AND coins + ? >= 0")
    .run(delta, playerId, delta);
  if (result.changes === 0) return null; // nothing updated: would have gone negative, or no such player
  const player = getPlayer(db, playerId);
  return player ? player.coins : null;
}

/** True if the player already owns this item. */
export function ownsItem(db: DB, playerId: number, itemId: string): boolean {
  const row = db.prepare("SELECT 1 FROM player_items WHERE player_id = ? AND item_id = ?").get(playerId, itemId);
  return row !== undefined;
}

/** Every item id the player owns. */
export function ownedItems(db: DB, playerId: number): string[] {
  const rows = db.prepare("SELECT item_id FROM player_items WHERE player_id = ?").all(playerId) as {
    item_id: string;
  }[];
  return rows.map((r) => r.item_id);
}

/**
 * Buy an item: in one transaction, refuse if already owned or unaffordable,
 * else deduct the price and record ownership. Returns the new balance, or null
 * if the purchase was rejected.
 */
export function buyItem(db: DB, playerId: number, itemId: string, price: number): number | null {
  const purchase = db.transaction((): number | null => {
    if (ownsItem(db, playerId, itemId)) return null;
    const balance = addCoins(db, playerId, -price);
    if (balance === null) return null; // not enough coins
    db.prepare("INSERT INTO player_items (player_id, item_id, bought_at) VALUES (?, ?, ?)").run(
      playerId,
      itemId,
      Date.now(),
    );
    return balance;
  });
  return purchase();
}
