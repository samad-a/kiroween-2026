# Club Kiro vs the rules (check as of Phase 1)

Checked against [devpost-rules.md](devpost-rules.md). Status: ✅ on track, ⚠️ needs attention, ❌ not done / at risk.

## Hard requirements (a miss here can disqualify)

| Item | Status | Notes |
|---|---|---|
| New project, built in the Submission Period | ✅ | Repo's first real commit is Nov 2026. Keep all work inside the window. |
| Category chosen (Resurrection) | ✅ | A browser virtual world, a dead genre, brought back. Fits well. |
| Built using Kiro, visibly | ✅ | Specs, steering, hooks, PBT already in `.kiro/` and the code. |
| Public GitHub repo | ⚠️ | Repo exists but **3 commits are unpushed**. Needs pushing before submission. |
| Open-source licence shown in About | ✅ | MIT `LICENSE` present. Confirm it shows in the GitHub About sidebar. |
| `/.kiro` at root, not gitignored | ✅ | Verified: `git check-ignore .kiro` returns nothing, so it is tracked. `.gitignore` explicitly keeps it in. |
| Working app URL, free for judges until Jan 29, 2027 | ❌ | **Not deployed yet.** Phase 4. The server needs WebSockets; the free tier must stay up through judging. |
| Runs consistently | ⚠️ | Needs the AI-down fallback ("Caretaker is resting") so a model outage never breaks the game. Planned for Phase 2. |
| Demo video, <3 min, public on YouTube, no infringing content | ❌ | Phase 4. Ghost art and UI are original; use royalty-free or self-made music. |
| Kiro write-up covering the 8 prompts | ⚠️ | `kiro-log.md` is capturing material. Not yet assembled into the write-up. |
| English materials | ✅ | All English. |

## IP and privacy (judged, and a disqualifier if wrong)
- ✅ Ghosts and props are hand-drawn SVGs. No Disney or Club Penguin names, art or music.
- ⚠️ The project is named "Club Kiro" and themed around the Kiro mascot idea. "Kiro" is the sponsor's trademark. The roadmap already flags this: confirm with the organisers in writing that the name and a Kiro-like ghost are allowed, or fall back to "Club Boo" with an original ghost. Open question.
- ✅ `safety.md` already forbids storing chat logs and collecting personal data, which lines up with the privacy warranties.
- ⚠️ Pets, if added, must be original creatures, not puffles.

## Scoring: where the plan earns points
- **Potential Impact (20%)**: strong. Real problem (keyword filters fail young people), clear audience (teens and up), and a hero moment that proves it. Lead with the eval score ("19 of 20 tricky messages handled right"). Accessibility work (keyboard, reduced motion, contrast) helps the "accessible" part of this criterion.
- **Technological Implementation (20%)**: strong and the biggest differentiator. Already using specs, steering, hooks and PBT; planned: MCP (Playwright), a custom red-team agent, Kiro CLI headless, and a power. Show experimentation (spec vs vibe, IDE vs CLI vs Web). The PBT bug stories (float32 sync drift; the base64 SVG loader) are concrete evidence judges reward.
- **Design (20%)**: on track. The cosy-spooky plaza looks complete already. The full loop (join, play, earn, spend, decorate, visit) must actually work end to end by Phase 3.
- **Innovation/Idea (20%)**: strong. A dead genre plus an in-character AI caretaker that reads context instead of keywords. Say plainly how it differs from Club Penguin and from ordinary filters.
- **Presentation (20%)**: TBD, all in Phase 4. The 3-minute video is where many entries lose points; follow the demo script in the roadmap.

## Biggest risks, in order
1. **No live deployment yet** (hard requirement). Don't leave it all to Phase 4; prove a deploy early.
2. **The "Kiro" name/mascot trademark question.** Get the organisers' answer in writing soon, because it affects the name, art, video and repo.
3. **The AI-down fallback.** Judges may test during an outage; "running consistently" needs the graceful degrade.
4. **Judges may score on the video and description alone.** The write-up and video have to carry the project even if nobody runs it.

## Easy points worth banking
- A README that runs the app in under 5 minutes.
- Screenshots in the Devpost gallery (already generating them in `screenshots/`).
- One write-up section per Kiro feature, each with a concrete example.
- Bonus Blog and Social Blitz are low-effort, separate prizes: a blog post and one `#KiroweenHackathon26` post.
