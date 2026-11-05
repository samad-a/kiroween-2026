import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { HAUNTED_ROOM, ROOM } from "@club-kiro/shared";
import { createServer } from "./app.js";
import type { HauntedRoom } from "./HauntedRoom.js";
import { openDb } from "./db/index.js";
import { setDb } from "./db/shared.js";
import { addCoins, buyItem, resolvePlayer } from "./db/players.js";
import { getLayout } from "./db/rooms.js";

let colyseus: ColyseusTestServer;

beforeAll(async () => {
  colyseus = await boot(createServer(), 2603);
});
afterAll(async () => {
  await colyseus.shutdown();
});
beforeEach(async () => {
  await colyseus.cleanup();
  setDb(openDb(":memory:"));
});

async function until(check: () => boolean, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > deadline) throw new Error("Timed out");
    await new Promise((r) => setTimeout(r, 10));
  }
}

const guid = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

/** Create an owner player with a decoration to place. */
function makeOwner(): number {
  const db = openDb(":memory:");
  setDb(db);
  const p = resolvePlayer(db, guid(1), null);
  addCoins(db, p.id, 100);
  buyItem(db, p.id, "dec-lantern", 15);
  return p.id;
}

describe("HauntedRoom", () => {
  it("lets the owner place a decoration and persists it", async () => {
    const ownerId = makeOwner();
    const room = await colyseus.createRoom<HauntedRoom>(HAUNTED_ROOM, { ownerPlayerId: ownerId });
    room.autoDispose = false;
    // Join as the owner (same guest id resolves to the same player).
    const client = await colyseus.connectTo(room, { guestId: guid(1) });
    await until(() => room.state.ghosts.has(client.sessionId));

    client.send(ROOM.place, { itemId: "dec-lantern", x: 200, y: 300 });
    await until(() => room.state.items.length === 1);
    expect(room.state.items[0]!.itemId).toBe("dec-lantern");
    expect(getLayout(room.db, ownerId)).toEqual([{ itemId: "dec-lantern", x: 200, y: 300 }]);
  });

  it("ignores edit intents from a visitor", async () => {
    const ownerId = makeOwner();
    const room = await colyseus.createRoom<HauntedRoom>(HAUNTED_ROOM, { ownerPlayerId: ownerId });
    room.autoDispose = false;
    // A different guest id -> a different player -> a visitor.
    const visitor = await colyseus.connectTo(room, { guestId: guid(2) });
    await until(() => room.state.ghosts.has(visitor.sessionId));

    visitor.send(ROOM.place, { itemId: "dec-lantern", x: 50, y: 50 });
    // Give the server a moment; the edit must not take effect.
    await new Promise((r) => setTimeout(r, 200));
    expect(room.state.items.length).toBe(0);
  });

  it("reloads a saved layout when the room is recreated", async () => {
    const ownerId = makeOwner();
    const first = await colyseus.createRoom<HauntedRoom>(HAUNTED_ROOM, { ownerPlayerId: ownerId });
    first.autoDispose = false;
    const owner = await colyseus.connectTo(first, { guestId: guid(1) });
    await until(() => first.state.ghosts.has(owner.sessionId));
    owner.send(ROOM.place, { itemId: "dec-lantern", x: 111, y: 222 });
    await until(() => first.state.items.length === 1);

    // A freshly created room for the same owner loads the saved layout.
    const second = await colyseus.createRoom<HauntedRoom>(HAUNTED_ROOM, { ownerPlayerId: ownerId });
    expect(second.state.items.length).toBe(1);
    expect(second.state.items[0]!.x).toBe(111);
  });
});
