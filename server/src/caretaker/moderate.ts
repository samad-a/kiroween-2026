import { MAX_MESSAGE_LENGTH, type Verdict } from "@club-kiro/shared";
import { instantCheck } from "./instantChecks.js";
import { StubProvider } from "./providers/stub.js";
import { BedrockProvider } from "./providers/bedrock.js";
import { NebiusProvider } from "./providers/nebius.js";
import type { Decision, LlmProvider, ModerationContext } from "./types.js";

const HELD: Decision = {
  verdict: "block",
  reason: "The Caretaker is thinking that one over. Give it another try in a moment, dear.",
  source: "held",
};

const TOO_FAST: Decision = {
  verdict: "block",
  reason: "Catch your breath, little spirit. One whisper at a time.",
  source: "instant",
};

const HARD_BLOCK: Decision = {
  verdict: "block",
  reason: "That word has no home in our town. Let us keep it kind.",
  source: "instant",
};

export interface Moderator {
  readonly providerName: string;
  /** True while the LLM path is up. When false, the game runs on instant checks only. */
  resting: boolean;
  decide(text: string, lastMessageAt: number, now: number, context: ModerationContext): Promise<Decision>;
  /** Refresh `resting` by pinging the provider. Called on a timer by the room. */
  refreshHealth(): Promise<void>;
}

export function selectProvider(env: NodeJS.ProcessEnv = process.env): LlmProvider {
  switch (env.CARETAKER_PROVIDER) {
    case "bedrock":
      return new BedrockProvider(env.CARETAKER_MODEL_ID ?? "", env.AWS_REGION ?? "us-east-1", env.AWS_BEARER_TOKEN_BEDROCK ?? "");
    case "nebius":
      return new NebiusProvider(env.CARETAKER_MODEL_ID ?? "", env.NEBIUS_BASE_URL ?? "", env.NEBIUS_API_KEY ?? "");
    default:
      return new StubProvider();
  }
}

/**
 * Wraps a provider with the safety rules from safety.md:
 * instant checks first, then the LLM, fail closed on error or timeout.
 */
export function createModerator(provider: LlmProvider = selectProvider()): Moderator {
  return {
    providerName: provider.name,
    resting: false,

    async decide(text, lastMessageAt, now, context) {
      // Length is validated at the edge too, but never trust that alone.
      if (text.length === 0 || text.length > MAX_MESSAGE_LENGTH) return HARD_BLOCK;

      const instant = instantCheck(text, lastMessageAt, now);
      if (instant.kind === "too-fast") return TOO_FAST;
      if (instant.kind === "hard-block") return HARD_BLOCK;

      // When the Caretaker is resting, instant checks are the whole filter.
      if (this.resting) return { verdict: "allow", source: "instant" };

      try {
        const { verdict, reason } = await provider.classify(text, context);
        return { verdict, reason, source: "llm" };
      } catch {
        // Fail closed: a broken or slow model holds the message, never lets it through.
        this.resting = true;
        return HELD;
      }
    },

    async refreshHealth() {
      this.resting = !(await provider.healthy());
    },
  };
}

export type { Decision, ModerationContext, Verdict };
