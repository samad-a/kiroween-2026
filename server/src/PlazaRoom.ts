import { Room, matchMaker, type Client } from "colyseus";
import {
  BUBBLE_TTL_MS,
  CAST_COOLDOWN_MS,
  CATCHES,
  CHAT_ROOM_MESSAGE,
  FISH,
  FISH_EVENT,
  GHOST_COLOURS,
  HAUNTING_DURATION_MS,
  MAX_GHOSTS_PER_PLAZA,
  MAX_MESSAGE_LENGTH,
  MESSAGE,
  MIDNIGHT_INTERVAL_MS,
  PLAZA_HEIGHT,
  PLAZA_WIDTH,
  ROOM,
  ROUND_MS,
  SHOP,
  SHOP_EVENT,
  cleanMessage,
  cleanName,
  getShopItem,
  hitsObstacle,
  parseBuy,
  parseCast,
  parseColour,
  parseGuestId,
  parseMove,
  randomName,
  stepGhost,
  AREAS,
  DASH,
  DASH_EVENT,
  DASH_GATE,
  DASH_MAP_IDS,
  DASH_MAX_RACERS,
  DASH_QUEUE_MS,
  DASH_ROOM,
  type DashQueue,
  type DashStart,
  arrivalPoint,
  isAreaId,
  type AreaId,
  FRIENDS,
  FRIENDS_EVENT,
  parseFriendTarget,
  type FriendsList,
  SEANCE,
  SEANCE_EVENT,
  SEANCE_MAX_ROUNDS,
  SEANCE_RANGE,
  SEANCE_SPOT,
  PET_STORE,
  extendSequence,
  parseSeanceAnswer,
  seanceDeadlineMs,
  seanceReward,
  sequenceMatches,
  type SeanceEndReason,
  type SeanceResult,
  type SeanceShow,
  type CaretakerNote,
  type ChatBroadcast,
  type ChatMessage,
  type FishCatch,
  type FishEnded,
  type FishStarted,
  type JoinOptions,
  type Point,
  type ShopBought,
  type ShopDenied,
  type Wallet,
} from "@club-kiro/shared";
import { randomUUID } from "node:crypto";
import { Ghost, PlazaState } from "./state.js";
import { createModerator, type Moderator } from "./caretaker/moderate.js";
import { getDb } from "./db/shared.js";
import { addCoins, buyItem, displayRecoveryCode, getPlayer, ownedItems, ownsItem, resolvePlayer } from "./db/players.js";
import { rollCatch } from "./fishing.js";
import { addFriend, listFriends, removeFriend, setPlayerName } from "./db/friends.js";
import { isOnline, markOffline, markOnline } from "./presence.js";
import { canUse, restoreWearables } from "./wearables.js";
import { getRecords } from "./db/dash.js";
import type { DB } from "./db/index.js";

export const TICK_MS = 50;
/** How often to recheck whether the Caretaker's AI is back. */
const HEALTH_INTERVAL_MS = 30_000;

/** The Caretaker's in-character announcement when a haunting begins. */
const HAUNTING_ANNOUNCE = "The clocks lean toward midnight… the lanterns dim. Stay close, dear spirits. 🕯️";

/** Spawn on the open path below the fountain, spread out a little. */
export function spawnPoint(random: () => number = Math.random): Point {
  for (let attempt = 0; attempt < 20; attempt++) {
    const p = { x: PLAZA_WIDTH / 2 + (random() - 0.5) * 300, y: PLAZA_HEIGHT - 160 + (random() - 0.5) * 80 };
    if (!hitsObstacle(p)) return p;
  }
  return { x: PLAZA_WIDTH / 2, y: PLAZA_HEIGHT - 120 };
}

/** Per-sender chat state. Never holds message text. */
interface ChatInfo {
  lastMessageAt: number;
  blocks: number;
  mutedUntil: number;
}

/** Per-connection fishing round. Single-player, so not synced state. */
interface FishingRound {
  endsAt: number;
  lastCastAt: number;
  earned: number;
}

