# Haunted UI and rooms: design

The cosy-spooky look, accessibility, personal decoratable rooms, the midnight haunting event, and
join/leave effects. Builds directly on the ghost-fishing foundation: identity (guest id + recovery
code), the SQLite players repository, and the shop that already grants item ownership. This spec is
where bought decorations finally get *placed* and bought hats get *worn*.

Grounded in the current code: `PlazaState`/`Ghost` are Colyseus schema; the client renders ghosts in
`PlazaScene` (Phaser) with HTML/CSS overlays for chat/HUD/shop; identity and the wallet already flow
through `onJoin`. The server stays authoritative — clients send intents (place this item here,
visit this room), never trusted layouts.

## Scope

In: theme polish + accessibility pass (reqs 1–3), confirming identity UX (reqs 4, 5 — mostly done in
ghost-fishing, surfaced here), personal rooms with decorating and visiting (reqs 6–8), the midnight
haunting event (req 9), join/leave effects (req 10), and wearing a bought hat on the plaza ghost.

Out: new shop items (ghost-fishing owns the catalogue), new mini-games, real accounts (a roadmap
stretch goal, explicitly not built).

## Breakdown into coherent pieces

The requirements split into four groups that can land independently:

1. **Look & accessibility** (reqs 1–3): CSS theme audit, contrast, keyboard focus, a settings panel
   with reduced-motion and mute toggles.
2. **Identity surfacing** (reqs 4, 5): guest id + recovery code already exist; add a "restore with a
   code" entry on the join screen and make the recovery code visible and copyable (partly done).
3. **Rooms** (reqs 6–8): the big one — model, persistence, decorating, visiting.
4. **Ambience** (reqs 9, 10): midnight haunting event with a lighting change, and join/leave visuals.

Rooms (3) is the largest and carries its own persistence + sync work; the others are smaller.

## Look & accessibility (requirements 1–3)

The look is already deep-purple night with flickering lanterns and parchment panels (see the shop
screenshots), so this is an audit, not a rebuild:

- **Contrast**: check text/background pairs against WCAG AA (4.5:1 for body). The parchment-on-ink
  and glow-on-night pairs are the ones to verify; adjust CSS variables if any fall short. Full WCAG
  conformance needs manual AT testing and expert review — this pass covers automated contrast only.
- **Keyboard focus**: menus are already real `<button>`/`<input>` with a visible `:focus-visible`
  ring. Add focus trapping to the modal panels (shop, recovery, settings, room editor) so Tab stays
  inside an open dialog, and `Esc` closes it. Give each a labelled close control (the shop/recovery
  already have one).
- **Settings panel**: a new overlay with two toggles persisted in `localStorage`:
  - **Reduced motion** — currently read once from `prefers-reduced-motion`. Make it a setting that
    overrides/augments the media query, applied by toggling a `reduce-motion` class on `<body>` that
    the CSS and the Phaser scene both honour (the scene reads a shared flag instead of the media
    query directly).
  - **Mute** — plays a looping, low-volume cosy-spooky **background music** track; the mute button
    stops/starts it and the choice persists in `localStorage`. The track must be an open-source /
    freely-licensed piece compatible with the repo's MIT licence and public GitHub hosting (e.g.
    CC0 / CC-BY with attribution, or a permissive game-audio licence). The file lives in
    `client/public/` and its source + licence + attribution are recorded in a `CREDITS` note and the
    `kiro-log`. Audio starts only after the first user gesture (join click), per browser autoplay
    rules, and respects the stored mute preference.

## Identity surfacing (requirements 4, 5)

The mechanism exists (ghost-fishing): guest id in `localStorage`, server-issued recovery code,
`resolvePlayer` restores by code. This spec only improves the UX:

- Join screen gains a small "Have a recovery code? Restore" control that reveals an input; the code
  is validated client-side with `parseRecoveryCode` and passed in `JoinOptions.recoveryCode` (already
  wired). On a successful restore the server's `wallet` reflects the restored coins/items.
- The recovery-code dialog (already built) is the canonical display; add copy-to-clipboard and a
  one-line "write this down to play on another device" note.

## Rooms (requirements 6, 7, 8)

The central decision: **a room is a separate Colyseus room type (`HauntedRoom`), not a mode inside
the plaza.** Why: visiting means several ghosts can be in someone's room at once with their own
movement/chat, which is exactly what a Colyseus room already gives us; cramming it into `PlazaRoom`
would fork every handler on a "where am I" flag. The plaza and a haunted room share the ghost
movement/chat code via small shared helpers rather than duplicating it.

### Model & persistence

- A room layout is a list of placed items: `{ itemId, x, y }`. Only items the owner **owns** (shop
  decorations) may be placed, and only decorations (not hats). The grid is the room's own coordinate
  space (reuse `PLAZA_WIDTH`/`HEIGHT` bounds for simplicity).
- New SQLite migration (v2): a `room_items` table keyed by `(player_id, slot)` or simply stored as
  one JSON blob per player in a `rooms` table — **JSON blob** chosen: a room is small, always read
  and written whole, and never queried by item. `rooms(player_id PK, layout TEXT, updated_at)`.
- Repository `server/src/db/rooms.ts`: `getLayout(playerId)`, `saveLayout(playerId, layout)` with
  validation that every placed item is owned and in-bounds. Parsing/validation of a layout lives in
  `shared/` (`parseRoomLayout`) so client and server agree and the server can reject a forged one.

### HauntedRoom (Colyseus)

