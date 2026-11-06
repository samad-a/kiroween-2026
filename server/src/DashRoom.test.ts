import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { DASH, DASH_EVENT, DASH_GATE, DASH_ROOM, PLAZA_ROOM, track, type DashResults, type DashStart } from "@club-kiro/shared";
import { createServer } from "./app.js";
import type { DashRoom } from "./DashRoom.js";
import type { PlazaRoom } from "./PlazaRoom.js";
import { openDb } from "./db/index.js";
import { setDb } from "./db/shared.js";
import { resolvePlayer } from "./db/players.js";
import { getRecords } from "./db/dash.js";

let colyseus: ColyseusTestServer;
const guid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const until = async (ok: () => boolean, ms = 3000) => {
  const end = Date.now() + ms;
  while (!ok()) {
    if (Date.now() > end) throw new Error("timed out");
    await new Promise((r) => setTimeout(r, 20));
  }
};

beforeAll(async () => {
  setDb(openDb(":memory:"));
  colyseus = await boot(createServer(), 2603);
});
afterAll(async () => {
  await colyseus.shutdown();
});

describe("Graveyard Dash", () => {
  it("racing alone from the gate opens a race room on a real track and sends you there", async () => {
    const plaza = await colyseus.createRoom<PlazaRoom>(PLAZA_ROOM, {});
    const client = await colyseus.connectTo(plaza, { guestId: guid(1), name: "Dasher" });
    let start: DashStart | undefined;
    client.onMessage(DASH_EVENT.start, (m: DashStart) => (start = m));
    client.onMessage(DASH_EVENT.queue, () => {});
    // Stand at the gate (positions are server-owned; tests may set them).
    const ghost = plaza.state.ghosts.get(client.sessionId)!;
    ghost.x = DASH_GATE.x;
    ghost.y = DASH_GATE.y;
    client.send(DASH.solo);
    await until(() => start !== undefined);
    expect(track(start!.map).finishX).toBeGreaterThan(1000);
    expect(colyseus.getRoomById(start!.roomId)).toBeDefined();
  });

  it("only the queued players may join, and a finish pays coins and saves a record", async () => {
    const db = openDb(":memory:");
    setDb(db);
    const me = resolvePlayer(db, guid(5), null).id;
    const room = (await colyseus.createRoom(DASH_ROOM, { map: "lane", playerIds: [me] })) as unknown as DashRoom;
    room.db = db;
    room.autoDispose = false; // the refused join below would otherwise dispose the empty room
    await expect(colyseus.connectTo(room as never, { guestId: guid(6), name: "Stranger" })).rejects.toThrow();

    const racer = await colyseus.connectTo(room as never, { guestId: guid(5), name: "Racer" });
    let results: DashResults | undefined;
    racer.onMessage(DASH_EVENT.results, (r: DashResults) => (results = r));
    // Skip the countdown and teleport to the line: we're testing the finish, not the driving.
    await until(() => room.state.phase === "countdown" && room.state.racers.size === 1);
    (room as unknown as { startedAt: number }).startedAt = Date.now() - 10_000;
    room.state.racers.get(racer.sessionId)!.x = track("lane").finishX + 1;
    room.tick(0.033);
    await until(() => results !== undefined);
    expect(results!.coins).toBeGreaterThan(0);
    expect(results!.newRecord).toBe(true);
    expect(getRecords(db, me).lane).toBeGreaterThan(0);
  });
});
