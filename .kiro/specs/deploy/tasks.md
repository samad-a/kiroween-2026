# Deploy: tasks

Platform-agnostic groundwork done in code; the actual hosting step is left to the human (needs
accounts + a hosting choice). Budget is tight, so nothing speculative.

- [x] 1. Production server start (`npm run start:server` → `tsx src/index.ts`, no watch); `tsx` + `@club-kiro/shared` as server deps so `npm ci` suffices
- [x] 2. Verify the server reads `PORT`/`DB_PATH`/Caretaker env (booted clean on a test port)
- [x] 3. `.env.example` documenting every variable by name (no secret values); repo stays public-safe
- [x] 4. Verify the client bakes `VITE_SERVER_URL` at build time (confirmed in the built bundle); wss:// auto-selected under https (already in `net.ts`)
- [x] 5. Deploy guide (`docs/deploy.md`): build steps, server env, client URL, three hosting options, a checklist
- [ ] 6. **Human:** choose a host, deploy the server (persistent disk for `DB_PATH`, WebSockets), build the client with its `wss://` URL, deploy the static files
- [ ] 7. **Human/agent:** post-deploy smoke test over the live URL (two tabs: movement, moderated chat, coins/rooms persist)
