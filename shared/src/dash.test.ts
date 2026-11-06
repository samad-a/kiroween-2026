import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  BOOST_MULT,
  DASH_MAP_IDS,
  DASH_SPEED,
  PLACE_COINS,
  RECORD_BONUS,
  SOLO_COINS,
  dashPayout,
  formatRaceTime,
  parseIntent,
  solidAt,
  startPosition,
  stepRacer,
  track,
  type RacerState,
} from "./dash.js";

/** Grid search from the start line to the finish, with every gate shut (the slow way must exist). */
function finishable(id: (typeof DASH_MAP_IDS)[number]): boolean {
  const t = track(id);
  const step = 15;
  const key = (x: number, y: number) => `${x},${y}`;
  const start = startPosition(0, 1);
  const queue: [number, number][] = [[Math.round(start.x / step) * step, Math.round(start.y / step) * step]];
  const seen = new Set(queue.map(([x, y]) => key(x, y)));
  while (queue.length) {
    const [x, y] = queue.shift()!;
    if (x >= t.finishX) return true;
    for (const [dx, dy] of [[step, 0], [0, step], [0, -step], [-step, 0]]) {
      const nx = x + dx!;
      const ny = y + dy!;
      if (seen.has(key(nx, ny)) || solidAt(t, { x: nx, y: ny }, 0, "shut")) continue;
      seen.add(key(nx, ny));
      queue.push([nx, ny]);
    }
  }
  return false;
}

describe("Graveyard Dash tracks", () => {
  it.each(DASH_MAP_IDS)("%s can always be finished, even with every gate shut", (id) => {
    expect(finishable(id)).toBe(true);
  });

  it.each(DASH_MAP_IDS)("%s has every kind of challenge", (id) => {
    const t = track(id);
    for (const list of [t.tombstones, t.gates, t.mud, t.pads, t.wisps, t.bats]) expect(list.length).toBeGreaterThan(0);
  });

  it("start positions are clear", () => {
    for (const id of DASH_MAP_IDS) for (let n = 1; n <= 4; n++) for (let i = 0; i < n; i++) expect(solidAt(track(id), startPosition(i, n), 0)).toBe(false);
  });
});

describe("racer movement", () => {
  const intent = fc.oneof(
    fc.record({ dx: fc.integer({ min: -1, max: 1 }), dy: fc.integer({ min: -1, max: 1 }) }),
    fc.record({ target: fc.record({ x: fc.integer({ min: 0, max: 5000 }), y: fc.integer({ min: 0, max: 700 }) }) }),
  );
  const steps = fc.array(fc.tuple(intent, fc.double({ min: 0.01, max: 0.1, noNaN: true })), { maxLength: 80 });

  it("never goes faster than a boosted racer, and never ends inside a tombstone or wall", () => {
    fc.assert(
      fc.property(fc.constantFrom(...DASH_MAP_IDS), steps, (id, moves) => {
        const t = track(id);
        const s: RacerState = { ...startPosition(0, 1), boostUntil: 0, stunUntil: 0 };
        const wisps: number[] = [];
        let ms = 0;
        for (const [i, dt] of moves) {
          const before = { x: s.x, y: s.y };
          stepRacer(t, s, i, dt, ms, wisps);
          ms += dt * 1000;
          const moved = Math.hypot(s.x - before.x, s.y - before.y);
          // Knockback from a bat can push you back a little on top of moving.
          if (moved > DASH_SPEED * BOOST_MULT * dt + 60) return false;
          if (solidAt(t, s, ms, "open")) return false;
        }
        return true;
      }),
      { numRuns: 60 },
    );
  });
});

describe("rewards and parsing", () => {
  it("pays by place, less for solo, plus a record bonus", () => {
    expect(dashPayout(1, 4, false)).toBe(PLACE_COINS[0]);
    expect(dashPayout(4, 4, true)).toBe(PLACE_COINS[3] + RECORD_BONUS);
    expect(dashPayout(1, 1, false)).toBe(SOLO_COINS);
    expect(dashPayout(1, 1, false)).toBeLessThan(dashPayout(1, 2, false));
    expect(dashPayout(null, 3, true)).toBe(0);
  });

  it("formats times and rejects bad intents", () => {
    expect(formatRaceTime(65_432)).toBe("1:05.43");
    expect(parseIntent({ dx: 5, dy: -1 })).toEqual({ dx: 1, dy: -1 });
    expect(parseIntent({ x: 10, y: 20 })).toEqual({ target: { x: 10, y: 20 } });
    expect(parseIntent({ dx: "a" })).toBeNull();
    expect(parseIntent(null)).toBeNull();
  });
});
