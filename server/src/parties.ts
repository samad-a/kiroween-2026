// Room parties: haunted rooms whose owner has opened them to the town.
// In memory only; a party ends when the owner closes it or leaves.
import type { PartyView } from "@club-kiro/shared";

const parties = new Map<number, PartyView>();

export function openParty(ownerPlayerId: number, ownerName: string, guests: number): void {
  parties.set(ownerPlayerId, { ownerPlayerId, ownerName, guests });
}

export function closeParty(ownerPlayerId: number): void {
  parties.delete(ownerPlayerId);
}

export function setPartyGuests(ownerPlayerId: number, guests: number): void {
  const p = parties.get(ownerPlayerId);
  if (p) p.guests = guests;
}

export function isPartyOpen(ownerPlayerId: number): boolean {
  return parties.has(ownerPlayerId);
}

/** Busiest first. */
export function listParties(): PartyView[] {
  return [...parties.values()].sort((a, b) => b.guests - a.guests).map((p) => ({ ...p }));
}
