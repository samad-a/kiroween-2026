// Graveyard Dash: a short race on a long track. Shared so the server simulates
// and the client draws exactly the same track, gates and bats.
//
// Tracks are generated from a fixed seed per map, so a map id is all that needs
// to be sent. Gates and bats move on the race clock (synced by the server), so
// their positions are a pure function of time.
import type { Rect } from "./constants.js";
import { hitsRect, type Point } from "./movement.js";

export const DASH_ROOM = "dash";
export const DASH = {
  join: "dash:join", // queue at the gate
  leave: "dash:leave", // leave the queue
  solo: "dash:solo", // race alone, now
  intent: "dash:intent", // racer: { dx, dy } held direction, or { x, y } target
} as const;
export const DASH_EVENT = {
  queue: "dash:queue", // plaza -> queued players: who's in, countdown
  start: "dash:start", // plaza -> queued players: join this race room
  results: "dash:results", // race -> racers: standings, coins, records
} as const;

export const DASH_MAX_RACERS = 4;
/** Countdown in the plaza once two ghosts are queued. Four start at once. */
export const DASH_QUEUE_MS = 8_000;
/** 3-2-1 on the track before anyone can move. */
export const DASH_COUNTDOWN_MS = 3_000;
/** The race ends this long after the first finisher, or at the time limit. */
export const DASH_GRACE_MS = 15_000;
export const DASH_TIME_LIMIT_MS = 120_000;

/** The Dash Gate in the plaza: stand here to queue. */
export const DASH_GATE = { x: 420, y: 600, radius: 80 } as const;

export const DASH_SPEED = 300; // px/s; the plaza is 180
export const BOOST_MULT = 1.75;
export const BOOST_MS = 1_500;
export const MUD_MULT = 0.5;
export const STUN_MS = 600;
export const KNOCKBACK = 50;
export const WISP_RESPAWN_MS = 4_000;
export const WISP_RADIUS = 34;
export const BAT_RADIUS = 34;

export const PLACE_COINS = [20, 12, 8, 5] as const;
export const SOLO_COINS = 5;
export const RECORD_BONUS = 5;

/** The track is as tall as the plaza and four screens long. */
export const TRACK_HEIGHT = 700;
export const TRACK_TOP = 200; // highest a racer's centre can go
export const TRACK_BOTTOM = 620;
export const START_X = 140;

export interface Gate extends Rect {
  /** Milliseconds per open+close cycle, and the offset into it. Open for the first `openMs`. */
  period: number;
  openMs: number;
  offset: number;
}

export interface Bat {
  x: number;
  y0: number;
  y1: number;
  period: number;
  phase: number;
}

export interface Track {
  id: DashMapId;
  name: string;
  length: number;
  finishX: number;
  tombstones: Rect[];
  /** Walls with a gate in them: the walls are always solid; the gate only when closed. */
  walls: Rect[];
  gates: Gate[];
  mud: Rect[];
  pads: Rect[];
  wisps: Point[];
  bats: Bat[];
}

export const DASH_MAPS = {
  lane: { name: "Graveyard Lane", seed: 11, length: 4800 },
  marsh: { name: "Misty Marsh", seed: 23, length: 5200 },
  crypt: { name: "Crypt Run", seed: 37, length: 4600 },
} as const;
export type DashMapId = keyof typeof DASH_MAPS;
export const DASH_MAP_IDS = Object.keys(DASH_MAPS) as DashMapId[];

export function isDashMapId(v: unknown): v is DashMapId {
  return typeof v === "string" && v in DASH_MAPS;
}

/** A small seeded PRNG (mulberry32), so a seed always builds the same track. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Feet space (as in the plaza): footprints are where the ghost's feet can't go.
const FEET_TOP = TRACK_TOP + 36;
const FEET_BOTTOM = TRACK_BOTTOM + 36;
const BAND = FEET_BOTTOM - FEET_TOP;

/**
 * Build a track: sections every ~420px, each one challenge. Every section leaves
 * at least one open lane, so the track is always finishable.
 */