export class PlazaRoom extends Room<{ state: PlazaState }> {
  maxClients = MAX_GHOSTS_PER_PLAZA;
  maxMessagesPerSecond = 30;
  state = new PlazaState();

  private readonly targets = new Map<string, Point>();
  private readonly chat = new Map<string, ChatInfo>();
  private readonly playerIds = new Map<string, number>();
  private readonly rounds = new Map<string, FishingRound>();
  private moderator: Moderator = createModerator();
  /** Injectable for tests; defaults to the process-wide database. */
  db: DB = getDb();
  private random: () => number = Math.random;

  messages = {
    [MESSAGE.move]: (client: Client, payload: unknown) => {
      const target = parseMove(payload);
      if (target && this.state.ghosts.has(client.sessionId)) this.targets.set(client.sessionId, target);
    },
    // Keys released: stop on the spot rather than walking back to a stale position.
    [MESSAGE.stop]: (client: Client) => {
      this.targets.delete(client.sessionId);
    },
    [CHAT_ROOM_MESSAGE.chat]: (client: Client, payload: unknown) => {
      void this.handleChat(client, payload);
    },
    [FISH.start]: (client: Client) => this.handleFishStart(client),
    [FISH.cast]: (client: Client, payload: unknown) => this.handleFishCast(client, payload),
    [FISH.end]: (client: Client) => this.handleFishEnd(client),
    [SHOP.buy]: (client: Client, payload: unknown) => this.handleBuy(client, payload),
    [ROOM.setHat]: (client: Client, payload: unknown) => this.handleSetHat(client, payload),
    [ROOM.setPet]: (client: Client, payload: unknown) => this.handleSetPet(client, payload),
    [FRIENDS.add]: (client: Client, payload: unknown) => {
      const me = this.playerIds.get(client.sessionId);
      const target = parseFriendTarget(payload);
      if (me !== undefined && target) addFriend(this.db, me, target.playerId);
      this.sendFriends(client);
    },
    [FRIENDS.remove]: (client: Client, payload: unknown) => {
      const me = this.playerIds.get(client.sessionId);
      const target = parseFriendTarget(payload);
      if (me !== undefined && target) removeFriend(this.db, me, target.playerId);
      this.sendFriends(client);
    },
    [FRIENDS.list]: (client: Client) => this.sendFriends(client),
    [SEANCE.start]: (client: Client) => this.handleSeanceStart(client),
    [SEANCE.answer]: (client: Client, payload: unknown) => this.handleSeanceAnswer(client, payload),
    [SEANCE.end]: (client: Client) => this.endSeance(client, "left"),
    [DASH.join]: (client: Client) => this.joinDashQueue(client),
    [DASH.leave]: (client: Client) => this.leaveDashQueue(client.sessionId),
    [DASH.solo]: (client: Client) => {
      if (!this.atDashGate(client.sessionId)) return;
      this.leaveDashQueue(client.sessionId);
      void this.startDash([client.sessionId]);
    },
  };

  // --- Graveyard Dash queue (the gate is in the plaza; the race is its own room) ---

  private dashQueue: string[] = [];
  private dashStartsAt = 0;
  private dashTimer?: { clear(): void };

  private atDashGate(sessionId: string): boolean {
    const g = this.state.ghosts.get(sessionId);
    return this.area === "plaza" && !!g && Math.hypot(g.x - DASH_GATE.x, g.y - DASH_GATE.y) <= DASH_GATE.radius + 30;
  }

  private joinDashQueue(client: Client) {
    if (!this.atDashGate(client.sessionId) || this.dashQueue.includes(client.sessionId)) return;
    this.dashQueue.push(client.sessionId);
    if (this.dashQueue.length >= DASH_MAX_RACERS) {
      void this.startDash(this.dashQueue.splice(0, DASH_MAX_RACERS));
    } else if (this.dashQueue.length >= 2 && !this.dashStartsAt) {
      this.dashStartsAt = Date.now() + DASH_QUEUE_MS;
      this.dashTimer = this.clock.setTimeout(() => void this.startDash(this.dashQueue.splice(0, DASH_MAX_RACERS)), DASH_QUEUE_MS);
    }
    this.sendDashQueue();
  }

