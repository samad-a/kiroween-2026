// Town life: emotes, quick chat, the wishing well, the lighthouse lamp, crypt riddles,
// stamps, the daily gift, the featured item, the notice board and room parties.
// The server owns every coin and stamp; clients only send intents.
import { FOUNTAIN_CENTRE } from "./constants.js";
import { SHOP_ITEMS, type ShopItem } from "./shop.js";

/** Client to server. */
export const TOWN = {
  emote: "town:emote",
  quick: "town:quick",
  wish: "town:wish",
  tend: "town:tend",
  riddle: "town:riddle",
  riddleAnswer: "town:riddle-answer",
  stamps: "town:stamps",
  parties: "town:parties",
  party: "town:party",
} as const;

/** Server to client. */
export const TOWN_EVENT = {
  emote: "town:emote",
  stamps: "town:stamps",
  stamp: "town:stamp",
  gift: "town:gift",
  riddle: "town:riddle",
  riddleResult: "town:riddle-result",
  coins: "town:coins",
  parties: "town:parties",
} as const;

const isIndex = (v: unknown, length: number): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) < length;

/** Read `{ [key]: index }` with the index in range, or null. */
export function parseIndex(payload: unknown, key: string, length: number): number | null {
  if (typeof payload !== "object" || payload === null) return null;
  const v = (payload as Record<string, unknown>)[key];
  return isIndex(v, length) ? v : null;
}

// --- Emotes (keys 1 to 5) ---

export const EMOTES = ["wave", "heart", "laugh", "boo", "star"] as const;
export type Emote = (typeof EMOTES)[number];
export const EMOTE_LABELS: Record<Emote, string> = { wave: "Wave", heart: "Heart", laugh: "Laugh", boo: "Boo!", star: "Star" };
export const EMOTE_COOLDOWN_MS = 1000;

/** Server to everyone: this ghost emoted. */
export interface EmoteBroadcast {
  sessionId: string;
  emote: number;
}

// --- Quick chat: pre-approved lines that skip the Caretaker's check ---

export const QUICK_CHAT = [
  "Hi there!",
  "Want to go fishing?",
  "Race me at the Dash Gate!",
  "Nice hat!",
  "Follow me!",
  "Good game!",
  "Come visit my room!",
  "Thank you!",
  "Boo! Did I scare you?",
  "See you later!",
] as const;

// --- Wishing well: toss a coin in the fountain for a minute of sparkle ---

export const WISH_SPOT = { area: "plaza", x: FOUNTAIN_CENTRE.x, y: FOUNTAIN_CENTRE.y, radius: 160 } as const;
export const WISH_COST = 1;
export const WISH_SPARKLE_MS = 60_000;

// --- Lantern keeping: everyone at the lighthouse keeps its lamp lit together ---

export const LAMP_SPOT = { area: "lighthouse", x: 905, y: 300, radius: 90 } as const;
export const LAMP_MAX = 100;
export const LAMP_TEND = 6;
export const LAMP_DECAY_PER_S = 0.5;
export const LAMP_TEND_COOLDOWN_MS = 1200;
/** Coins for everyone who tended the lamp in the last minute when it blazes. */
export const LAMP_REWARD = 8;
export const LAMP_HELPER_WINDOW_MS = 60_000;
export const LAMP_AFTER_BLAZE = 40;

// --- Crypt riddles, asked by the old skull in the crypt's far alcove ---

export const RIDDLE_SPOT = { area: "crypt", x: 1060, y: 330, radius: 90 } as const;
export const RIDDLE_COINS = 3;
export const RIDDLE_COOLDOWN_MS = 4000;

export interface Riddle {
  q: string;
  options: readonly [string, string, string];
  answer: 0 | 1 | 2;
}

export const RIDDLES: readonly Riddle[] = [
  { q: "I have keys but open no locks. I sing at midnight with no voice. What am I?", options: ["A piano", "A ghost", "A door"], answer: 0 },
  { q: "The more of me you take, the more you leave behind. What am I?", options: ["Coins", "Footsteps", "Candles"], answer: 1 },
  { q: "I'm full of holes but still hold water. What am I?", options: ["A cauldron", "A sponge", "A net"], answer: 1 },
  { q: "What has a face and two hands but no arms or legs?", options: ["A clock", "A scarecrow", "A mirror"], answer: 0 },
  { q: "I go up but never come down. What am I?", options: ["Smoke", "Your age", "A bat"], answer: 1 },
  { q: "What can fill a room but takes up no space?", options: ["Fog", "Light", "Cobwebs"], answer: 1 },
  { q: "I'm always running but never get tired. What am I?", options: ["A river", "A ghost", "A spider"], answer: 0 },
  { q: "What gets wetter the more it dries?", options: ["A towel", "A puddle", "A pumpkin"], answer: 0 },
  { q: "I have a neck but no head, and wear a cap. What am I?", options: ["A scarecrow", "A bottle", "A candle"], answer: 1 },
  { q: "What has one eye but cannot see?", options: ["A needle", "A cyclops", "A potato"], answer: 0 },
  { q: "The person who makes me doesn't need me. The one who uses me never sees me. What am I?", options: ["A coffin", "A mask", "A lantern"], answer: 0 },
  { q: "I'm light as a feather, yet the strongest ghost can't hold me for long. What am I?", options: ["A whisper", "Breath", "A shadow"], answer: 1 },
  { q: "What comes once in a minute, twice in a moment, and never in a thousand years?", options: ["The letter M", "A haunting", "A full moon"], answer: 0 },
  { q: "I follow you all day but vanish in the dark. What am I?", options: ["Your shadow", "A bat", "A pet wisp"], answer: 0 },
  { q: "What has many teeth but never bites?", options: ["A comb", "A jack-o'-lantern", "A skeleton"], answer: 0 },
];

