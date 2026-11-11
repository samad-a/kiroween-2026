# Club Kiro

A haunted town in the browser where you hang out as a ghost. Flash-era virtual worlds died with Flash; Club Kiro brings the genre back with real-time multiplayer, no plugin, and an AI Caretaker who reads chat in context instead of matching a keyword list.

Built for Kiroween 2026 with [Kiro](https://kiro.dev). The whole Kiro setup (steering, specs, hooks, custom agent, MCP config) is in [`.kiro/`](.kiro/).

## What you can do

- Float around the plaza with up to 20 ghosts per plaza. Click to walk, or use WASD / arrow keys.
- Chat. Every message is checked by the Caretaker before anyone else sees it.
- Earn coins with Ghost Fishing at the lighthouse jetty and in Graveyard Dash, a 1 to 4 player race.
- Spend coins on hats, decorations and pets.
- Decorate your own haunted room and visit other ghosts' rooms (click a ghost).
- Travel to the lighthouse and the crypt, hold a seance, solve riddles, keep the lamps lit, make a wish at the well.
- Add friends, use emotes and quick chat, collect stamps, claim a daily gift.
- Reduced-motion and mute options in settings.

## The Caretaker

Keyword filters miss meanness with no bad words in it, and block harmless jokes. The Caretaker is an ancient, kind ghost who checks each message in three steps:

1. Instant checks: length (120 characters), rate (1 message every 2 seconds), obvious slurs.
2. An LLM call that judges the message in context.
3. A verdict: **allow** (sent), **nudge** (a private, gentle note to the sender; the message is not sent) or **block** (a short timeout for repeat or severe cases).

It fails closed: if the check errors or times out, the message is held. If the AI is down, the game falls back to the basic filter and shows "Caretaker is resting". Chat text is never stored or logged.

The provider sits behind one `moderate()` function (`server/src/caretaker/`). Set `CARETAKER_PROVIDER` to `stub` (offline, default), `nebius` or `bedrock`. The labelled eval set in `server/src/caretaker/caretaker-evals.json` covers sarcasm, friendly insults and meanness with no bad words. The live Nebius run (Qwen3-30B-A3B-Instruct) scored 23 of 24 on the original set.

## Run it locally (about 5 minutes)

Needs Node 22 (the eval script uses `node --env-file`).

```sh
git clone https://github.com/samad-a/kiroween-2026.git
cd kiroween-2026
npm install
cp .env.example .env          # Windows: copy .env.example .env
```

The defaults run the Caretaker on the offline `stub` provider, so no API key is needed.

Start the server and the client in two terminals:

```sh
npm run dev:server            # ws://localhost:2567
npm run dev:client            # http://localhost:5173
```

Open http://localhost:5173 in two tabs to see two ghosts in the same plaza. On Windows PowerShell, use `npm.cmd` instead of `npm`.

To use a real model, set `CARETAKER_PROVIDER`, `CARETAKER_MODEL_ID` and the provider's keys in `.env`. Every variable is described in [`.env.example`](.env.example).

## Commands

| Command | What it does |
|---|---|
| `npm run typecheck` | TypeScript check across all packages |
| `npm test` | Unit and property-based tests (Vitest + fast-check) |
| `npm run evals` | Runs the Caretaker eval set against the configured provider; fails below 90% |
| `npm run build` | Builds the static client into `client/dist` |
| `npm run start:server` | Production server start (reads `PORT`, `DB_PATH`) |
| `npm run svg-check` | Optimises SVGs and checks text colour contrast against WCAG AA |

Browser checks (need both dev servers running): `node node_modules/tsx/dist/cli.mjs scripts/two-tabs.ts`. Screenshots go to `screenshots/`. Deployment notes are in [`docs/deploy.md`](docs/deploy.md).

## How it's built

- TypeScript everywhere, strict mode.
- `client/`: Phaser 3 scenes for the world, HTML/CSS overlays for chat and menus, built with Vite. Art is hand-written SVG.
- `server/`: Colyseus 0.18 rooms (plaza, lighthouse, crypt, haunted rooms, dash races), SQLite via `better-sqlite3`, and the Caretaker.
- `shared/`: message types, constants and pure game logic used by both sides.

The server is authoritative. Clients send intents (a target position, a direction, a fishing accuracy) and the server owns positions, catches, coins and purchases.

Identity is a guest ID kept in the browser plus a short recovery code to restore it on another device. The game stores only the guest ID, recovery code, coins, items and room layout. No names, emails or other personal data.

## How Kiro was used

Details and lessons are in [`kiro-log.md`](kiro-log.md).

- **Steering** ([`.kiro/steering/`](.kiro/steering/)): product, tech, safety and credit-budget rules written from the roadmap before any code.
- **Specs** ([`.kiro/specs/`](.kiro/specs/)): one per feature (plaza movement, multiplayer sync, chat and Caretaker, Ghost Fishing, haunted UI, deploy, Graveyard Dash). Requirements, then design, then tasks, then code.
- **Hooks** ([`.kiro/hooks/`](.kiro/hooks/)):
  - secret scan on commit (also a git pre-commit hook), because the repo is public;
  - tests on save for `shared/` and `server/`;
  - Caretaker evals re-run whenever `prompt.md` changes;
  - SVG optimise + WCAG contrast check on art and stylesheet saves.
- **Custom agent** ([`.kiro/agents/red-team.json`](.kiro/agents/red-team.json)): writes tricky chat messages aimed at gaps in the Caretaker, adds them to the eval set and reports misses. It may only write the eval file and only run the evals.
- **MCP**: Playwright MCP server configured in [`.kiro/settings/mcp.json`](.kiro/settings/mcp.json).
- **Property-based tests**: these found real bugs, including a float32/float64 sync mismatch that a hand-written test would have missed.

## Licence

MIT. See [`LICENSE`](LICENSE). Music credits are in [`client/public/CREDITS.md`](client/public/CREDITS.md). All characters and art are original.
