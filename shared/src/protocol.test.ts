import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { parseColour, parseMove } from "./messages.js";
import { cleanName, NAME_MAX, randomName } from "./names.js";

describe("parseMove", () => {
  it("rejects malformed payloads", () => {
    for (const bad of [null, 5, "x", {}, { x: 1 }, { x: NaN, y: 1 }, { x: Infinity, y: 1 }, { x: -1, y: 5 }, { x: 5, y: 99999 }]) {
      expect(parseMove(bad)).toBeNull();
    }
  });

  it("accepts any in-bounds point unchanged", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1200, noNaN: true }), fc.double({ min: 0, max: 700, noNaN: true }), (x, y) => {
        expect(parseMove({ x, y })).toEqual({ x, y });
      }),
    );
  });
});

describe("parseColour", () => {
  it("only accepts integer indexes 0-5", () => {
    expect(parseColour(0)).toBe(0);
    expect(parseColour(5)).toBe(5);
    for (const bad of [-1, 6, 1.5, "1", null, undefined]) expect(parseColour(bad)).toBeNull();
  });
});

describe("names", () => {
  it("trims and collapses whitespace", () => {
    expect(cleanName("  Misty   Wisp ")).toBe("Misty Wisp");
  });

  it("rejects empty, too long, and markup-ish names", () => {
    for (const bad of ["", "   ", "a".repeat(NAME_MAX + 1), "<script>", "a/b", 42]) expect(cleanName(bad)).toBeNull();
  });

  it("cleaned names are always within limits", () => {
    fc.assert(
      fc.property(fc.string(), (raw) => {
        const name = cleanName(raw);
        return name === null || (name.length >= 1 && name.length <= NAME_MAX && name === name.trim());
      }),
    );
  });

  it("random names are always valid", () => {
    fc.assert(fc.property(fc.double({ min: 0, max: 0.999999, noNaN: true }), (r) => cleanName(randomName(() => r)) !== null));
  });
});
