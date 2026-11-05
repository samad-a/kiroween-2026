# Ghost Fishing: tasks

Order: persistence + identity foundation first (everything else saves through it), then the fishing
round, then the shop, then the client. One testable piece at a time; commit after each.

- [x] 1. Add `better-sqlite3` (+ `@types/better-sqlite3`) to the server; `.gitignore` `server/data/`
- [x] 2. Shared identity helpers (`shared/src/identity.ts`): `parseGuestId`, `generateRecoveryCode`, `parseRecoveryCode`, `formatRecoveryCode` + tests (unambiguous alphabet, round-trips)
- [ ] 3. DB module (`server/src/db/index.ts`): open DB from `DB_PATH` (`:memory:` in tests), run v1 migration (players, player_items)
- [ ] 4. Players repository (`server/src/db/players.ts`): `resolvePlayer`, `getPlayer`, `addCoins`, `ownsItem`, `grantItem` + tests (coins never negative, no double-grant, resolve order)
- [ ] 5. Shared fishing + shop message types and parsers (`shared/src/fishing.ts`, `shared/src/shop.ts`): catch table, `parseCast`, catalogue (~6 hats + ~6 decorations), `parseBuy` + tests
- [ ] 6. Catch roll (`server/src/fishing.ts`): weighted, accuracy-scaled, injectable random + tests (distribution within tolerance, always a valid catch)
- [ ] 7. Wire identity into `PlazaRoom.onJoin`: resolve player, attach `playerId`, send `wallet` (coins + owned items)
- [ ] 8. Fishing round in `PlazaRoom`: `fish:start/cast/end` handlers, 60 s server timeout, cast rate limit, credit coins once on end + tests (round credits the sum once, double-end is a no-op)
- [ ] 9. Shop buy in `PlazaRoom`: `shop:buy` → validate / not-owned / affordable → transaction → `shop:bought`/`shop:denied` + tests
- [ ] 10. Client net helpers (`client/src/net.ts`): guest id + recovery code in `localStorage`, send on join, `sendCast`/`sendBuy`, `onWallet`/`onCatch`/`onBought` handlers
- [ ] 11. Client UI: fountain "cast a line" prompt, timing bar, coin counter, shop panel (owned/affordable states), recovery-code display. Plain HTML/CSS overlay, keyboard-focusable
- [ ] 12. Browser check: start a round, catch, buy an item, confirm coins/ownership persist across reconnect; screenshot for the gallery
