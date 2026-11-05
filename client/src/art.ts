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

const GHOST_BODY =
  "M8 34 C8 14 20 4 32 4 C44 4 56 14 56 34 L56 62 C52 68 48 60 44 66 C40 70 36 60 32 66 C28 70 24 60 20 66 C16 70 12 60 8 64 Z";

/** Original round ghost with a wavy hem. Drawn by hand, not a mascot. */
export function ghostSvg(colour: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="72" viewBox="0 0 64 72">
  <defs>
    <radialGradient id="g" cx="38%" cy="26%" r="82%"><stop offset="0" stop-color="#ffffff"/><stop offset="0.5" stop-color="${colour}"/><stop offset="1" stop-color="${colour}" stop-opacity="0.8"/></radialGradient>
    <linearGradient id="hem" x1="0" y1="0" x2="0" y2="1"><stop offset="0.6" stop-color="#1d1533" stop-opacity="0"/><stop offset="1" stop-color="#1d1533" stop-opacity="0.18"/></linearGradient>
  </defs>
  <path d="${GHOST_BODY}" fill="url(#g)" stroke="#2a1f45" stroke-opacity="0.45" stroke-width="1.5"/>
  <path d="${GHOST_BODY}" fill="url(#hem)"/>
  <ellipse cx="21" cy="15" rx="7" ry="3.5" fill="#fff" opacity="0.6" transform="rotate(-28 21 15)"/>
  <ellipse cx="24" cy="31" rx="3.8" ry="5.2" fill="#1d1533"/>
  <ellipse cx="40" cy="31" rx="3.8" ry="5.2" fill="#1d1533"/>
  <circle cx="25.4" cy="28.6" r="1.4" fill="#fff"/>
  <circle cx="41.4" cy="28.6" r="1.4" fill="#fff"/>
  <path d="M28 41 Q32 45 36 41" fill="none" stroke="#1d1533" stroke-width="2" stroke-linecap="round"/>
  <ellipse cx="17" cy="39" rx="3.6" ry="2.4" fill="#ff8fb1" opacity="0.5"/>
  <ellipse cx="47" cy="39" rx="3.6" ry="2.4" fill="#ff8fb1" opacity="0.5"/>
</svg>`;
}

/** The Caretaker: an old, kind ghost with spectacles and a lantern. */
export function caretakerSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="104" height="112" viewBox="0 0 104 112">
  <defs><radialGradient id="c" cx="40%" cy="25%" r="85%"><stop offset="0" stop-color="#ffffff"/><stop offset="0.55" stop-color="#d9fbef"/><stop offset="1" stop-color="#9fe3d0" stop-opacity="0.75"/></radialGradient></defs>
  <path d="M14 50 C14 22 30 8 48 8 C66 8 82 22 82 50 L82 92 C76 100 70 88 64 96 C58 104 54 90 48 98 C42 106 38 90 32 96 C26 102 20 90 14 94 Z"
        fill="url(#c)" stroke="#2a1f45" stroke-opacity="0.4" stroke-width="1.5"/>
  <ellipse cx="34" cy="18" rx="9" ry="4" fill="#fff" opacity="0.6" transform="rotate(-25 34 18)"/>
  <path d="M80 58 Q92 62 92 72" fill="none" stroke="#c4f2e4" stroke-width="7" stroke-linecap="round"/>
  <line x1="92" y1="70" x2="92" y2="76" stroke="#2a1f45" stroke-width="1.5"/>
  <path d="M85 77 L92 72 L99 77 Z" fill="#2a1f45"/>
  <rect x="85" y="77" width="14" height="17" rx="3" fill="#ffcf7a" stroke="#2a1f45" stroke-width="1.5"/>
  <circle cx="38" cy="44" r="8" fill="#ffffff" fill-opacity="0.3" stroke="#6b5534" stroke-width="2"/>
  <circle cx="58" cy="44" r="8" fill="#ffffff" fill-opacity="0.3" stroke="#6b5534" stroke-width="2"/>
  <line x1="46" y1="44" x2="50" y2="44" stroke="#6b5534" stroke-width="2"/>
  <path d="M34 45 Q38 41 42 45 M54 45 Q58 41 62 45" fill="none" stroke="#1d1533" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M30 34 Q37 30 43 33 M53 33 Q59 30 66 34" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
  <path d="M42 60 Q48 65 54 60" fill="none" stroke="#1d1533" stroke-width="2" stroke-linecap="round"/>
  <ellipse cx="29" cy="55" rx="4" ry="2.6" fill="#ff8fb1" opacity="0.45"/>
  <ellipse cx="67" cy="55" rx="4" ry="2.6" fill="#ff8fb1" opacity="0.45"/>
</svg>`;
}

