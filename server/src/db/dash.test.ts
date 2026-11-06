import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { openDb } from "./index.js";
import { resolvePlayer } from "./players.js";
import { getRecords, recordFinish } from "./dash.js";

const guid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("dash records", () => {
  it("keeps the fastest time per track, whatever order runs come in", () => {
    fc.assert(
      fc.property(fc.array(fc.tuple(fc.constantFrom("lane", "marsh", "crypt" as const), fc.integer({ min: 1, max: 200_000 })), { minLength: 1, maxLength: 30 }), (runs) => {
        const db = openDb(":memory:");
        const me = resolvePlayer(db, guid(1), null).id;
        const best: Record<string, number> = {};
        for (const [map, ms] of runs) {
          const r = recordFinish(db, me, map, ms);
          const expectedNew = best[map] === undefined || ms < best[map]!;
          if (r.newRecord !== expectedNew) return false;
          best[map] = Math.min(best[map] ?? Infinity, ms);
          if (r.bestMs !== best[map]) return false;
        }
        return JSON.stringify(getRecords(db, me)) === JSON.stringify(Object.fromEntries(Object.entries(getRecords(db, me)).map(([k]) => [k, best[k]])));
      }),
      { numRuns: 40 },
    );
  });

  it("records are per player", () => {
    const db = openDb(":memory:");
    const a = resolvePlayer(db, guid(1), null).id;
    const b = resolvePlayer(db, guid(2), null).id;
    recordFinish(db, a, "lane", 30_000);
    expect(getRecords(db, a)).toEqual({ lane: 30_000 });
    expect(getRecords(db, b)).toEqual({});
  });
});
