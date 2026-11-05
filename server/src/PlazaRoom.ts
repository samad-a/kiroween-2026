import { Room, type Client } from "colyseus";
import {
  BUBBLE_TTL_MS,
  CAST_COOLDOWN_MS,
  CATCHES,
  CHAT_ROOM_MESSAGE,
  FISH,
  FISH_EVENT,
  GHOST_COLOURS,
  MAX_GHOSTS_PER_PLAZA,
  MAX_MESSAGE_LENGTH,
  MESSAGE,
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
import type { DB } from "./db/index.js";

export const TICK_MS = 50;
/** How often to recheck whether the Caretaker's AI is back. */
const HEALTH_INTERVAL_MS = 30_000;

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
    [CHAT_ROOM_MESSAGE.chat]: (client: Client, payload: unknown) => {
      void this.handleChat(client, payload);
    },
    [FISH.start]: (client: Client) => this.handleFishStart(client),
    [FISH.cast]: (client: Client, payload: unknown) => this.handleFishCast(client, payload),
    [FISH.end]: (client: Client) => this.handleFishEnd(client),
    [SHOP.buy]: (client: Client, payload: unknown) => this.handleBuy(client, payload),
    [ROOM.setHat]: (client: Client, payload: unknown) => this.handleSetHat(client, payload),
  };

  onCreate() {
    this.setSimulationInterval((deltaMs) => this.tick(deltaMs / 1000), TICK_MS);
    void this.refreshHealth();
    this.clock.setInterval(() => void this.refreshHealth(), HEALTH_INTERVAL_MS);
  }

  onJoin(client: Client, options?: JoinOptions) {
    const spawn = spawnPoint();
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
    // Restore a previously-worn hat the player still owns.
    if (options?.hat && ownsItem(this.db, player.id, options.hat) && getShopItem(options.hat)?.kind === "hat") {
      ghost.hat = options.hat;
    }
    this.sendWallet(client);
  }

  onLeave(client: Client) {
    this.state.ghosts.delete(client.sessionId);
    this.targets.delete(client.sessionId);
    this.chat.delete(client.sessionId);
    this.playerIds.delete(client.sessionId);
    this.rounds.delete(client.sessionId);
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

  // --- Ghost Fishing (single-player, request/response, not synced state) ---

  private handleFishStart(client: Client) {
    const playerId = this.playerIds.get(client.sessionId);
    if (playerId === undefined) return;
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
    if (hat === "") {
      ghost.hat = "";
      return;
    }
    if (typeof hat === "string" && getShopItem(hat)?.kind === "hat" && ownsItem(this.db, playerId, hat)) {
      ghost.hat = hat;
    }
  }

  /** Advance moving ghosts and expire old chat bubbles. Public so tests can drive it. */
  tick(dtSeconds: number) {
    const now = Date.now();
    for (const [id, target] of this.targets) {
      const ghost = this.state.ghosts.get(id);
      if (!ghost) continue;
      const next = stepGhost({ x: ghost.x, y: ghost.y }, target, dtSeconds);
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
