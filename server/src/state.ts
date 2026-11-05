import { schema, t } from "@colyseus/schema";

/** A ghost as every client sees it. Targets stay server-side, so they are not synced. */
export const Ghost = schema(
  {
    name: t.string(),
    colour: t.uint8(),
    // float64 so clients see exactly the server's position.
    // t.number() syncs as float32, which the convergence property test caught drifting.
    x: t.float64(),
    y: t.float64(),
    /** Current speech bubble text, or empty. Cleared after a few seconds. Never persisted. */
    bubble: t.string(),
    /** When the bubble should disappear (ms epoch). Server-only use, but synced is harmless. */
    bubbleUntil: t.float64(),
  },
  "Ghost",
);
export type Ghost = InstanceType<typeof Ghost>;

export const PlazaState = schema(
  {
    ghosts: t.map(Ghost),
    /** True when the Caretaker's AI is unavailable and chat runs on the basic filter. */
    caretakerResting: t.boolean(),
  },
  "PlazaState",
);
export type PlazaState = InstanceType<typeof PlazaState>;
