import { OBSTACLES, PLAZA_HEIGHT, PLAZA_WIDTH, SEANCE_SPOT } from "@club-kiro/shared";
import { svgUrl } from "./svg";

// World art: flat vector shapes, no outlines. Depth comes from value (darker in
// front, paler and bluer far away), soft translucent shadows, and one light
// source per object. Lantern glow and fog are added by the scenes in Phaser.

const W = PLAZA_WIDTH;
const H = PLAZA_HEIGHT;

/** Shared palette, so every prop sits in the same night. */
const C = {
  skyTop: "#100b22",
  skyLow: "#2a1f4f",
  far: "#2f2658",
  mid: "#251d48",
  near: "#1b1536",
  window: "#ffc46b",
  ground: "#372a5c",
  groundDark: "#2e2350",
  path: "#40336b",
  plazaDisc: "#463873",
  plazaRing: "#52437f",
  hedge: "#1f1a3d",
  hedgeLit: "#2a2350",
  stone: "#6a5c9e",
  stoneTop: "#8172b5",
  stoneDark: "#4e4284",
  water: "#58cdbb",
  waterLit: "#a6efe2",
  waterDark: "#3aa494",
  shadow: "rgba(8, 4, 20, 0.35)",
};

const [fountain, tower] = OBSTACLES as [(typeof OBSTACLES)[number], (typeof OBSTACLES)[number]];

/** Lantern positions, also used by the scene for flickering glows. */
export const LANTERNS = [
  { x: 120, y: 200 },
  { x: 420, y: 160 },
  { x: 780, y: 160 },
  { x: 160, y: 560 },
  { x: 1060, y: 560 },
];

/** Deterministic pseudo-random in 0..1, so the scenery is the same for everyone. */
const rand = (n: number): number => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** One row of rooftops. Rounded, slightly crooked houses; a few windows lit. */
function rooftops(baseY: number, colour: string, seed: number, scale: number, lit: number): string {
  let out = "";
  let x = -40;
  for (let i = 0; x < W + 40; i++) {
    const r = (k: number) => rand(seed * 31 + i * 7 + k);
    const w = (56 + r(1) * 50) * scale;
    const h = (34 + r(2) * 54) * scale;
    const roof = (20 + r(3) * 18) * scale;
    const tilt = (r(4) - 0.5) * 6;
    const top = baseY - h;
    const cx = x + w / 2;
    out += `<g transform="rotate(${tilt.toFixed(1)} ${cx} ${baseY})" fill="${colour}">`;
    out += `<rect x="${x}" y="${top}" width="${w}" height="${h + 40}" rx="${4 * scale}"/>`;
    out += `<path d="M${x - 6 * scale} ${top + 2} Q${cx} ${top - roof * 1.6} ${x + w + 6 * scale} ${top + 2} Z"/>`;
    if (r(5) > 0.55) out += `<rect x="${x + w * 0.7}" y="${top - roof * 0.9}" width="${8 * scale}" height="${roof}" rx="2"/>`;
    out += `</g>`;
    if (lit > 0 && r(6) > 0.35) {
      const wx = x + w * (0.3 + r(7) * 0.3);
      const wy = top + h * 0.3;
      const ww = 9 * scale;
      const wh = 12 * scale;
      out += `<rect x="${wx}" y="${wy}" width="${ww}" height="${wh}" rx="${ww / 2}" fill="${C.window}" opacity="${0.9 * lit}"/>`;
    }
    x += w + (4 + r(8) * 18) * scale;
  }
  return out;
}

/**
 * A low garden wall along the top of the square (the edge you can't walk past),
 * with a few bush clusters at irregular spots so it doesn't read as a pattern.
 */
