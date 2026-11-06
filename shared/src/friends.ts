// Friends: a personal list of other players, with who's online and a quick room visit.
// One-way, like a contact list: adding someone needs no acceptance and shares
// nothing beyond what the plaza already shows (their ghost name and whether they're here).

export const FRIENDS = { add: "friends:add", remove: "friends:remove", list: "friends:list" } as const;
export const FRIENDS_EVENT = { list: "friends:list" } as const;

/** Keep lists small; also bounds the work of building one. */
export const MAX_FRIENDS = 50;

/** Client to server for add/remove: which player. */
export interface FriendTarget {
  playerId: number;
}

export interface FriendView {
  playerId: number;
  /** The ghost name they last played as. */
  name: string;
  online: boolean;
}

/** Server to client: the player's whole friends list. */
export interface FriendsList {
  friends: FriendView[];
}

/** A positive integer player id, or null if the payload is malformed. */
export function parseFriendTarget(payload: unknown): FriendTarget | null {
  if (typeof payload !== "object" || payload === null) return null;
  const { playerId } = payload as Record<string, unknown>;
  if (typeof playerId !== "number" || !Number.isInteger(playerId) || playerId <= 0) return null;
  return { playerId };
}
