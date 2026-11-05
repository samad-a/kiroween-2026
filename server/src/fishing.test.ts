import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { CATCHES, type CatchId } from "@club-kiro/shared";
import { rollCatch } from "./fishing.js";

// A seeded PRNG so distributions are reproducible.
const seeded = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
};

describe("rollCatch", () => {
  it("always returns a catch from the table", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 0.999999, noNaN: true }), (acc, r) => {
        const c = rollCatch(acc, () => r);
        return CATCHES.some((x) => x.id === c.id) && c.coins > 0;
      }),
    );
  });

  it("at zero accuracy, the distribution roughly matches the base weights", () => {
    const rnd = seeded(12345);
    const counts: Record<CatchId, number> = { pumpkin: 0, bones: 0, "spooky-fish": 0 };
    const N = 20_000;
    for (let i = 0; i < N; i++) counts[rollCatch(0, rnd).id] += 1;
    // Base weights 50/35/15 -> expected fractions. Allow a few % tolerance.
    expect(counts.pumpkin / N).toBeCloseTo(0.5, 1);
    expect(counts.bones / N).toBeCloseTo(0.35, 1);
    expect(counts["spooky-fish"] / N).toBeCloseTo(0.15, 1);
  });

  it("higher accuracy raises the chance of the rare spooky fish", () => {
    const rare = (acc: number): number => {
      const rnd = seeded(999);
      let hits = 0;
      const N = 20_000;
      for (let i = 0; i < N; i++) if (rollCatch(acc, rnd).id === "spooky-fish") hits += 1;
      return hits / N;
    };
    expect(rare(1)).toBeGreaterThan(rare(0));
  });
});
