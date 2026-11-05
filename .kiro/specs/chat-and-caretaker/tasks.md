# Chat and Caretaker: tasks

- [x] 1. Shared chat types, verdict type, timeout and bubble constants, `cleanMessage`
- [x] 2. Instant checks: rate limit, length, obvious-slur list
- [x] 3. `moderate()` orchestration: instant → LLM → fail-closed hold/timeout
- [x] 4. Providers: stub (offline), Bedrock (Nova Converse), Nebius (fallback)
- [x] 5. Caretaker prompt in `server/caretaker/prompt.md`
- [x] 6. Chat in `PlazaRoom`: hold, verdict, allow/nudge/block, no stored logs
- [x] 7. Client: chat input, speech bubbles, private Caretaker notes
- [x] 8. "Caretaker is resting" fallback wired to synced state
- [x] 9. `caretaker-evals.json` (24 cases) + `npm run evals` scorer, gated at 18/20
- [x] 10. Tests: instant checks, fail-closed, verdict parsing, no-message-without-verdict (PBT)
- [x] 11. Hook: re-run evals when prompt.md changes
- [ ] 12. Live eval run + prompt tuning to 18/20 — BLOCKED on AWS Bedrock allowlisting (support case open). Switch `CARETAKER_PROVIDER` to bedrock/nebius and run `npm run evals` once a working key is available.
- [ ] 13. Caretaker NPC: greet newcomers by name, drift around (Phase 2/3 boundary; event ties into haunted-ui)
