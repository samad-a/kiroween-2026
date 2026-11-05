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
- [x] 12. Live eval run + prompt tuning. Nebius (Qwen3-30B-A3B-Instruct-2507) scores 23/24 (96%), above the 18/20 target. Bedrock stayed blocked by AWS account-level allowlisting, so shipped on Nebius; the moderate() abstraction keeps Bedrock a one-env switch if AWS clears it.
- [ ] 13. Caretaker NPC: greet newcomers by name, drift around (Phase 2/3 boundary; event ties into haunted-ui)
