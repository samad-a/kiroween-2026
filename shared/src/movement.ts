import {
  GHOST_RADIUS,
  GHOST_SPEED,
  KEY_TARGET_DISTANCE,
  OBSTACLES,
  PLAZA_HEIGHT,
  PLAZA_WALK_TOP,
  PLAZA_WIDTH,
  ROOM_WALK_TOP,
  type Rect,
} from "./constants.js";

export interface Point {
  x: number;
  y: number;
}

/** Where ghosts may walk: a top edge (the floor line) and solid props. */
export interface WalkArea {
  top: number;
  obstacles: readonly Rect[];
}

export const PLAZA_AREA: WalkArea = { top: PLAZA_WALK_TOP, obstacles: OBSTACLES };
/** Rooms share the plaza's size but have no plaza props. */
export const ROOM_AREA: WalkArea = { top: ROOM_WALK_TOP, obstacles: [] };

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/** Keep a ghost's centre inside the walkable area, allowing for its radius. */
export function clampToPlaza(p: Point, top: number = PLAZA_WALK_TOP): Point {
  return {
    x: clamp(p.x, GHOST_RADIUS, PLAZA_WIDTH - GHOST_RADIUS),
    y: clamp(p.y, Math.max(GHOST_RADIUS, top), PLAZA_HEIGHT - GHOST_RADIUS),
  };
}

/** True if a ghost centred at `p` overlaps the prop. */
export function hitsRect(p: Point, r: Rect): boolean {
  if (r.shape === "ellipse") {
    // Grow the ellipse by the ghost's radius, then test the centre point.
    const rx = r.width / 2 + GHOST_RADIUS;
    const ry = r.height / 2 + GHOST_RADIUS;
    const dx = (p.x - (r.x + r.width / 2)) / rx;
    const dy = (p.y - (r.y + r.height / 2)) / ry;
    return dx * dx + dy * dy < 1;
  }
  const nearestX = clamp(p.x, r.x, r.x + r.width);
  const nearestY = clamp(p.y, r.y, r.y + r.height);
  const dx = p.x - nearestX;
  const dy = p.y - nearestY;
  return dx * dx + dy * dy < GHOST_RADIUS * GHOST_RADIUS;
}

export function hitsObstacle(p: Point, obstacles: readonly Rect[] = OBSTACLES): boolean {
  return obstacles.some((r) => hitsRect(p, r));
}

/**
 * Move toward `target` at GHOST_SPEED without overshooting.
 * The result stays inside the walk area. A step into an obstacle is refused,
 * so the ghost stays where it is.
 */
export function stepGhost(pos: Point, target: Point, dtSeconds: number, area: WalkArea = PLAZA_AREA): Point {
  const goal = clampToPlaza(target, area.top);
  const dx = goal.x - pos.x;
  const dy = goal.y - pos.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0 || dtSeconds <= 0) return pos;

  const travel = Math.min(distance, GHOST_SPEED * dtSeconds);
  const next = clampToPlaza(
    {
      x: pos.x + (dx / distance) * travel,
      y: pos.y + (dy / distance) * travel,
    },
    area.top,
  );
  return hitsObstacle(next, area.obstacles) ? pos : next;
}

/** Turn a WASD/arrow direction (each of dx, dy in -1..1) into a nearby target. */
export function keysToTarget(pos: Point, dx: number, dy: number, top: number = PLAZA_WALK_TOP): Point {
  const length = Math.hypot(dx, dy);
  if (length === 0) return pos;
  return clampToPlaza(
    {
      x: pos.x + (dx / length) * KEY_TARGET_DISTANCE,
      y: pos.y + (dy / length) * KEY_TARGET_DISTANCE,
    },
    top,
  );
}
