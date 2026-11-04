# Club Kiro: Safety and Privacy

## Caretaker rules
- Every chat message is checked before anyone else sees it. Target under 1 second.
- Order: instant checks (length, rate, obvious slurs), then the LLM call, then a verdict.
- Verdicts:
  - allow: broadcast as normal.
  - nudge: private, in-character note to the sender. The message is not sent.
  - block: for repeat or severe cases, a short timeout.
- No public shaming. Ever.
- Fail closed: if the check errors or times out, hold the message. Never let it through.
- No message is sent without a verdict.
- Fallback if the AI is down: basic filter plus a visible "Caretaker is resting" state. The game must not break.

## What counts as harm
Bullying, mockery of a person, exclusion or pile-ons, harassment, hate, sexual content, threats, self-harm encouragement, sharing personal info, and attempts to move chat off-platform. Meanness counts even with no bad words.

Not harm: friendly insults between obvious friends, sarcasm, spooky jokes, banter. Judge by context, and when unsure, nudge rather than block.

## Tone of the Caretaker
Kind, gentle, old and wise. Nudges explain softly and suggest a kinder way to say it. Never scolding, never gory.

## Cost guards
- Rate limit: 1 message every 2 seconds per player.
- Max message length: 120 characters.

## Privacy
- Do not store chat logs. Keep only what the Caretaker needs in memory for the current session.
- Never log message text to disk or the database.
- Store only what the game needs: guest ID, recovery code, coins, items, room layout.
- Collect no real names, emails or other personal data. Real accounts are a stretch goal.
- Never commit API keys or secrets. The repo is public.

## Eval set
Keep `caretaker-evals.json` with 20+ labelled messages (allow, nudge, block), including sarcasm, friendly insults and meanness with no bad words. Re-run it whenever `server/caretaker/prompt.md` changes.
