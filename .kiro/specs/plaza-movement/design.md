# Plaza movement: design

## Shared (`shared/src/`)
- `constants.ts`: `PLAZA_WIDTH` 1200, `PLAZA_HEIGHT` 700, `GHOST_RADIUS` 20, `GHOST_SPEED` 180 px/s, `GHOST_COLOURS` (6 hex strings), `OBSTACLES` (rects: fountain, clock tower).
- `movement.ts`: pure functions, no I/O, so they are easy to property-test.
  - `clampToPlaza(p)`: keeps a ghost inside bounds, accounting for radius.
  - `stepGhost(pos, target, dtSeconds)`: moves toward target at `GHOST_SPEED`, never overshoots, clamps, and refuses a step that lands inside an obstacle (ghost stays put).
  - `keysToTarget(pos, dx, dy)`: converts WASD/arrow direction into a target a short distance away. Used by the client.

## Client
- Click handler and key handler both send `{ x, y }` as a `move` intent. Neither moves the ghost locally.
- Ghost = SVG body texture + float tween + name tag. Colour from `GHOST_COLOURS`.
- Fade-in on spawn.

## Server
- `PlazaRoom` calls `stepGhost` each tick for every ghost with a target.

## Notes
- Name and colour validated server-side (name 1-16 chars trimmed, colour index 0-5). Random-name list lives in `shared/`.
