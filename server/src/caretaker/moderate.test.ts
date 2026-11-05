import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { MAX_MESSAGE_LENGTH, MESSAGE_COOLDOWN_MS } from "@club-kiro/shared";
import { createModerator } from "./moderate.js";
import { StubProvider } from "./providers/stub.js";
import { parseVerdict } from "./providers/bedrock.js";
import type { LlmProvider } from "./types.js";

const ctx = { senderName: "Tester", priorBlocks: 0 };
const fresh = Number.MAX_SAFE_INTEGER; // far past any cooldown

describe("instant checks (before any LLM call)", () => {
  it("blocks obvious slurs without calling the provider", async () => {
    let called = false;
    const spy: LlmProvider = {
      name: "spy",
      classify: async () => {
        called = true;
        return { verdict: "allow" as const };
      },
      healthy: async () => true,
    };
    const mod = createModerator(spy);
    const d = await mod.decide("you are a retard", 0, fresh, ctx);
    expect(d.verdict).toBe("block");
    expect(d.source).toBe("instant");
    expect(called).toBe(false);
  });

  it("rate limits a second message inside the cooldown", async () => {
    const mod = createModerator(new StubProvider());
    const d = await mod.decide("hello again", 1000, 1000 + MESSAGE_COOLDOWN_MS - 1, ctx);
    expect(d.verdict).toBe("block");
    expect(d.source).toBe("instant");
  });

  it("rejects an over-long message", async () => {
    const mod = createModerator(new StubProvider());
    const d = await mod.decide("x".repeat(MAX_MESSAGE_LENGTH + 1), 0, fresh, ctx);
    expect(d.verdict).toBe("block");
  });
});

describe("fail-closed behaviour", () => {
  it("holds the message and goes resting when the provider throws", async () => {
    const broken: LlmProvider = {
      name: "broken",
      classify: async () => {
        throw new Error("model down");
      },
      healthy: async () => false,
    };
    const mod = createModerator(broken);
    const d = await mod.decide("a normal friendly message", 0, fresh, ctx);
    expect(d.verdict).toBe("block");
    expect(d.source).toBe("held");
    expect(mod.resting).toBe(true);
  });

  it("while resting, passes clean messages on instant checks only", async () => {
    const broken: LlmProvider = {
      name: "broken",
      classify: async () => {
        throw new Error("still down");
      },
      healthy: async () => false,
    };
    const mod = createModerator(broken);
    mod.resting = true;
    const d = await mod.decide("hello friends", 0, fresh, ctx);
    expect(d.verdict).toBe("allow");
    expect(d.source).toBe("instant");
  });

  it("no message ever passes without a verdict (property)", async () => {
    const mod = createModerator(new StubProvider());
    await fc.assert(
      fc.asyncProperty(fc.string({ maxLength: 200 }), async (text) => {
        const d = await mod.decide(text, 0, fresh, ctx);
        return d.verdict === "allow" || d.verdict === "nudge" || d.verdict === "block";
      }),
      { numRuns: 40 },
    );
  });
});

describe("parseVerdict", () => {
  it("extracts a verdict even with surrounding text", () => {
    expect(parseVerdict('Here you go: {"verdict":"nudge","reason":"be kind"}')).toEqual({ verdict: "nudge", reason: "be kind" });
  });
  it("treats an empty reason as undefined", () => {
    expect(parseVerdict('{"verdict":"allow","reason":""}')).toEqual({ verdict: "allow", reason: undefined });
  });
  it("throws on a missing or bad verdict", () => {
    expect(() => parseVerdict("no json here")).toThrow();
    expect(() => parseVerdict('{"verdict":"maybe"}')).toThrow();
  });
});
