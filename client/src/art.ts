import { GHOST_COLOURS, OBSTACLES, PLAZA_HEIGHT, PLAZA_WIDTH } from "@club-kiro/shared";

/**
 * Encode an SVG string as a base64 data URL. Phaser's loader decodes data URLs
 * with atob, so percent-encoding does not work here.
 */
export function svgUrl(svg: string): string {
  const bytes = new TextEncoder().encode(svg);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}

/** Original round ghost with a wavy hem. Drawn by hand, not a mascot. */
export function ghostSvg(colour: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="72" viewBox="0 0 64 72">
  <defs><radialGradient id="g" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="${colour}"/></radialGradient></defs>
  <path d="M8 34 C8 14 20 4 32 4 C44 4 56 14 56 34 L56 62 C52 68 48 60 44 66 C40 70 36 60 32 66 C28 70 24 60 20 66 C16 70 12 60 8 64 Z"
        fill="url(#g)" stroke="#2a1f45" stroke-width="2.5"/>
  <ellipse cx="24" cy="30" rx="4" ry="6" fill="#2a1f45"/>
  <ellipse cx="40" cy="30" rx="4" ry="6" fill="#2a1f45"/>
  <ellipse cx="32" cy="44" rx="5" ry="3.5" fill="#2a1f45" opacity="0.7"/>
  <circle cx="18" cy="40" r="3" fill="#ff9ab8" opacity="0.6"/>
  <circle cx="46" cy="40" r="3" fill="#ff9ab8" opacity="0.6"/>
</svg>`;
}

export const ghostTextureKey = (colour: number): string => `ghost-${colour}`;

export const ghostTextures = GHOST_COLOURS.map((colour, i) => ({ key: ghostTextureKey(i), url: svgUrl(ghostSvg(colour)) }));

const [fountain, tower] = OBSTACLES as [(typeof OBSTACLES)[number], (typeof OBSTACLES)[number]];

/** Lantern positions, also used by the scene for flickering glows. */
export const LANTERNS = [
  { x: 120, y: 200 },
  { x: 420, y: 160 },
  { x: 780, y: 160 },
  { x: 160, y: 560 },
  { x: 1060, y: 560 },
];

function lantern(x: number, y: number): string {
  return `<g transform="translate(${x} ${y})">
    <rect x="-3" y="0" width="6" height="90" fill="#2a1f45"/>
    <rect x="-12" y="-26" width="24" height="28" rx="4" fill="#ffcf7a" stroke="#2a1f45" stroke-width="3"/>
    <path d="M-14 -26 L0 -38 L14 -26 Z" fill="#2a1f45"/>
  </g>`;
}

/** The haunted plaza background, with props placed on the obstacle rects. */
export function plazaSvg(): string {
  const f = fountain;
  const t = tower;
  const fx = f.x + f.width / 2;
  const fy = f.y + f.height / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PLAZA_WIDTH}" height="${PLAZA_HEIGHT}" viewBox="0 0 ${PLAZA_WIDTH} ${PLAZA_HEIGHT}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#140c2c"/><stop offset="1" stop-color="#2d1b4e"/></linearGradient>
    <radialGradient id="moon" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff8dc"/><stop offset="0.7" stop-color="#f5e6a8"/><stop offset="1" stop-color="#f5e6a8" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#sky)"/>
  <circle cx="160" cy="80" r="56" fill="url(#moon)"/>
  <!-- distant rooftops -->
  <path d="M0 140 L60 100 L120 140 L180 90 L250 140 L330 110 L400 140 L470 95 L540 140 L620 105 L700 140 L760 100 L840 140 L900 140 L1200 140 L1200 170 L0 170 Z" fill="#1c1236"/>
  <!-- cobbled square -->
  <rect x="0" y="160" width="${PLAZA_WIDTH}" height="${PLAZA_HEIGHT - 160}" fill="#3b2a5c"/>
  <g fill="#46336b" opacity="0.8">
    ${Array.from({ length: 60 }, (_, i) => {
      const x = (i * 197) % PLAZA_WIDTH;
      const y = 180 + ((i * 131) % (PLAZA_HEIGHT - 200));
      return `<ellipse cx="${x}" cy="${y}" rx="26" ry="10"/>`;
    }).join("")}
  </g>
  <!-- crooked clock tower -->
  <g transform="rotate(-4 ${t.x + t.width / 2} ${t.y + t.height})">
    <rect x="${t.x}" y="${t.y}" width="${t.width}" height="${t.height}" fill="#24183f" stroke="#120b24" stroke-width="4"/>
    <path d="M${t.x - 10} ${t.y} L${t.x + t.width / 2} ${t.y - 60} L${t.x + t.width + 10} ${t.y} Z" fill="#120b24"/>
    <circle cx="${t.x + t.width / 2}" cy="${t.y + 50}" r="30" fill="#f5e6a8" stroke="#120b24" stroke-width="4"/>
    <path d="M${t.x + t.width / 2} ${t.y + 50} L${t.x + t.width / 2} ${t.y + 30} M${t.x + t.width / 2} ${t.y + 50} L${t.x + t.width / 2 + 14} ${t.y + 56}" stroke="#120b24" stroke-width="4" stroke-linecap="round"/>
    <rect x="${t.x + 35}" y="${t.y + 130}" width="30" height="70" rx="14" fill="#120b24"/>
  </g>
  <!-- fountain -->
  <ellipse cx="${fx}" cy="${fy + 25}" rx="${f.width / 2}" ry="${f.height / 3}" fill="#5a4a7a" stroke="#241840" stroke-width="5"/>
  <ellipse cx="${fx}" cy="${fy + 20}" rx="${f.width / 2 - 14}" ry="${f.height / 3 - 10}" fill="#4fb3a5" opacity="0.85"/>
  <rect x="${fx - 10}" y="${fy - 40}" width="20" height="60" fill="#5a4a7a" stroke="#241840" stroke-width="4"/>
  <ellipse cx="${fx}" cy="${fy - 40}" rx="30" ry="10" fill="#5a4a7a" stroke="#241840" stroke-width="4"/>
  ${LANTERNS.map((l) => lantern(l.x, l.y)).join("")}
</svg>`;
}

