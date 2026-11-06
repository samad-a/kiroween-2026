import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import {
  FISH,
  FISH_EVENT,
  PLAZA_ROOM,
  AREAS,
  FISH_SPOT,
  getShopItem,
  priceOf,
  SHOP,
  SHOP_EVENT,
  type FishEnded,
  type ShopBought,
  type ShopDenied,
} from "@club-kiro/shared";
import { createServer } from "./app.js";
import type { PlazaRoom } from "./PlazaRoom.js";
import { openDb } from "./db/index.js";
import { setDb } from "./db/shared.js";
import { addCoins, getPlayer } from "./db/players.js";

let colyseus: ColyseusTestServer;

beforeAll(async () => {
  colyseus = await boot(createServer(), 2601);
});
afterAll(async () => {
  await colyseus.shutdown();
});
beforeEach(async () => {
  await colyseus.cleanup();
  setDb(openDb(":memory:")); // fresh, isolated database per test
});

async function until(check: () => boolean, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > deadline) throw new Error("Timed out");
    await new Promise((r) => setTimeout(r, 10));
  }
}

describe("fishing round", () => {
  it("credits the sum of catches exactly once when the round ends", async () => {
    // Fishing is on the lighthouse jetty.
    const room = await colyseus.createRoom<PlazaRoom>(AREAS.lighthouse.room, { area: "lighthouse" });
    room.autoDispose = false;
    const client = await colyseus.connectTo(room, { name: "Angler" });
    await until(() => room.state.ghosts.has(client.sessionId));
    const ghost = room.state.ghosts.get(client.sessionId)!;
    ghost.x = FISH_SPOT.x;
    ghost.y = FISH_SPOT.y;

    const playerId = (room as unknown as { playerIds: Map<string, number> }).playerIds.get(client.sessionId)!;
    const start = getPlayer(room.db, playerId)!.coins; // the daily gift

    let ended: FishEnded | undefined;
    client.onMessage(FISH_EVENT.ended, (e: FishEnded) => (ended = e));

    client.send(FISH.start, {});
    await room.waitForMessage(FISH.start);

    // Three casts; cooldown is honoured via the lastCastAt reset between sends.
    const round = (room as unknown as { rounds: Map<string, { earned: number; lastCastAt: number }> }).rounds;
    for (let i = 0; i < 3; i++) {
      round.get(client.sessionId)!.lastCastAt = 0; // bypass the 800ms gap in the test
      client.send(FISH.cast, { accuracy: 0.5 });
      await room.waitForMessage(FISH.cast);
    }
    const earned = round.get(client.sessionId)!.earned;
    expect(earned).toBeGreaterThan(0);

    client.send(FISH.end, {});
    await until(() => ended !== undefined);
    expect(ended!.coinsEarned).toBe(earned);
    expect(ended!.balance).toBe(start + earned);

    // A second end is a no-op: no further credit.
    client.send(FISH.end, {});
    await room.waitForMessage(FISH.end);
    expect(ended!.balance).toBe(start + earned);
  });

  it("ignores casts with no active round", async () => {
    const room = await colyseus.createRoom<PlazaRoom>(PLAZA_ROOM);
    const client = await colyseus.connectTo(room, {});
    await until(() => room.state.ghosts.has(client.sessionId));
    client.send(FISH.cast, { accuracy: 1 });
    await room.waitForMessage(FISH.cast);
    const round = (room as unknown as { rounds: Map<string, unknown> }).rounds;
    expect(round.has(client.sessionId)).toBe(false);
  });
});

describe("shop buy", () => {
  it("buys an affordable item and refuses a repeat purchase", async () => {
    const room = await colyseus.createRoom<PlazaRoom>(PLAZA_ROOM);
    room.autoDispose = false;
    const client = await colyseus.connectTo(room, {});
    await until(() => room.state.ghosts.has(client.sessionId));

    // Give the player coins directly through the repo the room uses.
    const playerId = (room as unknown as { playerIds: Map<string, number> }).playerIds.get(client.sessionId)!;
    const balance = addCoins(room.db, playerId, 100)!;

    let bought: ShopBought | undefined;
    let denied: ShopDenied | undefined;
    client.onMessage(SHOP_EVENT.bought, (b: ShopBought) => (bought = b));
    client.onMessage(SHOP_EVENT.denied, (d: ShopDenied) => (denied = d));

    client.send(SHOP.buy, { itemId: "hat-witch" }); // price 20, less if featured this week
    await until(() => bought !== undefined);
    expect(bought!.balance).toBe(balance - priceOf(getShopItem("hat-witch")!, Date.now()));

    client.send(SHOP.buy, { itemId: "hat-witch" });
    await until(() => denied !== undefined);
    expect(denied!.reason).toBe("owned");
  });

  it("refuses an unaffordable item", async () => {
    const room = await colyseus.createRoom<PlazaRoom>(PLAZA_ROOM);
    const client = await colyseus.connectTo(room, {});
    await until(() => room.state.ghosts.has(client.sessionId));

    let denied: ShopDenied | undefined;
    client.onMessage(SHOP_EVENT.denied, (d: ShopDenied) => (denied = d));
    client.send(SHOP.buy, { itemId: "hat-jack" }); // price 80, player has 0
    await until(() => denied !== undefined);
    expect(denied!.reason).toBe("cost");
  });
});
