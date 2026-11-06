// Graveyard Dash: one race on one track for 1-4 ghosts who queued together in the
// plaza. The server owns every position, as in the plaza; clients send a held
// direction or a target point. Only the players the plaza sent may join.
import { Room, type Client } from "colyseus";
import {
  DASH,
  DASH_COUNTDOWN_MS,
  DASH_EVENT,
  DASH_GRACE_MS,
  DASH_MAX_RACERS,
  DASH_TIME_LIMIT_MS,
  GHOST_COLOURS,
  cleanName,
  dashPayout,
  isDashMapId,
  parseGuestId,
  parseIntent,
  randomName,
  startPosition,
  stepRacer,
  track,
  type DashMapId,
  type DashResults,
  type JoinOptions,
  type RacerIntent,
  type RacerState,
} from "@club-kiro/shared";
import { randomUUID } from "node:crypto";
import { DashState, Racer } from "./DashState.js";
import { getDb } from "./db/shared.js";
import { addCoins, getPlayer, resolvePlayer } from "./db/players.js";
import { recordFinish } from "./db/dash.js";
import { restoreWearables } from "./wearables.js";
import { markOffline, markOnline } from "./presence.js";
import type { DB } from "./db/index.js";

const TICK_MS = 33;
/** If not everyone shows up, start anyway after this long. */
const JOIN_WAIT_MS = 6_000;

export interface DashCreateOptions {
  map?: unknown;
  /** Player ids allowed in (the queue that started this race). */
  playerIds?: unknown;
}

export class DashRoom extends Room<{ state: DashState }> {
  maxClients = DASH_MAX_RACERS;
  state = new DashState();
  db: DB = getDb();
  private map: DashMapId = "lane";
  private allowed = new Set<number>();
  private playerIds = new Map<string, number>();
  private intents = new Map<string, RacerIntent>();
  private startedAt = 0; // wall-clock ms when the race clock reads 0
  private firstFinishAt = 0;
  private racersAtStart = 0;
  private finished = false;

  messages = {
    [DASH.intent]: (client: Client, payload: unknown) => {
      const intent = parseIntent(payload);
      if (intent) this.intents.set(client.sessionId, intent);
    },
  };

  onCreate(options?: DashCreateOptions) {
    this.map = isDashMapId(options?.map) ? options.map : "lane";
    const ids = Array.isArray(options?.playerIds) ? options.playerIds : [];
    for (const id of ids) if (Number.isInteger(id)) this.allowed.add(id as number);
    this.state.map = this.map;
    this.state.phase = "countdown";
    this.state.clock = -DASH_COUNTDOWN_MS;
    for (let i = 0; i < track(this.map).wisps.length; i++) this.state.wisps.push(0);
    this.setPrivate(true); // never matched by joinOrCreate; only joinById from the plaza handoff
    this.setSimulationInterval((dt) => this.tick(dt / 1000), TICK_MS);
    // Start once everyone's in, or after a short wait if someone never arrives.
    this.clock.setTimeout(() => this.beginCountdown(), JOIN_WAIT_MS);
  }

  onJoin(client: Client, options?: JoinOptions) {
    const guestId = parseGuestId(options?.guestId) ?? randomUUID();
    const player = resolvePlayer(this.db, guestId, options?.recoveryCode ?? null);
    if (!this.allowed.has(player.id) || this.startedAt) throw new Error("This race isn't yours to join.");
    this.playerIds.set(client.sessionId, player.id);
    client.userData = { playerId: player.id };
    markOnline(player.id);

    const r = new Racer();
    r.name = cleanName(options?.name) ?? randomName();
    r.colour = Number.isInteger(options?.colour) && options!.colour! >= 0 && options!.colour! < GHOST_COLOURS.length ? options!.colour! : 0;
    restoreWearables(this.db, player.id, r, options);
    const pos = startPosition(this.state.racers.size, this.allowed.size || 1);
    r.x = pos.x;
    r.y = pos.y;
    this.state.racers.set(client.sessionId, r);
    if (this.state.racers.size >= this.allowed.size) this.beginCountdown();
  }