function hedge(y: number): string {
  let bushes = "";
  for (const [x, s] of [[70, 1], [300, 0.8], [560, 1.1], [690, 0.7], [880, 0.9], [1120, 1.05]] as const) {
    const r = 22 * s;
    bushes += `<g transform="translate(${x} ${y})">
      <circle cx="${-r * 0.9}" cy="${-r * 0.5}" r="${r * 0.75}" fill="${C.hedge}"/>
      <circle cx="${r * 0.9}" cy="${-r * 0.4}" r="${r * 0.7}" fill="${C.hedge}"/>
      <circle cx="0" cy="${-r * 0.8}" r="${r}" fill="${C.hedge}"/>
      <circle cx="${-r * 0.3}" cy="${-r * 1.2}" r="${r * 0.45}" fill="${C.hedgeLit}"/>
    </g>`;
  }
  return `<rect x="0" y="${y - 14}" width="${W}" height="20" fill="#241d45"/>
    <rect x="0" y="${y - 18}" width="${W}" height="7" rx="3.5" fill="#33295e"/>
    ${Array.from({ length: 16 }, (_, i) => `<rect x="${i * 80 + 18}" y="${y - 11}" width="2" height="16" fill="#1c163a"/>`).join("")}
    ${bushes}`;
}

/** A round spooky tree for framing the edges. */
function tree(x: number, y: number, s: number): string {
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <ellipse cx="0" cy="2" rx="34" ry="8" fill="${C.shadow}"/>
    <path d="M-5 0 Q-7 -40 -2 -70 L4 -70 Q8 -40 6 0 Z" fill="#241a3a"/>
    <path d="M0 -52 Q-18 -60 -26 -78 M2 -60 Q16 -70 22 -88" stroke="#241a3a" stroke-width="5" stroke-linecap="round" fill="none"/>
    <circle cx="-4" cy="-96" r="34" fill="#2c2350"/>
    <circle cx="-22" cy="-78" r="22" fill="#2c2350"/>
    <circle cx="20" cy="-82" r="24" fill="#2c2350"/>
    <circle cx="-12" cy="-108" r="16" fill="#382d63"/>
  </g>`;
}

function lamp(x: number, y: number): string {
  return `<g transform="translate(${x} ${y})">
    <ellipse cx="0" cy="92" rx="18" ry="5" fill="${C.shadow}"/>
    <rect x="-8" y="82" width="16" height="10" rx="4" fill="#1d1733"/>
    <rect x="-2.5" y="2" width="5" height="84" rx="2.5" fill="#1d1733"/>
    <rect x="-10" y="-24" width="20" height="26" rx="6" fill="#ffe2a3"/>
    <rect x="-10" y="-24" width="7" height="26" rx="3" fill="#fff4d6"/>
    <path d="M-14 -22 Q0 -40 14 -22 Z" fill="#1d1733"/>
    <rect x="-12" y="0" width="24" height="5" rx="2.5" fill="#1d1733"/>
  </g>`;
}

function tombstone(x: number, y: number, s = 1): string {
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <ellipse cx="0" cy="2" rx="20" ry="5" fill="${C.shadow}"/>
    <path d="M-14 0 L-14 -26 Q-14 -40 0 -40 Q14 -40 14 -26 L14 0 Z" fill="#5a4f86"/>
    <path d="M-14 0 L-14 -26 Q-14 -40 0 -40 Q-6 -36 -6 -24 L-6 0 Z" fill="#6c62a0"/>
    <rect x="-1.5" y="-32" width="3" height="16" rx="1.5" fill="#463d70"/>
    <rect x="-6" y="-27" width="12" height="3" rx="1.5" fill="#463d70"/>
  </g>`;
}

function pumpkin(x: number, y: number): string {
  return `<g transform="translate(${x} ${y})">
    <ellipse cx="0" cy="12" rx="20" ry="5" fill="${C.shadow}"/>
    <ellipse cx="-7" cy="0" rx="10" ry="13" fill="#e67a2a"/>
    <ellipse cx="7" cy="0" rx="10" ry="13" fill="#e67a2a"/>
    <ellipse cx="0" cy="0" rx="9" ry="13.5" fill="#f28d35"/>
    <ellipse cx="-3" cy="-6" rx="3" ry="4" fill="#ffb15e" opacity="0.8"/>
    <rect x="-2" y="-18" width="4" height="7" rx="2" fill="#5d7a45"/>
    <path d="M-9 -2 l4 -4 l4 4 Z M1 -2 l4 -4 l4 4 Z M-8 4 Q0 10 8 4 Q0 7 -8 4 Z" fill="#ffe08a"/>
  </g>`;
}

