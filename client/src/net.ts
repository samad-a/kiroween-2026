import { Client, type Room } from "@colyseus/sdk";
import { DEFAULT_SERVER_PORT, MESSAGE, PLAZA_ROOM, type JoinOptions, type MoveMessage } from "@club-kiro/shared";

/** The synced shape the client reads. Mirrors server/src/state.ts. */
export interface GhostView {
  name: string;
  colour: number;
  x: number;
  y: number;
}

export interface PlazaView {
  ghosts: { forEach(cb: (ghost: GhostView, id: string) => void): void; get(id: string): GhostView | undefined };
}

export type PlazaRoom = Room<unknown, PlazaView>;

function serverUrl(): string {
  const configured = import.meta.env.VITE_SERVER_URL as string | undefined;
  if (configured) return configured;
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${location.hostname}:${DEFAULT_SERVER_PORT}`;
}

export async function joinPlaza(options: JoinOptions): Promise<PlazaRoom> {
  const client = new Client(serverUrl());
  const room = await client.joinOrCreate<PlazaView>(PLAZA_ROOM, options);
  return room as PlazaRoom;
}

export function sendMove(room: PlazaRoom, target: MoveMessage): void {
  room.send(MESSAGE.move, target);
}
