import { describe, expect, it } from "vitest";
import { openDb, type DB } from "./index.js";
import { addCoins, buyItem, resolvePlayer } from "./players.js";
import { getLayout, saveLayout } from "./rooms.js";

const guid = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const seeded = (seed: number) => {
  let s = seed;
  return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
};

function playerWithDecor(db: DB): number {
  const p = resolvePlayer(db, guid(1), null, seeded(1));
  addCoins(db, p.id, 200);
  buyItem(db, p.id, "dec-lantern", 15);
  buyItem(db, p.id, "dec-rug", 20);
  return p.id;
}

describe("rooms repository", () => {
  it("round-trips a saved layout", () => {
    const db = openDb(":memory:");
    const id = playerWithDecor(db);
    const saved = saveLayout(db, id, [
      { itemId: "dec-lantern", x: 100, y: 100 },
      { itemId: "dec-rug", x: 300, y: 400 },
    ]);
    expect(saved).toHaveLength(2);
    expect(getLayout(db, id)).toEqual(saved);
  });

  it("returns an empty room for a player who has never decorated", () => {
    const db = openDb(":memory:");
    const p = resolvePlayer(db, guid(2), null, seeded(2));
    expect(getLayout(db, p.id)).toEqual([]);
  });

  it("drops items the player does not own", () => {
    const db = openDb(":memory:");
    const id = playerWithDecor(db); // owns dec-lantern, dec-rug
    const saved = saveLayout(db, id, [
      { itemId: "dec-lantern", x: 10, y: 10 },
      { itemId: "dec-cauldron", x: 20, y: 20 }, // not bought -> dropped
    ]);
    expect(saved).toEqual([{ itemId: "dec-lantern", x: 10, y: 10 }]);
  });

  it("overwrites a previous layout", () => {
    const db = openDb(":memory:");
    const id = playerWithDecor(db);
    saveLayout(db, id, [{ itemId: "dec-lantern", x: 1, y: 1 }]);
    saveLayout(db, id, [{ itemId: "dec-rug", x: 2, y: 2 }]);
    expect(getLayout(db, id)).toEqual([{ itemId: "dec-rug", x: 2, y: 2 }]);
  });
});
