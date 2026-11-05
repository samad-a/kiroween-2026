import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { MODERATION_TIMEOUT_MS, type Verdict } from "@club-kiro/shared";
import type { LlmProvider, ModerationContext } from "../types.js";
import { parseVerdict } from "./bedrock.js";

const PROMPT = readFileSync(fileURLToPath(new URL("../prompt.md", import.meta.url)), "utf8");

interface ChatCompletion {
  choices?: Array<{ message?: { content?: string } }>;
}

/** Nebius Token Factory (OpenAI-compatible). The fallback provider. */
export class NebiusProvider implements LlmProvider {
  readonly name = "nebius";

  constructor(
    private readonly modelId: string,
    private readonly baseUrl: string,
    private readonly apiKey: string,
  ) {
    if (!apiKey) throw new Error("NEBIUS_API_KEY is not set");
    if (!baseUrl) throw new Error("NEBIUS_BASE_URL is not set");
    if (!modelId) throw new Error("CARETAKER_MODEL_ID is not set");
  }

  private async chat(userText: string, signal: AbortSignal): Promise<string> {
    const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.modelId,
        temperature: 0,
        max_tokens: 120,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: PROMPT },
          { role: "user", content: userText },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Nebius ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const body = (await res.json()) as ChatCompletion;
    return body.choices?.[0]?.message?.content ?? "";
  }

  async classify(text: string, context: ModerationContext): Promise<{ verdict: Verdict; reason?: string }> {
    const prompt = `Sender: ${context.senderName} (prior blocks this session: ${context.priorBlocks})\nMessage: ${text}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), MODERATION_TIMEOUT_MS);
    try {
      return parseVerdict(await this.chat(prompt, controller.signal));
    } finally {
      clearTimeout(timer);
    }
  }

  async healthy(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), MODERATION_TIMEOUT_MS);
      try {
        await this.chat("ping", controller.signal);
        return true;
      } finally {
        clearTimeout(timer);
      }
    } catch {
      return false;
    }
  }
}