export function buildTrack(id: DashMapId): Track {
  const def = DASH_MAPS[id];
  const r = seeded(def.seed);
  const t: Track = { id, name: def.name, length: def.length, finishX: def.length - 260, tombstones: [], walls: [], gates: [], mud: [], pads: [], wisps: [], bats: [] };
  const between = (a: number, b: number) => a + r() * (b - a);

  // A free boost pad near the start, so the first few seconds feel fast.
  t.pads.push({ x: 420, y: FEET_TOP + BAND / 2 - 40, width: 110, height: 80 });

  let kindsLeft: number[] = [];
  for (let x = 680; x < t.finishX - 300; x += between(380, 470)) {
    if (kindsLeft.length === 0) kindsLeft = [0, 1, 2, 3, 4].sort(() => r() - 0.5); // every kind, shuffled
    const kind = kindsLeft.pop()!;
    if (kind === 0) {
      // Tombstone slalom: three stones, staggered, always a gap between them.
      for (let i = 0; i < 3; i++) {
        const y = FEET_TOP + 20 + ((i + r() * 0.5) / 3) * (BAND - 60);
        t.tombstones.push({ x: x + i * 90 + between(-20, 20), y, width: 44, height: 22 });
      }
      t.wisps.push({ x: x + 140, y: FEET_TOP - 36 + between(40, BAND - 40) });
    } else if (kind === 1) {
      // Mud field with a boost pad lane through it.
      const laneY = between(FEET_TOP + 20, FEET_BOTTOM - 120);
      t.mud.push({ x, y: FEET_TOP, width: 260, height: laneY - FEET_TOP });
      t.mud.push({ x, y: laneY + 100, width: 260, height: FEET_BOTTOM - laneY - 100 });
      t.pads.push({ x: x + 70, y: laneY + 10, width: 110, height: 80 });
    } else if (kind === 2) {
      // Crypt wall with a timed gate; the long way round is muddy.
      const gateY = between(FEET_TOP + 40, FEET_BOTTOM - 220);
      const muddyGapY = FEET_BOTTOM - 90;
      t.walls.push({ x, y: FEET_TOP - 10, width: 26, height: gateY - FEET_TOP + 10 });
      t.gates.push({ x, y: gateY, width: 26, height: 110, period: 2800, openMs: 1500, offset: Math.floor(r() * 2800) });
      t.walls.push({ x, y: gateY + 110, width: 26, height: muddyGapY - gateY - 110 });
      t.mud.push({ x: x - 80, y: muddyGapY, width: 190, height: FEET_BOTTOM - muddyGapY + 10 });
    } else if (kind === 3) {
      // Bats swooping across the track, out of step with each other.
      for (let i = 0; i < 2; i++) {
        t.bats.push({ x: x + i * 150, y0: TRACK_TOP - 10, y1: TRACK_BOTTOM + 10, period: between(1600, 2400), phase: r() });
      }
    } else {
      // A wisp line with boost pads: pure speed, the reward for clean driving.
      for (let i = 0; i < 3; i++) t.wisps.push({ x: x + i * 90, y: between(TRACK_TOP + 30, TRACK_BOTTOM - 30) });
      t.pads.push({ x: x + 40, y: between(FEET_TOP, FEET_BOTTOM - 80), width: 110, height: 80 });
    }
  }
  return t;
}

const TRACKS = new Map<DashMapId, Track>();
/** Cached: tracks never change. */
export function track(id: DashMapId): Track {
  let t = TRACKS.get(id);
  if (!t) TRACKS.set(id, (t = buildTrack(id)));
  return t;
}

/** Is this gate open at race time `ms`? */
export function gateOpen(g: Gate, ms: number): boolean {
  const phase = (((ms + g.offset) % g.period) + g.period) % g.period;
  return phase < g.openMs;
}

/** Where a bat is at race time `ms` (centre position). */
export function batAt(b: Bat, ms: number): Point {
  const s = (Math.sin(((ms / b.period) + b.phase) * Math.PI * 2) + 1) / 2;
  return { x: b.x, y: b.y0 + (b.y1 - b.y0) * s };
}

const inside = (p: Point, r: Rect) => {
  const fy = p.y + 36;
  return p.x >= r.x && p.x <= r.x + r.width && fy >= r.y && fy <= r.y + r.height;
};

/**
 * Solid things at race time `ms`: the track edges, tombstones, walls, and gates
 * that are shut. `gates` can force every gate open or shut (for tests and escapes).
 */
export function solidAt(t: Track, p: Point, ms: number, gates: "timed" | "open" | "shut" = "timed"): boolean {
  if (p.y < TRACK_TOP || p.y > TRACK_BOTTOM || p.x < 40 || p.x > t.length - 40) return true;
  return (
    t.tombstones.some((r) => hitsRect(p, r)) ||
    t.walls.some((r) => hitsRect(p, r)) ||
    (gates !== "open" && t.gates.some((g) => (gates === "shut" || !gateOpen(g, ms)) && hitsRect(p, g)))
  );
}

export interface RacerIntent {
  /** Held direction (each -1..1), or a target point. Direction wins if both. */
  dx?: number;
  dy?: number;
  target?: Point;
}

export interface RacerState {
  x: number;
  y: number;
  boostUntil: number;
  stunUntil: number;
}

export interface StepEvents {
  boosted?: boolean;
  wisp?: number;
  stunned?: boolean;
}

/** Current speed for a racer at `ms`: boost and mud multiply, stun stops. */
export function racerSpeed(t: Track, s: RacerState, ms: number): number {
  if (ms < s.stunUntil) return 0;
  let v = DASH_SPEED;
  if (ms < s.boostUntil) v *= BOOST_MULT;
  if (t.mud.some((m) => inside(s, m))) v *= MUD_MULT;
  return v;
}

