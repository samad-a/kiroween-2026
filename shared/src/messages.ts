import { GHOST_COLOURS, PLAZA_HEIGHT, PLAZA_WIDTH } from "./constants.js";
import type { Point } from "./movement.js";

export const PLAZA_ROOM = "plaza";
export const DEFAULT_SERVER_PORT = 2567;

/** Options a client sends when joining the plaza. Validated server-side. */
export interface JoinOptions {
  name?: string;
  colour?: number;
}

/** Client to server: "walk toward this point". Never an authoritative position. */
export interface MoveMessage {
  x: number;
  y: number;
}

export const MESSAGE = { move: "move" } as const;

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
