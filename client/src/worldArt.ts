import {
  CRYPT_PILLARS,
  FOUNTAIN_CENTRE,
  FOUNTAIN_FOOT,
  LAMPS,
  PET_COLOURS,
  PET_ITEMS,
  PLAZA_HEIGHT,
  PLAZA_WIDTH,
  SEANCE_SPOT,
  parsePetId,
  type AreaId,
  type PetSpecies,
} from "@club-kiro/shared";
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

/** Where the fountain and clock tower are drawn. Their hitboxes are smaller footprints (shared OBSTACLES). */
const fountain = { x: FOUNTAIN_CENTRE.x - 80, y: FOUNTAIN_CENTRE.y - 60, width: 160, height: 120 };
const tower = { x: 940, y: 80, width: 100, height: 200 };

/** Lantern positions, also used by the scene for flickering glows. */
export const LANTERNS = LAMPS;

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

/** The plaza's flat ground and backdrop. Upright props are separate sprites (see plazaProps). */
export function plazaSvg(): string {
  const f = fountain;
  const fx = f.x + f.width / 2;
  const fy = f.y + f.height / 2;
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
  ${seanceCircle(SEANCE_SPOT.x, SEANCE_SPOT.y)}
</svg>`;
}

// --- Plaza props: drawn as separate sprites so ghosts can walk behind them ---

function towerArt(): string {
  const t = tower;
  const tc = t.x + t.width / 2;
  return `<ellipse cx="${tc}" cy="${t.y + t.height + 2}" rx="74" ry="12" fill="${C.shadow}"/>
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
  </g>`;
}

function fountainArt(): string {
  const f = fountain;
  const fx = f.x + f.width / 2;
  const fy = f.y + f.height / 2;
  return `<ellipse cx="${fx}" cy="${fy + 40}" rx="${f.width / 2 + 14}" ry="${f.height / 3 + 10}" fill="${C.shadow}"/>
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
        fill="none" stroke="${C.waterLit}" stroke-width="3" stroke-linecap="round" opacity="0.55"/>`;
}

/**
 * A prop drawn as its own sprite. `svg` crops the world-coordinate drawing to the
 * prop's box (via viewBox), so the art code stays in world coordinates.
 * `depth` is the ground line it stands on: ghosts whose feet are above it are behind it.
 */
export interface PropSprite {
  key: string;
  svg: string;
  x: number;
  y: number;
  w: number;
  h: number;
  depth: number;
}

function prop(key: string, content: string, x: number, y: number, w: number, h: number, depth: number): PropSprite {
  return {
    key,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}">${content}</svg>`,
    x,
    y,
    w,
    h,
    depth,
  };
}

