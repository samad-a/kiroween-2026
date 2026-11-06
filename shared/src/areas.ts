// Public areas: the plaza plus places you can walk to from it. Each is its own
// Colyseus room type with the same chat, Caretaker and friends as the plaza;
// only the walkable space, props and exits differ. Mini-games stay in the plaza.
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

const LIGHTHOUSE_OBSTACLES: readonly Rect[] = [
  { x: 820, y: 250, width: 170, height: 90, shape: "ellipse" }, // lighthouse base
  { x: 300, y: 280, width: 110, height: 60, shape: "ellipse" }, // boulder
  { x: 120, y: 520, width: 90, height: 50, shape: "ellipse" }, // rock
];

const CRYPT_OBSTACLES: readonly Rect[] = [
  { x: 520, y: 360, width: 160, height: 70 }, // sarcophagus
  { x: 260, y: 290, width: 50, height: 40 }, // pillars
  { x: 890, y: 290, width: 50, height: 40 },
  { x: 260, y: 540, width: 50, height: 40 },
  { x: 890, y: 540, width: 50, height: 40 },
];

export const AREAS: Record<AreaId, AreaDef> = {
  plaza: {
    id: "plaza",
    room: "plaza",
    name: "Town Square",
    walk: { top: PLAZA_WALK_TOP, obstacles: OBSTACLES },
    spawn: { x: 600, y: 560 },
    exits: [
      { to: "lighthouse", x: 50, y: 470, radius: 70, label: "Lighthouse Cliffs" },
      { to: "crypt", x: 1150, y: 450, radius: 70, label: "The Old Crypt" },
    ],
  },
  lighthouse: {
    id: "lighthouse",
    room: "lighthouse",
    name: "Lighthouse Cliffs",
    walk: { top: 230, obstacles: LIGHTHOUSE_OBSTACLES },
    spawn: { x: 1050, y: 520 },
    exits: [{ to: "plaza", x: 1150, y: 520, radius: 70, label: "Town Square" }],
  },
  crypt: {
    id: "crypt",
    room: "crypt",
    name: "The Old Crypt",
    walk: { top: 250, obstacles: CRYPT_OBSTACLES },
    spawn: { x: 150, y: 470 },
    exits: [{ to: "plaza", x: 50, y: 470, radius: 70, label: "Town Square" }],
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
