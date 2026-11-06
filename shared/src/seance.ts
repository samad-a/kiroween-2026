// Séance: a Simon-style memory game at the candle circle in the Old Crypt.
// The server picks the rune sequence, checks each answer and pays the coins;
// the client only shows the runes and collects clicks.

export const SEANCE = { start: "seance:start", answer: "seance:answer", end: "seance:end" } as const;
export const SEANCE_EVENT = { show: "seance:show", result: "seance:result" } as const;

export const RUNES = ["moon", "star", "eye", "candle"] as const;
export type Rune = (typeof RUNES)[number];

/** Where the candle circle is drawn, and how close you must float to start. */
export const SEANCE_AREA = "crypt" as const;
export const SEANCE_SPOT = { x: 600, y: 560 } as const;
export const SEANCE_RANGE = 120;

/** A perfect séance ends here, so a round can't be farmed forever. */
export const SEANCE_MAX_ROUNDS = 12;
export const SEANCE_COINS_PER_ROUND = 2;

/** How long one rune stays lit while the sequence is shown; quicker as rounds go on. */
export const runeShowMs = (round: number): number => Math.max(300, 620 - round * 25);
/** Time allowed for showing plus answering a sequence of this length. */
export const seanceDeadlineMs = (length: number): number => length * (runeShowMs(length) + 200) + 5000 + length * 1200;

/** Server to client: memorise this sequence (rune indexes). */
export interface SeanceShow {
  round: number;
  sequence: number[];
}

export type SeanceEndReason = "wrong" | "timeout" | "complete" | "left";

/** Server to client: the séance is over. */
export interface SeanceResult {
  roundsCleared: number;
  coins: number;
  balance: number;
  reason: SeanceEndReason;
}

/** The sequence with one more random rune on the end. */
export function extendSequence(sequence: readonly number[], random: () => number = Math.random): number[] {
  return [...sequence, Math.min(RUNES.length - 1, Math.floor(random() * RUNES.length))];
}

export function sequenceMatches(sequence: readonly number[], answer: readonly number[]): boolean {
  return sequence.length === answer.length && sequence.every((rune, i) => rune === answer[i]);
}

/** Rounds fully cleared, and the coins they earn. */
export function seanceReward(roundsCleared: number): number {
  return Math.max(0, Math.min(roundsCleared, SEANCE_MAX_ROUNDS)) * SEANCE_COINS_PER_ROUND;
}

/** A list of rune indexes, no longer than the longest séance, or null if malformed. */
export function parseSeanceAnswer(payload: unknown): number[] | null {
  if (typeof payload !== "object" || payload === null) return null;
  const { answer } = payload as Record<string, unknown>;
  if (!Array.isArray(answer) || answer.length > SEANCE_MAX_ROUNDS) return null;
  if (!answer.every((r) => Number.isInteger(r) && r >= 0 && r < RUNES.length)) return null;
  return answer as number[];
}
