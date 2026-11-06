import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { GHOST_RADIUS, GHOST_SPEED, PLAZA_HEIGHT, PLAZA_WALK_TOP, PLAZA_WIDTH } from "./constants.js";
import { clampToPlaza, hitsObstacle, keysToTarget, stepGhost, type Point } from "./movement.js";

const anyPoint = fc.record({
  x: fc.double({ min: -5000, max: 5000, noNaN: true }),
  y: fc.double({ min: -5000, max: 5000, noNaN: true }),
});

/** A legal ghost position: inside the plaza and not inside a prop. */
const validPoint = anyPoint
  .map((p) => clampToPlaza(p))
  .filter((p) => !hitsObstacle(p));

const dt = fc.double({ min: 0, max: 0.5, noNaN: true });

/** Inside the walkable square: never up among the houses. */
const inPlaza = (p: Point): boolean =>
  p.x >= GHOST_RADIUS &&
  p.x <= PLAZA_WIDTH - GHOST_RADIUS &&
  p.y >= PLAZA_WALK_TOP &&
  p.y <= PLAZA_HEIGHT - GHOST_RADIUS;

describe("movement", () => {
  it("clampToPlaza always lands inside the plaza", () => {
    fc.assert(fc.property(anyPoint, (p) => inPlaza(clampToPlaza(p))));
  });

  it("a ghost never leaves the plaza or enters a prop, whatever the moves", () => {
    fc.assert(
      fc.property(validPoint, fc.array(fc.tuple(anyPoint, dt), { maxLength: 60 }), (start, moves) => {
        let pos = start;
        for (const [target, step] of moves) {
          pos = stepGhost(pos, target, step);
          if (!inPlaza(pos) || hitsObstacle(pos)) return false;
        }
        return true;
      }),
    );
  });

  it("never moves further than speed allows in one step", () => {
    fc.assert(
      fc.property(validPoint, anyPoint, dt, (start, target, step) => {
        const next = stepGhost(start, target, step);
        return Math.hypot(next.x - start.x, next.y - start.y) <= GHOST_SPEED * step + 1e-6;
      }),
    );
  });

  it("does not overshoot a reachable target", () => {
    const next = stepGhost({ x: 100, y: 500 }, { x: 110, y: 500 }, 10);
    expect(next).toEqual({ x: 110, y: 500 });
  });

  it("refuses a step into the fountain", () => {
    const start = { x: 500, y: 350 };
    expect(stepGhost(start, { x: 600, y: 350 }, 10)).toEqual(start);
  });

  it("keysToTarget stays inside the plaza", () => {
    fc.assert(
      fc.property(validPoint, fc.integer({ min: -1, max: 1 }), fc.integer({ min: -1, max: 1 }), (p, dx, dy) =>
        inPlaza(keysToTarget(p, dx, dy)),
      ),
    );
  });
});
