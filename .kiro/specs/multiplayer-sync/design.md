# Multiplayer sync: design

## Messages (`shared/src/messages.ts`)
- Client to server: `join` options `{ name, colour }`; `move` `{ x, y }`.
- No position is ever sent as authoritative from the client; `move` is only a target.

## Server (`server/src/`)
- Colyseus `PlazaRoom`, `maxClients = 20`. Using `joinOrCreate("plaza")` means a full room causes Colyseus to create a second copy automatically.
- State: `PlazaState` with `MapSchema<Ghost>`; `Ghost` has `name`, `colour`, `x`, `y`, `targetX`, `targetY`.
- Simulation interval of 50 ms calls `stepGhost` for each ghost.
- Invalid `move` payloads (non-finite, out of bounds) are ignored.
- Spawn near the plaza centre, offset a little so ghosts don't stack.

## Client (`client/src/net/`)
- Colyseus JS client joins "plaza", listens to schema changes.
- Each ghost keeps a rendered position that lerps toward the synced position each frame.

## Tests
- Property: after any sequence of `move` intents and ticks, every client's view equals the server state.
- Unit: the 21st client lands in a second room.
