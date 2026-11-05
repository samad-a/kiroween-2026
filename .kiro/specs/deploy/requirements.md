# Deploy: requirements

Phase 4. Budget is tight (200 credits), so keep it simple and platform-agnostic where possible.

1. The client SHALL build to static files and be hostable on any static host or CDN.
2. The client SHALL learn the server's WebSocket URL at build time via `VITE_SERVER_URL`.
3. The server SHALL run in production without `tsx watch` (a real start command).
4. The server SHALL read config from the environment: `PORT`, `CARETAKER_PROVIDER` (+ provider keys), `DB_PATH`.
5. The SQLite database SHALL live on a persistent path so coins, items and rooms survive a restart.
6. Secrets SHALL NOT be committed. A `.env.example` SHALL document required variables by name only.
7. A short deploy guide SHALL explain the steps for the chosen host, and how to set the client's server URL.
8. The game SHALL work over HTTPS/WSS (secure client implies secure socket).
9. Nothing in the deploy SHALL break local dev (`npm run dev:server` / `dev:client` keep working).
