// Hats and pets a ghost brings along. Only items the player owns, of the right kind.
import { getShopItem, type ItemKind, type JoinOptions } from "@club-kiro/shared";
import { ownsItem } from "./db/players.js";
import type { DB } from "./db/index.js";
import type { Ghost } from "./state.js";

/** True if `id` is an owned shop item of this kind ("" means none and is always allowed). */
export function canUse(db: DB, playerId: number, kind: ItemKind, id: unknown): id is string {
  if (id === "") return true;
  return typeof id === "string" && getShopItem(id)?.kind === kind && ownsItem(db, playerId, id);
}

/** On join, put back the hat and pet the player had, if they still own them. */
export function restoreWearables(db: DB, playerId: number, ghost: Ghost, options: JoinOptions | undefined): void {
  if (canUse(db, playerId, "hat", options?.hat)) ghost.hat = options.hat;
  if (canUse(db, playerId, "pet", options?.pet)) ghost.pet = options.pet;
}
