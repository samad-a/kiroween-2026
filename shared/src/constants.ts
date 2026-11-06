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

/** Solid props ghosts cannot walk through. Rects are top-left anchored. */
export const OBSTACLES: readonly Rect[] = [
  { x: 520, y: 290, width: 160, height: 120, shape: "ellipse" }, // round fountain basin
  { x: 940, y: 80, width: 100, height: 200 }, // crooked clock tower
];

/** Highest a ghost's centre may go in the plaza: keeps it on the square, below the houses. */
export const PLAZA_WALK_TOP = 165;
/** Highest a ghost's centre may go in a room: keeps it on the floor, off the wall. */
export const ROOM_WALK_TOP = 290;
