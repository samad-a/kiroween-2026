# Graveyard Dash: design (proposal, awaiting approval)

## Shape of the change
Reuse what already exists: server-owned movement, the area/exit model and the following camera.

| Part | Where | Notes |
|---|---|---|
| Track data | `shared/src/dash.ts` | Track size, finish line x, obstacles (tombstones = solid rects), mud and boost zones, gate timings, payouts. Pure functions: `stepRacer(pos, intent, dt, effects)`, `placeOf`, `payout`. Property-tested. |
| Queue | `PlazaRoom` | Gate zone in the plaza. Queue held in the plaza room (in memory). Countdown with `this.clock`. On start: create a race room with `matchMaker.createRoom("dash", { players })` and send each queued client a seat reservation. |
| Race room | `server/src/DashRoom.ts` | New room type. Synced state: racers (x, y, place, finished, boostUntil), gates open/closed, phase (countdown, racing, done). 20 Hz tick like the plaza. Pays coins at the end via `addCoins`. |
| Client scene | `client/src/scenes/DashScene.ts` | Wide track (about 4800x700) with the existing `coverCamera` + `followMe`. Draws ghosts with the same parts (name tags, pets, hats). Countdown overlay, results card. |
| Art | `worldArt.ts` | Graveyard track: tombstones, mud, crypt section, finish arch, wisps. Same flat style. |
| Main | `main.ts` | Gate prompt in the dock (like fishing). Travel to the race on seat reservation; back to the plaza at the gate afterwards. |

## Key decisions
- **Separate room per race**, not a mode inside the plaza: the plaza keeps running for everyone else and race state stays small.
- **Keyboard + click both supported:** clicking ahead sets a target as in the plaza; arrow keys/WASD steer. The server applies terrain effects to whichever is used.
- **Queue lives in the plaza room.** If several plaza copies exist (20+ players), each has its own gate queue. This is simpler than a global matchmaker and fine at hackathon scale.
- **No physics engine.** Movement stays the plaza's capped-speed stepping, with multipliers for mud/boost and rect checks for tombstones/gates.

## Testing
- Property tests: racers never exceed the speed limit (with boost), never end inside a tombstone or closed gate, places are a permutation of finishers, payouts never exceed the table.
- Room tests (Colyseus testing): 2 players queue → race room created with both; leaving mid-race forfeits; race ends on timeout.
- Browser check: two browsers queue, race, both see the results card and return to the plaza.

## Tasks (in commit order)
1. `shared/dash.ts` + property tests.
2. `DashRoom` + room tests.
3. Plaza gate queue + countdown + handoff.
4. Track art.
5. `DashScene` + results card + main wiring.
6. Two-browser check; kiro-log entry.

## Cost
Roughly 250–350 credits: about the size of haunted rooms. The biggest risk is the plaza-to-race handoff (seat reservations), which is new to this codebase.

## Open questions for you
1. Payouts: 20 / 12 / 8 / 5 coins OK? (A hat costs 20–80.)
2. Allow solo practice runs (no coins)?
3. Where should the gate sit in the plaza? Proposal: bottom-left, by the tombstones.