  private leaveDashQueue(sessionId: string) {
    const i = this.dashQueue.indexOf(sessionId);
    if (i < 0) return;
    this.dashQueue.splice(i, 1);
    this.clients.find((c) => c.sessionId === sessionId)?.send(DASH_EVENT.queue, { names: [], startsAt: 0, records: {} } satisfies DashQueue);
    if (this.dashQueue.length < 2) this.cancelDashCountdown();
    this.sendDashQueue();
  }

  private cancelDashCountdown() {
    this.dashTimer?.clear();
    this.dashTimer = undefined;
    this.dashStartsAt = 0;
  }

  /** Tell everyone in the queue who's in and when it starts, with their own records. */
  private sendDashQueue() {
    const names = this.dashQueue.map((id) => this.state.ghosts.get(id)?.name ?? "A ghost");
    for (const id of this.dashQueue) {
      const playerId = this.playerIds.get(id);
      const records = playerId !== undefined ? getRecords(this.db, playerId) : {};
      this.clients.find((c) => c.sessionId === id)?.send(DASH_EVENT.queue, { names, startsAt: this.dashStartsAt, records } satisfies DashQueue);
    }
  }

  /** Open a race room for these players on a random track, and send them there. */
  private async startDash(sessionIds: string[]) {
    this.cancelDashCountdown();
    if (this.dashQueue.length >= 2) {
      // Others still waiting: give them their own countdown.
      this.dashStartsAt = Date.now() + DASH_QUEUE_MS;
      this.dashTimer = this.clock.setTimeout(() => void this.startDash(this.dashQueue.splice(0, DASH_MAX_RACERS)), DASH_QUEUE_MS);
    }
    this.sendDashQueue();
    const racers = sessionIds.filter((id) => this.playerIds.has(id));
    if (racers.length === 0) return;
    const map = DASH_MAP_IDS[Math.floor(this.random() * DASH_MAP_IDS.length)]!;
    try {
      const room = await matchMaker.createRoom(DASH_ROOM, { map, playerIds: racers.map((id) => this.playerIds.get(id)) });
      for (const id of racers) this.clients.find((c) => c.sessionId === id)?.send(DASH_EVENT.start, { roomId: room.roomId, map } satisfies DashStart);
    } catch (err) {
      console.error("could not open a dash race", err);
    }
  }

  /** Send the player their friends list, with who's online right now. */
  private sendFriends(client: Client) {
    const me = this.playerIds.get(client.sessionId);
    if (me === undefined) return;
    const list: FriendsList = {
      friends: listFriends(this.db, me).map((f) => ({ ...f, online: isOnline(f.playerId) })),
    };
    client.send(FRIENDS_EVENT.list, list);
  }

  /** Which public area this room is: the plaza, or a place you walk to from it. */
  area: AreaId = "plaza";

  onCreate(options?: { area?: unknown }) {
    if (isAreaId(options?.area)) this.area = options.area;
    this.state.haunting = false; // explicit default so clients read a boolean from the start
    this.setSimulationInterval((deltaMs) => this.tick(deltaMs / 1000), TICK_MS);
    void this.refreshHealth();
    this.clock.setInterval(() => void this.refreshHealth(), HEALTH_INTERVAL_MS);
    this.clock.setInterval(() => this.startHaunting(), MIDNIGHT_INTERVAL_MS);
  }

  /** Begin a midnight haunting: dim the plaza, announce it, and end it after the window. */
  startHaunting() {
    if (this.state.haunting) return;
    this.state.haunting = true;
    this.broadcast(CHAT_ROOM_MESSAGE.caretaker, { kind: "nudge", text: HAUNTING_ANNOUNCE } satisfies CaretakerNote);
    this.clock.setTimeout(() => (this.state.haunting = false), HAUNTING_DURATION_MS);
  }

