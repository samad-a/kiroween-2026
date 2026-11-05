import type { Verdict } from "@club-kiro/shared";

export interface ModerationContext {
  /** Display name of the sender, for a personal nudge. */
  senderName: string;
  /** How many messages this sender has had blocked already this session. */
  priorBlocks: number;
}

export interface Decision {
  verdict: Verdict;
  /** In-character note shown privately to the sender for nudge/block. */
  reason?: string;
  /** Where the decision came from, for logging and the demo. Never the message text. */
  source: "instant" | "llm" | "held";
}

/** A runtime LLM backend. Only classify(); everything else lives in the moderator. */
export interface LlmProvider {
  readonly name: string;
  classify(text: string, context: ModerationContext): Promise<{ verdict: Verdict; reason?: string }>;
  /** Cheap liveness check so the room can show "Caretaker is resting". */
  healthy(): Promise<boolean>;
}
