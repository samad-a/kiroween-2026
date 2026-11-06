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
  ROOM_AREA,
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
import { playerName } from "./db/friends.js";
import { restoreWearables } from "./wearables.js";
import { markOffline, markOnline } from "./presence.js";
import { awardStamp } from "./db/town.js";
import { closeParty, openParty, setPartyGuests } from "./parties.js";
import { TOWN } from "@club-kiro/shared";
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
    // The owner opens or closes the room as a party, listed on the plaza notice board.
    [TOWN.party]: (client: Client, payload: unknown) => {
      if (!this.isOwner(client)) return;
      const open = (payload as { open?: unknown } | null)?.open === true;
      this.state.party = open;
      if (open) {
        openParty(this.ownerPlayerId, this.state.ownerName, this.state.ghosts.size);
        awardStamp(this.db, this.ownerPlayerId, "party-host");
      } else {
        closeParty(this.ownerPlayerId);
      }
    },
    move: (client: Client, payload: unknown) => {
      const target = parseMove(payload);
      if (target && this.state.ghosts.has(client.sessionId)) this.targets.set(client.sessionId, target);
    },
    // Keys released: stop on the spot rather than walking back to a stale position.
    stop: (client: Client) => {
      this.targets.delete(client.sessionId);
    },
  };

  onCreate(options?: RoomJoinOptions) {
    // The room belongs to one owner, fixed for its lifetime.
    this.ownerPlayerId = Number(options?.ownerPlayerId) || 0;
    this.state.ownerId = String(this.ownerPlayerId);
    const owner = this.ownerPlayerId ? getPlayer(this.db, this.ownerPlayerId) : null;
    // Show the owner's ghost name ("Misty Moth's room"), not their internal id.
    this.state.ownerName = owner ? playerName(this.db, owner.id) || "A ghost" : "A ghost";
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
    restoreWearables(this.db, player.id, ghost, options);
    this.state.ghosts.set(client.sessionId, ghost);
    markOnline(player.id); // still "online" to friends while visiting a room
    if (player.id !== this.ownerPlayerId) awardStamp(this.db, player.id, "visitor");
    setPartyGuests(this.ownerPlayerId, this.state.ghosts.size);
  }

  onLeave(client: Client) {
    this.state.ghosts.delete(client.sessionId);
    this.targets.delete(client.sessionId);
    const playerId = (client.userData as { playerId?: number } | undefined)?.playerId;
    if (playerId !== undefined) markOffline(playerId);
    // The party ends when its host goes home.
    if (playerId === this.ownerPlayerId) {
      this.state.party = false;
      closeParty(this.ownerPlayerId);
    }
    setPartyGuests(this.ownerPlayerId, this.state.ghosts.size);
  }

  onDispose() {
    closeParty(this.ownerPlayerId);
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
      // Rooms have their own floor line and none of the plaza's props.
      const next = stepGhost({ x: ghost.x, y: ghost.y }, target, dtSeconds, ROOM_AREA);
      if (next.x === ghost.x && next.y === ghost.y) {
        this.targets.delete(id);
        continue;
      }
      ghost.x = next.x;
      ghost.y = next.y;
    }
  }
}
