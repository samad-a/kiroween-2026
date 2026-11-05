// Runs caretaker-evals.json through the active moderator and prints a score.
// Usage: npm run evals   (uses CARETAKER_PROVIDER from .env; defaults to the stub)
// Exits non-zero if the score is below the threshold, so CI / the hook can gate on it.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Verdict } from "@club-kiro/shared";
import { createModerator } from "./moderate.js";

interface EvalCase {
  text: string;
  label: Verdict;
  why?: string;
}

const PASS_THRESHOLD = 0.9; // roadmap target: at least 18 of 20

const file = fileURLToPath(new URL("./caretaker-evals.json", import.meta.url));
const { cases } = JSON.parse(readFileSync(file, "utf8")) as { cases: EvalCase[] };

const moderator = createModerator();

let correct = 0;
const misses: string[] = [];

for (const c of cases) {
  // Each case is a fresh sender, so rate limits and prior blocks never interfere.
  const decision = await moderator.decide(c.text, 0, Number.MAX_SAFE_INTEGER, {
    senderName: "Tester",
    priorBlocks: 0,
  });
  const ok = decision.verdict === c.label;
  if (ok) correct++;
  else misses.push(`  expected ${c.label}, got ${decision.verdict}: "${c.text}"`);
}

const pct = ((correct / cases.length) * 100).toFixed(0);
console.log(`Caretaker evals (${moderator.providerName}): ${correct}/${cases.length} correct (${pct}%)`);
if (misses.length) console.log("Misses:\n" + misses.join("\n"));

process.exit(correct / cases.length >= PASS_THRESHOLD ? 0 : 1);
