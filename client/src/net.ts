import { Client, type Room } from "@colyseus/sdk";
import {
  CHAT_ROOM_MESSAGE,
  DEFAULT_SERVER_PORT,
  FISH,
  FISH_EVENT,
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