// --- Hats (worn above a ghost) and decorations (placed in a room) ---

/** Hand-drawn hat SVGs keyed by shop item id. ~40x30, anchored to sit on the head. */
const HAT_SVGS: Record<string, string> = {
  "hat-witch": `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="44" viewBox="0 0 48 44"><path d="M24 2 L34 34 L14 34 Z" fill="#4a2f70" stroke="#201038" stroke-width="2"/><ellipse cx="24" cy="36" rx="20" ry="5" fill="#2a1a48" stroke="#201038" stroke-width="2"/><rect x="19" y="26" width="10" height="5" fill="#ffcf7a"/></svg>`,
  "hat-top": `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="40" viewBox="0 0 44 40"><rect x="14" y="4" width="16" height="26" rx="2" fill="#1c1430" stroke="#000" stroke-width="2" transform="rotate(-6 22 17)"/><ellipse cx="22" cy="32" rx="18" ry="5" fill="#1c1430" stroke="#000" stroke-width="2"/><rect x="13" y="22" width="18" height="5" fill="#6b3fa0" transform="rotate(-6 22 24)"/></svg>`,
  "hat-flower": `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="26" viewBox="0 0 48 26"><path d="M6 20 Q24 6 42 20" fill="none" stroke="#5a7a4a" stroke-width="4"/><circle cx="12" cy="16" r="5" fill="#c98fb1"/><circle cx="24" cy="10" r="5" fill="#e6b8a8"/><circle cx="36" cy="16" r="5" fill="#b9a7ff"/></svg>`,
  "hat-crown": `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="28" viewBox="0 0 48 28"><path d="M8 24 L8 10 L16 18 L24 6 L32 18 L40 10 L40 24 Z" fill="#e8e0d0" stroke="#8c7a55" stroke-width="2"/></svg>`,
  "hat-halo": `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="24" viewBox="0 0 48 24"><ellipse cx="24" cy="12" rx="18" ry="6" fill="none" stroke="#ffcf7a" stroke-width="4" opacity="0.9"/></svg>`,
  "hat-jack": `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="38" viewBox="0 0 40 38"><ellipse cx="20" cy="22" rx="18" ry="15" fill="#ffb86b" stroke="#a85a1a" stroke-width="2"/><rect x="18" y="4" width="4" height="7" fill="#5a7a4a"/><path d="M12 20 l5 -5 l5 5 Z M22 20 l5 -5 l5 5 Z" fill="#3a2410"/><path d="M11 30 q9 6 18 0" fill="none" stroke="#3a2410" stroke-width="2"/></svg>`,
};

export const hatTextureKey = (hatId: string): string => `hat-tex-${hatId}`;

