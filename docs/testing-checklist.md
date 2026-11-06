# Testing checklist (needs your confirmation)

Everything here was built since the roadmap gap check. Unit, property and typecheck runs are green (86 tests), but these need a human: looks, feel, multi-player, and anything I could only partly test in the browser.

**Before you start:** restart `npm.cmd run dev:server` (new rooms and synced fields), then hard-refresh http://localhost:5173 (Ctrl+Shift+R).
**Two players:** tabs in one browser share a guest id and count as the same player. Use two different browsers, or a normal window and a private one.

Legend: 🧪 = I couldn't test this at all · 👀 = I tested it works, but you need to judge how it looks or feels.

## 1. Screen and layout
- [ ] 👀 The join card shows "Waking the town…" briefly, then the form, with your ghost preview changing colour as you pick swatches.
- [ ] 👀 The world fills the whole window at several window sizes and browser zoom levels (try 80%, 100%, 150%). No black bars.
- [ ] 👀 On a narrow window (under 720px wide) the toolbar shows icons only and nothing overlaps.
- [ ] 👀 **Your original bug:** HUD, chat, fishing and dialogs are always visible and never jump around or vanish until you re-zoom.
- [ ] 👀 The camera follows your ghost smoothly and never shows past the map edge.

## 2. Movement
- [ ] Typing W/A/S/D in the chat box types letters and does **not** move your ghost. Esc in the chat box hands the keyboard back to the game.
- [ ] Releasing the keys stops you on the spot, with no nudge and no turning round.
- [ ] Ghosts face the way they move and flip when you change direction; hats flip with them.
- [ ] The fountain blocks you as an oval matching the basin, not a square.
- [ ] You can't walk up past the garden wall into the houses. In rooms, you can't walk up the wall.
- [ ] 👀 The new ghost shape (your three-point tail, now without a dark outline). Say if you want the outline back.

## 3. The Caretaker
- [ ] It greets you by name when you arrive and circles the fountain, turning to face where it's going.
- [ ] Clicking it swaps the chat bar for reply buttons; answers appear in its speech bubble, long enough to read.
- [ ] While you talk it stops moving and doesn't interrupt with tips. **Goodbye** or Esc brings the chat bar back.

## 4. Chat and moderation
- [ ] 🧪 **Run `npm.cmd run evals`** (owed since `prompt.md` changed). The bar from the roadmap is 18/20; there are now 32 cases. Report the score.
- [ ] Spot-check live: "I'm dead 💀 that was hilarious" and "this fishing game is so damn hard" go through; "nobody here actually likes you" gets a private nudge.

## 5. Ghost Fishing
- [ ] The amber zone has hard edges and jumps somewhere new after every press.
- [ ] Each hit speeds the marker up (the four bars fill); a miss drops back to slow.
- [ ] A hit at top speed lands a catch and coins. **Space** works as well as the button, and doesn't fire while typing.

## 6. Séance (candle circle, left of the fountain)
- [ ] "Hold a séance" appears when you stand in the circle.
- [ ] Runes light up in order, then you repeat them by clicking or pressing 1–4. Each round adds one rune and gets a little faster.
- [ ] A wrong rune ends it; waiting too long ends it; both pay 2 coins per cleared round. "Leave the circle" ends it with no penalty.

## 7. Shop and pets
- [ ] 👀 Cards show previews in three sections (Hats, Room decorations, Pets); locked items say "Need N more".
- [ ] Buy one pet of each species if you can afford it (or give yourself coins in the DB). **Bring along** / **Send home** works, one pet at a time.
- [ ] 🧪 👀 **Pets on screen (I never saw one):** bats flap, wisps bob and glow, spiders dangle on a thread. They trail behind you and flip with you.
- [ ] 🧪 Your pet and hat come with you into rooms, the lighthouse and the crypt.
- [ ] 🧪 Another player (second browser) sees your pet.
- [ ] Under Settings → Reduced motion, pets hold still (after re-entering the area).

## 8. Haunted rooms
- [ ] **My room** opens your room. **Decorate → Place** attaches the item to your cursor; click anywhere (walls too) to drop it; Esc cancels.
- [ ] Drag to move, double-click to remove. Dragging an item doesn't walk your ghost there.
- [ ] 👀 The fireplace glow is a soft warm wash now, not a blob.
- [ ] 🧪 Visiting another player's room shows "*Their ghost name*'s room", not "Player 12's room".

## 9. Friends (needs two browsers)
- [ ] 🧪 Click the other ghost: a card with **Visit their room** and **Add friend**.
- [ ] 🧪 Their name appears in **Friends** with a green "Online" dot; the toolbar badge counts online friends.
- [ ] 🧪 **Visit room** from the list works; **Remove** works; when they leave, they show as "Away" within about 20 seconds.
- [ ] Clicking your own ghost in another tab explains it's you instead of doing nothing.

## 10. Public areas
- [ ] Signposts at the plaza's left (Lighthouse) and right (Crypt) edges; standing there shows "Go to…".
- [ ] You arrive next to the way back, and the top-left **Plaza** button also takes you home.
- [ ] Chat works in both areas; fishing and the séance only appear in the plaza.
- [ ] 🧪 👀 **The lighthouse beam** now sweeps over the sea and sky only, with soft edges. I changed this after my last look.
- [ ] 🧪 👀 **The crypt** (my screenshot failed): pillars, sarcophagus, candle alcoves, stairs on the left. You can't walk through the pillars or the sarcophagus.

## 11. Events, settings, identity
- [ ] The midnight haunting (every 5 minutes) dims the plaza and the Caretaker announces it in its bubble.
- [ ] Settings: Reduced motion and Mute music toggles work; **Show my recovery code** opens the code, **Copy code** shows "Code copied".
- [ ] 🧪 In another browser, type the code on the join screen ("Have a recovery code?"): your coins and items come back.
- [ ] Keyboard only: Tab moves through every dialog without escaping it; Esc closes it.

## 12. Tooling
- [ ] Save `client/public/favicon.svg` in Kiro and check the hook ran (Agent Hooks panel / hook output).
- [ ] `npm run svg-check` prints svgo results and 16 contrast pairs, all passing.

## 13. Decisions only you can make
- [ ] `product.md` still says "parchment and tombstone panels"; the UI now uses dark Kiro-purple panels. Update the steering file, or ask me to bring parchment back.
- [ ] Kiro name and mascot-like ghost: still unconfirmed with the organisers (backup name Club Boo).
- [ ] Two identical commits, `d50b04c` and `0423dda` ("client: modern UI pass…"). If they're not pushed, I can squash them. If they are, leave them.
- [ ] Graveyard Dash: approve, change or drop the design in `.kiro/specs/graveyard-dash/`.

## Known broken (not for you to test)
- The browser check scripts (`scripts/two-tabs.ts`, `fishing-check.ts`, `room-check.ts`) click fixed canvas positions, which the following camera broke. They need updating before you rely on them for screenshots.
