import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { MAX_FRIENDS } from "@club-kiro/shared";
import { openDb, type DB } from "./index.js";
import { resolvePlayer } from "./players.js";
import { addFriend, listFriends, playerName, removeFriend, setPlayerName } from "./friends.js";

const guid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const players = (db: DB, count: number) => Array.from({ length: count }, (_, i) => resolvePlayer(db, guid(i + 1), null).id);

describe("friends", () => {
  it("adds, lists with names, and removes", () => {
    const db = openDb(":memory:");
    const [me, them] = players(db, 2) as [number, number];
    setPlayerName(db, them, "Misty Moth");
    expect(addFriend(db, me, them)).toBe(true);
    expect(listFriends(db, me)).toEqual([{ playerId: them, name: "Misty Moth" }]);
    expect(listFriends(db, them)).toEqual([]); // one-way
    removeFriend(db, me, them);
    expect(listFriends(db, me)).toEqual([]);
  });

  it("refuses yourself and unknown players", () => {
    const db = openDb(":memory:");
    const [me] = players(db, 1) as [number];
    expect(addFriend(db, me, me)).toBe(false);
    expect(addFriend(db, me, 9999)).toBe(false);
    expect(listFriends(db, me)).toEqual([]);
  });

  it("never lists a friend twice or goes over the cap, whatever is added", () => {
    const db = openDb(":memory:");
    const ids = players(db, MAX_FRIENDS + 6);
    const me = ids[0]!;
    fc.assert(
      fc.property(fc.array(fc.constantFrom(...ids), { maxLength: 120 }), (adds) => {
        for (const id of adds) addFriend(db, me, id);
        const list = listFriends(db, me).map((f) => f.playerId);
        return new Set(list).size === list.length && list.length <= MAX_FRIENDS && !list.includes(me);
      }),
      { numRuns: 30 },
    );
  });

  it("remembers the last ghost name", () => {
    const db = openDb(":memory:");
    const [me] = players(db, 1) as [number];
    expect(playerName(db, me)).toBe("");
    setPlayerName(db, me, "Lantern Lou");
    expect(playerName(db, me)).toBe("Lantern Lou");
  });
});
