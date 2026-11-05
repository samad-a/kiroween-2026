# Deploying Club Kiro

Club Kiro is two deployables:

- **Client** — static files built by Vite (`client/dist/`). Host on any static host or CDN.
- **Server** — a long-running Node process (Colyseus + WebSockets). Needs a host that supports
  persistent processes and WebSockets, plus a small persistent disk for the SQLite database.

They talk over WebSockets. The client learns the server URL at build time from `VITE_SERVER_URL`.

## 1. Build

```bash
npm ci                 # install workspaces
npm run typecheck      # tsc -b, should be clean
npm test               # vitest, should be green

# Client (set the deployed server URL first — use wss:// for an https site):
VITE_SERVER_URL=wss://your-server.example.com npm run build
# -> static files in client/dist/
```

On Windows PowerShell, set the variable first: `$env:VITE_SERVER_URL = "wss://your-server.example.com"; npm run build`.

## 2. Run the server (production)

```bash
# From the repo root, with .env populated (see .env.example):
npm run start:server
# -> "Club Kiro server listening on ws://localhost:<PORT>"
```

`start:server` runs `tsx src/index.ts` (no file watching). `tsx` is a server dependency, so a plain
`npm ci` in production installs it — no build step or compile is required for the server.

### Server environment

Copy `.env.example` to `.env` and fill in. The essentials:

- `PORT` — most hosts set this automatically; the server reads it.
- `DB_PATH` — point at a **persistent** volume (e.g. `/data/club-kiro.db`) so coins, items and rooms
  survive restarts. Without a persistent disk, progress resets on every deploy.
- `CARETAKER_PROVIDER` — `stub` (no keys, basic filter), `nebius`, or `bedrock`. For a public demo,
  `nebius` (the Phase 2 choice) or `stub` are both fine; the game never breaks if the AI is down
  (fail-closed, "Caretaker is resting").
- Provider keys as needed (`NEBIUS_*` or `AWS_*`). Keep these out of git.

## 3. Point the client at the server

The client bundles whatever `VITE_SERVER_URL` was set to at build time. If you change the server URL,
rebuild the client. If `VITE_SERVER_URL` is unset, the client falls back to the same hostname on the
default port — fine only if the server is reachable there.

Serve the site over **HTTPS**; the client then uses **WSS** automatically, so the server must present
a valid TLS certificate (most managed hosts terminate TLS for you).

## Hosting options (pick one)

Hosting is not locked in. Three paths, cheapest-friction first:

1. **One managed Node host for the server + any static host for the client.**
   - Server: a platform that runs a Node process and supports WebSockets with a persistent disk
     (e.g. Render, Railway, Fly.io). Start command `npm run start:server`, attach a small volume,
     mount it, and set `DB_PATH` to a file on it. Set the Caretaker env vars.
   - Client: build with `VITE_SERVER_URL` = the server's `wss://` URL, then drop `client/dist/` on
     any static host (Netlify, Cloudflare Pages, GitHub Pages, S3+CloudFront).

2. **Colyseus Cloud for the server**, static host for the client. Colyseus Cloud is purpose-built for
   Colyseus rooms and WebSockets; follow their deploy flow for `createServer()` in `server/src/app.ts`,
   then point the client at the URL it gives you.

3. **A single VPS** (e.g. a small cloud VM): run the server under a process manager (systemd or pm2),
   put nginx in front for TLS + to serve `client/dist/`, and reverse-proxy the WebSocket upgrade to the
   Node port. Most control, most setup.

For a hackathon demo, option 1 is usually the least work: a free/cheap Node host for the server and a
static host for the client.

## Checklist

- [ ] `npm test` and `npm run typecheck` green
- [ ] Server host supports WebSockets and a persistent disk; `DB_PATH` on that disk
- [ ] Caretaker env set (or `stub` for a keyless demo); no secrets in git
- [ ] Client built with the correct `VITE_SERVER_URL` (wss:// for https)
- [ ] Site served over HTTPS
- [ ] Open two browser tabs: both see each other move, chat is moderated, coins/rooms persist across a reload
