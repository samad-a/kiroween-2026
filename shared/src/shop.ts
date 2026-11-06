// The shop catalogue, shared so client and server agree on ids and prices.
// Static: there is nothing to persist about the catalogue itself, only who owns what.
// Granting ownership is this spec's job; wearing/placing items is haunted-ui's.
import { PET_ITEMS } from "./pets.js";

export const SHOP = { buy: "shop:buy" } as const;
export const SHOP_EVENT = { bought: "shop:bought", denied: "shop:denied", wallet: "wallet" } as const;

export type ItemKind = "hat" | "decoration" | "pet";

export interface ShopItem {
  id: string;
  kind: ItemKind;
  name: string;
  price: number;
}

/** ~6 hats/outfits and ~6 room decorations. Prices roughly track rarity. */
export const SHOP_ITEMS: readonly ShopItem[] = [
  { id: "hat-witch", kind: "hat", name: "Witch Hat", price: 20 },
  { id: "hat-top", kind: "hat", name: "Crooked Top Hat", price: 25 },
  { id: "hat-flower", kind: "hat", name: "Wilted Flower Crown", price: 30 },
  { id: "hat-crown", kind: "hat", name: "Bone Crown", price: 45 },
  { id: "hat-halo", kind: "hat", name: "Flickering Halo", price: 60 },
  { id: "hat-jack", kind: "hat", name: "Jack-o'-Lantern Head", price: 80 },
  { id: "dec-lantern", kind: "decoration", name: "Paper Lantern", price: 15 },
  { id: "dec-rug", kind: "decoration", name: "Cobweb Rug", price: 20 },
  { id: "dec-candle", kind: "decoration", name: "Dripping Candle", price: 25 },
  { id: "dec-cauldron", kind: "decoration", name: "Bubbling Cauldron", price: 40 },
  { id: "dec-portrait", kind: "decoration", name: "Haunted Portrait", price: 55 },
  { id: "dec-tree", kind: "decoration", name: "Twisted Willow", price: 70 },
  ...PET_ITEMS,
] as const;

const BY_ID = new Map(SHOP_ITEMS.map((item) => [item.id, item]));

/** The catalogue item for an id, or undefined. */
export const getShopItem = (id: string): ShopItem | undefined => BY_ID.get(id);

/** Client to server: buy this item. */
export interface BuyMessage {
  itemId: string;
}

/** Server to client: a purchase succeeded, with the new balance. */
export interface ShopBought {
  itemId: string;
  balance: number;
}

/** Server to client: a purchase was refused. */
export interface ShopDenied {
  itemId: string;
  reason: "owned" | "cost" | "unknown";
}

/** Server to client (on join, and after changes): coins and owned item ids. */
export interface Wallet {
  coins: number;
  items: string[];
  /** Display form of the recovery code, e.g. "MANE-7823". */
  recoveryCode: string;
}

/** Validate a buy payload against the catalogue. Returns the item id or null. */
export function parseBuy(payload: unknown): BuyMessage | null {
  if (typeof payload !== "object" || payload === null) return null;
  const { itemId } = payload as Record<string, unknown>;
  if (typeof itemId !== "string" || !BY_ID.has(itemId)) return null;
  return { itemId };
}
