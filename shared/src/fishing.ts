// Ghost Fishing types and the catch table, shared so client and server agree.
// Single-player: these ride over room messages, not synced state. The server
// owns the catch outcome and the coins; the client only drives the timing UI.

export const FISH = { start: "fish:start", cast: "fish:cast", end: "fish:end" } as const;
export const FISH_EVENT = { started: "fish:started", catch: "fish:catch", ended: "fish:ended" } as const;

/** The fishing jetty on Lighthouse Cliffs, and how close you must float to cast. */
export const FISH_SPOT = { area: "lighthouse", x: 560, y: 240, radius: 120 } as const;

/** A round lasts one minute. */
export const ROUND_MS = 60_000;
/** Minimum gap between casts, so a client cannot spam to farm coins. */
export const CAST_COOLDOWN_MS = 800;

export type CatchId = "pumpkin" | "bones" | "spooky-fish";

export interface CatchKind {
  id: CatchId;
  name: string;
  /** Relative chance before accuracy weighting. */
  weight: number;
  coins: number;
}

/** The catch table. Rarer catches are worth more. */
export const CATCHES: readonly CatchKind[] = [
  { id: "pumpkin", name: "Lost Pumpkin", weight: 50, coins: 3 },
  { id: "bones", name: "Old Bones", weight: 35, coins: 6 },
  { id: "spooky-fish", name: "Spooky Fish", weight: 15, coins: 20 },
] as const;

export const getCatch = (id: CatchId): CatchKind => CATCHES.find((c) => c.id === id)!;

/** Client to server: the timing bar was hit. accuracy 0..1, 1 = dead centre. */
export interface CastMessage {
  accuracy: number;
}

/** Server to client: round opened. */
export interface FishStarted {
  roundMs: number;
  catches: readonly CatchKind[];
}

/** Server to client: a single catch result. */
export interface FishCatch {
  catchId: CatchId;
  coins: number;
}

/** Server to client: round closed, with the new balance. */
export interface FishEnded {
  coinsEarned: number;
  balance: number;
}

/** Clamp a cast payload's accuracy to 0..1, or null if malformed. */
export function parseCast(payload: unknown): CastMessage | null {
  if (typeof payload !== "object" || payload === null) return null;
  const { accuracy } = payload as Record<string, unknown>;
  if (typeof accuracy !== "number" || !Number.isFinite(accuracy)) return null;
  return { accuracy: Math.min(1, Math.max(0, accuracy)) };
}
