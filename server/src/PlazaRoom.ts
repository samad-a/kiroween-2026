import { Room, type Client } from "colyseus";
import {
  GHOST_COLOURS,
  MAX_GHOSTS_PER_PLAZA,
  PLAZA_HEIGHT,
  PLAZA_WIDTH,
  cleanName,
  hitsObstacle,
  parseColour,
  parseMove,
  randomName,
  stepGhost,
  type JoinOptions,
  type Point,
} from "@club-kiro/shared";
import { Ghost, PlazaState } from "./state.js";

export const TICK_MS = 50;

/** Spawn on the open path below the fountain, spread out a little. */
export function spawnPoint(random: () => number = Math.random): Point {
  for (let attempt = 0; attempt < 20; attempt++) {
    const p = { x: PLAZA_WIDTH / 2 + (random() - 0.5) * 300, y: PLAZA_HEIGHT - 160 + (random() - 0.5) * 80 };
    if (!hitsObstacle(p)) return p;
  }
  return { x: PLAZA_WIDTH / 2, y: PLAZA_HEIGHT - 120 };
}

export class PlazaRoom extends Room<{ state: PlazaState }> {
  // A full room locks; joinOrCreate then opens a second copy of the plaza.
  maxClients = MAX_GHOSTS_PER_PLAZA;
  // Keyboard input sends ~10/s; anything far above that is abuse.
  maxMessagesPerSecond = 30;
  state = new PlazaState();

  /** Where each ghost is heading. Server-only. */
  private readonly targets = new Map<string, Point>();

  messages = {
    move: (client: Client, payload: unknown) => {
      const target = parseMove(payload);
      if (target && this.state.ghosts.has(client.sessionId)) this.targets.set(client.sessionId, target);
    },
  };

  onCreate() {
    this.setSimulationInterval((deltaMs) => this.tick(deltaMs / 1000), TICK_MS);
  }

  onJoin(client: Client, options?: JoinOptions) {
    const spawn = spawnPoint();
    const ghost = new Ghost();
    ghost.name = cleanName(options?.name) ?? randomName();
    ghost.colour = parseColour(options?.colour) ?? Math.floor(Math.random() * GHOST_COLOURS.length);
    ghost.x = spawn.x;
    ghost.y = spawn.y;
    this.state.ghosts.set(client.sessionId, ghost);
  }

  onLeave(client: Client) {
    this.state.ghosts.delete(client.sessionId);
    this.targets.delete(client.sessionId);
  }

  /** Advance every moving ghost. Public so tests can drive it directly. */
  tick(dtSeconds: number) {
    for (const [id, target] of this.targets) {
      const ghost = this.state.ghosts.get(id);
      if (!ghost) continue;
      const next = stepGhost({ x: ghost.x, y: ghost.y }, target, dtSeconds);
      if (next.x === ghost.x && next.y === ghost.y) {
        this.targets.delete(id); // arrived, or blocked by a prop
        continue;
      }
      ghost.x = next.x;
      ghost.y = next.y;
    }
  }
}