/**
 * Advance one racer by `dt` seconds at race time `ms`. Mutates `s`. Blocked moves
 * slide along the obstacle (try x, then y) so walls feel smooth, not sticky.
 * `wispsTakenAt[i]` is when wisp i was last grabbed (0 = never).
 */
export function stepRacer(t: Track, s: RacerState, intent: RacerIntent, dt: number, ms: number, wispsTakenAt: number[]): StepEvents {
  const events: StepEvents = {};
  let dx = intent.dx ?? 0;
  let dy = intent.dy ?? 0;
  if (dx === 0 && dy === 0 && intent.target) {
    dx = intent.target.x - s.x;
    dy = intent.target.y - s.y;
    if (Math.hypot(dx, dy) < 4) dx = dy = 0;
  }
  const len = Math.hypot(dx, dy);
  const speed = racerSpeed(t, s, ms);
  // A gate that shut on you never traps you: while inside one, gates don't block.
  const gateMode = solidAt(t, s, ms) && !solidAt(t, s, ms, "open") ? "open" : "timed";
  const blocked = (p: Point, m: number) => solidAt(t, p, m, gateMode);
  if (len > 0 && speed > 0) {
    let step = speed * dt;
    if (!intent.dx && !intent.dy && intent.target) step = Math.min(step, Math.hypot(intent.target.x - s.x, intent.target.y - s.y));
    const nx = s.x + (dx / len) * step;
    const ny = s.y + (dy / len) * step;
    if (!blocked({ x: nx, y: ny }, ms)) [s.x, s.y] = [nx, ny];
    else if (!blocked({ x: nx, y: s.y }, ms)) s.x = nx;
    else if (!blocked({ x: s.x, y: ny }, ms)) s.y = ny;
  }

  if (ms >= 0 && t.pads.some((p) => inside(s, p))) {
    if (s.boostUntil < ms + BOOST_MS - 100) events.boosted = true;
    s.boostUntil = Math.max(s.boostUntil, ms + BOOST_MS);
  }
  t.wisps.forEach((w, i) => {
    const free = (wispsTakenAt[i] ?? 0) === 0 || ms - wispsTakenAt[i]! >= WISP_RESPAWN_MS;
    if (free && Math.hypot(s.x - w.x, s.y - w.y) < WISP_RADIUS) {
      wispsTakenAt[i] = Math.max(1, ms);
      s.boostUntil = Math.max(s.boostUntil, ms + BOOST_MS);
      events.wisp = i;
    }
  });
  if (ms >= s.stunUntil) {
    for (const b of t.bats) {
      const p = batAt(b, ms);
      if (Math.hypot(s.x - p.x, s.y - p.y) < BAT_RADIUS) {
        s.stunUntil = ms + STUN_MS;
        const back = { x: s.x - KNOCKBACK, y: s.y };
        if (!blocked(back, ms)) s.x = back.x;
        events.stunned = true;
        break;
      }
    }
  }
  return events;
}

/** Where racer `i` of `n` lines up at the start. */
export function startPosition(i: number, n: number): Point {
  const gap = (TRACK_BOTTOM - TRACK_TOP) / (n + 1);
  return { x: START_X, y: TRACK_TOP + gap * (i + 1) };
}

/** Coins for a finish: by place in a group race, flat for solo, plus a record bonus. */
export function dashPayout(place: number | null, racers: number, newRecord: boolean): number {
  if (place === null) return 0;
  const base: number = racers <= 1 ? SOLO_COINS : (PLACE_COINS[place - 1] ?? PLACE_COINS[3]);
  return base + (newRecord ? RECORD_BONUS : 0);
}

/** Server -> plaza players in the queue. */
export interface DashQueue {
  names: string[];
  /** When the race starts (ms epoch), or 0 while waiting for a second ghost. */
  startsAt: number;
  /** Your best times per track, in ms (missing = never finished). */
  records: Partial<Record<DashMapId, number>>;
}

export interface DashStart {
  roomId: string;
  map: DashMapId;
}

export interface DashStanding {
  name: string;
  timeMs: number | null;
  place: number | null;
}

export interface DashResults {
  map: DashMapId;
  standings: DashStanding[];
  /** Just for you. */
  coins: number;
  balance: number;
  bestMs: number | null;
  newRecord: boolean;
}

/** Format a race time as m:ss.cc. */
export function formatRaceTime(ms: number): string {
  const s = ms / 1000;
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(2).padStart(5, "0")}`;
}

/** A held direction or a target point, or null if malformed. */
export function parseIntent(payload: unknown): RacerIntent | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  const num = (v: unknown) => typeof v === "number" && Number.isFinite(v);
  if (num(p.dx) && num(p.dy)) {
    return { dx: Math.max(-1, Math.min(1, p.dx as number)), dy: Math.max(-1, Math.min(1, p.dy as number)) };
  }
  if (num(p.x) && num(p.y)) return { target: { x: p.x as number, y: p.y as number } };
  return null;
}
