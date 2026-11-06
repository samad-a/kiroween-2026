import { Client, type Room } from "@colyseus/sdk";
import {
  CHAT_ROOM_MESSAGE,
  DEFAULT_SERVER_PORT,
  FISH,
  FISH_EVENT,
  FRIENDS,
  FRIENDS_EVENT,
  type FriendTarget,
  type FriendsList,
  SEANCE,
  SEANCE_EVENT,
  type SeanceResult,
  type SeanceShow,
  HAUNTED_ROOM,
  MESSAGE,
  PLAZA_ROOM,
  ROOM,
  SHOP,
  SHOP_EVENT,
  parseGuestId,
  type CaretakerNote,
  type CastMessage,
  type ChatBroadcast,
  type ChatMessage,
  type FishCatch,
  type FishEnded,
  type FishStarted,
  type JoinOptions,
  type MoveMessage,
  type ShopBought,
  type ShopDenied,
  type Wallet,
} from "@club-kiro/shared";

/** The synced shape the client reads. Mirrors server/src/state.ts. */
export interface GhostView {
  name: string;
  colour: number;
  x: number;
  y: number;
  bubble: string;
  bubbleUntil: number;
  hat: string;
  ownerId: string;
}

export interface PlazaView {
  ghosts: { forEach(cb: (ghost: GhostView, id: string) => void): void; get(id: string): GhostView | undefined };
  caretakerResting: boolean;
  haunting: boolean;
}

export type PlazaRoom = Room<unknown, PlazaView>;

/** A placed decoration as the client reads it from synced room state. */
export interface RoomItemView {
  itemId: string;
  x: number;
  y: number;
}

export interface HauntedRoomView {
  ghosts: { forEach(cb: (ghost: GhostView, id: string) => void): void; get(id: string): GhostView | undefined };
  items: { forEach(cb: (item: RoomItemView, i: number) => void): void; length: number; [i: number]: RoomItemView };
  ownerId: string;
  ownerName: string;
}

export type HauntedRoomClient = Room<unknown, HauntedRoomView>;

