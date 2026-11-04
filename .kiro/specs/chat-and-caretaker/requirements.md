# Chat and Caretaker: requirements

Phase 2. See `.kiro/steering/safety.md` for the rules this spec implements.

1. Messages SHALL appear as chat bubbles over ghosts, with a chat input.
2. The server SHALL hold every message, check it, then broadcast. Target under 1 second.
3. The check SHALL run instant rules first (length, rate, obvious slurs), then the LLM call.
4. The verdict SHALL be allow, nudge or block. No message is sent without a verdict.
   - allow: broadcast to the plaza.
   - nudge: private, in-character note to the sender. The message is not sent.
   - block: short timeout, for repeat or severe cases. No public shaming.
5. IF the check fails or times out, the server SHALL hold the message.
6. Each player SHALL be limited to 1 message per 2 seconds, max 120 characters.
7. The LLM provider SHALL sit behind a single `moderate()` function.
8. The prompt SHALL live in `server/caretaker/prompt.md`, written in the Caretaker's voice.
9. The server SHALL NOT store chat logs. Only in-memory session state is kept.
10. IF the AI is unavailable, the server SHALL fall back to a basic filter and show "Caretaker is resting".
11. The Caretaker SHALL appear as an NPC: greets newcomers by name, drifts around, announces events.
12. `caretaker-evals.json` SHALL hold 20+ labelled messages. Done when the Caretaker gets at least 18 of 20 right.