  onLeave(client: Client) {
    // Leaving forfeits: no coins, no record.
    this.state.racers.delete(client.sessionId);
    this.intents.delete(client.sessionId);
    const playerId = this.playerIds.get(client.sessionId);
    if (playerId !== undefined) markOffline(playerId);
    this.playerIds.delete(client.sessionId);
    if (this.startedAt && !this.finished && this.allFinished()) this.finish();
  }

  /** Line everyone up again (spacing depends on who arrived) and start the 3-2-1. */
  private beginCountdown() {
    if (this.startedAt) return;
    this.lock();
    const n = this.state.racers.size;
    if (n === 0) return void this.disconnect();
    let i = 0;
    this.state.racers.forEach((r) => {
      const p = startPosition(i++, n);
      r.x = p.x;
      r.y = p.y;
    });
    this.racersAtStart = n;
    this.startedAt = Date.now() + DASH_COUNTDOWN_MS;
  }

  private allFinished(): boolean {
    let done = true;
    this.state.racers.forEach((r) => (done &&= r.place > 0));
    return done;
  }

  /** Advance the race. Public so tests can drive it. */
  tick(dtSeconds: number) {
    if (!this.startedAt || this.finished) return;
    const ms = Date.now() - this.startedAt;
    this.state.clock = ms;
    if (ms < 0) return;
    if (this.state.phase !== "racing") this.state.phase = "racing";

    const t = track(this.map);
    const wisps = Array.from(this.state.wisps);
    let finishedCount = 0;
    this.state.racers.forEach((r) => r.place > 0 && finishedCount++);
    this.state.racers.forEach((r, id) => {
      if (r.place > 0) return;
      const s: RacerState = { x: r.x, y: r.y, boostUntil: r.boostUntil, stunUntil: r.stunUntil };
      stepRacer(t, s, this.intents.get(id) ?? {}, dtSeconds, ms, wisps);
      r.x = s.x;
      r.y = s.y;
      r.boostUntil = s.boostUntil;
      r.stunUntil = s.stunUntil;
      if (r.x >= t.finishX) {
        r.timeMs = ms;
        r.place = ++finishedCount;
        if (!this.firstFinishAt) this.firstFinishAt = ms;
      }
    });
    wisps.forEach((v, i) => {
      if (this.state.wisps[i] !== v) this.state.wisps[i] = v;
    });

    const timeUp = ms >= DASH_TIME_LIMIT_MS || (this.firstFinishAt > 0 && ms - this.firstFinishAt >= DASH_GRACE_MS);
    if (this.allFinished() || timeUp) this.finish();
  }

  /** Pay out, save records, send everyone their results, then close soon after. */
  finish() {
    if (this.finished) return;
    this.finished = true;
    this.state.phase = "done";
    const standings: DashResults["standings"] = [];
    this.state.racers.forEach((r) => standings.push({ name: r.name, timeMs: r.place ? r.timeMs : null, place: r.place || null }));
    standings.sort((a, b) => (a.place ?? 99) - (b.place ?? 99));

    for (const client of this.clients) {
      const r = this.state.racers.get(client.sessionId);
      const playerId = this.playerIds.get(client.sessionId);
      if (!r || playerId === undefined) continue;
      let bestMs: number | null = null;
      let newRecord = false;
      if (r.place) ({ bestMs, newRecord } = recordFinish(this.db, playerId, this.map, r.timeMs));
      const coins = dashPayout(r.place || null, this.racersAtStart, newRecord);
      const balance = (coins > 0 ? addCoins(this.db, playerId, coins) : null) ?? getPlayer(this.db, playerId)?.coins ?? 0;
      const results: DashResults = { map: this.map, standings, coins, balance, bestMs, newRecord };
      client.send(DASH_EVENT.results, results);
    }
    this.clock.setTimeout(() => this.disconnect(), 60_000);
  }
}
