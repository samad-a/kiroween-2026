// Server-side catch roll. Authoritative: the client sends an accuracy, the server
// decides the catch. Randomness is injectable so tests are deterministic.
import { CATCHES, type CatchKind } from "@club-kiro/shared";

/**
 * Roll a catch. Accuracy (0..1) tilts the odds toward rarer, higher-value catches
 * by raising their effective weight, but never guarantees the rarest.
 *
 * Each catch's effective weight is scaled by (1 + accuracy * k) raised to its
 * "rarity rank": common catches are barely affected, rare ones benefit most.
 */
export function rollCatch(accuracy: number, random: () => number = Math.random): CatchKind {
  const a = Math.min(1, Math.max(0, accuracy));
  // Rank by rarity: lowest weight = rarest = highest rank.
  const ranked = [...CATCHES].sort((x, y) => y.weight - x.weight); // common -> rare
  const weights = ranked.map((c, rank) => c.weight * Math.pow(1 + a * 1.5, rank));
  const total = weights.reduce((sum, w) => sum + w, 0);

  let roll = random() * total;
  for (let i = 0; i < ranked.length; i++) {
    roll -= weights[i]!;
    if (roll < 0) return ranked[i]!;
  }
  return ranked[ranked.length - 1]!;
}
