// Public areas: the plaza plus places you can walk to from it. Each is its own
// Colyseus room type with the same chat, Caretaker and friends as the plaza;
// only the walkable space, props, exits and games differ: fishing and the lamp on
// the cliffs, the séance and riddles in the crypt, the Dash and wishing well in the plaza.
import { OBSTACLES, PLAZA_WALK_TOP, type Rect } from "./constants.js";
import type { Point, WalkArea } from "./movement.js";

export type AreaId = "plaza" | "lighthouse" | "crypt";

export interface AreaExit {
  to: AreaId;
  /** Centre of the exit on the ground, and how close counts as "at" it. */
  x: number;
  y: number;
  radius: number;
  label: string;
}

export interface AreaDef {
  id: AreaId;
  /** Colyseus room type name. */
  room: string;
  name: string;
  walk: WalkArea;
  /** Where you appear if you didn't arrive through an exit. */
  spawn: Point;
  exits: AreaExit[];
}

// Footprints on the ground (feet space): only where each prop meets the floor is solid,
// so ghosts can float behind the lighthouse, pillars and sarcophagus.
const LIGHTHOUSE_OBSTACLES: readonly Rect[] = [
  { x: 835, y: 276, width: 140, height: 32, shape: "ellipse" }, // lighthouse base
  { x: 300, y: 304, width: 112, height: 24, shape: "ellipse" }, // boulder
  { x: 124, y: 548, width: 86, height: 20, shape: "ellipse" }, // rock
];

const pillarFoot = (x: number, y: number): Rect => ({ x: x - 30, y: y + 14, width: 60, height: 22 });
/** Pillar positions in the crypt (the art draws a shaft rising from each). */
export const CRYPT_PILLARS = [
  { x: 285, y: 290 },
  { x: 915, y: 290 },
  { x: 285, y: 540 },
  { x: 915, y: 540 },
] as const;

const CRYPT_OBSTACLES: readonly Rect[] = [
  { x: 516, y: 384, width: 168, height: 46 }, // sarcophagus
  { x: 1036, y: 290, width: 48, height: 14 }, // the riddle skull's pedestal
  ...CRYPT_PILLARS.map((p) => pillarFoot(p.x, p.y)),
];

export const AREAS: Record<AreaId, AreaDef> = {
  plaza: {
    id: "plaza",
    room: "plaza",
    name: "Town Square",
    walk: { top: PLAZA_WALK_TOP, obstacles: OBSTACLES },
    spawn: { x: 600, y: 560 },
    exits: [
      { to: "lighthouse", x: 50, y: 470, radius: 90, label: "Lighthouse Cliffs" },
      { to: "crypt", x: 1150, y: 450, radius: 90, label: "The Old Crypt" },
    ],
  },
  lighthouse: {
    id: "lighthouse",
    room: "lighthouse",
    name: "Lighthouse Cliffs",
    walk: { top: 200, obstacles: LIGHTHOUSE_OBSTACLES }, // room to float behind the lighthouse
    spawn: { x: 1050, y: 520 },
    exits: [{ to: "plaza", x: 1150, y: 520, radius: 90, label: "Town Square" }],
  },
  crypt: {
    id: "crypt",
    room: "crypt",
    name: "The Old Crypt",
    walk: { top: 250, obstacles: CRYPT_OBSTACLES },
    spawn: { x: 150, y: 470 },
    exits: [{ to: "plaza", x: 50, y: 470, radius: 90, label: "Town Square" }],
  },
};

export const AREA_IDS = Object.keys(AREAS) as AreaId[];

export function isAreaId(value: unknown): value is AreaId {
  return typeof value === "string" && value in AREAS;
}

/**
 * Where to appear in `area`: just inside the exit that leads back to where you came
 * from, so walking out of the plaza's left edge lands you by the lighthouse's way home.
 */
export function arrivalPoint(area: AreaId, from: AreaId | undefined): Point {
  const def = AREAS[area];
  const exit = from ? def.exits.find((e) => e.to === from) : undefined;
  if (!exit) return def.spawn;
  // Step inward from the edge the exit sits on, so you don't re-trigger it at once.
  const inward = exit.x < 600 ? 1 : -1;
  return { x: exit.x + inward * (exit.radius + 40), y: exit.y };
}

/** The exit you're standing in, if any. */
export function exitAt(area: AreaId, p: Point): AreaExit | undefined {
  return AREAS[area].exits.find((e) => Math.hypot(p.x - e.x, p.y - e.y) <= e.radius);
}
