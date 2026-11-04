// Smoke test against the running dev servers: checks the client page is served,
// then two clients join the plaza, one moves, and both must see the same position.
// Usage: npx tsx scripts/smoke.ts   (needs `npm run dev:server` and `npm run dev:client` running)
import { Client } from "@colyseus/sdk";
import { DEFAULT_SERVER_PORT, PLAZA_ROOM } from "@club-kiro/shared";

interface GhostView {
  x: number;
  y: number;
  name: string;
}
interface PlazaView {
  ghosts: Map<string, GhostView>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const page = await fetch("http://localhost:5173/");
const html = await page.text();
if (!page.ok || !html.includes("Club Kiro")) throw new Error(`client page not served (${page.status})`);
console.log("client page: ok");

const sdk = new Client(`ws://localhost:${DEFAULT_SERVER_PORT}`);
const a = await sdk.joinOrCreate<PlazaView>(PLAZA_ROOM, { name: "Smoke A", colour: 1 });
const b = await sdk.joinOrCreate<PlazaView>(PLAZA_ROOM, { name: "Smoke B", colour: 3 });
if (a.roomId !== b.roomId) throw new Error("clients landed in different plazas");
await sleep(300);

const before = a.state.ghosts.get(a.sessionId)!;
const target = { x: 200, y: before.y };
a.send("move", target);
await sleep(4000); // ~400 px at 180 px/s, plus slack

const seenByA = a.state.ghosts.get(a.sessionId)!;
const seenByB = b.state.ghosts.get(a.sessionId)!;
console.log(`A sees A at ${seenByA.x.toFixed(1)},${seenByA.y.toFixed(1)}; B sees A at ${seenByB.x.toFixed(1)},${seenByB.y.toFixed(1)}`);
console.log(`B sees ${b.state.ghosts.size} ghosts; names: ${[...b.state.ghosts.values()].map((g) => g.name).join(", ")}`);

const ok = Math.abs(seenByA.x - target.x) < 1 && seenByA.x === seenByB.x && seenByA.y === seenByB.y;
await a.leave();
await b.leave();
console.log(ok ? "SMOKE_OK" : "SMOKE_FAIL");
process.exit(ok ? 0 : 1);
