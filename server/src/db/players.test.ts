import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { openDb, type DB } from "./index.js";
import { addCoins, buyItem, getPlayer, ownedItems, ownsItem, resolvePlayer } from "./players.js";

const guid = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const fresh = (): DB => openDb(":memory:");
// Deterministic "random" so recovery codes are stable per test.
const seeded = (seed: number) => {
  let s = seed;
  return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
};

describe("resolvePlayer", () => {
  it("creates a new player for an unknown guest id, with a recovery code and zero coins", () => {
    const db = fresh();
    const p = resolvePlayer(db, guid(1), null, seeded(1));
    expect(p.coins).toBe(0);
    expect(p.recoveryCode).toHaveLength(8);
    expect(p.id).toBeGreaterThan(0);
  });

  it("returns the same row for the same guest id", () => {
    const db = fresh();
    const a = resolvePlayer(db, guid(1), null, seeded(1));
    const b = resolvePlayer(db, guid(1), null, seeded(99));
    expect(b.id).toBe(a.id);
    expect(b.recoveryCode).toBe(a.recoveryCode);
  });

  it("creates distinct rows for distinct guest ids", () => {
    const db = fresh();
    const a = resolvePlayer(db, guid(1), null, seeded(1));
    const b = resolvePlayer(db, guid(2), null, seeded(2));
    expect(b.id).not.toBe(a.id);
  });

  it("restores a player by recovery code even from a different guest id (new device)", () => {
    const db = fresh();
    const original = resolvePlayer(db, guid(1), null, seeded(1));
    // New browser: different guest id, but the player typed their recovery code.
    const restored = resolvePlayer(db, guid(2), original.recoveryCode, seeded(2));
    expect(restored.id).toBe(original.id);
  });

  it("ignores an unknown recovery code and falls back to guest id / create", () => {
    const db = fresh();
    const p = resolvePlayer(db, guid(1), "ZZZZ-9999", seeded(1));
    expect(p.guestId).toBe(guid(1));
  });
});

describe("addCoins", () => {
  it("adds and subtracts, returning the new balance", () => {
    const db = fresh();
    const p = resolvePlayer(db, guid(1), null, seeded(1));
    expect(addCoins(db, p.id, 10)).toBe(10);
    expect(addCoins(db, p.id, -4)).toBe(6);
  });

  it("refuses a spend larger than the balance and leaves coins unchanged", () => {
    const db = fresh();
    const p = resolvePlayer(db, guid(1), null, seeded(1));
    addCoins(db, p.id, 5);
    expect(addCoins(db, p.id, -6)).toBeNull();
    expect(getPlayer(db, p.id)!.coins).toBe(5);
  });

  it("never lets the balance go negative under random earn/spend sequences", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: -50, max: 50 }), { maxLength: 100 }), (deltas) => {
        const db = fresh();
        const p = resolvePlayer(db, guid(1), null, seeded(1));
        for (const d of deltas) addCoins(db, p.id, d);
        return getPlayer(db, p.id)!.coins >= 0;
      }),
    );
  });
});

describe("buyItem", () => {
  it("deducts the price and records ownership", () => {
    const db = fresh();
    const p = resolvePlayer(db, guid(1), null, seeded(1));
    addCoins(db, p.id, 20);
    expect(buyItem(db, p.id, "hat-top", 12)).toBe(8);
    expect(ownsItem(db, p.id, "hat-top")).toBe(true);
    expect(ownedItems(db, p.id)).toEqual(["hat-top"]);
  });

  it("refuses buying the same item twice (and does not charge again)", () => {
    const db = fresh();
    const p = resolvePlayer(db, guid(1), null, seeded(1));
    addCoins(db, p.id, 100);
    expect(buyItem(db, p.id, "hat-top", 12)).toBe(88);
    expect(buyItem(db, p.id, "hat-top", 12)).toBeNull();
    expect(getPlayer(db, p.id)!.coins).toBe(88);
  });

  it("refuses an unaffordable purchase without recording ownership", () => {
    const db = fresh();
    const p = resolvePlayer(db, guid(1), null, seeded(1));
    addCoins(db, p.id, 5);
    expect(buyItem(db, p.id, "hat-top", 12)).toBeNull();
    expect(ownsItem(db, p.id, "hat-top")).toBe(false);
    expect(getPlayer(db, p.id)!.coins).toBe(5);
  });
});