  onJoin(client: Client, options?: JoinOptions) {
    // Arriving through an exit puts you by the way back; a fresh join uses the normal spawn.
    const from = isAreaId(options?.from) ? options.from : undefined;
    const spawn = this.area === "plaza" && !from ? spawnPoint() : arrivalPoint(this.area, from);
    const ghost = new Ghost();
    ghost.name = cleanName(options?.name) ?? randomName();
    ghost.colour = parseColour(options?.colour) ?? Math.floor(Math.random() * GHOST_COLOURS.length);
    ghost.x = spawn.x;
    ghost.y = spawn.y;
    ghost.bubble = "";
    ghost.bubbleUntil = 0;
    this.state.ghosts.set(client.sessionId, ghost);
    this.chat.set(client.sessionId, { lastMessageAt: 0, blocks: 0, mutedUntil: 0 });

    // Resolve the persistent player (recovery code -> guest id -> new) and send their wallet.
    const guestId = parseGuestId(options?.guestId) ?? randomUUID();
    const player = resolvePlayer(this.db, guestId, options?.recoveryCode ?? null, this.random);
    this.playerIds.set(client.sessionId, player.id);
    client.userData = { playerId: player.id };
    ghost.ownerId = String(player.id);
    setPlayerName(this.db, player.id, ghost.name); // shown to people who add them as a friend
    markOnline(player.id);
    // Restore the hat and pet the player had, if they still own them.
    restoreWearables(this.db, player.id, ghost, options);
    this.sendWallet(client);
  }

  onLeave(client: Client) {
    this.state.ghosts.delete(client.sessionId);
    this.targets.delete(client.sessionId);
    this.chat.delete(client.sessionId);
    const playerId = this.playerIds.get(client.sessionId);
    if (playerId !== undefined) markOffline(playerId);
    this.playerIds.delete(client.sessionId);
    this.rounds.delete(client.sessionId);
    this.seances.delete(client.sessionId); // leaving forfeits an unfinished séance
    this.leaveDashQueue(client.sessionId);
  }

  /** Send the player their coins, owned items and recovery code. */
  private sendWallet(client: Client) {
    const playerId = this.playerIds.get(client.sessionId);
    if (playerId === undefined) return;
    const player = getPlayer(this.db, playerId);
    if (!player) return;
    const wallet: Wallet = {
      coins: player.coins,
      items: ownedItems(this.db, playerId),
      recoveryCode: displayRecoveryCode(player),
    };
    client.send(SHOP_EVENT.wallet, wallet);
  }

  private async refreshHealth() {
    await this.moderator.refreshHealth();
    this.state.caretakerResting = this.moderator.resting;
  }

  private note(client: Client, note: CaretakerNote) {
    client.send(CHAT_ROOM_MESSAGE.caretaker, note);
  }

  /** Hold the message, check it, then broadcast only if allowed. */
  private async handleChat(client: Client, payload: unknown) {
    const ghost = this.state.ghosts.get(client.sessionId);
    const info = this.chat.get(client.sessionId);
    if (!ghost || !info) return;

    const now = Date.now();
    if (now < info.mutedUntil) {
      this.note(client, { kind: "block", text: "Rest a moment longer, spirit. The town will wait for you." });
      return;
    }

    const text = cleanMessage((payload as ChatMessage | null)?.text, MAX_MESSAGE_LENGTH);
    if (!text) return; // empty or too long: silently dropped at the edge

    const decision = await this.moderator.decide(text, info.lastMessageAt, now, {
      senderName: ghost.name,
      priorBlocks: info.blocks,
    });

    if (decision.verdict === "allow") {
      info.lastMessageAt = now;
      ghost.bubble = text;
      ghost.bubbleUntil = now + BUBBLE_TTL_MS;
      const broadcast: ChatBroadcast = { sessionId: client.sessionId, name: ghost.name, text };
      this.broadcast(CHAT_ROOM_MESSAGE.chat, broadcast);
      return;
    }

    if (decision.verdict === "block") {
      info.blocks += 1;
      // A repeat or severe case earns a short timeout. No public shaming.
      if (decision.source === "llm" || info.blocks >= 2) info.mutedUntil = now + 15_000;
    }
    this.note(client, {
      kind: decision.verdict === "block" ? "block" : "nudge",
      text: decision.reason ?? "Let us keep the town kind, dear.",
    });
  }

