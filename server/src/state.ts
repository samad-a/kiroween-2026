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
  },
  "Ghost",
);
export type Ghost = InstanceType<typeof Ghost>;

export const PlazaState = schema(
  {
    ghosts: t.map(Ghost),
  },
  "PlazaState",
);
export type PlazaState = InstanceType<typeof PlazaState>;
