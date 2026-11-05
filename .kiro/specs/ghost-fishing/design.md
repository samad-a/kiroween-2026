# Ghost Fishing: design

Covers the Phase 3 mini-game and shop, plus the **persistence + identity foundation** every
Phase 3 feature needs (coins, items, and later room layouts must survive a reconnect).

Grounded in the current code: the server is in-memory only (`PlazaRoom`, `PlazaState`), a ghost is
identified by its Colyseus `sessionId`, and clients send intents that the server validates
(`parseMove`). This design keeps that shape: the client sends fishing/shop intents, the server owns
coins and the catch outcome, and nothing trusts a client-sent balance.

## Scope

In: identity (guest ID + recovery code), SQLite persistence, the fishing round, coin rewards, the
shop (buy hats/outfits and decorations), loading a player's coins/items on join.

Out (other Phase 3 specs): the cosy-spooky theme, room decorating UI, midnight event, join/leave
effects (haunted-ui). Wearing a bought hat visually and placing a bought decoration in a room is
haunted-ui work; this spec only grants ownership.

## Identity (requirements 9; haunted-ui 4, 5)

The mini-game is single-player but coins/items must persist, so we need a stable player identity
that is **not** the per-connection `sessionId`.

- **Guest ID:** a random UUID the browser keeps in `localStorage` (`clubkiro.guestId`). Created on
  first visit. Sent as a new `JoinOptions.guestId`.
- **Recovery code:** a short, human-typeable code (e.g. `MOON-7421`, from an unambiguous alphabet,
  no `0/O/1/I`) the **server** issues once per player and returns to the client. Typing the same
  code on another device restores the same player row. Stored client-side next to the guest ID.
- The server resolves a player row on join in this order: recovery code (if the client sent one) →
  guest ID → create a new player. The resolved player's DB id is attached to the Colyseus client
  (`client.userData.playerId`) for the rest of the connection.

Identity validation lives in `shared/` (pure functions: `parseGuestId`, `parseRecoveryCode`,
`formatRecoveryCode`), matching how `parseMove`/`cleanName` already work.

## Persistence (requirements 6, 9)

- Driver: **`better-sqlite3`** — synchronous, no async ceremony inside the Colyseus tick, well
  suited to a single-process game server. New server dependency (flagged).
- One module `server/src/db/index.ts` opens the database and runs migrations on boot. File path
  from `process.env.DB_PATH`, default `server/data/club-kiro.db`. An **in-memory** database
  (`:memory:`) is used in tests so they stay hermetic and fast.
- A thin repository `server/src/db/players.ts` exposes pure-ish functions
  (`resolvePlayer`, `getPlayer`, `addCoins`, `ownsItem`, `grantItem`) so `PlazaRoom` never writes
  SQL inline. Every function takes the `Database` handle, so tests pass an in-memory one.

Schema (v1):

```sql
CREATE TABLE players (
  id            INTEGER PRIMARY KEY,
  guest_id      TEXT NOT NULL UNIQUE,
  recovery_code TEXT NOT NULL UNIQUE,
  coins         INTEGER NOT NULL DEFAULT 0 CHECK (coins >= 0),
  created_at    INTEGER NOT NULL
);
CREATE TABLE player_items (
  player_id INTEGER NOT NULL REFERENCES players(id),
  item_id   TEXT NOT NULL,
  bought_at INTEGER NOT NULL,
  PRIMARY KEY (player_id, item_id)   -- enforces "no buying the same item twice" (req 8)
);
```

The `coins >= 0` CHECK is the last line of defence for requirement 6; the repository also refuses a
spend it cannot afford before touching the DB.

## The fishing round (requirements 1–5, 10)

Single-player, so **no Colyseus state sync** — the round is a direct request/response over room
messages, keeping `PlazaState` untouched. The server is still authoritative over the outcome and
the coins; the client only drives the timing UI.

Flow:

1. Client sends `fish:start` when the player is near the fountain. Server checks the player has no
   active round, records `startedAt`, and replies `fish:started` with the round length (60 s) and
   the catch table (so the client can show odds/art without hardcoding them).