/** The haunted plaza background, with props placed on the obstacle rects. */
export function plazaSvg(): string {
  const f = fountain;
  const t = tower;
  const fx = f.x + f.width / 2;
  const fy = f.y + f.height / 2;
  const tc = t.x + t.width / 2;
  const horizon = 158;
  const stars = Array.from({ length: 60 }, (_, i) => {
    const r = 0.6 + rand(900 + i) * 1.1;
    return `<circle cx="${(rand(i) * W).toFixed(0)}" cy="${(6 + rand(300 + i) * 100).toFixed(0)}" r="${r.toFixed(1)}" fill="#fff" opacity="${(0.25 + rand(600 + i) * 0.6).toFixed(2)}"/>`;
  }).join("");
  // Flagstones in rings around the fountain: a modern, readable "town square".
  const rings = [1, 2, 3]
    .map((k) => `<ellipse cx="${fx}" cy="${fy + 30}" rx="${130 + k * 52}" ry="${62 + k * 26}" fill="none" stroke="${C.plazaRing}" stroke-width="2" opacity="${0.55 - k * 0.12}" stroke-dasharray="${26 + k * 6} 8"/>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.skyTop}"/><stop offset="1" stop-color="${C.skyLow}"/></linearGradient>
  </defs>
  <rect width="100%" height="${horizon + 10}" fill="url(#sky)"/>
  ${stars}
  <circle cx="170" cy="74" r="86" fill="#fff3c4" opacity="0.05"/>
  <circle cx="170" cy="74" r="58" fill="#fff3c4" opacity="0.07"/>
  <circle cx="170" cy="74" r="38" fill="#f7eccb"/>
  <circle cx="158" cy="64" r="6" fill="#e9dcb3"/><circle cx="182" cy="88" r="4.5" fill="#e9dcb3"/><circle cx="186" cy="62" r="3" fill="#e9dcb3"/>
  <!-- three rows of rooftops, fading with distance -->
  ${rooftops(128, C.far, 3, 0.7, 0.35)}
  ${rooftops(146, C.mid, 7, 0.85, 0.65)}
  ${rooftops(164, C.near, 11, 1, 1)}
  <!-- the square -->
  <rect x="0" y="${horizon}" width="${W}" height="${H - horizon}" fill="${C.ground}"/>
  <rect x="0" y="${horizon}" width="${W}" height="70" fill="${C.groundDark}" opacity="0.6"/>
  <g fill="none" stroke="${C.path}" stroke-linecap="round">
    <path d="M${fx} 440 L${fx} ${H + 60}" stroke-width="150"/>
    <path d="M380 370 Q200 410 -40 520" stroke-width="100"/>
    <path d="M820 370 Q1000 420 1240 450" stroke-width="100"/>
  </g>
  <ellipse cx="${fx}" cy="${fy + 30}" rx="300" ry="150" fill="${C.plazaDisc}"/>
  ${rings}
  ${hedge(horizon + 8)}
  <!-- clock tower -->
  <ellipse cx="${tc}" cy="${t.y + t.height + 2}" rx="74" ry="12" fill="${C.shadow}"/>
  <g transform="rotate(-3 ${tc} ${t.y + t.height})">
    <rect x="${t.x + 6}" y="${t.y}" width="${t.width - 12}" height="${t.height}" rx="6" fill="#2d2454"/>
    <rect x="${tc}" y="${t.y}" width="${t.width / 2 - 6}" height="${t.height}" rx="6" fill="#241c46"/>
    <rect x="${t.x}" y="${t.y + 92}" width="${t.width}" height="10" rx="5" fill="#372d63"/>
    <path d="M${t.x - 8} ${t.y + 4} Q${tc} ${t.y - 90} ${t.x + t.width + 8} ${t.y + 4} Z" fill="#1d1738"/>
    <circle cx="${tc}" cy="${t.y + 48}" r="40" fill="#ffd98a" opacity="0.12"/>
    <circle cx="${tc}" cy="${t.y + 48}" r="29" fill="#3b3170"/>
    <circle cx="${tc}" cy="${t.y + 48}" r="24" fill="#ffe7ad"/>
    <path d="M${tc} ${t.y + 48} L${tc} ${t.y + 32} M${tc} ${t.y + 48} L${tc + 11} ${t.y + 54}" stroke="#2d2454" stroke-width="3.5" stroke-linecap="round"/>
    <circle cx="${tc}" cy="${t.y + 48}" r="3" fill="#2d2454"/>
    <rect x="${tc - 8}" y="${t.y + 116}" width="16" height="22" rx="8" fill="${C.window}" opacity="0.85"/>
    <path d="M${tc - 15} ${t.y + t.height} L${tc - 15} ${t.y + 170} Q${tc} ${t.y + 152} ${tc + 15} ${t.y + 170} L${tc + 15} ${t.y + t.height} Z" fill="#15102b"/>
  </g>
  <!-- framing trees, tombstones, pumpkins -->
  ${tree(40, 690, 1.1)}${tree(1170, 300, 0.9)}${tree(1160, 700, 1)}
  ${tombstone(98, 690)}${tombstone(140, 700, 0.75)}${tombstone(880, 228, 0.7)}${tombstone(1100, 690, 0.8)}
  ${pumpkin(fx - 128, fy + 100)}${pumpkin(fx + 132, fy + 96)}${pumpkin(330, 650)}
  <!-- fountain: round basin, tiered column, water arcs -->
  <ellipse cx="${fx}" cy="${fy + 40}" rx="${f.width / 2 + 14}" ry="${f.height / 3 + 10}" fill="${C.shadow}"/>
  <ellipse cx="${fx}" cy="${fy + 26}" rx="${f.width / 2 + 4}" ry="${f.height / 3 + 4}" fill="${C.stoneDark}"/>
  <ellipse cx="${fx}" cy="${fy + 16}" rx="${f.width / 2 + 4}" ry="${f.height / 3 + 2}" fill="${C.stone}"/>
  <ellipse cx="${fx}" cy="${fy + 14}" rx="${f.width / 2 - 6}" ry="${f.height / 3 - 6}" fill="${C.waterDark}"/>
  <ellipse cx="${fx}" cy="${fy + 17}" rx="${f.width / 2 - 10}" ry="${f.height / 3 - 9}" fill="${C.water}"/>
  <path d="M${fx - 52} ${fy + 22} Q${fx - 30} ${fy + 28} ${fx - 8} ${fy + 24}" stroke="${C.waterLit}" stroke-width="3" stroke-linecap="round" fill="none" opacity="0.8"/>
  <path d="M${fx + 18} ${fy + 8} Q${fx + 34} ${fy + 12} ${fx + 50} ${fy + 8}" stroke="${C.waterLit}" stroke-width="3" stroke-linecap="round" fill="none" opacity="0.6"/>
  <rect x="${fx - 10}" y="${fy - 34}" width="20" height="50" rx="8" fill="${C.stoneDark}"/>
  <rect x="${fx - 10}" y="${fy - 34}" width="8" height="50" rx="4" fill="${C.stone}"/>
  <ellipse cx="${fx}" cy="${fy - 30}" rx="34" ry="11" fill="${C.stone}"/>
  <ellipse cx="${fx}" cy="${fy - 32}" rx="26" ry="7" fill="${C.water}"/>
  <ellipse cx="${fx}" cy="${fy - 34}" rx="6" ry="4" fill="${C.stoneTop}"/>
  <path d="M${fx} ${fy - 40} Q${fx - 30} ${fy - 72} ${fx - 46} ${fy + 4} M${fx} ${fy - 40} Q${fx + 30} ${fy - 72} ${fx + 46} ${fy + 4}"
        fill="none" stroke="${C.waterLit}" stroke-width="3" stroke-linecap="round" opacity="0.55"/>
  ${seanceCircle(SEANCE_SPOT.x, SEANCE_SPOT.y)}
  ${LANTERNS.map((l) => lamp(l.x, l.y)).join("")}
</svg>`;
}

/** Candle positions around the séance circle, also used for their glows. */
export const SEANCE_CANDLES = Array.from({ length: 6 }, (_, i) => {
  const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
  return { x: SEANCE_SPOT.x + Math.cos(a) * 62, y: SEANCE_SPOT.y + 14 + Math.sin(a) * 26 };
});

/** A rune circle on the ground ringed by candles: where the séance is held. */
function seanceCircle(x: number, y: number): string {
  const runes = [0, 1, 2, 3].map((i) => {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    return `<circle cx="${x + Math.cos(a) * 30}" cy="${y + 14 + Math.sin(a) * 12}" r="3" fill="#b080ff" opacity="0.7"/>`;
  });
  const candles = SEANCE_CANDLES.map(
    (c) => `<g transform="translate(${c.x} ${c.y})">
      <ellipse cx="0" cy="2" rx="7" ry="2.5" fill="${C.shadow}"/>
      <rect x="-3.5" y="-14" width="7" height="15" rx="2.5" fill="#f2e9d6"/>
      <path d="M0 -14 Q4 -19 0 -25 Q-4 -19 0 -14 Z" fill="#ffb84d"/>
    </g>`,
  );
  return `<ellipse cx="${x}" cy="${y + 14}" rx="70" ry="30" fill="#2e2350"/>
    <ellipse cx="${x}" cy="${y + 14}" rx="54" ry="22" fill="none" stroke="#7a62c4" stroke-width="2" opacity="0.7"/>
    <ellipse cx="${x}" cy="${y + 14}" rx="38" ry="15" fill="none" stroke="#7a62c4" stroke-width="1.5" opacity="0.5" stroke-dasharray="6 5"/>
    ${runes.join("")}${candles.join("")}`;
}

/** A soft dark frame around the edges of the screen, drawn above the world. */
export function vignetteSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs><radialGradient id="v" cx="50%" cy="50%" r="75%"><stop offset="0.6" stop-color="#05020f" stop-opacity="0"/><stop offset="1" stop-color="#05020f" stop-opacity="0.5"/></radialGradient></defs>
  <rect width="100%" height="100%" fill="url(#v)"/>
</svg>`;
}

// --- Hats (worn above a ghost) and decorations (placed in a room) ---

const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

/** Flat hat SVGs keyed by shop item id, anchored to sit on the head. */
const HAT_SVGS: Record<string, string> = {
  "hat-witch": svg(48, 44, `
    <ellipse cx="24" cy="36" rx="21" ry="6" fill="#3c2569"/>
    <path d="M13 35 Q18 18 25 4 Q28 2 30 6 Q30 10 27 10 Q32 22 35 35 Z" fill="#5b3a96"/>
    <path d="M13 35 Q18 18 25 4 Q22 20 21 35 Z" fill="#6e4bb0"/>
    <rect x="14" y="28" width="21" height="6" rx="2" fill="#ffb84d"/>`),
  "hat-top": svg(44, 40, `
    <ellipse cx="22" cy="33" rx="19" ry="5.5" fill="#1d1730"/>
    <g transform="rotate(-6 22 18)"><rect x="12" y="4" width="20" height="28" rx="4" fill="#2a2244"/>
    <rect x="12" y="4" width="7" height="28" rx="3" fill="#352c55"/>
    <rect x="12" y="22" width="20" height="6" fill="#7138cc"/></g>`),
  "hat-flower": svg(48, 26, `
    <path d="M5 20 Q24 6 43 20" fill="none" stroke="#5d8a55" stroke-width="4" stroke-linecap="round"/>
    ${[[12, 15, "#e79bc0"], [24, 10, "#ffd27a"], [36, 15, "#b080ff"]]
      .map(([x, y, c]) => [0, 72, 144, 216, 288].map((a) => `<circle cx="${(x as number) + 4 * Math.cos(((a as number) * Math.PI) / 180)}" cy="${(y as number) + 4 * Math.sin(((a as number) * Math.PI) / 180)}" r="3.2" fill="${c}"/>`).join("") + `<circle cx="${x}" cy="${y}" r="2.4" fill="#fff4d6"/>`)
      .join("")}`),
  "hat-crown": svg(48, 28, `
    <path d="M8 25 L8 9 Q12 9 16 17 L24 4 L32 17 Q36 9 40 9 L40 25 Z" fill="#e9e1cf"/>
    <path d="M8 25 L8 9 Q12 9 16 17 L24 4 L20 25 Z" fill="#f6f0e2"/>
    <rect x="8" y="21" width="32" height="4" rx="2" fill="#cfc4ab"/>
    <circle cx="24" cy="15" r="2.5" fill="#b080ff"/>`),
  "hat-halo": svg(48, 24, `
    <ellipse cx="24" cy="12" rx="19" ry="7" fill="#ffd27a" opacity="0.18"/>
    <ellipse cx="24" cy="12" rx="17" ry="5.5" fill="none" stroke="#ffd27a" stroke-width="4"/>
    <path d="M10 10 Q24 4 38 10" fill="none" stroke="#fff1c2" stroke-width="2" stroke-linecap="round"/>`),
  "hat-jack": svg(40, 38, `
    <ellipse cx="12" cy="23" rx="10" ry="13" fill="#e67a2a"/><ellipse cx="28" cy="23" rx="10" ry="13" fill="#e67a2a"/>
    <ellipse cx="20" cy="23" rx="9" ry="14" fill="#f28d35"/>
    <ellipse cx="15" cy="16" rx="3" ry="4" fill="#ffb15e"/>
    <rect x="18" y="3" width="4" height="8" rx="2" fill="#5d7a45"/>
    <path d="M11 21 l4 -5 l4 5 Z M21 21 l4 -5 l4 5 Z M11 28 Q20 35 29 28 Q20 31 11 28 Z" fill="#3b1f0a"/>`),
};

export const hatTextureKey = (hatId: string): string => `hat-tex-${hatId}`;

export const hatTextures = Object.entries(HAT_SVGS).map(([id, s]) => ({ id, key: hatTextureKey(id), url: svgUrl(s) }));

/** Flat decoration SVGs keyed by shop item id, for placing in a room. */
const DECOR_SVGS: Record<string, string> = {
  "dec-lantern": svg(48, 72, `
    <rect x="22" y="0" width="4" height="16" fill="#1d1733"/>
    <circle cx="24" cy="44" r="22" fill="#ffd27a" opacity="0.15"/>
    <path d="M10 22 Q24 8 38 22 Z" fill="#2b2348"/>
    <rect x="11" y="22" width="26" height="40" rx="9" fill="#ffd98a"/>
    <rect x="11" y="22" width="9" height="40" rx="4.5" fill="#fff1c9"/>
    <rect x="9" y="60" width="30" height="6" rx="3" fill="#2b2348"/>`),
  "dec-rug": svg(120, 72, `
    <rect x="4" y="8" width="112" height="56" rx="28" fill="#4b2f80"/>
    <rect x="14" y="16" width="92" height="40" rx="20" fill="#5b3a96"/>
    <rect x="28" y="26" width="64" height="20" rx="10" fill="#7148b8"/>
    ${[22, 40, 60, 80, 98].map((x) => `<circle cx="${x}" cy="36" r="2.5" fill="#b080ff"/>`).join("")}`),
  "dec-candle": svg(40, 72, `
    <circle cx="20" cy="18" r="14" fill="#ffd27a" opacity="0.18"/>
    <ellipse cx="20" cy="64" rx="15" ry="5" fill="#6a5c9e"/>
    <rect x="13" y="26" width="14" height="38" rx="5" fill="#f2e9d6"/>
    <rect x="13" y="26" width="5" height="38" rx="2.5" fill="#fffaf0"/>
    <path d="M20 25 Q27 16 20 5 Q13 16 20 25 Z" fill="#ffb84d"/>
    <path d="M20 23 Q23 18 20 12 Q17 18 20 23 Z" fill="#fff1c2"/>`),
  "dec-cauldron": svg(72, 64, `
    <ellipse cx="36" cy="60" rx="28" ry="4" fill="rgba(8,4,20,0.35)"/>
    <ellipse cx="36" cy="38" rx="30" ry="22" fill="#2b2348"/>
    <ellipse cx="28" cy="34" rx="10" ry="12" fill="#352c58"/>
    <ellipse cx="36" cy="22" rx="30" ry="8" fill="#3a3062"/>
    <ellipse cx="36" cy="22" rx="24" ry="5.5" fill="#7fe0c8"/>
    <circle cx="28" cy="16" r="4" fill="#a6efe2"/><circle cx="42" cy="12" r="3" fill="#a6efe2"/><circle cx="36" cy="6" r="2" fill="#a6efe2"/>`),
  "dec-portrait": svg(56, 72, `
    <rect x="3" y="3" width="50" height="66" rx="10" fill="#b58b4a"/>
    <rect x="9" y="9" width="38" height="54" rx="6" fill="#2e2452"/>
    <path d="M18 56 L18 32 Q18 20 28 20 Q38 20 38 32 L38 56 L33 52 L28 56 L23 52 Z" fill="#b080ff"/>
    <circle cx="25" cy="32" r="2" fill="#2e2452"/><circle cx="32" cy="32" r="2" fill="#2e2452"/>`),
  "dec-tree": svg(72, 96, `
    <ellipse cx="36" cy="92" rx="24" ry="4" fill="rgba(8,4,20,0.35)"/>
    <path d="M32 92 Q30 60 36 36 L40 36 Q42 62 42 92 Z" fill="#3b2a4f"/>
    <circle cx="36" cy="30" r="24" fill="#4a3a7a"/>
    <circle cx="20" cy="40" r="14" fill="#4a3a7a"/><circle cx="52" cy="38" r="15" fill="#4a3a7a"/>
    <circle cx="30" cy="22" r="10" fill="#5b4a8a"/>
    ${[16, 26, 46, 56].map((x, i) => `<path d="M${x} ${44 + (i % 2) * 4} Q${x - 2} ${60} ${x} ${70 - (i % 2) * 8}" stroke="#5b4a8a" stroke-width="3" stroke-linecap="round" fill="none"/>`).join("")}`),
};

export const decorTextureKey = (decorId: string): string => `decor-tex-${decorId}`;

export const decorTextures = Object.entries(DECOR_SVGS).map(([id, s]) => ({ id, key: decorTextureKey(id), url: svgUrl(s) }));

/** Data URL of a shop item's art, for previews in the shop and decorate panel. */
export function itemPreviewUrl(itemId: string): string {
  return svgUrl(HAT_SVGS[itemId] ?? DECOR_SVGS[itemId] ?? svg(1, 1, ""));
}

/** Where the room's fireplace glows; the scene adds a flickering light here. */
export const FIREPLACE = { x: 260, y: 262 };

/** A cosy haunted room: flat walls, a rounded fireplace, an arched window, soft floorboards. */
export function roomSvg(): string {
  const floorY = 300;
  const planks = Array.from({ length: 9 }, (_, row) => {
    const y = floorY + 20 + row * 46;
    return `<rect x="0" y="${y}" width="${W}" height="2" fill="#2a1d45" opacity="0.35"/>` +
      Array.from({ length: 4 }, (_, i) => `<rect x="${((row * 173) % 380) + i * 380}" y="${y - 44}" width="2" height="44" fill="#2a1d45" opacity="0.25"/>`).join("");
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="100%" height="${floorY}" fill="#2a2050"/>
  ${Array.from({ length: 16 }, (_, i) => `<rect x="${i * 80 + 36}" y="0" width="8" height="226" rx="4" fill="#30265a"/>`).join("")}
  <rect x="0" y="226" width="${W}" height="${floorY - 226}" fill="#211940"/>
  <rect x="0" y="222" width="${W}" height="8" rx="4" fill="#3d3170"/>
  <!-- arched window with curtains -->
  <path d="M832 230 L832 112 Q900 34 968 112 L968 230 Z" fill="#3d3170"/>
  <path d="M844 222 L844 116 Q900 52 956 116 L956 222 Z" fill="#141030"/>
  <circle cx="924" cy="104" r="20" fill="#f7eccb"/>
  <circle cx="870" cy="160" r="1.5" fill="#fff"/><circle cx="940" cy="186" r="1.2" fill="#fff"/><circle cx="880" cy="104" r="1.2" fill="#fff"/>
  <rect x="898" y="60" width="4" height="162" fill="#3d3170"/><rect x="844" y="150" width="112" height="4" fill="#3d3170"/>
  <rect x="818" y="226" width="164" height="10" rx="5" fill="#4a3d82"/>
  <path d="M796 40 Q838 44 844 120 Q836 196 852 250 L796 250 Z" fill="#6b2d6a"/>
  <path d="M796 40 Q816 44 818 120 Q812 196 820 250 L796 250 Z" fill="#7d3a7c"/>
  <path d="M1004 40 Q962 44 956 120 Q964 196 948 250 L1004 250 Z" fill="#6b2d6a"/>
  <rect x="786" y="34" width="228" height="8" rx="4" fill="#1d1738"/>
  <!-- fireplace -->
  <rect x="148" y="148" width="224" height="${floorY - 148}" rx="10" fill="#4a3d82"/>
  <rect x="148" y="148" width="60" height="${floorY - 148}" rx="10" fill="#54468f"/>
  <rect x="134" y="136" width="252" height="18" rx="9" fill="#5d4f9a"/>
  <path d="M198 ${floorY} L198 214 Q260 168 322 214 L322 ${floorY} Z" fill="#120d26"/>
  <path d="M228 ${floorY - 4} Q232 252 248 236 Q250 258 262 222 Q274 258 278 238 Q292 260 292 ${floorY - 4} Z" fill="#ff8a3c"/>
  <path d="M244 ${floorY - 4} Q248 266 260 250 Q270 268 276 ${floorY - 4} Z" fill="#ffd27a"/>
  <rect x="220" y="${floorY - 10}" width="80" height="8" rx="4" fill="#3b2410"/>
  <rect x="168" y="108" width="10" height="28" rx="3" fill="#f2e9d6"/><path d="M173 108 q5 -8 0 -15 q-5 7 0 15Z" fill="#ffb84d"/>
  <rect x="342" y="114" width="10" height="22" rx="3" fill="#f2e9d6"/><path d="M347 114 q5 -8 0 -15 q-5 7 0 15Z" fill="#ffb84d"/>
  <!-- floor -->
  <rect x="0" y="${floorY}" width="${W}" height="${H - floorY}" fill="#3a2a5e"/>
  ${planks}
  <rect x="0" y="${floorY}" width="${W}" height="10" fill="#1d1538" opacity="0.8"/>
  <path d="M846 ${floorY} L954 ${floorY} L1030 ${H} L770 ${H} Z" fill="#fff3c4" opacity="0.025"/>
</svg>`;
}