/** Server to client: answer this riddle (the answer stays on the server). */
export interface RiddleAsk {
  q: string;
  options: readonly string[];
}

/** Server to client: how the answer went. */
export interface RiddleResult {
  correct: boolean;
  answer: string;
  coins: number;
  balance: number;
}

// --- Stamps: small achievements, kept in the stamp book ---

export const STAMPS = [
  { id: "first-catch", name: "First Catch", how: "Catch something off the lighthouse jetty." },
  { id: "spooky-fish", name: "Spooky Angler", how: "Land a Spooky Fish." },
  { id: "first-buy", name: "Window Shopper", how: "Buy anything from a shop." },
  { id: "pet-pal", name: "Pet Pal", how: "Adopt a pet from the Pet Store." },
  { id: "seance-5", name: "Medium", how: "Clear 5 rounds of the séance in the crypt." },
  { id: "riddler", name: "Riddler", how: "Answer one of the crypt skull's riddles." },
  { id: "lamp-keeper", name: "Lamp Keeper", how: "Help the lighthouse lamp blaze." },
  { id: "wish", name: "Wishful", how: "Toss a coin into the fountain." },
  { id: "dash-win", name: "Swift Spirit", how: "Win a Graveyard Dash against others." },
  { id: "visitor", name: "Good Neighbour", how: "Visit another ghost's room." },
  { id: "party-host", name: "Party Host", how: "Open your room for a party." },
  { id: "emote", name: "Expressive", how: "Use an emote (keys 1 to 5)." },
  { id: "friend", name: "Kindred Spirit", how: "Add a friend." },
] as const;
export type StampId = (typeof STAMPS)[number]["id"];
export const isStampId = (v: unknown): v is StampId => STAMPS.some((s) => s.id === v);

/** Server to client: the stamps you have. */
export interface StampList {
  stamps: string[];
}

/** Server to client: a new stamp, just earned. */
export interface StampEarned {
  id: string;
}

// --- Daily gift ---

export const DAILY_GIFT_COINS = 10;
/** The UTC day a timestamp falls on, e.g. "2026-11-06". One gift per day. */
export const dayKey = (now: number): string => new Date(now).toISOString().slice(0, 10);

/** Server to client: today's gift was given. */
export interface DailyGift {
  coins: number;
  balance: number;
}

/** Server to client: coins changed for a town reason (wish, lamp). */
export interface CoinsChanged {
  balance: number;
}

// --- Featured item and weekly event (both rotate every Monday, UTC) ---

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** Weeks since a Monday epoch (1970-01-05 was a Monday). */
export const weekIndex = (now: number): number => Math.floor((now - 4 * 24 * 60 * 60 * 1000) / WEEK_MS);

export const FEATURED_DISCOUNT = 0.25;

/** This week's featured hat or decoration, sold at a discount. Pets are never featured. */
export function featuredItem(now: number): ShopItem {
  const pool = SHOP_ITEMS.filter((i) => i.kind !== "pet");
  return pool[((weekIndex(now) % pool.length) + pool.length) % pool.length]!;
}

/** What an item costs right now, after any featured discount. */
export function priceOf(item: ShopItem, now: number): number {
  return featuredItem(now).id === item.id ? Math.ceil(item.price * (1 - FEATURED_DISCOUNT)) : item.price;
}

export const WEEKLY_EVENTS = [
  { title: "Lantern Week", text: "The lighthouse lamp burns low. Gather on the cliffs and keep it blazing together." },
  { title: "Riddle Week", text: "The old skull in the crypt has new riddles. Answer them for coins." },
  { title: "Fishing Derby", text: "The sea is full of Spooky Fish this week. Cast a line off the jetty." },
  { title: "Party Week", text: "Open your haunted room and invite the town. Parties are listed on this board." },
] as const;

export const weeklyEvent = (now: number) => WEEKLY_EVENTS[((weekIndex(now) % WEEKLY_EVENTS.length) + WEEKLY_EVENTS.length) % WEEKLY_EVENTS.length]!;

// --- Notice board (plaza) and room parties ---

export const NOTICE_SPOT = { area: "plaza", x: 250, y: 290, radius: 90 } as const;

/** One open room party, as listed on the notice board. */
export interface PartyView {
  ownerPlayerId: number;
  ownerName: string;
  guests: number;
}

export interface PartyList {
  parties: PartyView[];
}

/** Within `radius` of a spot in the given area? */
export function atSpot(spot: { area: string; x: number; y: number; radius: number }, area: string, p: { x: number; y: number }, slack = 0): boolean {
  return area === spot.area && Math.hypot(p.x - spot.x, p.y - spot.y) <= spot.radius + slack;
}
