// Load .env before anything reads process.env (the Caretaker provider needs it).
import "./env.js";
import { listen } from "colyseus";
import { DEFAULT_SERVER_PORT } from "@club-kiro/shared";
import { createServer } from "./app.js";

const port = Number(process.env.PORT) || DEFAULT_SERVER_PORT;
await listen(createServer(), port);
console.log(`Club Kiro server listening on ws://localhost:${port} (Caretaker: ${process.env.CARETAKER_PROVIDER ?? "stub"})`);
