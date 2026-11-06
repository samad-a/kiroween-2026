import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  RUNES,
  SEANCE_COINS_PER_ROUND,
  SEANCE_MAX_ROUNDS,
  extendSequence,
  parseSeanceAnswer,
  seanceReward,
  sequenceMatches,
} from "./seance.js";

const rune = fc.integer({ min: 0, max: RUNES.length - 1 });
const sequence = fc.array(rune, { minLength: 1, maxLength: SEANCE_MAX_ROUNDS });

describe("séance", () => {
  it("extending adds exactly one valid rune and keeps the rest", () => {
    fc.assert(
      fc.property(fc.array(rune), fc.double({ min: 0, max: 1, noNaN: true }), (seq, r) => {
        const next = extendSequence(seq, () => r);
        const added = next[next.length - 1]!;
        return next.length === seq.length + 1 && sequenceMatches(seq, next.slice(0, -1)) && added >= 0 && added < RUNES.length;
      }),
    );
  });

  it("the right answer always matches; any changed or shortened answer never does", () => {
    fc.assert(
      fc.property(sequence, fc.nat(), (seq, at) => {
        const i = at % seq.length;
        const changed = [...seq];
        changed[i] = (changed[i]! + 1) % RUNES.length;
        return sequenceMatches(seq, [...seq]) && !sequenceMatches(seq, changed) && !sequenceMatches(seq, seq.slice(0, -1));
      }),
    );
  });

  it("pays per cleared round and never more than a perfect séance", () => {
    fc.assert(fc.property(fc.integer({ min: -5, max: 100 }), (n) => seanceReward(n) <= SEANCE_MAX_ROUNDS * SEANCE_COINS_PER_ROUND && seanceReward(n) >= 0));
    expect(seanceReward(3)).toBe(3 * SEANCE_COINS_PER_ROUND);
  });

  it("rejects malformed answers", () => {
    expect(parseSeanceAnswer({ answer: [0, 1, 3] })).toEqual([0, 1, 3]);
    expect(parseSeanceAnswer({ answer: [4] })).toBeNull();
    expect(parseSeanceAnswer({ answer: [1.5] })).toBeNull();
    expect(parseSeanceAnswer({ answer: "0,1" })).toBeNull();
    expect(parseSeanceAnswer({ answer: new Array(SEANCE_MAX_ROUNDS + 1).fill(0) })).toBeNull();
    expect(parseSeanceAnswer(null)).toBeNull();
  });
});
