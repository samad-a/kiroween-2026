// Who is online right now, by player id. In memory only: one server process,
// and a player may have several sessions (two tabs, or plaza then room).
const sessions = new Map<number, number>();

export function markOnline(playerId: number): void {
  sessions.set(playerId, (sessions.get(playerId) ?? 0) + 1);
}

export function markOffline(playerId: number): void {
  const n = (sessions.get(playerId) ?? 0) - 1;
  if (n > 0) sessions.set(playerId, n);
  else sessions.delete(playerId);
}

export function isOnline(playerId: number): boolean {
  return sessions.has(playerId);
}
