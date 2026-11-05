import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { MODERATION_TIMEOUT_MS, type Verdict } from "@club-kiro/shared";
import type { LlmProvider, ModerationContext } from "../types.js";

const PROMPT = readFileSync(fileURLToPath(new URL("../prompt.md", import.meta.url)), "utf8");

interface NovaResponse {
  output?: { message?: { content?: Array<{ text?: string }> } };
}

/**
 * Amazon Bedrock via the Nova Converse API, authenticated with a bearer token
 * (AWS_BEARER_TOKEN_BEDROCK). Nova's request shape differs from Anthropic's:
 * a `system` array, `messages` with typed content, and `inferenceConfig`.
 */
export class BedrockProvider implements LlmProvider {
  readonly name = "bedrock";
  private readonly endpoint: string;

  constructor(
    private readonly modelId: string,
    private readonly region: string,
    private readonly token: string,
  ) {
    if (!token) throw new Error("AWS_BEARER_TOKEN_BEDROCK is not set");
    if (!modelId) throw new Error("CARETAKER_MODEL_ID is not set");
    this.endpoint = `https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(modelId)}/converse`;
  }

  private async converse(userText: string, signal: AbortSignal): Promise<string> {
    const res = await fetch(this.endpoint, {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({
        system: [{ text: PROMPT }],
        messages: [{ role: "user", content: [{ text: userText }] }],
        inferenceConfig: { maxTokens: 120, temperature: 0 },
      }),
    });
    if (!res.ok) {
      throw new Error(`Bedrock ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const body = (await res.json()) as NovaResponse;
    return body.output?.message?.content?.[0]?.text ?? "";
  }

  async classify(text: string, context: ModerationContext): Promise<{ verdict: Verdict; reason?: string }> {
    const prompt = `Sender: ${context.senderName} (prior blocks this session: ${context.priorBlocks})\nMessage: ${text}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), MODERATION_TIMEOUT_MS);
    try {
      return parseVerdict(await this.converse(prompt, controller.signal));
    } finally {
      clearTimeout(timer);
    }
  }

  async healthy(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), MODERATION_TIMEOUT_MS);
      try {
        await this.converse("ping", controller.signal);
        return true;
      } finally {
        clearTimeout(timer);
      }
    } catch {
      return false;
    }
  }
}

/** Pull the JSON verdict out of the model's reply, tolerating stray text. */
export function parseVerdict(raw: string): { verdict: Verdict; reason?: string } {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`No JSON in model reply: ${raw.slice(0, 120)}`);
  const parsed = JSON.parse(match[0]) as { verdict?: unknown; reason?: unknown };
  const verdict = parsed.verdict;
  if (verdict !== "allow" && verdict !== "nudge" && verdict !== "block") {
    throw new Error(`Unexpected verdict: ${String(verdict)}`);
  }
  const reason = typeof parsed.reason === "string" && parsed.reason.trim() ? parsed.reason.trim() : undefined;
  return { verdict, reason };
}