/** A soft dark frame around the edges of the screen, drawn above the world. */
export function vignetteSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PLAZA_WIDTH}" height="${PLAZA_HEIGHT}" viewBox="0 0 ${PLAZA_WIDTH} ${PLAZA_HEIGHT}">
  <defs><radialGradient id="v" cx="50%" cy="50%" r="75%"><stop offset="0.55" stop-color="#05020f" stop-opacity="0"/><stop offset="1" stop-color="#05020f" stop-opacity="0.7"/></radialGradient></defs>
  <rect width="100%" height="100%" fill="url(#v)"/>
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
    <ellipse cx="0" cy="92" rx="16" ry="5" fill="#000" opacity="0.3"/>
    <rect x="-7" y="80" width="14" height="12" rx="2" fill="#1d1433"/>
    <rect x="-2.5" y="0" width="5" height="84" fill="#1d1433"/>
    <rect x="-10" y="4" width="20" height="3" rx="1.5" fill="#1d1433"/>
    <rect x="-11" y="-24" width="22" height="26" rx="3" fill="url(#lamp)" stroke="#1d1433" stroke-width="2.5"/>
    <line x1="0" y1="-24" x2="0" y2="2" stroke="#1d1433" stroke-width="1.5" opacity="0.6"/>
    <path d="M-15 -24 L0 -36 L15 -24 Z" fill="#1d1433"/>
    <circle cx="0" cy="-38" r="2.5" fill="#1d1433"/>
  </g>`;
}

/** A row of crooked houses on the skyline, a few windows lit. Deterministic. */
function skyline(baseY: number, colour: string, seed: number, lit: number): string {
  let out = "";
  for (let i = 0; i < 14; i++) {
    const w = 60 + ((i * 37 + seed) % 40);
    const h = 30 + ((i * 53 + seed) % 46);
    const x = i * 92 - 30 + ((i * seed) % 20);
    const tilt = ((i * 7 + seed) % 7) - 3;
    out += `<g transform="rotate(${tilt} ${x + w / 2} ${baseY})"><rect x="${x}" y="${baseY - h}" width="${w}" height="${h + 20}" fill="${colour}"/>
      <path d="M${x - 6} ${baseY - h} L${x + w / 2} ${baseY - h - 26} L${x + w + 6} ${baseY - h} Z" fill="${colour}"/>`;
    if ((i + seed) % 3 !== 0) {
      out += `<rect x="${x + w / 2 - 6}" y="${baseY - h + 10}" width="10" height="12" rx="2" fill="#ffcf7a" opacity="${lit}"/>`;
    }
    out += `</g>`;
  }
  return out;
}

function tombstone(x: number, y: number, s = 1): string {
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <ellipse cx="0" cy="2" rx="20" ry="5" fill="#000" opacity="0.3"/>
    <path d="M-14 0 L-14 -26 Q-14 -40 0 -40 Q14 -40 14 -26 L14 0 Z" fill="#5d5080" stroke="#2a1f45" stroke-width="2"/>
    <path d="M0 -32 L0 -14 M-6 -26 L6 -26" stroke="#3a2f5a" stroke-width="3" stroke-linecap="round"/>
  </g>`;
}

