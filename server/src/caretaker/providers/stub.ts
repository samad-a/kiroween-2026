import type { Verdict } from "@club-kiro/shared";
import type { LlmProvider, ModerationContext } from "../types.js";

/**
 * Deterministic, offline stand-in for a real LLM. Used in tests and whenever no
 * provider key is set, so chat, the eval harness and the fallback can all be built
 * and run without network or cost. It is NOT the shipping moderator: it only
 * recognises a handful of patterns, including some meanness with no bad words.
 */
const MEAN_PATTERNS: RegExp[] = [
  /\bnobody (likes|wants) you\b/i,
  /\byou('?re| are) (so )?(stupid|dumb|ugly|worthless|pathetic|annoying)\b/i,
  /\bno ?one cares\b/i,
  /\bgo away\b/i,
  /\bshut up\b/i,
  /\byou should(n'?t| not) (be here|have come)\b/i,
  /\bget lost\b/i,
  /\bwho invited you\b/i,
];

/** Friendly-banter signals that make a borderline line an allow. */
const FRIENDLY = /(\blol\b|\bhaha\b|😄|😂|🎃|👻|\bjk\b|\bkidding\b|\bmy friend\b|\bmate\b)/i;

export class StubProvider implements LlmProvider {
  readonly name = "stub";

  async classify(text: string, _context: ModerationContext): Promise<{ verdict: Verdict; reason?: string }> {
    const mean = MEAN_PATTERNS.some((re) => re.test(text));
    const friendly = FRIENDLY.test(text);

    if (mean && !friendly) {
      return {
        verdict: "nudge",
        reason: "That one might sting a little. Try saying it with a kinder spirit, dear.",
      };
    }
    return { verdict: "allow" };
  }

  async healthy(): Promise<boolean> {
    return true;
  }
}