function serverUrl(): string {
  const configured = import.meta.env.VITE_SERVER_URL as string | undefined;
  if (configured) return configured;
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${location.hostname}:${DEFAULT_SERVER_PORT}`;
}

const GUEST_ID_KEY = "clubkiro.guestId";
const RECOVERY_KEY = "clubkiro.recoveryCode";

/** The browser's guest id, creating and storing one on first visit. */
function guestId(): string {
  const stored = parseGuestId(localStorage.getItem(GUEST_ID_KEY));
  if (stored) return stored;
  const fresh = crypto.randomUUID();
  localStorage.setItem(GUEST_ID_KEY, fresh);
  return fresh;
}

/** Store the recovery code the server issued, so it can be shown and reused. */
export function saveRecoveryCode(code: string): void {
  localStorage.setItem(RECOVERY_KEY, code);
}

export function joinOptionsWithIdentity(options: JoinOptions): JoinOptions {
  const recoveryCode = localStorage.getItem(RECOVERY_KEY) ?? undefined;
  return { ...options, guestId: guestId(), recoveryCode };
}

export async function joinPlaza(options: JoinOptions): Promise<PlazaRoom> {
  const client = new Client(serverUrl());
  const room = await client.joinOrCreate<PlazaView>(PLAZA_ROOM, joinOptionsWithIdentity(options));
  return room as PlazaRoom;
}

/** Visit a haunted room by its owner's player id. */
export async function joinHauntedRoom(options: JoinOptions, ownerPlayerId: number): Promise<HauntedRoomClient> {
  const client = new Client(serverUrl());
  const room = await client.joinOrCreate<HauntedRoomView>(HAUNTED_ROOM, {
    ...joinOptionsWithIdentity(options),
    ownerPlayerId,
  });
  return room as HauntedRoomClient;
}

export function placeItem(room: HauntedRoomClient, itemId: string, x: number, y: number): void {
  room.send(ROOM.place, { itemId, x, y });
}
export function moveItem(room: HauntedRoomClient, index: number, x: number, y: number): void {
  room.send(ROOM.move, { index, x, y });
}
export function removeItem(room: HauntedRoomClient, index: number): void {
  room.send(ROOM.remove, { index });
}

export function sendMove(room: PlazaRoom, target: MoveMessage): void {
  room.send(MESSAGE.move, target);
}

export function sendChat(room: PlazaRoom, text: string): void {
  const message: ChatMessage = { text };
  room.send(CHAT_ROOM_MESSAGE.chat, message);
}

/** Private, in-character notes from the Caretaker to this player only. */
export function onCaretakerNote(room: PlazaRoom, handler: (note: CaretakerNote) => void): void {
  room.onMessage(CHAT_ROOM_MESSAGE.caretaker, handler);
}

/** Allowed chat messages broadcast to everyone. */
export function onChat(room: PlazaRoom, handler: (msg: ChatBroadcast) => void): void {
  room.onMessage(CHAT_ROOM_MESSAGE.chat, handler);
}

// --- Ghost Fishing ---

export function startFishing(room: PlazaRoom): void {
  room.send(FISH.start, {});
}

export function sendCast(room: PlazaRoom, accuracy: number): void {
  const message: CastMessage = { accuracy };
  room.send(FISH.cast, message);
}

export function endFishing(room: PlazaRoom): void {
  room.send(FISH.end, {});
}

export function onFishStarted(room: PlazaRoom, handler: (msg: FishStarted) => void): void {
  room.onMessage(FISH_EVENT.started, handler);
}

export function onFishCatch(room: PlazaRoom, handler: (msg: FishCatch) => void): void {
  room.onMessage(FISH_EVENT.catch, handler);
}

export function onFishEnded(room: PlazaRoom, handler: (msg: FishEnded) => void): void {
  room.onMessage(FISH_EVENT.ended, handler);
}

// --- Shop / wallet ---

export function sendBuy(room: PlazaRoom, itemId: string): void {
  room.send(SHOP.buy, { itemId });
}

/** Wear an owned hat (shop item id), or "" to remove the current hat. */
export function sendSetHat(room: PlazaRoom, hat: string): void {
  room.send(ROOM.setHat, { hat });
}

/** Coins, owned items and the recovery code. Sent on join and after changes. */
export function onWallet(room: PlazaRoom, handler: (wallet: Wallet) => void): void {
  room.onMessage(SHOP_EVENT.wallet, handler);
}

export function onBought(room: PlazaRoom, handler: (msg: ShopBought) => void): void {
  room.onMessage(SHOP_EVENT.bought, handler);
}

export function onDenied(room: PlazaRoom, handler: (msg: ShopDenied) => void): void {
  room.onMessage(SHOP_EVENT.denied, handler);
}

// --- Friends ---

export function addFriend(room: PlazaRoom, playerId: number): void {
  room.send(FRIENDS.add, { playerId } satisfies FriendTarget);
}
export function removeFriend(room: PlazaRoom, playerId: number): void {
  room.send(FRIENDS.remove, { playerId } satisfies FriendTarget);
}
export function requestFriends(room: PlazaRoom): void {
  room.send(FRIENDS.list);
}
export function onFriends(room: PlazaRoom, handler: (list: FriendsList) => void): void {
  room.onMessage(FRIENDS_EVENT.list, handler);
}

// --- Séance ---

export function startSeance(room: PlazaRoom): void {
  room.send(SEANCE.start);
}
export function answerSeance(room: PlazaRoom, answer: number[]): void {
  room.send(SEANCE.answer, { answer });
}
export function endSeance(room: PlazaRoom): void {
  room.send(SEANCE.end);
}
export function onSeanceShow(room: PlazaRoom, handler: (msg: SeanceShow) => void): void {
  room.onMessage(SEANCE_EVENT.show, handler);
}
export function onSeanceResult(room: PlazaRoom, handler: (msg: SeanceResult) => void): void {
  room.onMessage(SEANCE_EVENT.result, handler);
}
