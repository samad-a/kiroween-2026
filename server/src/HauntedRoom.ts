import { Room, type Client } from "colyseus";
import {
  GHOST_COLOURS,
  MAX_GHOSTS_PER_PLAZA,
  MAX_ROOM_ITEMS,
  ROOM,
  ROOM_HEIGHT,
  ROOM_WIDTH,
  cleanName,
  getShopItem,
  parseColour,
  parseGuestId,
  parseMove,
  parseMoveItem,
  parsePlacement,
  parseRemoveItem,
  randomName,
  stepGhost,
  type JoinOptions,
  type PlacedItem,
  type Point,
} from "@club-kiro/shared";
import { randomUUID } from "node:crypto";
import { Ghost } from "./state.js";
import { HauntedRoomState, RoomItem } from "./RoomState.js";
import { getDb } from "./db/shared.js";
import { getPlayer, ownsItem, resolvePlayer } from "./db/players.js";
import { getLayout, saveLayout } from "./db/rooms.js";
import type { DB } from "./db/index.js";

const TICK_MS = 50;

interface RoomJoinOptions extends JoinOptions {
  /** Which player's room to visit. */
  ownerPlayerId?: number;
}

/**
 * A personal haunted room. The owner may place/move/remove decorations (owner-only,
 * enforced server-side); visitors can walk around and chat but never edit.
 */
export class HauntedRoom extends Room<{ state: HauntedRoomState }> {
  maxClients = MAX_GHOSTS_PER_PLAZA;
  state = new HauntedRoomState();

  private readonly targets = new Map<string, Point>();
  db: DB = getDb();
  private random: () => number = Math.random;
  private ownerPlayerId = 0;

  messages = {
    [ROOM.place]: (client: Client, payload: unknown) => this.handlePlace(client, payload),
    [ROOM.move]: (client: Client, payload: unknown) => this.handleMoveItem(client, payload),
    [ROOM.remove]: (client: Client, payload: unknown) => this.handleRemoveItem(client, payload),
    move: (client: Client, payload: unknown) => {
      const target = parseMove(payload);
      if (target && this.state.ghosts.has(client.sessionId)) this.targets.set(client.sessionId, target);
    },
  };

  onCreate(options?: RoomJoinOptions) {
    // The room belongs to one owner, fixed for its lifetime.
    this.ownerPlayerId = Number(options?.ownerPlayerId) || 0;
    this.state.ownerId = String(this.ownerPlayerId);
    const owner = this.ownerPlayerId ? getPlayer(this.db, this.ownerPlayerId) : null;
    this.state.ownerName = owner ? `Player ${owner.id}` : "A ghost";
    // Load the owner's saved layout into synced state.
    for (const item of getLayout(this.db, this.ownerPlayerId)) this.addItemToState(item);
    this.setSimulationInterval((dtMs) => this.tick(dtMs / 1000), TICK_MS);
  }

  onJoin(client: Client, options?: RoomJoinOptions) {
    const guestId = parseGuestId(options?.guestId) ?? randomUUID();
    const player = resolvePlayer(this.db, guestId, options?.recoveryCode ?? null, this.random);
    client.userData = { playerId: player.id };

    const ghost = new Ghost();
    ghost.name = cleanName(options?.name) ?? randomName();
    ghost.colour = parseColour(options?.colour) ?? Math.floor(Math.random() * GHOST_COLOURS.length);
    ghost.x = ROOM_WIDTH / 2;
    ghost.y = ROOM_HEIGHT - 120;
    ghost.ownerId = String(player.id);
    if (options?.hat && ownsItem(this.db, player.id, options.hat) && getShopItem(options.hat)?.kind === "hat") {
      ghost.hat = options.hat;
    }
    this.state.ghosts.set(client.sessionId, ghost);
  }

  onLeave(client: Client) {
    this.state.ghosts.delete(client.sessionId);
    this.targets.delete(client.sessionId);
  }

  /** True if this client is the room's owner. */
  private isOwner(client: Client): boolean {
    return (client.userData as { playerId?: number } | undefined)?.playerId === this.ownerPlayerId && this.ownerPlayerId !== 0;
  }

  private addItemToState(item: PlacedItem) {
    const r = new RoomItem();
    r.itemId = item.itemId;
    r.x = item.x;
    r.y = item.y;
    this.state.items.push(r);
  }

  /** Persist the current synced items as the owner's layout. */
  private persist() {
    const layout: PlacedItem[] = this.state.items.map((i) => ({ itemId: i.itemId, x: i.x, y: i.y }));
    saveLayout(this.db, this.ownerPlayerId, layout);
  }

  private handlePlace(client: Client, payload: unknown) {
    if (!this.isOwner(client)) return; // visitors cannot edit
    if (this.state.items.length >= MAX_ROOM_ITEMS) return;
    const placed = parsePlacement(payload);
    if (!placed || !ownsItem(this.db, this.ownerPlayerId, placed.itemId)) return;
    this.addItemToState(placed);
    this.persist();
  }

  private handleMoveItem(client: Client, payload: unknown) {
    if (!this.isOwner(client)) return;
    const mv = parseMoveItem(payload);
    if (!mv || mv.index >= this.state.items.length) return;
    const item = this.state.items[mv.index]!;
    item.x = mv.x;
    item.y = mv.y;
    this.persist();
  }

  private handleRemoveItem(client: Client, payload: unknown) {
    if (!this.isOwner(client)) return;
    const rm = parseRemoveItem(payload);
    if (!rm || rm.index >= this.state.items.length) return;
    this.state.items.splice(rm.index, 1);
    this.persist();
  }

  /** Advance moving ghosts. Public so tests can drive it. */
  tick(dtSeconds: number) {
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
  }
}
