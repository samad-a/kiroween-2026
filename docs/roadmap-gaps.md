# Roadmap gap check (Nov 5)

Compared `Club Kiro — Kiroween 2026 Roadmap.pdf` with the code, `.kiro/` and `kiro-log.md`.

## Done
Plaza, movement, multiplayer sync, 20-ghost cap, chat + Caretaker (allow/nudge/block, fail-closed, resting state), evals (23/24) + evals hook, secret scan, tests-on-save hook, property tests, Ghost Fishing (60s rounds), coins, shop (6 hats + 6 decorations), SQLite saving, guest ID + recovery code, haunted rooms (place/move/remove, owner-only, visiting), midnight haunting, reduced motion, mute, music, join/leave effects, deploy groundwork.

## Missing in the game
| Item | Roadmap phase | Status |
|---|---|---|
| Caretaker as a visible NPC (greets newcomers by name, drifts around, announces events) | 2 (Core) | Missing. Announcements exist as text notes only. **Fixed in the visual pass (client-side NPC).** |
| Visiting is discoverable ("click a ghost to visit") | 3 | Works but nothing tells you. **Fixed in the visual pass (hint).** |
| Sound effects (catch, buy, join) | 3 | Only background music. Needs licensed audio; left to you. |
| Lanterns flickering, fonts, glow | 3 | Basic version. **Reworked in the visual pass.** |

## Missing outside the game (left to you)
| Item | Roadmap phase | Why it matters |
|---|---|---|
| `README.md` (run in under 5 minutes, how Kiro was used, link to `.kiro`) | 4 | Listed under "easy points people miss". |
| Custom agent `.kiro/agents/red-team.json` | 2 (Core) | Core write-up feature (custom agents). |
| Kiro CLI GitHub Action for evals + red-team on `server/caretaker/` PRs | 2 (Core) | Core write-up feature (CLI headless). |
| Vibe-coded title screen note in `kiro-log.md` (spec vs vibe) | 1 (Core) | No entry in the log. |
| Playwright MCP use noted in the log | 1, 3 | Browser checks use a script, not the MCP server. Worth saying plainly in the write-up. |
| Deployment + live URL, deploy via a Kiro power | 4 | Groundwork done, see `docs/deploy.md`. |
| Playtest with 2–3 friends, fix top 5 issues | 3 | Not logged. |
| Video, blog post, social post, write-up, Kiro Web README | 4 | Not started. |
| Organiser questions (Kiro name/mascot, Club Penguin inspiration) | 0 | No answer recorded. Backup name is Club Boo. |

Stretch items not started: pets, custom power, Kiro Crew Night Watch, art-director agent, SVG check hook.
