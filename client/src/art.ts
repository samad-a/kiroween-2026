import { GHOST_COLOURS } from "@club-kiro/shared";
import { svgUrl } from "./svg";

// Characters live here; scenery, hats and decorations live in worldArt.ts.
export { svgUrl } from "./svg";
export * from "./worldArt";

// Facing right: a round head leaning forward and a tail that trails back-left.
// Scenes flip the sprite when the ghost moves left. Original design, not a mascot.
// The hem trails back into three wispy points, each longer than the one in front.
const GHOST_TAIL =
  "C34 59 32 64 29 67 " + // middle point
  "C28 63 25 59 21 60 C17 62 13 67 8 70 " + // back point, longest
  "C10 64 12 58 12 50 Z";
const GHOST_BODY =
  "M12 34 C12 16 24 6 36 6 C50 6 58 16 58 32 " +
  "C58 44 57 52 54 56 C52 59 48 61 44 63 " + // front point, shortest
  "C43 59 40 56 37 57 " +
  GHOST_TAIL;
/** The back of the body, drawn a shade darker for simple flat shading. */
const GHOST_SHADE = "M12 34 C12 16 24 6 36 6 C29 11 26 22 26 34 C26 46 30 54 37 57 " + GHOST_TAIL;

/** Head centre offset from the sprite centre (px, facing right), for placing hats. */
export const GHOST_HEAD_OFFSET_X = 4;

export function ghostSvg(colour: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="72" viewBox="0 0 64 72">
  <path d="${GHOST_BODY}" fill="${colour}"/>
  <path d="${GHOST_SHADE}" fill="#1d1533" opacity="0.12"/>
  <ellipse cx="42" cy="13" rx="6" ry="3" fill="#fff" opacity="0.55" transform="rotate(20 42 13)"/>
  <ellipse cx="37" cy="28" rx="3.4" ry="5" fill="#1d1533"/>
  <ellipse cx="49" cy="28" rx="3.4" ry="5" fill="#1d1533"/>
  <circle cx="38.2" cy="26" r="1.2" fill="#fff"/>
  <circle cx="50.2" cy="26" r="1.2" fill="#fff"/>
  <path d="M40 38 Q43.5 41 47 38" fill="none" stroke="#1d1533" stroke-width="2" stroke-linecap="round"/>
  <ellipse cx="32" cy="36" rx="3" ry="2" fill="#ff8fb1" opacity="0.55"/>
  <ellipse cx="54" cy="36" rx="2.2" ry="2" fill="#ff8fb1" opacity="0.55"/>
</svg>`;
}

/** The Caretaker: an old, kind ghost with spectacles and a lantern. */
export function caretakerSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="104" height="112" viewBox="0 0 104 112">
  <path d="M14 50 C14 22 30 8 48 8 C66 8 82 22 82 50 L82 92 C76 100 70 88 64 96 C58 104 54 90 48 98 C42 106 38 90 32 96 C26 102 20 90 14 94 Z" fill="#d6f5ea"/>
  <path d="M14 50 C14 22 30 8 48 8 C36 16 30 32 32 52 C33 70 34 84 32 96 C26 102 20 90 14 94 Z" fill="#1d1533" opacity="0.1"/>
  <ellipse cx="60" cy="18" rx="8" ry="3.5" fill="#fff" opacity="0.6" transform="rotate(25 60 18)"/>
  <path d="M80 58 Q92 62 92 72" fill="none" stroke="#c4f2e4" stroke-width="7" stroke-linecap="round"/>
  <rect x="91" y="68" width="2" height="8" fill="#2b2348"/>
  <circle cx="92" cy="86" r="14" fill="#ffd27a" opacity="0.18"/>
  <path d="M85 78 Q92 70 99 78 Z" fill="#2b2348"/>
  <rect x="85" y="78" width="14" height="17" rx="5" fill="#ffd98a"/>
  <rect x="85" y="78" width="5" height="17" rx="2.5" fill="#fff1c9"/>
  <circle cx="38" cy="44" r="8" fill="#ffffff" fill-opacity="0.35" stroke="#6b5534" stroke-width="2"/>
  <circle cx="58" cy="44" r="8" fill="#ffffff" fill-opacity="0.35" stroke="#6b5534" stroke-width="2"/>
  <line x1="46" y1="44" x2="50" y2="44" stroke="#6b5534" stroke-width="2"/>
  <path d="M34 45 Q38 41 42 45 M54 45 Q58 41 62 45" fill="none" stroke="#1d1533" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M30 34 Q37 30 43 33 M53 33 Q59 30 66 34" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
  <path d="M42 60 Q48 65 54 60" fill="none" stroke="#1d1533" stroke-width="2" stroke-linecap="round"/>
  <ellipse cx="29" cy="55" rx="4" ry="2.6" fill="#ff8fb1" opacity="0.45"/>
  <ellipse cx="67" cy="55" rx="4" ry="2.6" fill="#ff8fb1" opacity="0.45"/>
</svg>`;
}

export const ghostTextureKey = (colour: number): string => `ghost-${colour}`;

export const ghostTextures = GHOST_COLOURS.map((colour, i) => ({ key: ghostTextureKey(i), url: svgUrl(ghostSvg(colour)) }));
