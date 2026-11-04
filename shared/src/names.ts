export const NAME_MIN = 1;
export const NAME_MAX = 16;

// Letters (any script), digits, spaces, and a few safe punctuation marks.
const ALLOWED = /^[\p{L}\p{N} _'-]+$/u;

/**
 * Trim and collapse whitespace, then check length and characters.
 * Returns the cleaned name, or null if it isn't allowed.
 * Content moderation of names is the Caretaker's job (Phase 2).
 */
export function cleanName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.normalize("NFC").trim().replace(/\s+/g, " ");
  if (name.length < NAME_MIN || name.length > NAME_MAX) return null;
  return ALLOWED.test(name) ? name : null;
}

const ADJECTIVES = ["Misty", "Gloomy", "Wispy", "Sleepy", "Spooky", "Foggy", "Moony", "Dusky", "Hollow", "Velvet"];
const NOUNS = ["Wisp", "Boo", "Shade", "Lantern", "Moth", "Owl", "Candle", "Echo", "Bat", "Pumpkin"];

/** A friendly random name, always valid for cleanName. */
export function randomName(random: () => number = Math.random): string {
  const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length) % list.length]!;
  return `${pick(ADJECTIVES)} ${pick(NOUNS)}`;
}