2. Each cast: client sends `fish:cast` with the moment the timing bar was hit, expressed as a
   normalised accuracy `0..1` (1 = dead centre). The **server** decides the catch: it rolls against
   a weighted table, scaled by accuracy, and replies `fish:catch` with `{ item, coins }`. Rolling
   server-side stops a client from forging rare catches.
3. Server enforces a minimum interval between casts (reuses the chat-style rate idea) so a client
   cannot spam casts to farm coins.
4. When 60 s elapse (server clock) or the client sends `fish:end`, the server closes the round,
   calls `addCoins(playerId, roundTotal)`, and replies `fish:ended` with the new balance.

Catch table (tunable constants in `shared/`, so client and server agree):

| catch        | weight | coins |
| ------------ | -----: | ----: |
| pumpkin      |     50 |     3 |
| bones        |     35 |     6 |
| spooky fish  |     15 |    20 |

Accuracy shifts the roll toward higher-value catches; a near-centre hit improves the odds of the
rare fish but never guarantees it. All randomness is server-side and injectable (`random = Math.random`
default) so tests are deterministic.

## The shop (requirements 7, 8)

- The catalogue is a static constant in `shared/src/shop.ts`: ~6 hats/outfits and ~6 room
  decorations, each `{ id, kind: "hat" | "decoration", name, price }`. Static so there is nothing
  to persist about the catalogue itself and both sides share it.
- Buy flow: client sends `shop:buy` with an `itemId`. Server validates the id against the
  catalogue, checks `!ownsItem` (req 8) and `coins >= price`, then in a single DB transaction
  deducts coins and inserts the `player_items` row. Replies `shop:bought { itemId, coins }` on
  success or `shop:denied { itemId, reason }` on failure (already owned / not enough coins).
- On join the server sends the player their current `coins` and owned `itemIds` via a `wallet`
  message so the client can render the shop as owned/affordable without guessing.

## Message types (all added to `shared/src/`)

New room-message constants and payload parsers, following `parseMove`'s validate-at-the-edge style:

```
FISH = { start, cast, end }            // client → server
FISH_EVENT = { started, catch, ended } // server → client
SHOP = { buy }                         // client → server
SHOP_EVENT = { bought, denied, wallet } // server → client
```

Parsers (`parseCast` clamps accuracy to `0..1`, `parseBuy` checks the item id is a known catalogue
id) live in `shared/` with their own tests.

## Client (requirement 10: playable without explanation)

- A fountain prompt ("Cast a line?") appears when the ghost is near the fountain; clicking it (or a
  key) starts a round. The timing bar is a simple moving marker over a target zone — one obvious
  action, no instructions needed.
- A coin counter in the corner, updated from `wallet`/`fish:ended`. A shop panel lists items with
  price, an owned tick, and a disabled state when unaffordable.
- Identity, fishing, and shop messaging extend `client/src/net.ts` alongside the existing
  `sendMove`/`sendChat` helpers. Fishing/shop UI is plain HTML/CSS overlay (same pattern as chat),
  not Phaser, so it is keyboard-focusable for haunted-ui's accessibility pass.

## Testing (Vitest, property-based where it pays off)

- **Repository (in-memory DB):** coins never go negative (req 6); buying the same item twice is
  rejected (req 8); `resolvePlayer` returns the same row for the same guest id / recovery code and a
  new row otherwise (req 5). Property test: a random sequence of earns and affordable/over-budget
  spends never drives the balance negative and never double-grants an item.
- **Catch roll:** over many seeded rolls the distribution matches the weights within tolerance, and
  every catch is from the table with its listed coin value (reqs 3, 4). Property test: any accuracy
  in `0..1` yields a valid catch and non-negative coins.
- **Parsers:** `parseCast` clamps/rejects junk; `parseBuy` only accepts catalogue ids.
- **Round:** a 60 s round credits exactly the sum of its catches once, and a second `fish:end` is a
  no-op (reqs 2, 5).

## Dependencies / flags

- New server dependency: **`better-sqlite3`** (+ `@types/better-sqlite3`). Native module; needs a
  build toolchain on install. Flagging per the credits steering's "ask before dependency changes".
- `.gitignore`: add `server/data/` so the local SQLite file is never committed.
- No secrets involved; the secret-scan hook is unaffected.