export const hatTextures = Object.entries(HAT_SVGS).map(([id, svg]) => ({
  id,
  key: hatTextureKey(id),
  url: svgUrl(svg),
}));

/** Decoration SVGs keyed by shop item id, for placing in a room. */
const DECOR_SVGS: Record<string, string> = {
  "dec-lantern": `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="72" viewBox="0 0 48 72"><rect x="21" y="0" width="6" height="40" fill="#2a1f45"/><rect x="8" y="30" width="32" height="38" rx="6" fill="#ffcf7a" stroke="#2a1f45" stroke-width="3"/><path d="M6 30 L24 14 L42 30 Z" fill="#2a1f45"/></svg>`,
  "dec-rug": `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="72" viewBox="0 0 120 72"><ellipse cx="60" cy="36" rx="56" ry="30" fill="#5a3f70" stroke="#2a1a48" stroke-width="3"/><ellipse cx="60" cy="36" rx="40" ry="18" fill="none" stroke="#b9a7ff" stroke-width="2" opacity="0.6"/></svg>`,
  "dec-candle": `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="72" viewBox="0 0 40 72"><rect x="14" y="24" width="12" height="40" rx="2" fill="#efe6d0" stroke="#8c7a55" stroke-width="2"/><ellipse cx="20" cy="64" rx="14" ry="5" fill="#5a4a2a"/><path d="M20 24 q6 -10 0 -18 q-6 8 0 18Z" fill="#ffcf7a"/></svg>`,
  "dec-cauldron": `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="64" viewBox="0 0 72 64"><ellipse cx="36" cy="40" rx="30" ry="22" fill="#1c1430" stroke="#000" stroke-width="3"/><ellipse cx="36" cy="24" rx="30" ry="9" fill="#2a1a48" stroke="#000" stroke-width="3"/><ellipse cx="36" cy="24" rx="22" ry="6" fill="#7fd6c2" opacity="0.8"/></svg>`,
  "dec-portrait": `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="72" viewBox="0 0 56 72"><rect x="4" y="4" width="48" height="64" rx="3" fill="#2a1a48" stroke="#8c7a55" stroke-width="4"/><circle cx="28" cy="30" r="12" fill="#b9a7ff" opacity="0.8"/><path d="M12 60 q16 -18 32 0Z" fill="#b9a7ff" opacity="0.8"/></svg>`,
  "dec-tree": `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="96" viewBox="0 0 72 96"><path d="M36 96 L36 40" stroke="#3a2a1a" stroke-width="8"/><path d="M36 60 q-18 -6 -26 -22 M36 48 q16 -8 24 -26 M36 40 q-14 -10 -18 -30" fill="none" stroke="#3a2a1a" stroke-width="5"/></svg>`,
};

export const decorTextureKey = (decorId: string): string => `decor-tex-${decorId}`;

export const decorTextures = Object.entries(DECOR_SVGS).map(([id, svg]) => ({
  id,
  key: decorTextureKey(id),
  url: svgUrl(svg),
}));

/** A cosy haunted-room interior: wooden floor, striped wall, a small window. */
export function roomSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PLAZA_WIDTH}" height="${PLAZA_HEIGHT}" viewBox="0 0 ${PLAZA_WIDTH} ${PLAZA_HEIGHT}">
  <defs><linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1a48"/><stop offset="1" stop-color="#3a2560"/></linearGradient></defs>
  <rect width="100%" height="100%" fill="url(#wall)"/>
  <!-- wall panelling -->
  <g stroke="#241840" stroke-width="2" opacity="0.5">
    ${Array.from({ length: 12 }, (_, i) => `<line x1="${i * 110}" y1="0" x2="${i * 110}" y2="300"/>`).join("")}
  </g>
  <!-- round window with the moon -->
  <circle cx="900" cy="140" r="70" fill="#140c2c" stroke="#5a4a7a" stroke-width="8"/>
  <circle cx="880" cy="120" r="34" fill="#f5e6a8" opacity="0.9"/>
  <!-- wooden floor -->
  <rect x="0" y="300" width="${PLAZA_WIDTH}" height="${PLAZA_HEIGHT - 300}" fill="#4a3426"/>
  <g stroke="#3a281c" stroke-width="3" opacity="0.7">
    ${Array.from({ length: 8 }, (_, i) => `<line x1="0" y1="${300 + i * 50}" x2="${PLAZA_WIDTH}" y2="${300 + i * 50}"/>`).join("")}
  </g>
</svg>`;
}
