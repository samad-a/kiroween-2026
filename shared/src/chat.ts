export const CHAT_ROOM_MESSAGE = { chat: "chat", caretaker: "caretaker" } as const;

/** How long a chat bubble stays over a ghost, in ms. */
export const BUBBLE_TTL_MS = 6000;
/** Max time the server waits for the LLM before holding the message. */
export const MODERATION_TIMEOUT_MS = 1000;

export type Verdict = "allow" | "nudge" | "block";

/** Client to server: "say this". */
export interface ChatMessage {
  text: string;
}

/** Server to everyone: a message that was allowed. */
export interface ChatBroadcast {
  sessionId: string;
  name: string;
  text: string;
}

/** Server to one sender: a private, in-character note from the Caretaker. */
export interface CaretakerNote {
  kind: "nudge" | "block" | "holding";
  text: string;
}

/** Trim, and reject empty or over-long messages. Returns the cleaned text or null. */
export function cleanMessage(raw: unknown, maxLength: number): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.replace(/\s+/g, " ").trim();
  if (text.length === 0 || text.length > maxLength) return null;
  return text;
}