function pumpkin(x: number, y: number): string {
  return `<g transform="translate(${x} ${y})">
    <ellipse cx="0" cy="12" rx="18" ry="4" fill="#000" opacity="0.3"/>
    <ellipse cx="0" cy="0" rx="17" ry="13" fill="#f08a2c" stroke="#9a4a10" stroke-width="2"/>
    <path d="M-6 -12 Q0 -2 -6 12 M6 -12 Q0 -2 6 12" fill="none" stroke="#c76518" stroke-width="1.5"/>
    <rect x="-2" y="-18" width="4" height="7" rx="1" fill="#4f6b3a"/>
    <path d="M-9 -3 l4 -4 l4 4 Z M1 -3 l4 -4 l4 4 Z M-8 4 Q0 10 8 4 Z" fill="#ffe08a"/>
  </g>`;
}

/** The haunted plaza background, with props placed on the obstacle rects. */
export function plazaSvg(): string {
  const f = fountain;
  const t = tower;
  const fx = f.x + f.width / 2;
  const fy = f.y + f.height / 2;
  const tc = t.x + t.width / 2;
  const stars = Array.from({ length: 46 }, (_, i) => {
    const x = (i * 263 + 40) % PLAZA_WIDTH;
    const y = 8 + ((i * 97) % 110);
    const r = i % 5 === 0 ? 1.6 : 0.9;
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${0.35 + (i % 4) * 0.15}"/>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PLAZA_WIDTH}" height="${PLAZA_HEIGHT}" viewBox="0 0 ${PLAZA_WIDTH} ${PLAZA_HEIGHT}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c0720"/><stop offset="1" stop-color="#2f1c58"/></linearGradient>
    <radialGradient id="halo" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff3c4" stop-opacity="0.45"/><stop offset="1" stop-color="#fff3c4" stop-opacity="0"/></radialGradient>
    <radialGradient id="moon" cx="40%" cy="40%" r="60%"><stop offset="0" stop-color="#fffbe8"/><stop offset="1" stop-color="#f0dc9a"/></radialGradient>
    <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1c4c"/><stop offset="1" stop-color="#3e2b68"/></linearGradient>
    <radialGradient id="pool" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffcf7a" stop-opacity="0.16"/><stop offset="1" stop-color="#ffcf7a" stop-opacity="0"/></radialGradient>
    <radialGradient id="water" cx="45%" cy="40%" r="70%"><stop offset="0" stop-color="#9ff3e4"/><stop offset="0.5" stop-color="#4fc2b0"/><stop offset="1" stop-color="#257a78"/></radialGradient>
    <linearGradient id="stone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a6aa6"/><stop offset="1" stop-color="#4a3c72"/></linearGradient>
    <linearGradient id="towerG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2c1f4e"/><stop offset="1" stop-color="#1a1032"/></linearGradient>
    <radialGradient id="clock" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff6d0"/><stop offset="1" stop-color="#f0d68a"/></radialGradient>
    <linearGradient id="lamp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1c2"/><stop offset="1" stop-color="#ffc35c"/></linearGradient>
    <pattern id="cobble" width="56" height="30" patternUnits="userSpaceOnUse">
      <rect x="2" y="2" width="24" height="11" rx="5" fill="#ffffff" opacity="0.05"/>
      <rect x="30" y="2" width="24" height="11" rx="5" fill="#ffffff" opacity="0.035"/>
      <rect x="-12" y="17" width="24" height="11" rx="5" fill="#ffffff" opacity="0.04"/>
      <rect x="16" y="17" width="24" height="11" rx="5" fill="#ffffff" opacity="0.05"/>
      <rect x="44" y="17" width="24" height="11" rx="5" fill="#ffffff" opacity="0.035"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#sky)"/>
  ${stars}
  <circle cx="160" cy="80" r="130" fill="url(#halo)"/>
  <circle cx="160" cy="80" r="44" fill="url(#moon)"/>
  <circle cx="146" cy="70" r="7" fill="#e6cf8a" opacity="0.5"/>
  <circle cx="174" cy="94" r="5" fill="#e6cf8a" opacity="0.45"/>
  <!-- two layers of crooked rooftops -->
  <g>${skyline(150, "#1d1240", 11, 0.55)}</g>
  <g>${skyline(168, "#160d32", 5, 0.85)}</g>
  <!-- the square -->
  <rect x="0" y="158" width="${PLAZA_WIDTH}" height="${PLAZA_HEIGHT - 158}" fill="url(#ground)"/>
  <rect x="0" y="158" width="${PLAZA_WIDTH}" height="${PLAZA_HEIGHT - 158}" fill="url(#cobble)"/>
  <rect x="0" y="158" width="${PLAZA_WIDTH}" height="10" fill="#120a28" opacity="0.6"/>
  <!-- worn paths leading to the fountain -->
  <g fill="none" stroke="#5a4688" stroke-linecap="round" opacity="0.35">
    <path d="M${fx} 460 L${fx} 800" stroke-width="130"/>
    <path d="M360 380 Q180 430 -40 560" stroke-width="90"/>
    <path d="M840 380 Q1000 440 1240 470" stroke-width="90"/>
  </g>
  <ellipse cx="${fx}" cy="${fy + 30}" rx="270" ry="130" fill="#5a4688" opacity="0.32"/>
  <ellipse cx="${fx}" cy="${fy + 30}" rx="270" ry="130" fill="none" stroke="#7a66aa" stroke-width="3" opacity="0.35"/>
  <ellipse cx="${fx}" cy="${fy + 30}" rx="230" ry="108" fill="none" stroke="#7a66aa" stroke-width="1.5" opacity="0.25" stroke-dasharray="14 10"/>
  <ellipse cx="${fx}" cy="${fy + 30}" rx="320" ry="170" fill="url(#pool)"/>
  <!-- crooked clock tower -->
  <ellipse cx="${tc}" cy="${t.y + t.height + 4}" rx="70" ry="12" fill="#000" opacity="0.35"/>
  <g transform="rotate(-4 ${tc} ${t.y + t.height})">
    <rect x="${t.x}" y="${t.y}" width="${t.width}" height="${t.height}" fill="url(#towerG)" stroke="#0e0820" stroke-width="3"/>
    ${[40, 90, 140].map((dy) => `<line x1="${t.x}" y1="${t.y + dy}" x2="${t.x + t.width}" y2="${t.y + dy}" stroke="#0e0820" stroke-width="2" opacity="0.5"/>`).join("")}
    <path d="M${t.x - 14} ${t.y + 2} L${tc} ${t.y - 66} L${t.x + t.width + 14} ${t.y + 2} Z" fill="#120a26"/>
    <path d="M${tc} ${t.y - 66} L${tc + 4} ${t.y - 82}" stroke="#120a26" stroke-width="3"/>
    <circle cx="${tc}" cy="${t.y + 52}" r="34" fill="#ffcf7a" opacity="0.18"/>
    <circle cx="${tc}" cy="${t.y + 52}" r="27" fill="url(#clock)" stroke="#0e0820" stroke-width="3"/>
    ${[0, 90, 180, 270].map((a) => `<circle cx="${tc + 21 * Math.sin((a * Math.PI) / 180)}" cy="${t.y + 52 - 21 * Math.cos((a * Math.PI) / 180)}" r="2" fill="#0e0820"/>`).join("")}
    <path d="M${tc} ${t.y + 52} L${tc} ${t.y + 34} M${tc} ${t.y + 52} L${tc + 13} ${t.y + 58}" stroke="#0e0820" stroke-width="3.5" stroke-linecap="round"/>
    <rect x="${tc - 9}" y="${t.y + 100}" width="18" height="22" rx="9" fill="#ffcf7a" opacity="0.75"/>
    <path d="M${tc - 16} ${t.y + t.height} L${tc - 16} ${t.y + 160} Q${tc} ${t.y + 140} ${tc + 16} ${t.y + 160} L${tc + 16} ${t.y + t.height} Z" fill="#0e0820"/>
  </g>
  <!-- tombstones and pumpkins at the edges -->
  ${tombstone(60, 724)}${tombstone(110, 716, 0.8)}${tombstone(1120, 724, 0.9)}${tombstone(870, 220, 0.7)}
  ${pumpkin(fx - 120, fy + 98)}${pumpkin(fx + 126, fy + 96)}${pumpkin(1150, 640)}
  <!-- fountain -->
  <ellipse cx="${fx}" cy="${fy + 34}" rx="${f.width / 2 + 8}" ry="${f.height / 3 + 6}" fill="#000" opacity="0.3"/>
  <ellipse cx="${fx}" cy="${fy + 26}" rx="${f.width / 2}" ry="${f.height / 3}" fill="url(#stone)" stroke="#2a1f45" stroke-width="3"/>
  <ellipse cx="${fx}" cy="${fy + 20}" rx="${f.width / 2 - 10}" ry="${f.height / 3 - 8}" fill="url(#water)"/>
  <ellipse cx="${fx}" cy="${fy + 20}" rx="${f.width / 2 - 10}" ry="${f.height / 3 - 8}" fill="none" stroke="#2a1f45" stroke-width="2" opacity="0.5"/>
  <ellipse cx="${fx - 24}" cy="${fy + 26}" rx="18" ry="4" fill="none" stroke="#d4fff6" stroke-width="1.5" opacity="0.6"/>
  <ellipse cx="${fx + 30}" cy="${fy + 14}" rx="12" ry="3" fill="none" stroke="#d4fff6" stroke-width="1.5" opacity="0.5"/>
  <rect x="${fx - 9}" y="${fy - 34}" width="18" height="52" rx="4" fill="url(#stone)" stroke="#2a1f45" stroke-width="2.5"/>
  <ellipse cx="${fx}" cy="${fy - 34}" rx="32" ry="10" fill="url(#stone)" stroke="#2a1f45" stroke-width="2.5"/>
  <ellipse cx="${fx}" cy="${fy - 36}" rx="24" ry="6" fill="url(#water)"/>
  <path d="M${fx} ${fy - 44} Q${fx - 34} ${fy - 74} ${fx - 44} ${fy - 10} M${fx} ${fy - 44} Q${fx + 34} ${fy - 74} ${fx + 44} ${fy - 10}"
        fill="none" stroke="#bff8ec" stroke-width="2.5" stroke-linecap="round" opacity="0.55"/>
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

/** Data URL of a shop item's art, for previews in the shop and decorate panel. */
export function itemPreviewUrl(itemId: string): string {
  return svgUrl(HAT_SVGS[itemId] ?? DECOR_SVGS[itemId] ?? "<svg xmlns='http://www.w3.org/2000/svg'/>");
}

/** Where the room's fireplace glows; the scene adds a flickering light here. */
export const FIREPLACE = { x: 260, y: 262 };

/** A cosy haunted-room interior: wallpaper, fireplace, arched window, plum floorboards. */
export function roomSvg(): string {
  const W = PLAZA_WIDTH;
  const H = PLAZA_HEIGHT;
  const floorY = 300;
  const planks = Array.from({ length: 10 }, (_, row) => {
    const y = floorY + row * 48;
    const offset = (row * 137) % 240;
    const seams = Array.from({ length: 7 }, (_, i) => offset + i * 240)
      .map((x) => `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + 48}"/>`)
      .join("");
    return `<line x1="0" y1="${y}" x2="${W}" y2="${y}"/>${seams}`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22143f"/><stop offset="1" stop-color="#3a2464"/></linearGradient>
    <pattern id="paper" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M20 4 L36 20 L20 36 L4 20 Z" fill="none" stroke="#ffffff" stroke-width="1" opacity="0.06"/>
      <circle cx="20" cy="20" r="2" fill="#ffcf7a" opacity="0.12"/>
    </pattern>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2e1c46"/><stop offset="1" stop-color="#46295e"/></linearGradient>
    <radialGradient id="warm" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffb35c" stop-opacity="0.18"/><stop offset="1" stop-color="#ffb35c" stop-opacity="0"/></radialGradient>
    <linearGradient id="night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c0720"/><stop offset="1" stop-color="#2f1c58"/></linearGradient>
    <linearGradient id="fire" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff7a2c"/><stop offset="1" stop-color="#ffe08a"/></linearGradient>
  </defs>
  <rect width="100%" height="${floorY}" fill="url(#wall)"/>
  <rect width="100%" height="230" fill="url(#paper)"/>
  <!-- wainscot -->
  <rect x="0" y="230" width="${W}" height="${floorY - 230}" fill="#1e1238"/>
  <rect x="0" y="226" width="${W}" height="6" fill="#5b4689"/>
  ${Array.from({ length: 11 }, (_, i) => `<rect x="${20 + i * 112}" y="244" width="92" height="42" rx="4" fill="none" stroke="#3a2a60" stroke-width="2"/>`).join("")}
  <!-- arched window with curtains -->
  <path d="M830 230 L830 110 Q900 30 970 110 L970 230 Z" fill="url(#night)" stroke="#5b4689" stroke-width="10"/>
  <circle cx="928" cy="100" r="22" fill="#fff3c4"/>
  <circle cx="860" cy="150" r="1.5" fill="#fff"/><circle cx="950" cy="180" r="1.2" fill="#fff"/><circle cx="880" cy="96" r="1.2" fill="#fff"/>
  <path d="M900 52 L900 230 M830 150 L970 150" stroke="#5b4689" stroke-width="5"/>
  <rect x="820" y="226" width="160" height="10" rx="3" fill="#6b5499"/>
  <path d="M800 40 Q840 40 846 120 Q838 200 856 250 L800 250 Z" fill="#6b2d5c"/>
  <path d="M1000 40 Q960 40 954 120 Q962 200 944 250 L1000 250 Z" fill="#6b2d5c"/>
  <rect x="790" y="34" width="220" height="8" rx="4" fill="#2a1a48"/>
  <!-- fireplace -->
  <rect x="150" y="150" width="220" height="${floorY - 150}" fill="#4a3874" stroke="#2a1f45" stroke-width="3"/>
  <rect x="136" y="140" width="248" height="16" rx="3" fill="#5d4a8a" stroke="#2a1f45" stroke-width="3"/>
  <path d="M200 ${floorY} L200 210 Q260 170 320 210 L320 ${floorY} Z" fill="#120a24"/>
  <path d="M232 ${floorY - 6} Q236 250 250 236 Q252 256 262 226 Q272 258 276 240 Q290 260 288 ${floorY - 6} Z" fill="url(#fire)"/>
  <rect x="222" y="${floorY - 10}" width="76" height="8" rx="4" fill="#3a2410"/>
  <rect x="170" y="112" width="10" height="28" rx="2" fill="#efe6d0"/><path d="M175 112 q4 -8 0 -14 q-4 6 0 14Z" fill="#ffcf7a"/>
  <rect x="340" y="118" width="10" height="22" rx="2" fill="#efe6d0"/><path d="M345 118 q4 -8 0 -14 q-4 6 0 14Z" fill="#ffcf7a"/>
  <!-- floor -->
  <rect x="0" y="${floorY}" width="${W}" height="${H - floorY}" fill="url(#floor)"/>
  <g stroke="#1e1232" stroke-width="2" opacity="0.55">${planks}</g>
  <rect x="0" y="${floorY}" width="${W}" height="8" fill="#140b26" opacity="0.7"/>
  <ellipse cx="260" cy="${floorY + 40}" rx="260" ry="90" fill="url(#warm)"/>
  <path d="M840 ${floorY} L960 ${floorY} L1040 ${H} L740 ${H} Z" fill="#fff3c4" opacity="0.035"/>
</svg>`;
}
