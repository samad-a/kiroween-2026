import { schema, t } from "@colyseus/schema";
import { Ghost } from "./state.js";

/** A decoration placed in a haunted room. */
export const RoomItem = schema(
  {
    itemId: t.string(),
    x: t.float64(),
    y: t.float64(),
  },
  "RoomItem",
);
export type RoomItem = InstanceType<typeof RoomItem>;

/** A personal haunted room: visiting ghosts plus the owner's saved layout. */
export const HauntedRoomState = schema(
  {
    ghosts: t.map(Ghost),
    items: t.array(RoomItem),
    /** The owner's player id (as a string). Only this player may edit. */
    ownerId: t.string(),
    ownerName: t.string(),
    /** The owner has opened this room as a party, listed on the plaza notice board. */
    party: t.boolean(),
  },
  "HauntedRoomState",
);
export type HauntedRoomState = InstanceType<typeof HauntedRoomState>;
