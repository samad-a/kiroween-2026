import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { CATCHES, getCatch, parseCast } from "./fishing.js";
import { getShopItem, parseBuy, SHOP_ITEMS } from "./shop.js";

describe("parseCast", () => {
  it("clamps accuracy to 0..1", () => {
    expect(parseCast({ accuracy: 1.7 })).toEqual({ accuracy: 1 });
    expect(parseCast({ accuracy: -0.5 })).toEqual({ accuracy: 0 });
    expect(parseCast({ accuracy: 0.4 })).toEqual({ accuracy: 0.4 });
  });

  it("rejects malformed payloads", () => {
    for (const bad of [null, 5, "x", {}, { accuracy: "1" }, { accuracy: NaN }, { accuracy: Infinity }]) {
      expect(parseCast(bad)).toBeNull();
    }
  });

  it("always returns an accuracy within 0..1 for any finite number", () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true, noDefaultInfinity: true }), (n) => {
        const r = parseCast({ accuracy: n });
        return r !== null && r.accuracy >= 0 && r.accuracy <= 1;
      }),
    );
  });
});

describe("catch table", () => {
  it("looks up every catch by id with its listed coins", () => {
    for (const c of CATCHES) expect(getCatch(c.id)).toEqual(c);
  });
});

describe("parseBuy", () => {
  it("accepts known catalogue ids only", () => {
    expect(parseBuy({ itemId: "hat-witch" })).toEqual({ itemId: "hat-witch" });
    for (const bad of [null, 5, {}, { itemId: 7 }, { itemId: "not-an-item" }]) expect(parseBuy(bad)).toBeNull();
  });
});

describe("shop catalogue", () => {
  it("has about 6 hats and about 6 decorations, all with unique ids and positive prices", () => {
    const hats = SHOP_ITEMS.filter((i) => i.kind === "hat");
    const decs = SHOP_ITEMS.filter((i) => i.kind === "decoration");
    expect(hats.length).toBeGreaterThanOrEqual(6);
    expect(decs.length).toBeGreaterThanOrEqual(6);
    expect(new Set(SHOP_ITEMS.map((i) => i.id)).size).toBe(SHOP_ITEMS.length);
    for (const i of SHOP_ITEMS) {
      expect(i.price).toBeGreaterThan(0);
      expect(getShopItem(i.id)).toBe(i);
    }
  });
});
