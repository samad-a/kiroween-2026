// SVG + contrast check. Run by a Kiro hook when an SVG, the art modules or the
// stylesheet are saved, or by hand: `npm run svg-check [files...]`.
//
// 1. .svg files are optimised in place with svgo (only written if smaller).
// 2. Every text colour pair the game uses is checked against WCAG AA (4.5:1 for
//    body text, 3:1 for large/bold UI text). UI pairs are read from the CSS
//    variables in client/src/style.css; in-world text pairs mirror the art code.
//
// CLI mode exits 1 if any pair fails. Hook mode (stdin piped) always exits 0,
// because a save can't be blocked; it just reports.
import { readFileSync, writeFileSync } from "node:fs";
import { optimize } from "svgo";

const DEFAULT_SVGS = ["client/public/favicon.svg"];
const CSS = "client/src/style.css";

// --- Which files? ---------------------------------------------------------

const fromHook = !process.stdin.isTTY && process.argv.length <= 2;
let files = process.argv.slice(2);
if (fromHook) {
  let input = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) input += chunk;
  // The hook payload's shape may vary, so pick out any .svg path mentioned in it.
  files = [...new Set(input.match(/[\w./\\:-]+\.svg/g) ?? [])];
}
const svgs = (files.length ? files : DEFAULT_SVGS).filter((f) => f.endsWith(".svg"));

// --- 1. svgo ----------------------------------------------------------------

for (const file of svgs) {
  try {
    const before = readFileSync(file, "utf8");
    const { data } = optimize(before, { path: file, multipass: true });
    if (data.length < before.length) {
      writeFileSync(file, data);
      console.log(`svgo  ${file}: ${before.length} -> ${data.length} bytes`);
    } else {
      console.log(`svgo  ${file}: already optimal`);
    }
  } catch (err) {
    console.log(`svgo  ${file}: skipped (${err.message})`);
  }
}

// --- 2. Contrast ------------------------------------------------------------

const hexToRgb = (hex) => {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h.slice(0, 6);
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const luminance = ([r, g, b]) => {
  const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const ratio = (a, b) => {
  const [hi, lo] = [luminance(hexToRgb(a)), luminance(hexToRgb(b))].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
/** A translucent colour over a background, as the eye sees it. */
const over = (fg, alpha, bg) => {
  const f = hexToRgb(fg);
  const b = hexToRgb(bg);
  return "#" + f.map((c, i) => Math.round(c * alpha + b[i] * (1 - alpha)).toString(16).padStart(2, "0")).join("");
};

const vars = Object.fromEntries([...readFileSync(CSS, "utf8").matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,8})\b/g)].map((m) => [m[1], m[2]]));
const v = (name) => vars[name] ?? (console.log(`contrast: --${name} not found in ${CSS}`), "#000000");

// [what, foreground, background, minimum]
const PAIRS = [
  ["Body text on the page", v("text"), v("page"), 4.5],
  ["Body text on panels", v("text"), v("surface"), 4.5],
  ["Text on cards and inputs", v("text"), v("surface-2"), 4.5],
  ["Muted text on panels", v("muted"), v("surface"), 4.5],
  ["Muted text on cards", v("muted"), v("surface-2"), 4.5],
  ["Button label on primary", "#ffffff", v("primary"), 4.5],
  ["Button label on primary (hover)", "#ffffff", v("primary-hover"), 4.5],
  ["Headings / highlights (violet)", v("violet"), v("surface"), 3],
  ["Coins (amber) on cards", v("amber"), v("surface-2"), 3],
  ["Caretaker name (mint)", v("mint"), v("surface"), 3],
  ["Errors (danger) on panels", v("danger"), v("surface"), 4.5],
  // In-world text. These mirror ghostParts.ts (name tags, bubbles) and worldArt.ts (signposts).
  ["Speech bubble text", "#2b1d0e", "#fbf3df", 4.5],
  ["Your name tag", "#ffcf7a", over("#120b26", 0.72, "#372a5c"), 3],
  ["Other ghosts' name tags", "#f4f1ff", over("#120b26", 0.72, "#372a5c"), 4.5],
  ["Caretaker name tag", "#7fe0c8", over("#120b26", 0.72, "#372a5c"), 3],
  ["Signpost text", "#f3eaff", "#6b4c86", 4.5],
];

let failed = 0;
console.log("\ncontrast (WCAG AA)");
for (const [what, fg, bg, min] of PAIRS) {
  const r = ratio(fg, bg);
  const ok = r >= min;
  if (!ok) failed++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${r.toFixed(2).padStart(5)}:1 (needs ${min}:1)  ${what}  ${fg} on ${bg}`);
}
console.log(failed ? `\n${failed} pair(s) below WCAG AA.` : "\nAll text pairs meet WCAG AA.");
process.exit(failed && !fromHook ? 1 : 0);
