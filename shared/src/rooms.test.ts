import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  MAX_ROOM_ITEMS,
  ROOM_HEIGHT,
  ROOM_WIDTH,
  isDecorationId,
  parseMoveItem,
  parsePlacement,
  parseRemoveItem,
  parseRoomLayout,
} from "./rooms.js";

describe("isDecorationId", () => {
  it("accepts decorations, rejects hats and unknown ids", () => {
    expect(isDecorationId("dec-lantern")).toBe(true);
    expect(isDecorationId("hat-witch")).toBe(false);
    expect(isDecorationId("nope")).toBe(false);
    expect(isDecorationId(42)).toBe(false);
  });
});

describe("parsePlacement", () => {
  it("accepts an in-bounds decoration", () => {
    expect(parsePlacement({ itemId: "dec-rug", x: 100, y: 200 })).toEqual({ itemId: "dec-rug", x: 100, y: 200 });
  });

  it("rejects hats, unknown ids, and out-of-bounds points", () => {
    for (const bad of [
      null,
      {},
      { itemId: "hat-top", x: 10, y: 10 },
      { itemId: "dec-rug", x: -1, y: 10 },
      { itemId: "dec-rug", x: 10, y: ROOM_HEIGHT + 1 },
      { itemId: "dec-rug", x: NaN, y: 10 },
    ]) {
      expect(parsePlacement(bad)).toBeNull();
    }
  });
});

describe("parseMoveItem / parseRemoveItem", () => {
  it("requires a non-negative integer index", () => {
    expect(parseMoveItem({ index: 0, x: 5, y: 5 })).toEqual({ index: 0, x: 5, y: 5 });
    for (const bad of [{ index: -1, x: 5, y: 5 }, { index: 1.5, x: 5, y: 5 }, { index: 0, x: 9e9, y: 5 }]) {
      expect(parseMoveItem(bad)).toBeNull();
    }
    expect(parseRemoveItem({ index: 3 })).toEqual({ index: 3 });
    expect(parseRemoveItem({ index: -1 })).toBeNull();
  });
});

describe("parseRoomLayout", () => {
  it("drops invalid entries and caps the count", () => {
    const layout = parseRoomLayout([
      { itemId: "dec-rug", x: 10, y: 10 },
      { itemId: "hat-top", x: 10, y: 10 }, // hat -> dropped
      { itemId: "dec-candle", x: -5, y: 10 }, // out of bounds -> dropped
      "junk",
    ]);
    expect(layout).toEqual([{ itemId: "dec-rug", x: 10, y: 10 }]);
  });

  it("never exceeds MAX_ROOM_ITEMS and only keeps valid decorations", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            itemId: fc.constantFrom("dec-lantern", "dec-rug", "hat-top", "bogus"),
            x: fc.double({ min: -100, max: ROOM_WIDTH + 100, noNaN: true }),
            y: fc.double({ min: -100, max: ROOM_HEIGHT + 100, noNaN: true }),
          }),
          { maxLength: 80 },
        ),
        (raw) => {
          const layout = parseRoomLayout(raw);
          return (
            layout.length <= MAX_ROOM_ITEMS &&
            layout.every(
              (i) => isDecorationId(i.itemId) && i.x >= 0 && i.x <= ROOM_WIDTH && i.y >= 0 && i.y <= ROOM_HEIGHT,
            )
          );
        },
      ),
    );
  });

  it("returns an empty array for non-arrays", () => {
    for (const bad of [null, undefined, 5, {}, "x"]) expect(parseRoomLayout(bad)).toEqual([]);
  });
});
