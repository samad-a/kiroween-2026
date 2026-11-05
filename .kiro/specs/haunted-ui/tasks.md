# Haunted UI and rooms: tasks

Order groups small pieces first, then rooms (the big one), then ambience. Checkpoints are self-run:
typecheck + relevant tests + commit after each marked (CHECKPOINT) task, keeping a coherent history.

## Slice A — accessibility, settings, identity surfacing
- [ ] 1. Shared reduced-motion flag + settings panel (reduced-motion, mute) persisted in `localStorage`; `reduce-motion` body class honoured by CSS and the Phaser scene
- [ ] 2. Focus-trap + `Esc`-to-close for modal overlays (shop, recovery, settings, room editor); labelled close controls
- [ ] 3. Freely-licensed background music behind the mute toggle; `client/public/CREDITS.md` records source/licence/attribution; autoplay only after the join gesture
- [ ] 4. Contrast audit of theme CSS variables (automated AA); join-screen "restore with a code" entry + copy-to-clipboard on the recovery dialog (CHECKPOINT)

## Slice B — rooms
- [ ] 5. Shared rooms module (`shared/src/rooms.ts`): `PlacedItem`, `ROOM` message constants, `parseRoomLayout`/`parsePlacement`, midnight/haunting constants + tests
- [ ] 6. SQLite v2 migration (`rooms` table, JSON layout) + rooms repository (`getLayout`/`saveLayout` with owned+in-bounds validation) + tests
- [ ] 7. `Ghost.hat` + `ownerId` schema fields; `set-hat` intent validated against owned hats; draw the hat SVG above the ghost in `PlazaScene` (CHECKPOINT)
- [ ] 8. `HauntedRoomState` + `HauntedRoom` (join with ownerPlayerId, synced items, owner-only place/move/remove, persistence) + tests
- [ ] 9. Client: extract shared ghost rendering/movement; `RoomScene`; decoration art in `art.ts`; visit/return flow between plaza and room
- [ ] 10. Client: room-editor overlay (place/move/remove, owned decorations only) (CHECKPOINT)

## Slice C — ambience
- [ ] 11. Midnight haunting: server timer flips synced `haunting` flag on/off, Caretaker announces; client shifts plaza lighting + lantern glow (both scenes, reduced-motion aware) + test
- [ ] 12. Deliberate join/leave effects (puff on join, dissolve on leave; skipped under reduced-motion)
- [ ] 13. Browser check (`scripts/room-check.ts`): decorate a room, visit as a second ghost (read-only), trigger a haunting; screenshots in `screenshots/` (CHECKPOINT)
