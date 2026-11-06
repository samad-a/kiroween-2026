import { describe, expect, it } from "vitest";
import { AREAS, AREA_IDS, arrivalPoint, exitAt } from "./areas.js";
import { clampToPlaza, hitsObstacle } from "./movement.js";
import { PET_ITEMS, parsePetId } from "./pets.js";
import { getShopItem } from "./shop.js";

describe("public areas", () => {
  it("every exit leads to an area with an exit back", () => {
    for (const id of AREA_IDS) {
      for (const exit of AREAS[id].exits) {
        expect(AREAS[exit.to].exits.some((e) => e.to === id)).toBe(true);
      }
    }
  });

  it("you always arrive somewhere walkable, and not standing in an exit", () => {
    for (const id of AREA_IDS) {
      const walk = AREAS[id].walk;
      const sources = [undefined, ...AREAS[id].exits.map((e) => e.to)];
      for (const from of sources) {
        const p = arrivalPoint(id, from);
        expect(clampToPlaza(p, walk.top)).toEqual(p);
        expect(hitsObstacle(p, walk.obstacles)).toBe(false);
        if (from) expect(exitAt(id, p)).toBeUndefined();
      }
    }
  });

  it("every exit can actually be reached on foot", () => {
    for (const id of AREA_IDS) {
      const walk = AREAS[id].walk;
      for (const exit of AREAS[id].exits) {
        const p = clampToPlaza({ x: exit.x, y: exit.y }, walk.top);
        expect(exitAt(id, p)?.to).toBe(exit.to);
        expect(hitsObstacle(p, walk.obstacles)).toBe(false);
      }
    }
  });
});

describe("pets", () => {
  it("every pet is a shop item of kind pet whose id parses back", () => {
    expect(PET_ITEMS.length).toBe(9);
    for (const pet of PET_ITEMS) {
      expect(getShopItem(pet.id)?.kind).toBe("pet");
      expect(parsePetId(pet.id)).not.toBeNull();
    }
    expect(parsePetId("pet-dragon-plum")).toBeNull();
    expect(parsePetId("hat-witch")).toBeNull();
  });
});
