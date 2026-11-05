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

## Phase 2: Chat + the Caretaker
- Built the whole moderation system behind one `moderate()` function: instant checks (rate limit, length, obvious slurs) → LLM classify → fail-closed on error/timeout. Providers: `stub` (offline, deterministic, used in tests), `bedrock` (Nova Converse API), `nebius` (OpenAI-compatible fallback). Switching provider is one env var.
- Chat flow in `PlazaRoom`: hold every message, get a verdict, then allow (broadcast + bubble), nudge (private in-character note, not sent), or block (private note + short timeout). No chat text is stored.
- Client: chat input, speech bubbles over ghosts, private Caretaker notes, and a "Caretaker is resting" banner driven by synced state.
- Property-based test: no message is ever broadcast without a verdict. Unit tests cover the instant checks, the fail-closed hold, and JSON verdict parsing. 28 tests green, typecheck and client build pass.
- Eval harness: `caretaker-evals.json` (24 labelled cases incl. sarcasm, friendly insults, meanness-with-no-bad-words) + `npm run evals`, gated at 18/20.
- **Provider snag (good write-up material):** Bedrock was the first choice (AWS-sponsored). Nova Micro worked in the console Playground, but every programmatic `Converse`/`InvokeModel` returned `400 ValidationException "Operation not allowed"`, while `list-foundation-models` returned 200. Ruled out: key staleness (fresh key), model (Micro + Lite), model-ID format (profile + plain), operation (converse + invoke). After upgrading off the free Idea Launchpad plan the Playground *also* started failing, which pinned it to an account-level Bedrock allowlisting issue, not our code. Raised an AWS support case (category: Bedrock Allowlisting) with the request IDs. The fail-closed design behaved correctly throughout: failed calls were held, never wrongly allowed. Because everything routes through `moderate()`, the game runs on the stub meanwhile and can switch to Bedrock or Nebius with one env change.
- **Live result:** switched the provider to Nebius (Qwen3-30B-A3B-Instruct-2507) via the one env var. First eval run: 22/24. Two prompt tweaks (make off-platform contact like "add me on discord" an explicit block; make clearly-joking banter about an object, not the person, an explicit allow) took it to 23/24 (96%). The one remaining miss is a friendly hat-tease nudged rather than allowed — erring strict, the safe direction for a teens-and-up space. This 96% is the demo's hero stat ("23 of 24 tricky messages handled right, including meanness with no bad words"). The whole Bedrock→Nebius switch was literally changing CARETAKER_PROVIDER and the model ID, which is the payoff of hiding the provider behind moderate().

## Phase 3: Ghost Fishing + shop + persistence
- Spec-first again: wrote `ghost-fishing/design.md` and a 12-step `tasks.md` before any code, confirmed the two open questions (SQLite driver, and keeping "wear/place item" in haunted-ui) with the human, then implemented one task at a time.
- Persistence foundation: `better-sqlite3` (synchronous, fine inside the Colyseus tick), a `db/` module with a `user_version` migration, and a thin players repository. Tests run against a `:memory:` database via a `setDb()` override, so they stay hermetic and fast.
- Identity: browser-kept guest id (UUID) plus a server-issued recovery code from an unambiguous alphabet (no 0/O/1/I). **Property test earned its keep immediately** — it rejected my own example codes twice (`MOON-7421`, then `MOON-7823`): I kept forgetting the alphabet drops `O` and `I`, not just `0` and `1`. A hand-written test would have used whatever string I typed and happily passed.
- Server authority held the line: the client sends a timing-bar accuracy, the server rolls the catch and owns the coins; the shop buy is one SQLite transaction guarded by a `coins >= 0` CHECK and a composite primary key that makes "buy the same item twice" impossible at the schema level.
- Client race caught by a test: the join-time `wallet` message was being missed because the test registered its handler after an `await`. Fix on both sides — register message handlers synchronously right after join, before any await. The browser check later confirmed the real client receives it.
- Browser check (`scripts/fishing-check.ts`, Playwright + system Edge): join → walk to the fountain → fish a catch → buy a hat → reload the page → coins and ownership both restored from SQLite (`PERSIST_OK`), no page errors. Screenshots 05–09 in `screenshots/` show the cosy-spooky shop with a live coin counter and the bought hat flipping to "Owned". Good gallery + demo material: "earn coins fishing, buy a hat, close the tab, come back — it's still yours."
- Credits/workflow note: the human relaxed the commit rule mid-phase ("commit at sensible points, keep a coherent history") so the agent now commits each coherent unit (foundation, core logic, server wiring, client) instead of asking every time.
