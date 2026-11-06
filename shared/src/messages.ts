import { GHOST_COLOURS, PLAZA_HEIGHT, PLAZA_WIDTH } from "./constants.js";
import type { Point } from "./movement.js";

export const PLAZA_ROOM = "plaza";
export const HAUNTED_ROOM = "haunted-room";
export const DEFAULT_SERVER_PORT = 2567;

/** Options a client sends when joining the plaza. Validated server-side. */
export interface JoinOptions {
  name?: string;
  colour?: number;
  /** Browser-kept guest id (UUID). A new one is created server-side if missing/invalid. */
  guestId?: string;
  /** A recovery code the player typed to restore an account on a new device. */
  recoveryCode?: string;
  /** A previously-worn hat's shop item id, restored on join if still owned. */
  hat?: string;
}

/** Client to server: "walk toward this point". Never an authoritative position. */
export interface MoveMessage {
  x: number;
  y: number;
}

/** move: walk toward a point. stop: halt where the server has you now (no payload). */
export const MESSAGE = { move: "move", stop: "stop" } as const;

const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Returns a safe target, or null if the payload is malformed or off the map. */
export function parseMove(payload: unknown): Point | null {
  if (typeof payload !== "object" || payload === null) return null;
  const { x, y } = payload as Record<string, unknown>;
  if (!isFiniteNumber(x) || !isFiniteNumber(y)) return null;
  if (x < 0 || x > PLAZA_WIDTH || y < 0 || y > PLAZA_HEIGHT) return null;
  return { x, y };
}

/** Returns a valid colour index, or null. */
export function parseColour(value: unknown): number | null {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) < GHOST_COLOURS.length
    ? (value as number)
    : null;
}
