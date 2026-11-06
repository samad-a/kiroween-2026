// Personal haunted rooms: shared types, message constants, and validators.
// A room layout is a small list of placed decorations. The server is authoritative;
// clients send placement intents and the server validates ownership and bounds.
import { PLAZA_HEIGHT, PLAZA_WIDTH } from "./constants.js";
import { getShopItem } from "./shop.js";

/** Client -> server intents (owner only, enforced server-side). */
export const ROOM = {
  visit: "room:visit",
  place: "room:place",
  move: "room:move",
  remove: "room:remove",
  setHat: "set-hat",
  setPet: "set-pet",
} as const;

/** A room shares the plaza's coordinate space for simplicity. */
export const ROOM_WIDTH = PLAZA_WIDTH;
export const ROOM_HEIGHT = PLAZA_HEIGHT;
/** Keep rooms from being spammed with items. */
export const MAX_ROOM_ITEMS = 40;

/** The midnight haunting event: how often it fires and how long it lasts. */
export const MIDNIGHT_INTERVAL_MS = 5 * 60_000;
export const HAUNTING_DURATION_MS = 20_000;

/** One decoration placed in a room. `itemId` is a shop decoration id. */
export interface PlacedItem {
  itemId: string;
  x: number;
  y: number;
}

/** Client -> server: visit a room by its owner's player id. */
export interface VisitMessage {
  ownerPlayerId: number;
}

/** Client -> server: place a new decoration, or move the one at `index`. */
export interface PlaceMessage {
  itemId: string;
  x: number;
  y: number;
}
export interface MoveItemMessage {
  index: number;
  x: number;
  y: number;
}
export interface RemoveItemMessage {
  index: number;
}

/** Client -> server: wear an owned hat, or "" for none. */
export interface SetHatMessage {
  hat: string;
}

const inBounds = (x: number, y: number): boolean =>
  Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= ROOM_WIDTH && y >= 0 && y <= ROOM_HEIGHT;

/** True if `id` is a known shop decoration (not a hat). */
export function isDecorationId(id: unknown): id is string {
  return typeof id === "string" && getShopItem(id)?.kind === "decoration";
}

/** Validate one placement payload: a known decoration, in bounds. */
export function parsePlacement(payload: unknown): PlaceMessage | null {
  if (typeof payload !== "object" || payload === null) return null;
  const { itemId, x, y } = payload as Record<string, unknown>;
  if (!isDecorationId(itemId)) return null;
  if (typeof x !== "number" || typeof y !== "number" || !inBounds(x, y)) return null;
  return { itemId, x, y };
}

/** Validate a move payload: a non-negative index and an in-bounds point. */
export function parseMoveItem(payload: unknown): MoveItemMessage | null {
  if (typeof payload !== "object" || payload === null) return null;
  const { index, x, y } = payload as Record<string, unknown>;
  if (!Number.isInteger(index) || (index as number) < 0) return null;
  if (typeof x !== "number" || typeof y !== "number" || !inBounds(x, y)) return null;
  return { index: index as number, x, y };
}

export function parseRemoveItem(payload: unknown): RemoveItemMessage | null {
  if (typeof payload !== "object" || payload === null) return null;
  const { index } = payload as Record<string, unknown>;
  if (!Number.isInteger(index) || (index as number) < 0) return null;
  return { index: index as number };
}

/**
 * Validate a whole layout (e.g. loaded from storage). Drops any item that is not
 * a known decoration or is out of bounds, and caps the count. Always returns a
 * safe array, never throws.
 */
export function parseRoomLayout(raw: unknown): PlacedItem[] {
  if (!Array.isArray(raw)) return [];
  const out: PlacedItem[] = [];
  for (const entry of raw) {
    const placed = parsePlacement(entry);
    if (placed) out.push(placed);
    if (out.length >= MAX_ROOM_ITEMS) break;
  }
  return out;
}