function plazaProps(): PropSprite[] {
  const f = fountain;
  const fx = f.x + f.width / 2;
  const fy = f.y + f.height / 2;
  const trees: [number, number, number][] = [[40, 690, 1.1], [1170, 300, 0.9], [1160, 700, 1]];
  const stones: [number, number, number][] = [[98, 690, 1], [140, 700, 0.75], [880, 228, 0.7], [1100, 690, 0.8]];
  const pumpkins: [number, number][] = [[fx - 128, fy + 100], [fx + 132, fy + 96], [330, 650]];
  return [
    prop("p-tower", towerArt(), 912, -24, 156, 326, tower.y + tower.height - 4),
    prop("p-fountain", fountainArt(), fx - 106, fy - 80, 212, 174, FOUNTAIN_FOOT.y + FOUNTAIN_FOOT.height / 2),
    ...LANTERNS.map((l, i) => prop(`p-lamp-${i}`, lamp(l.x, l.y), l.x - 22, l.y - 44, 44, 144, l.y + 87)),
    ...trees.map(([x, y, s], i) => prop(`p-tree-${i}`, tree(x, y, s), x - 62 * s, y - 136 * s, 124 * s, 148 * s, y)),
    ...stones.map(([x, y, s], i) => prop(`p-stone-${i}`, tombstone(x, y, s), x - 22 * s, y - 42 * s, 44 * s, 50 * s, y)),
    ...pumpkins.map(([x, y], i) => prop(`p-pumpkin-${i}`, pumpkin(x, y), x - 22, y - 20, 44, 38, y + 10)),
  ];
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
  const pet = parsePetId(itemId);
  if (pet) return svgUrl(petSvg(pet.species, PET_COLOURS[pet.colour].hex));
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

// --- Pets ---

/** Mix a hex colour toward black (t < 0) or white (t > 0). */
function shade(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(t < 0 ? c * (1 + t) : c + (255 - c) * t));
  return `#${ch.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

const petEyes = (x1: number, x2: number, y: number) =>
  `<circle cx="${x1}" cy="${y}" r="2.6" fill="#fff"/><circle cx="${x2}" cy="${y}" r="2.6" fill="#fff"/>
   <circle cx="${x1 + 0.7}" cy="${y + 0.3}" r="1.3" fill="#1d1533"/><circle cx="${x2 + 0.7}" cy="${y + 0.3}" r="1.3" fill="#1d1533"/>`;

/** Pet art by species, in the given colour. All face right, like the ghosts. */
export function petSvg(species: PetSpecies, hex: string): string {
  const dark = shade(hex, -0.35);
  const light = shade(hex, 0.35);
  switch (species) {
    case "bat":
      return svg(48, 32, `
        <path d="M24 14 Q14 2 2 8 Q8 12 6 18 Q12 14 16 20 Q19 15 24 18 Z" fill="${dark}"/>
        <path d="M24 14 Q34 2 46 8 Q40 12 42 18 Q36 14 32 20 Q29 15 24 18 Z" fill="${dark}"/>
        <ellipse cx="25" cy="17" rx="8" ry="9" fill="${hex}"/>
        <path d="M19 10 L20 4 L23 9 Z M27 9 L30 4 L31 10 Z" fill="${hex}"/>
        <ellipse cx="22" cy="13" rx="3" ry="2" fill="${light}" opacity="0.6"/>
        ${petEyes(23, 29, 16)}
        <path d="M24 21 l1 2 l1 -2" stroke="#fff" stroke-width="1" fill="none"/>`);
    case "wisp":
      return svg(36, 40, `
        <path d="M18 38 Q4 34 6 22 Q8 12 16 4 Q16 12 22 10 Q30 16 30 24 Q31 36 18 38 Z" fill="${hex}"/>
        <path d="M18 34 Q10 31 11 23 Q12 17 17 12 Q18 18 22 17 Q26 21 26 26 Q26 33 18 34 Z" fill="${light}"/>
        ${petEyes(16, 22, 25)}`);
    case "spider":
      return svg(40, 34, `
        ${[-1, 1]
          .map((s) =>
            [0, 1, 2, 3]
              .map((i) => {
                const y = 14 + i * 4;
                const x = 20 + s * 7;
                return `<path d="M${x} ${y} Q${x + s * 9} ${y - 7 + i * 2} ${x + s * 14} ${y + 4 + i * 2}" stroke="${dark}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
              })
              .join(""),
          )
          .join("")}
        <ellipse cx="20" cy="22" rx="9" ry="8" fill="${hex}"/>
        <circle cx="20" cy="13" r="6" fill="${hex}"/>
        <ellipse cx="17" cy="19" rx="3" ry="2" fill="${light}" opacity="0.6"/>
        ${petEyes(18, 23, 13)}`);
  }
}

export const petTextureKey = (id: string): string => `pet-tex-${id}`;

export const petTextures = PET_ITEMS.map((item) => {
  const p = parsePetId(item.id)!;
  return { id: item.id, key: petTextureKey(item.id), url: svgUrl(petSvg(p.species, PET_COLOURS[p.colour].hex)) };
});

// --- Public areas beyond the plaza ---

/** A wooden signpost marking an exit, with an arrow toward it. */
function signpost(x: number, y: number, label: string, pointLeft: boolean): string {
  const w = label.length * 7.4 + 26;
  const bx = pointLeft ? -w + 14 : -14;
  const tip = pointLeft ? `M${bx} -46 L${bx - 10} -36 L${bx} -26 Z` : `M${bx + w} -46 L${bx + w + 10} -36 L${bx + w} -26 Z`;
  return `<g transform="translate(${x} ${y})">
    <ellipse cx="0" cy="2" rx="14" ry="4" fill="${C.shadow}"/>
    <rect x="-3" y="-40" width="6" height="42" rx="3" fill="#4a3460"/>
    <rect x="${bx}" y="-46" width="${w}" height="20" rx="5" fill="#6b4c86"/>
    <path d="${tip}" fill="#6b4c86"/>
    <text x="${bx + w / 2}" y="-32" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="700" font-size="12" fill="#f3eaff">${label}</text>
  </g>`;
}

/** Signposts at the plaza's two exits. Drawn on top of the plaza background. */
export function plazaSignsSvg(): string {
  return svg(W, H, `${signpost(70, 432, "Lighthouse", true)}${signpost(1128, 412, "Crypt", false)}`);
}

/** Warm and cold light sources per area, for the scene's glows: x, y, tint, size. */
export const AREA_LIGHTS: Record<Exclude<AreaId, "plaza">, { x: number; y: number; tint: number; scale: number }[]> = {
  lighthouse: [
    { x: 905, y: 62, tint: 0xffe2a3, scale: 0.9 },
  ],
  crypt: [
    { x: 140, y: 150, tint: 0x7fe0c8, scale: 0.55 },
    { x: 420, y: 150, tint: 0x7fe0c8, scale: 0.55 },
    { x: 780, y: 150, tint: 0x7fe0c8, scale: 0.55 },
    { x: 1060, y: 150, tint: 0x7fe0c8, scale: 0.55 },
    { x: 600, y: 360, tint: 0xb080ff, scale: 0.8 },
  ],
};

/** The lighthouse's lamp, for the rotating beam. */
export const LIGHTHOUSE_LAMP = { x: 905, y: 62 };

export function lighthouseSvg(): string {
  const stars = Array.from({ length: 40 }, (_, i) =>
    `<circle cx="${(rand(70 + i) * W).toFixed(0)}" cy="${(6 + rand(170 + i) * 90).toFixed(0)}" r="${(0.6 + rand(270 + i)).toFixed(1)}" fill="#fff" opacity="${(0.3 + rand(370 + i) * 0.5).toFixed(2)}"/>`,
  ).join("");
  const sea = Array.from({ length: 9 }, (_, i) =>
    `<rect x="${(rand(500 + i) * 900).toFixed(0)}" y="${130 + i * 10}" width="${(60 + rand(600 + i) * 140).toFixed(0)}" height="2" rx="1" fill="#6c8fd6" opacity="0.35"/>`,
  ).join("");
  const fence = Array.from({ length: 14 }, (_, i) => `<rect x="${40 + i * 60}" y="196" width="6" height="26" rx="3" fill="#3a2c55"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.skyTop}"/><stop offset="1" stop-color="#2b2a5e"/></linearGradient></defs>
  <rect width="100%" height="130" fill="url(#sky)"/>
  ${stars}
  <circle cx="230" cy="64" r="30" fill="#f7eccb"/><circle cx="230" cy="64" r="56" fill="#fff3c4" opacity="0.06"/>
  <!-- the sea, with the moon's reflection -->
  <rect x="0" y="120" width="${W}" height="110" fill="#1f2a5a"/>
  <rect x="0" y="120" width="${W}" height="8" fill="#2a3870"/>
  ${sea}
  ${[0, 1, 2, 3, 4].map((i) => `<rect x="${210 - i * 4}" y="${134 + i * 16}" width="${40 + i * 8}" height="3" rx="1.5" fill="#f7eccb" opacity="${0.5 - i * 0.08}"/>`).join("")}
  <path d="M640 128 Q690 104 760 128 Z" fill="#18214a"/><path d="M60 128 Q120 112 180 128 Z" fill="#18214a"/>
  <!-- the clifftop -->
  <path d="M0 214 Q160 196 360 210 Q620 226 820 206 Q1020 190 ${W} 210 L${W} ${H} L0 ${H} Z" fill="#33285a"/>
  <path d="M0 214 Q160 196 360 210 Q620 226 820 206 Q1020 190 ${W} 210 L${W} 226 Q1000 208 820 222 Q600 242 360 226 Q160 212 0 230 Z" fill="#3f3270"/>
  <rect x="0" y="196" width="860" height="4" rx="2" fill="#3a2c55"/>${fence}
  <g fill="#2c2350">${[[80, 340, 46], [460, 600, 60], [700, 470, 40], [1120, 640, 54]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${(r as number) / 3}"/>`).join("")}</g>
  <path d="M${W + 20} 520 Q900 560 700 480 Q520 420 360 470" stroke="${C.path}" stroke-width="80" stroke-linecap="round" fill="none" opacity="0.7"/>
  ${signpost(1128, 492, "Town Square", false)}
</svg>`;
}

export function cryptSvg(): string {
  const tiles = Array.from({ length: 10 }, (_, row) =>
    Array.from({ length: 11 }, (_, col) => {
      const x = col * 120 - (row % 2) * 60;
      const y = 250 + row * 48;
      // Floor flagstones: lighter and larger than the wall bricks, so floor and wall read apart.
      return `<rect x="${x + 3}" y="${y + 3}" width="114" height="42" rx="8" fill="${rand(row * 13 + col) > 0.5 ? "#3d3368" : "#382f61"}"/>`;
    }).join(""),
  ).join("");
  const alcoves = [140, 420, 780, 1060]
    .map(
      (x) => `<path d="M${x - 46} 236 L${x - 46} 120 Q${x} 64 ${x + 46} 120 L${x + 46} 236 Z" fill="#15112a"/>
      <rect x="${x - 7}" y="166" width="14" height="22" rx="3" fill="#d9f5ec"/>
      <path d="M${x} 166 Q${x + 6} 156 ${x} 146 Q${x - 6} 156 ${x} 166 Z" fill="#7fe0c8"/>
      <ellipse cx="${x}" cy="226" rx="22" ry="8" fill="#2e2452"/>
      <path d="M${x - 14} 222 Q${x - 14} 198 ${x} 196 Q${x + 14} 198 ${x + 14} 222 Z" fill="#4e4284"/>`,
    )
    .join("");
  const webs = [
    `M0 0 L120 0 M0 0 L0 120 M0 0 L90 90 M30 0 Q22 22 0 30 M70 0 Q56 56 0 70`,
    `M${W} 0 L${W - 120} 0 M${W} 0 L${W} 120 M${W} 0 L${W - 90} 90 M${W - 30} 0 Q${W - 22} 22 ${W} 30 M${W - 70} 0 Q${W - 56} 56 ${W} 70`,
  ]
    .map((d) => `<path d="${d}" stroke="#d9d2ee" stroke-width="1.2" fill="none" opacity="0.25"/>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="100%" height="250" fill="#1f1936"/>
  ${Array.from({ length: 6 }, (_, r) => Array.from({ length: 13 }, (_, c) => `<rect x="${c * 100 - (r % 2) * 50 + 2}" y="${r * 40 + 2}" width="96" height="36" rx="4" fill="#241d3f"/>`).join("")).join("")}
  ${alcoves}
  <rect x="0" y="236" width="${W}" height="16" fill="#2e2452"/>
  <rect x="0" y="250" width="${W}" height="${H - 250}" fill="#2a2249"/>
  ${tiles}
  <rect x="0" y="250" width="${W}" height="12" fill="#120e24" opacity="0.6"/>
  <!-- stairs up to the town on the left -->
  ${[0, 1, 2, 3].map((i) => `<rect x="${0}" y="${420 + i * 26}" width="${70 - i * 12}" height="24" rx="4" fill="${i % 2 ? "#3a3062" : "#433a72"}"/>`).join("")}
  ${webs}
  ${signpost(84, 404, "Town Square", true)}
</svg>`;
}

/** The background art for a public area. */
export function areaSvg(area: AreaId): string {
  return area === "lighthouse" ? lighthouseSvg() : area === "crypt" ? cryptSvg() : plazaSvg();
}

// --- Lighthouse and crypt props (walk-behind sprites) ---

function lighthouseArt(): string {
  return `<ellipse cx="905" cy="300" rx="96" ry="20" fill="${C.shadow}"/>
  <ellipse cx="905" cy="292" rx="84" ry="22" fill="#4e4284"/>
  <path d="M862 290 L878 90 L932 90 L948 290 Z" fill="#e8e1f7"/>
  <path d="M862 290 L878 90 L896 90 L886 290 Z" fill="#cfc6ea"/>
  ${[0, 1, 2].map((i) => `<path d="M${866 + i * 5.3} ${250 - i * 60} L${944 - i * 5.3} ${250 - i * 60} L${941 - i * 5.3} ${222 - i * 60} L${869 + i * 5.3} ${222 - i * 60} Z" fill="#7138cc"/>`).join("")}
  <rect x="893" y="246" width="24" height="44" rx="12" fill="#2b2348"/>
  <rect x="866" y="80" width="78" height="12" rx="4" fill="#2b2348"/>
  <rect x="878" y="44" width="54" height="38" rx="6" fill="#ffe2a3"/>
  <rect x="878" y="44" width="16" height="38" rx="5" fill="#fff4d6"/>
  <path d="M870 46 Q905 10 940 46 Z" fill="#2b2348"/>`;
}

const boulderArt = `<ellipse cx="355" cy="318" rx="62" ry="14" fill="${C.shadow}"/>
  <path d="M296 316 Q300 270 344 262 Q392 258 410 300 Q414 320 400 322 L304 322 Z" fill="#4e4284"/>
  <path d="M296 316 Q300 270 344 262 Q330 286 334 322 L304 322 Z" fill="#5f529c"/>`;

const rockArt = `<ellipse cx="165" cy="560" rx="52" ry="12" fill="${C.shadow}"/>
  <path d="M120 556 Q126 524 160 520 Q200 520 210 552 Q206 562 196 562 L128 562 Z" fill="#4e4284"/>`;

function pillarArt(x: number, y: number): string {
  return `<ellipse cx="${x}" cy="${y + 42}" rx="40" ry="10" fill="${C.shadow}"/>
  <rect x="${x - 30}" y="${y + 10}" width="60" height="30" rx="6" fill="#4e4284"/>
  <rect x="${x - 20}" y="${y - 150}" width="40" height="164" rx="6" fill="#5f529c"/>
  <rect x="${x - 20}" y="${y - 150}" width="14" height="164" rx="5" fill="#6c62a0"/>
  <rect x="${x - 30}" y="${y - 162}" width="60" height="16" rx="6" fill="#4e4284"/>`;
}

const sarcophagusArt = `<ellipse cx="600" cy="436" rx="100" ry="14" fill="${C.shadow}"/>
  <rect x="520" y="372" width="160" height="60" rx="10" fill="#4e4284"/>
  <rect x="512" y="358" width="176" height="22" rx="10" fill="#6a5c9e"/>
  <path d="M584 362 L584 352 Q600 336 616 352 L616 362 Z" fill="#b080ff" opacity="0.8"/>
  <circle cx="595" cy="352" r="1.8" fill="#2e2452"/><circle cx="605" cy="352" r="1.8" fill="#2e2452"/>`;

/** The upright props of an area, each its own depth-sorted sprite. */
export function areaProps(area: AreaId): PropSprite[] {
  if (area === "lighthouse") {
    return [
      prop("l-lighthouse", lighthouseArt(), 800, 0, 210, 326, 292),
      prop("l-boulder", boulderArt, 288, 252, 134, 86, 316),
      prop("l-rock", rockArt, 108, 512, 114, 64, 558),
    ];
  }
  if (area === "crypt") {
    return [
      prop("c-sarcophagus", sarcophagusArt, 496, 330, 208, 124, 407),
      ...CRYPT_PILLARS.map((p, i) => prop(`c-pillar-${i}`, pillarArt(p.x, p.y), p.x - 42, p.y - 166, 84, 222, p.y + 25)),
    ];
  }
  return plazaProps();
}
