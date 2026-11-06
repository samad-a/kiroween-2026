export const MAX_GHOSTS_PER_PLAZA = 20;
export const MAX_MESSAGE_LENGTH = 120;
export const MESSAGE_COOLDOWN_MS = 2000;

export const PLAZA_WIDTH = 1200;
export const PLAZA_HEIGHT = 700;
export const GHOST_RADIUS = 20;
/** Pixels per second. */
export const GHOST_SPEED = 180;
/** How far ahead a keyboard direction aims, in pixels. */
export const KEY_TARGET_DISTANCE = 120;

export const GHOST_COLOURS = [
  "#f4f1ff", // moonlight
  "#b9a7ff", // lavender
  "#7fd6c2", // mint
  "#ffb86b", // pumpkin
  "#ff8fb1", // rose
  "#8ec5ff", // sky
] as const;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
  /** "ellipse": the solid part is the ellipse inscribed in the rect. Default is the rect. */
  shape?: "rect" | "ellipse";
}

/**
 * Collision is tested at a ghost's feet, not its middle: a small oval this far
 * below the ghost's position. Props block only their footprint on the ground,
 * so a ghost can float behind the tall part of a prop (the client draws it behind).
 */
export const GHOST_FOOT_OFFSET = 36;
export const GHOST_FOOT_RX = 18;
export const GHOST_FOOT_RY = 8;

/** Where the fountain is drawn (centre of the basin art). */
export const FOUNTAIN_CENTRE = { x: 600, y: 350 } as const;
/** Lamp posts in the plaza: the art and the glows use these; their bases are solid. */
export const LAMPS = [
  { x: 120, y: 200 },
  { x: 420, y: 160 },
  { x: 780, y: 160 },
  { x: 160, y: 560 },
  { x: 1060, y: 560 },
] as const;

/** The fountain basin's footprint on the ground (feet space). */
export const FOUNTAIN_FOOT: Rect = { x: 516, y: 334, width: 168, height: 76, shape: "ellipse" };

/** The Pet Store at the back of the plaza: its building centre-x, its ground line, and the door zone. */
export const PET_STORE = { x: 860, ground: 256, door: { x: 860, y: 290 }, radius: 60 } as const;

/** Solid footprints in the plaza, in feet space. Rects are top-left anchored. */
export const OBSTACLES: readonly Rect[] = [
  FOUNTAIN_FOOT,
  { x: PET_STORE.x - 62, y: PET_STORE.ground - 22, width: 124, height: 22 }, // pet store front wall
  { x: 206, y: 292, width: 88, height: 10 }, // notice board posts (matches NOTICE_SPOT in town.ts)
  { x: 946, y: 262, width: 88, height: 26 }, // clock tower base
  ...LAMPS.map((l) => ({ x: l.x - 8, y: l.y + 82, width: 16, height: 10 })), // lamp-post bases
  { x: 32, y: 682, width: 18, height: 8 }, // tree trunks (match worldArt tree())
  { x: 1163, y: 294, width: 15, height: 8 },
  { x: 1152, y: 692, width: 16, height: 8 },
];

/** Highest a ghost's centre may go in the plaza: keeps it on the square, below the houses. */
export const PLAZA_WALK_TOP = 165;
/** Highest a ghost's centre may go in a room: keeps it on the floor, off the wall. */
export const ROOM_WALK_TOP = 290;
