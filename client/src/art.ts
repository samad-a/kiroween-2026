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
