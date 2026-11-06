import {
  GHOST_FOOT_OFFSET,
  GHOST_FOOT_RX,
  GHOST_FOOT_RY,
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

/** Lowest a ghost may go: its feet stay a little above the bottom edge. */
export const WALK_BOTTOM = PLAZA_HEIGHT - GHOST_FOOT_OFFSET - 8;

/** Keep a ghost inside the walkable area, allowing for its size. */
export function clampToPlaza(p: Point, top: number = PLAZA_WALK_TOP): Point {
  return {
    x: clamp(p.x, GHOST_RADIUS, PLAZA_WIDTH - GHOST_RADIUS),
    y: clamp(p.y, Math.max(GHOST_RADIUS, top), WALK_BOTTOM),
  };
}

/**
 * True if the ghost at `p` would stand on the prop's footprint. Tested at the
 * ghost's feet (a small oval below its position), so it can float behind the
 * upright part of a prop, which only blocks where it meets the ground.
 */
export function hitsRect(p: Point, r: Rect): boolean {
  const fx = p.x;
  const fy = p.y + GHOST_FOOT_OFFSET;
  if (r.shape === "ellipse") {
    // Grow the footprint ellipse by the foot oval, then test the foot point.
    const dx = (fx - (r.x + r.width / 2)) / (r.width / 2 + GHOST_FOOT_RX);
    const dy = (fy - (r.y + r.height / 2)) / (r.height / 2 + GHOST_FOOT_RY);
    return dx * dx + dy * dy < 1;
  }
  // Rect grown by the foot oval's half-sizes (a rounded-corner test is not worth it here).
  return fx > r.x - GHOST_FOOT_RX && fx < r.x + r.width + GHOST_FOOT_RX && fy > r.y - GHOST_FOOT_RY && fy < r.y + r.height + GHOST_FOOT_RY;
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