- Joined with `{ ownerPlayerId }` (which room to visit) plus the visitor's identity. State mirrors
  the plaza's ghosts map, plus a synced `items` list (the owner's saved layout) and `ownerId`.
- **Edit is owner-only** (req 8): the server accepts `room:place` / `room:move` / `room:remove`
  only from the client whose resolved `playerId === ownerPlayerId`. A visitor's edit intents are
  ignored server-side (not just hidden in the UI). Each accepted edit updates synced state and
  persists the layout.
- Visiting from the plaza: a `room:visit { ownerPlayerId }` flow. Simplest client approach that fits
  the existing `joinPlaza` pattern — leave the plaza room and `joinOrCreate` the `HauntedRoom` with
  the target owner id; a "Return to plaza" control rejoins the plaza. (We are not trying to render
  plaza and room simultaneously.)
- Discovery: to visit someone you need their `ownerPlayerId`. The plaza ghost's synced state gains
  an `ownerId` field so clicking a ghost offers "Visit their room". Your own room is reachable from a
  "My room" HUD button.

### Client

- A new `RoomScene` (Phaser) reuses the ghost rendering from `PlazaScene` — factor the shared
  sprite/movement code into a small module both scenes import, rather than copy-paste.
- Decorations render as SVG images (same `svgUrl` base64 approach as the plaza/ghost art, to dodge
  the Phaser `atob` data-URL issue found in Phase 1). New decoration art in `client/src/art.ts`.
- Owner editing: a room-editor overlay listing owned decorations; drag to place/move, a remove
  control. Placement sends intents; the server echoes authoritative positions back through synced
  state (never trust the client's drag position as final).

## Wearing a hat (bridges ghost-fishing)

A bought hat should show on the plaza ghost. Add an optional `hat` field to the `Ghost` schema
(empty = none) and a `JoinOptions.hat` / a `set-hat` intent validated against owned hats. The client
draws the hat SVG above the ghost body in both scenes. This is the visible payoff of buying a hat.

## Ambience (requirements 9, 10)

- **Midnight haunting** (req 9): the server runs a timer (every N minutes, N a shared constant) that
  flips a synced `haunting` boolean on for a short window. The Caretaker announces it in-character
  (reusing the existing caretaker-note channel as a broadcast). While on, the client shifts plaza
  lighting (a darker overlay + brighter lantern glows); honoured by both scenes. Server-owned so all
  ghosts see it together.
- **Join/leave effects** (req 10): already partly present (ghosts fade in on spawn, fade out on
  leave in `PlazaScene.syncSprites`). Make it deliberate — a small puff/sparkle tween on join and a
  dissolve on leave, both skipped under reduced-motion.

## Message types & state (shared)

- `Ghost` schema gains `hat: t.string()` and `ownerId: t.string()`.
- `PlazaState` gains `haunting: t.boolean()`.
- New room module `shared/src/rooms.ts`: `ROOM` message constants (`visit`, `place`, `move`,
  `remove`, `setHat`), `PlacedItem` type, `parseRoomLayout` / `parsePlacement` validators, and the
  `MIDNIGHT_INTERVAL_MS` / `HAUNTING_DURATION_MS` constants.
- New `HauntedRoomState` schema (ghosts map + items list + ownerId) in `server/src/`.

## Testing (Vitest, property-based where it pays off)

- **Layout validation** (shared): `parseRoomLayout` rejects out-of-bounds items, non-decoration ids,
  and junk; property test — any valid owned-decoration layout round-trips, any item outside bounds is
  dropped.
- **Rooms repository** (in-memory DB): save→get round-trips; saving rejects placing an unowned item.
- **HauntedRoom** (Colyseus testing): a visitor's `room:place` is ignored; the owner's is applied and
  persisted; re-joining reloads the saved layout.
- **Midnight event**: driving the server timer flips `haunting` on then off after the window; the
  flag is visible in synced state.
- **Hat**: `set-hat` is rejected for an unowned hat and accepted for an owned one.

## Dependencies / flags

- No new runtime dependencies. SQLite migration v2 is additive (new `rooms` table); the existing
  `user_version` migration runner applies it on boot.
- Background music: one freely-licensed audio file in `client/public/` (CC0/CC-BY or similar,
  MIT-compatible). No runtime dependency — played via a plain HTML `<audio>` element. Licence and
  attribution recorded in `client/public/CREDITS.md` and `kiro-log.md`.
- No secrets; privacy rules unaffected (we store room layout, coins, items, identity — never chat).

## Suggested task order (for tasks.md, to be confirmed)

1. Settings panel (reduced-motion + mute) + focus-trapping/Esc on modals; shared reduced-motion flag;
   freely-licensed background music behind the mute toggle (+ CREDITS note).
2. Contrast audit + any CSS variable fixes; join-screen "restore with code" + copy button.
3. Shared rooms module (types, constants, validators) + tests.
4. SQLite v2 migration + rooms repository + tests.
5. `Ghost.hat` / `set-hat` + wearing a hat in `PlazaScene`.
6. `HauntedRoomState` + `HauntedRoom` (join, synced items, owner-only edits, persistence) + tests.
7. Client: `RoomScene` (shared ghost rendering), decoration art, visit/return flow.
8. Client: room-editor overlay (place/move/remove, owned decorations only).
9. Midnight haunting event (server timer + synced flag + Caretaker announce) + client lighting.
10. Join/leave effects pass.
11. Browser check: decorate a room, visit as another ghost (read-only), trigger a haunting;
    screenshots.