  // --- Séance (single-player Simon; server owns the sequence and the coins) ---

  private readonly seances = new Map<string, { sequence: number[]; token: number }>();
  private seanceToken = 0;

  private handleSeanceStart(client: Client) {
    const ghost = this.state.ghosts.get(client.sessionId);
    if (!ghost || this.seances.has(client.sessionId) || this.area !== "plaza") return;
    // You have to be at the candle circle, as with fishing at the fountain.
    if (Math.hypot(ghost.x - SEANCE_SPOT.x, ghost.y - SEANCE_SPOT.y) > SEANCE_RANGE + 40) return;
    this.showSeance(client, extendSequence([], this.random));
  }

  /** Send the next sequence and arm its deadline; a stale deadline is ignored via the token. */
  private showSeance(client: Client, sequence: number[]) {
    const token = ++this.seanceToken;
    this.seances.set(client.sessionId, { sequence, token });
    client.send(SEANCE_EVENT.show, { round: sequence.length, sequence } satisfies SeanceShow);
    this.clock.setTimeout(() => {
      if (this.seances.get(client.sessionId)?.token === token) this.endSeance(client, "timeout");
    }, seanceDeadlineMs(sequence.length));
  }

  private handleSeanceAnswer(client: Client, payload: unknown) {
    const seance = this.seances.get(client.sessionId);
    const answer = parseSeanceAnswer(payload);
    if (!seance || !answer) return;
    if (!sequenceMatches(seance.sequence, answer)) return this.endSeance(client, "wrong");
    if (seance.sequence.length >= SEANCE_MAX_ROUNDS) return this.endSeance(client, "complete");
    this.showSeance(client, extendSequence(seance.sequence, this.random));
  }

  private endSeance(client: Client, reason: SeanceEndReason) {
    const seance = this.seances.get(client.sessionId);
    const playerId = this.playerIds.get(client.sessionId);
    if (!seance || playerId === undefined) return;
    this.seances.delete(client.sessionId); // delete first: a second end is a no-op
    // The current sequence was only cleared if the séance was completed.
    const roundsCleared = reason === "complete" ? seance.sequence.length : seance.sequence.length - 1;
    const coins = seanceReward(roundsCleared);
    const balance = (coins > 0 ? addCoins(this.db, playerId, coins) : null) ?? getPlayer(this.db, playerId)?.coins ?? 0;
    client.send(SEANCE_EVENT.result, { roundsCleared, coins, balance, reason } satisfies SeanceResult);
  }

  // --- Ghost Fishing (single-player, request/response, not synced state) ---

  private handleFishStart(client: Client) {
    const playerId = this.playerIds.get(client.sessionId);
    if (playerId === undefined || this.area !== "plaza") return; // the fountain is in the plaza
    // Starting again replaces any stale round; a fresh round earns from zero.
    this.rounds.set(client.sessionId, { endsAt: Date.now() + ROUND_MS, lastCastAt: 0, earned: 0 });
    const started: FishStarted = { roundMs: ROUND_MS, catches: CATCHES };
    client.send(FISH_EVENT.started, started);
  }

  private handleFishCast(client: Client, payload: unknown) {
    const round = this.rounds.get(client.sessionId);
    if (!round) return;
    const now = Date.now();
    if (now >= round.endsAt) {
      this.handleFishEnd(client);
      return;
    }
    const cast = parseCast(payload);
    if (!cast) return;
    if (now - round.lastCastAt < CAST_COOLDOWN_MS) return; // rate limit: no coin farming
    round.lastCastAt = now;

    const caught = rollCatch(cast.accuracy, this.random);
    round.earned += caught.coins;
    const result: FishCatch = { catchId: caught.id, coins: caught.coins };
    client.send(FISH_EVENT.catch, result);
  }

