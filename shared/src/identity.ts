// Identity shared between client and server: a browser-kept guest id, and a short,
// human-typeable recovery code the server issues so a player can be restored elsewhere.
// Validation lives here (validate-at-the-edge), matching parseMove / cleanName.

/** Guest ids are UUIDs the browser keeps in localStorage. */
const GUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Returns the guest id unchanged if it is a well-formed UUID, else null. */
export function parseGuestId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const id = raw.trim().toLowerCase();
  return GUEST_ID.test(id) ? id : null;
}

// Recovery codes are two groups of four from an unambiguous alphabet (no 0/O/1/I),
// e.g. MANE-7823. Short enough to read aloud or type, long enough to not collide.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 symbols, no 0 O 1 I
const GROUP_LEN = 4;
const GROUPS = 2;
export const RECOVERY_CODE_LENGTH = GROUP_LEN * GROUPS; // without the dash

/** A new random recovery code like "MANE-7823". Injectable random for tests. */
export function generateRecoveryCode(random: () => number = Math.random): string {
  let out = "";
  for (let i = 0; i < GROUP_LEN * GROUPS; i++) {
    if (i > 0 && i % GROUP_LEN === 0) out += "-";
    out += ALPHABET[Math.floor(random() * ALPHABET.length) % ALPHABET.length];
  }
  return out;
}

/**
 * Normalise a user-typed code: upper-case, strip anything not in the alphabet
 * (dashes, spaces, the easily-confused 0/O/1/I are dropped or must be re-typed).
 * Returns the canonical code (no dash) if it has exactly the right length, else null.
 */
export function parseRecoveryCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw
    .toUpperCase()
    .split("")
    .filter((c) => ALPHABET.includes(c))
    .join("");
  return cleaned.length === RECOVERY_CODE_LENGTH ? cleaned : null;
}

/** Add the dash back for display: "MANE7823" -> "MANE-7823". */
export function formatRecoveryCode(code: string): string {
  const groups: string[] = [];
  for (let i = 0; i < code.length; i += GROUP_LEN) groups.push(code.slice(i, i + GROUP_LEN));
  return groups.join("-");
}
