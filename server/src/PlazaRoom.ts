import { Room, type Client } from "colyseus";
import {
  BUBBLE_TTL_MS,
  CHAT_ROOM_MESSAGE,
  GHOST_COLOURS,
  MAX_GHOSTS_PER_PLAZA,
  MAX_MESSAGE_LENGTH,
  MESSAGE,
  PLAZA_HEIGHT,
  PLAZA_WIDTH,
  cleanMessage,
  cleanName,
  hitsObstacle,
  parseColour,
  parseMove,
  randomName,
  stepGhost,
  type CaretakerNote,
  type ChatBroadcast,
  type ChatMessage,
  type JoinOptions,
  type Point,
} from "@club-kiro/shared";
import { Ghost, PlazaState } from "./state.js";
import { createModerator, type Moderator } from "./caretaker/moderate.js";

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

export class PlazaRoom extends Room<{ state: PlazaState }> {
  maxClients = MAX_GHOSTS_PER_PLAZA;
  maxMessagesPerSecond = 30;
  state = new PlazaState();

  private readonly targets = new Map<string, Point>();
  private readonly chat = new Map<string, ChatInfo>();
  private moderator: Moderator = createModerator();

  messages = {
    [MESSAGE.move]: (client: Client, payload: unknown) => {
      const target = parseMove(payload);
      if (target && this.state.ghosts.has(client.sessionId)) this.targets.set(client.sessionId, target);
    },
    [CHAT_ROOM_MESSAGE.chat]: (client: Client, payload: unknown) => {
      void this.handleChat(client, payload);
    },
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
  }

  onLeave(client: Client) {
    this.state.ghosts.delete(client.sessionId);
    this.targets.delete(client.sessionId);
    this.chat.delete(client.sessionId);
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
  }
}