  private handleFishEnd(client: Client) {
    const round = this.rounds.get(client.sessionId);
    const playerId = this.playerIds.get(client.sessionId);
    if (!round || playerId === undefined) return;
    this.rounds.delete(client.sessionId); // delete first: a second end is a no-op

    const balance = round.earned > 0 ? addCoins(this.db, playerId, round.earned) : getPlayer(this.db, playerId)?.coins;
    const ended: FishEnded = { coinsEarned: round.earned, balance: balance ?? 0 };
    client.send(FISH_EVENT.ended, ended);
  }

  // --- Shop ---

  private handleBuy(client: Client, payload: unknown) {
    const playerId = this.playerIds.get(client.sessionId);
    if (playerId === undefined) return;
    const buy = parseBuy(payload);
    if (!buy) return;
    const item = getShopItem(buy.itemId)!; // parseBuy only passes known ids
    // Pets are sold only at the Pet Store door.
    if (item.kind === "pet") {
      const g = this.state.ghosts.get(client.sessionId);
      const d = PET_STORE.door;
      if (this.area !== "plaza" || !g || Math.hypot(g.x - d.x, g.y - d.y) > PET_STORE.radius + 40) return;
    }

    const balance = buyItem(this.db, playerId, item.id, item.price);
    if (balance === null) {
      const owned = ownedItems(this.db, playerId).includes(item.id);
      const denied: ShopDenied = { itemId: item.id, reason: owned ? "owned" : "cost" };
      client.send(SHOP_EVENT.denied, denied);
      return;
    }
    const bought: ShopBought = { itemId: item.id, balance };
    client.send(SHOP_EVENT.bought, bought);
  }

  /** Wear an owned hat (or "" for none). Ignores unowned or non-hat ids. */
  private handleSetHat(client: Client, payload: unknown) {
    const playerId = this.playerIds.get(client.sessionId);
    const ghost = this.state.ghosts.get(client.sessionId);
    if (playerId === undefined || !ghost) return;
    const hat = (payload as { hat?: unknown } | null)?.hat;
    if (canUse(this.db, playerId, "hat", hat)) ghost.hat = hat;
  }

  /** Bring an owned pet along (or "" for none). Ignores unowned or non-pet ids. */
  private handleSetPet(client: Client, payload: unknown) {
    const playerId = this.playerIds.get(client.sessionId);
    const ghost = this.state.ghosts.get(client.sessionId);
    if (playerId === undefined || !ghost) return;
    const pet = (payload as { pet?: unknown } | null)?.pet;
    if (canUse(this.db, playerId, "pet", pet)) ghost.pet = pet;
  }

  /** Advance moving ghosts and expire old chat bubbles. Public so tests can drive it. */
  tick(dtSeconds: number) {
    const now = Date.now();
    // Walking away from the Dash Gate leaves the queue.
    for (const id of [...this.dashQueue]) if (!this.atDashGate(id)) this.leaveDashQueue(id);
    for (const [id, target] of this.targets) {
      const ghost = this.state.ghosts.get(id);
      if (!ghost) continue;
      const next = stepGhost({ x: ghost.x, y: ghost.y }, target, dtSeconds, AREAS[this.area].walk);
      if (next.x === ghost.x && next.y === ghost.y) {
        this.targets.delete(id);
        continue;
      }
      ghost.x = next.x;
      ghost.y = next.y;
    }
    this.state.ghosts.forEach((ghost) => {
      if (ghost.bubble && now >= ghost.bubbleUntil) {
        ghost.bubble = "";
        ghost.bubbleUntil = 0;
      }
    });
    // Close any fishing round whose 60 seconds are up.
    for (const [id, round] of this.rounds) {
      if (now >= round.endsAt) {
        const client = this.clients.find((c) => c.sessionId === id);
        if (client) this.handleFishEnd(client);
        else this.rounds.delete(id);
      }
    }
  }
}
