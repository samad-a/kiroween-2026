import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import fc from "fast-check";
import { MAX_GHOSTS_PER_PLAZA, PLAZA_ROOM, hitsObstacle } from "@club-kiro/shared";
import { createServer } from "./app.js";
import { PlazaRoom, spawnPoint } from "./PlazaRoom.js";
import { openDb } from "./db/index.js";
import { setDb } from "./db/shared.js";

let colyseus: ColyseusTestServer;

beforeAll(async () => {
  setDb(openDb(":memory:")); // hermetic: never touch the on-disk database in tests
  colyseus = await boot(createServer(), 2599);
});
afterAll(async () => {
  await colyseus.shutdown();
});
beforeEach(async () => {
  await colyseus.cleanup();
});

/** Poll until `check` is true, or fail after `timeoutMs`. */
async function until(check: () => boolean, timeoutMs = 2000, explain?: () => string): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for condition${explain ? `: ${explain()}` : ""}`);
    await new Promise((r) => setTimeout(r, 10));
  }
}

describe("PlazaRoom", () => {
  it("adds a ghost on join with a cleaned name, and removes it on leave", async () => {
    const room = await colyseus.createRoom<PlazaRoom>(PLAZA_ROOM);
    room.autoDispose = false; // keep the room alive after the last client leaves
    const client = await colyseus.connectTo(room, { name: "  Misty  Wisp ", colour: 2 });

    await until(() => room.state.ghosts.has(client.sessionId));
    const ghost = room.state.ghosts.get(client.sessionId);
    expect(ghost?.name).toBe("Misty Wisp");
    expect(ghost?.colour).toBe(2);

    await client.leave();
    await until(() => room.state.ghosts.size === 0);
  });

  it("replaces an invalid name and colour with safe defaults", async () => {
    const room = await colyseus.createRoom<PlazaRoom>(PLAZA_ROOM);
    const client = await colyseus.connectTo(room, { name: "<script>", colour: 99 });
    await until(() => room.state.ghosts.has(client.sessionId));

    const ghost = room.state.ghosts.get(client.sessionId)!;
    expect(ghost.name).not.toContain("<");
    expect(ghost.colour).toBeLessThan(6);
  });

  it("moves a ghost toward its target, and ignores invalid moves", async () => {
    const room = await colyseus.createRoom<PlazaRoom>(PLAZA_ROOM);
    room.setSimulationInterval(); // drive ticks manually
    const client = await colyseus.connectTo(room, {});
    await until(() => room.state.ghosts.has(client.sessionId));
    const ghost = room.state.ghosts.get(client.sessionId)!;
    const start = { x: ghost.x, y: ghost.y };

    client.send("move", { x: Number.NaN, y: 10 });
    await room.waitForMessage("move");
    client.send("move", { x: 99999, y: 10 });
    await room.waitForMessage("move");
    room.tick(1);
    expect({ x: ghost.x, y: ghost.y }).toEqual(start);

    client.send("move", { x: 100, y: start.y });
    await room.waitForMessage("move");
    room.tick(0.1);
    expect(ghost.x).toBeLessThan(start.x);
  });

  it("opens a second plaza when the first is full", async () => {
    const clients = [];
    for (let i = 0; i <= MAX_GHOSTS_PER_PLAZA; i++) {
      clients.push(await colyseus.sdk.joinOrCreate(PLAZA_ROOM, {}));
    }
    expect(new Set(clients.map((c) => c.roomId)).size).toBe(2);
    await Promise.all(clients.map((c) => c.leave()));
  });

  it("every client converges to the server state after any sequence of moves", async () => {
    const room = await colyseus.createRoom<PlazaRoom>(PLAZA_ROOM);
    room.setSimulationInterval(); // only the test advances the world
    room.maxMessagesPerSecond = Infinity; // the test sends far faster than a person; don't trip the spam guard
    const clients = [await colyseus.connectTo(room, { name: "A" }), await colyseus.connectTo(room, { name: "B" })];
    const ids = clients.map((c) => c.sessionId);

    const inSync = () =>
      ids.every((id) => {
        const server = room.state.ghosts.get(id);
        return (
          server !== undefined &&
          clients.every((c) => {
            const seen = c.state.ghosts?.get(id);
            return seen !== undefined && seen.x === server.x && seen.y === server.y;
          })
        );
      });

    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            who: fc.integer({ min: 0, max: 1 }),
            x: fc.integer({ min: 0, max: 1200 }),
            y: fc.integer({ min: 0, max: 700 }),
            dt: fc.double({ min: 0.01, max: 0.5, noNaN: true }),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        async (moves) => {
          for (const m of moves) {
            clients[m.who]!.send("move", { x: m.x, y: m.y });
            await room.waitForMessage("move");
            room.tick(m.dt);
          }
          await until(inSync, 2000, () =>
            JSON.stringify(
              ids.map((id) => ({
                server: room.state.ghosts.get(id)?.toJSON(),
                clients: clients.map((c) => c.state.ghosts?.get(id)?.toJSON?.() ?? null),
              })),
            ),
          );
        },
      ),
      { numRuns: 15 },
    );
  });
});

describe("midnight haunting", () => {
  it("turns the haunting flag on and is idempotent while active", async () => {
    const room = await colyseus.createRoom<PlazaRoom>(PLAZA_ROOM);
    room.autoDispose = false;
    expect(room.state.haunting).toBe(false);
    room.startHaunting();
    expect(room.state.haunting).toBe(true);
    // Calling again while active does not reset or stack the event.
    room.startHaunting();
    expect(room.state.haunting).toBe(true);
    // The flag is cleared by clock.setTimeout after HAUNTING_DURATION_MS (not waited on here).
  });
});

describe("spawnPoint", () => {
  it("never spawns inside a prop", () => {
    fc.assert(fc.property(fc.double({ min: 0, max: 0.9999, noNaN: true }), (r) => !hitsObstacle(spawnPoint(() => r))));
  });
});
