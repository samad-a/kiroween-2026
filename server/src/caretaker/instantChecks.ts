import { MESSAGE_COOLDOWN_MS } from "@club-kiro/shared";

/**
 * Obvious slurs and clearly abusive terms, caught before spending an LLM call.
 * Deliberately short: the LLM handles everything subtle. These are only the
 * cases no context could excuse. Kept as word-boundary patterns to avoid the
 * Scunthorpe problem (innocent substrings).
 */
const HARD_BLOCK = [
  /\bn[i1]gg(?:er|a)\b/i,
  /\bf[a4]gg?(?:ot)?\b/i,
  /\br[e3]t[a4]rd\b/i,
  /\bk[i1]ll\s+your\s*self\b/i,
  /\bkys\b/i,
];

export type InstantResult =
  | { kind: "pass" }
  | { kind: "too-fast" }
  | { kind: "hard-block" };

/**
 * Synchronous pre-checks. Rate limit uses the sender's last-allowed timestamp.
 * Returns pass when the message should go on to the LLM.
 */
export function instantCheck(text: string, lastMessageAt: number, now: number): InstantResult {
  if (now - lastMessageAt < MESSAGE_COOLDOWN_MS) return { kind: "too-fast" };
  if (HARD_BLOCK.some((re) => re.test(text))) return { kind: "hard-block" };
  return { kind: "pass" };
}
