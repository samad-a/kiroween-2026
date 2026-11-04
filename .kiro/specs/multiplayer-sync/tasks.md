# Multiplayer sync: tasks

- [x] 1. Shared message types (`shared/src/messages.ts`)
- [x] 2. Colyseus `PlazaRoom` with schema state, join/leave, `move` handling, tick loop
- [x] 3. Server tests: invalid moves ignored, 21st client goes to a second room
- [x] 4. Client net layer: join, read synced state
- [x] 5. Interpolation for remote ghosts
- [x] 6. Two-window browser check (`scripts/two-tabs.ts`, Playwright + system Edge, screenshots in `screenshots/`)
- [x] 7. Property test: all clients converge to the same state (found the float32 sync bug)
- [ ] 8. Same two-window check via the Playwright MCP server, once it is configured in `.kiro/settings/mcp.json`
