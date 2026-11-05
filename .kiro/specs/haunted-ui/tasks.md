# Haunted UI and rooms: tasks

Order groups small pieces first, then rooms (the big one), then ambience. Checkpoints are self-run:
typecheck + relevant tests + commit after each marked (CHECKPOINT) task, keeping a coherent history.

## Slice A — accessibility, settings, identity surfacing
- [x] 1. Shared reduced-motion flag + settings panel (reduced-motion, mute) persisted in `localStorage`; `reduce-motion` body class honoured by CSS and the Phaser scene
- [x] 2. Focus-trap + `Esc`-to-close for modal overlays (shop, recovery, settings, room editor); labelled close controls
- [~] 3. Music toggle wired (mute button controls `/haunted-loop.mp3`); `client/public/CREDITS.md` placeholder — **audio file still to be supplied by the human**
- [x] 4. Contrast audit: all key pairs pass AA (ink/parchment 13.2, text/night 16–17, glow 13.3, headings 6.0, buttons 7.4); join-screen "restore with a code" + recovery copy button (CHECKPOINT)

## Slice B — rooms
- [x] 5. Shared rooms module (`shared/src/rooms.ts`): `PlacedItem`, `ROOM` message constants, `parseRoomLayout`/`parsePlacement`, midnight/haunting constants + tests
- [x] 6. SQLite v2 migration (`rooms` table, JSON layout) + rooms repository (`getLayout`/`saveLayout` with owned+in-bounds validation) + tests
- [x] 7. `Ghost.hat` + `ownerId` schema fields; `set-hat` intent validated against owned hats; draw the hat SVG above the ghost in `PlazaScene`; shop Wear/Take-off control (CHECKPOINT)
- [x] 8. `HauntedRoomState` + `HauntedRoom` (join with ownerPlayerId, synced items, owner-only place/move/remove, persistence) + tests
- [x] 9. Client: `RoomScene` (ghosts, hats, decorations, movement); decoration + room art; visit/return flow between plaza and room
- [x] 10. Client: room-editor overlay (place via list, drag to move, double-click to remove; owned decorations only) (CHECKPOINT)

## Slice C — ambience
- [x] 11. Midnight haunting: server timer flips synced `haunting` flag on/off, Caretaker announces; client eases plaza into a dim veil + brighter lantern glow (reduced-motion aware) + test
- [x] 12. Deliberate join/leave effects (scale-pop puff on join, dissolve-and-rise on leave; skipped under reduced-motion)
- [~] 13. Browser check (`scripts/room-check.ts`): visit own room + decorate verified by screenshots 10–11 and clean server log; **return-to-plaza step could not complete a clean automated run** (environment/terminal flakiness) — verified by code review, not end-to-end capture (CHECKPOINT)
