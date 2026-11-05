# Chat and Caretaker: design

Implements `.kiro/steering/safety.md`. The server holds every message, gets a verdict, then decides what to broadcast.

## Flow (server)
1. Client sends `chat` `{ text }`.
2. Instant checks (sync, no network): rate limit (1 per 2s), length (<=120), empty, and an obvious-slur list. A fail here returns a verdict with no LLM call.
3. If instant checks pass, call `moderate(text, context)` → `{ verdict, reason? }`. `verdict` is `allow | nudge | block`.
4. Act on the verdict:
   - allow: broadcast a `chat` message to everyone; set the sender ghost's `bubble`.
   - nudge: send a private `caretaker` message to the sender only. The message is not broadcast.
   - block: private `caretaker` note plus a timeout (`mutedUntil`); the message is not broadcast.
5. Fail closed: if `moderate` throws or exceeds `MODERATION_TIMEOUT_MS`, hold the message and privately tell the sender the Caretaker is thinking.

## moderate() and providers
- `server/caretaker/moderate.ts` exports `createModerator(): Moderator`. It picks a provider from `CARETAKER_PROVIDER` and wraps it with the instant checks, the timeout and the fail-closed rule.
- Providers implement `LlmProvider { classify(text, context): Promise<Verdict> }`:
  - `stub`: deterministic, no network. Used in tests and when no key is set. Flags a small set of meanness patterns so the eval harness is meaningful offline.
  - `bedrock`: calls Bedrock with the `AWS_BEARER_TOKEN_BEDROCK` key; prompt from `prompt.md`.
  - `nebius`: OpenAI-compatible fallback.
- Switching provider is one env var. The rest of the server only sees `moderate()`.

## Availability
- `Moderator.healthy()` reports whether the LLM path is up. The room exposes it as a `caretakerResting` flag in state so the client can show "Caretaker is resting".
- When resting, moderation runs instant checks only (a basic filter), never letting the game break.

## Privacy
- No chat text is written to disk or the DB. Only the current `bubble` lives in state, and it clears after a few seconds. Evals read from a fixed file, not from live chat.

## Eval harness
- `server/caretaker/caretaker-evals.json`: 20+ `{ text, label, note }` cases, including sarcasm, friendly insults and meanness with no bad words.
- `server/caretaker/evals.ts` runs them through the active moderator and prints a score. Wired to `npm run evals`.
- A hook re-runs the evals when `prompt.md` changes.

## Caretaker NPC
- A reserved ghost in state (`isCaretaker`), drifts around, greets newcomers by name, announces the midnight event. Phase 2 adds greet + presence; the event ties in with haunted-ui in Phase 3.
