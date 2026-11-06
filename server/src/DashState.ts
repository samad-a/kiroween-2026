import { schema, t } from "@colyseus/schema";

/** One racer as every client sees it. */
export const Racer = schema(
  {
    name: t.string(),
    colour: t.uint8(),
    hat: t.string(),
    pet: t.string(),
    x: t.float64(),
    y: t.float64(),
    /** Race-clock ms until which the racer is boosted / stunned (for trails and wobbles). */
    boostUntil: t.float64(),
    stunUntil: t.float64(),
    /** Finish time in race ms (0 until finished) and place (0 until finished). */
    timeMs: t.float64(),
    place: t.uint8(),
  },
  "Racer",
);
export type Racer = InstanceType<typeof Racer>;

export const DashState = schema(
  {
    map: t.string(),
    /** "countdown" | "racing" | "done" */
    phase: t.string(),
    /** Race clock in ms: negative during the 3-2-1, then time since the start. Gates and bats run on it. */
    clock: t.float64(),
    racers: t.map(Racer),
    /** Race-clock ms each wisp was last grabbed (0 = never). Index matches the track's wisps. */
    wisps: t.array("float64"),
  },
  "DashState",
);
export type DashState = InstanceType<typeof DashState>;
