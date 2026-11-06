# Club Kiro: Tech

## Stack
- Language: TypeScript everywhere (client and server). Strict mode, no `any`.
- Rendering: Phaser 3 for the plaza and mini-game. HTML/CSS overlays for chat, menus and spooky UI.
- Networking: Colyseus. The server owns all positions; the client only animates.
- Art: simple SVG shapes + CSS.
- Saving: server-side SQLite (Postgres only if hosting needs it).
- Identity: guest ID created automatically, plus a short recovery code to restore it on another device.
- Runtime AI: not decided (leaning Amazon Bedrock, fallback Nebius). Hide the provider behind one `moderate()` function so switching is a one-file change.
- Hosting: not decided. Server needs WebSockets; client is static files.

## Folder layout
Monorepo:
- `client/`: Phaser scenes, HTML/CSS overlays (Vite)
- `server/`: Colyseus rooms, database, `server/caretaker/` (moderation, `prompt.md`)
- `shared/`: message types and constants used by both sides
- `.kiro/`: steering, specs, hooks, agents (never gitignored)

## Tooling
- Vite (client), tsx (server), Vitest (tests), including property-based tests.
- MIT licence.

## Conventions
- Message types live in `shared/` only.
- Server is authoritative: clients send intents (target position), never positions.
- Movement: click-to-walk and WASD/arrows, both send a target.
- Commands (run from repo root; on Windows PowerShell use `npm.cmd`): `npm run typecheck` (tsc -b), `npm test` (vitest --run), `npm run build` (client).
- Dev: `npm run dev:server` (ws://localhost:2567) and `npm run dev:client` (http://localhost:5173), in separate terminals.
- Browser check: with both dev servers running, `node node_modules/tsx/dist/cli.mjs scripts/two-tabs.ts` (screenshots to `screenshots/`). `scripts/smoke.ts` does the same over the network only.
- Colyseus is 0.18: client package is `@colyseus/sdk`, state uses the `schema({...})` + `t.*` builder (no decorators). Sync positions as `t.float64()`; `t.number()` is float32.
- If the agent terminal drops output, run checks with `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\check.ps1 [-build]` (writes `check.log`) and commits with `scripts\commit.ps1 "message" paths...` (writes `commit.log`), both as background processes, then read the log.
- Secret scan: `node scripts/secret-scan.mjs` checks staged files. Runs from a Kiro hook and the git pre-commit hook.
