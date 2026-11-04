# Kiro log

Notes on how each Kiro feature was used and how it felt. Source for the blog post, video script and write-up.
Add concrete examples as they happen (a hook that caught a bug, a property test that found an edge case).

## Phase 0: Setup
- Steering: product.md, tech.md, safety.md, credits.md, written from the roadmap before any code.
- Specs: one per feature (plaza-movement, multiplayer-sync, chat-and-caretaker, ghost-fishing, haunted-ui), requirements first.
- Hook: secret scan (`.kiro/hooks/secret-scan.json`) blocks `git commit` if staged files look like they contain API keys. Also wired as a git pre-commit hook.

## Phase 1: Plaza + multiplayer
- Specs drove the order: shared pure movement functions first, then the server room, then the client.
- Property-based testing (fast-check):
  - Movement: ghosts never leave the plaza, never end inside a prop, never move faster than the speed limit.
  - Protocol: any in-bounds move is accepted unchanged; cleaned names are always within limits; random names are always valid.
  - **Bug found:** the "every client converges to the server state" property failed on its very first run, with a one-move counterexample. Clients agreed with each other but not with the server: positions were off by ~0.001 px. Cause: Colyseus `t.number()` syncs as float32, while the server simulates in float64. Fixed by syncing positions as `t.float64()`. A hand-written example test would almost certainly have used `toBeCloseTo` and missed it.
- Colyseus 0.18 was newer than the agent's knowledge and the docs pages strip code samples when fetched, so Kiro read the installed `.d.ts` files to get the real API instead of guessing.
- Browser check (`scripts/two-tabs.ts`, Playwright driving the system Edge): caught a second bug on its first run. Phaser's loader decodes data URLs with `atob`, so the percent-encoded SVG textures for the plaza and ghosts failed to load. Unit tests can't see this; only a real browser could. Fixed by base64-encoding.
- Screenshots in `screenshots/` show both windows with both ghosts at identical positions; usable for the Devpost gallery.
- Hook: tests on save for `shared/` and `server/` (`.kiro/hooks/tests-on-save.json`).
- The Kiro agent can't write `.kiro/settings/` (by design), so the Playwright MCP server has to be added by hand.
