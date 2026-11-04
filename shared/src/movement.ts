import {
  GHOST_RADIUS,
  GHOST_SPEED,
  KEY_TARGET_DISTANCE,
  OBSTACLES,
  PLAZA_HEIGHT,
  PLAZA_WIDTH,
  type Rect,
} from "./constants.js";

export interface Point {
  x: number;
  y: number;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/** Keep a ghost's centre inside the plaza, allowing for its radius. */
export function clampToPlaza(p: Point): Point {
  return {
    x: clamp(p.x, GHOST_RADIUS, PLAZA_WIDTH - GHOST_RADIUS),
    y: clamp(p.y, GHOST_RADIUS, PLAZA_HEIGHT - GHOST_RADIUS),
  };
}

/** True if a ghost centred at `p` overlaps the rect. */
export function hitsRect(p: Point, r: Rect): boolean {
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
 * The result stays inside the plaza. A step into an obstacle is refused,
 * so the ghost stays where it is.
 */
export function stepGhost(pos: Point, target: Point, dtSeconds: number): Point {
  const goal = clampToPlaza(target);
  const dx = goal.x - pos.x;
  const dy = goal.y - pos.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0 || dtSeconds <= 0) return pos;

  const travel = Math.min(distance, GHOST_SPEED * dtSeconds);
  const next = clampToPlaza({
    x: pos.x + (dx / distance) * travel,
    y: pos.y + (dy / distance) * travel,
  });
  return hitsObstacle(next) ? pos : next;
}

/** Turn a WASD/arrow direction (each of dx, dy in -1..1) into a nearby target. */
export function keysToTarget(pos: Point, dx: number, dy: number): Point {
  const length = Math.hypot(dx, dy);
  if (length === 0) return pos;
  return clampToPlaza({
    x: pos.x + (dx / length) * KEY_TARGET_DISTANCE,
    y: pos.y + (dy / length) * KEY_TARGET_DISTANCE,
  });
}
