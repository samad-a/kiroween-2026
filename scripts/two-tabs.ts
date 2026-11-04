// Browser check for Phase 1: two windows join the plaza, one ghost walks,
// and both windows show both ghosts. Saves screenshots to screenshots/.
// Uses the system Microsoft Edge so no browser download is needed.
// Usage: node node_modules/tsx/dist/cli.mjs scripts/two-tabs.ts   (dev servers must be running)
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright-core";

const URL = "http://localhost:5173/";
mkdirSync("screenshots", { recursive: true });

const browser = await chromium.launch({ channel: "msedge", headless: true });
const errors: string[] = [];

async function joinAs(name: string, colourIndex: number): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: 1200, height: 760 } });
  page.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${name} console: ${m.text()}`));
  await page.goto(URL);
  await page.fill("#name-input", name);
  await page.locator(`#colour-options input[value="${colourIndex}"]`).check();
  return page;
}

const a = await joinAs("Lantern Lou", 3);
await a.screenshot({ path: "screenshots/01-join.png" });
await a.click("#join-button");
await a.waitForSelector("canvas");

const b = await joinAs("Misty Moth", 1);
await b.click("#join-button");
await b.waitForSelector("canvas");
await b.waitForTimeout(1500);

// Walk Lou to the left side of the plaza by clicking the canvas.
const box = (await a.locator("canvas").boundingBox())!;
await a.mouse.click(box.x + box.width * 0.2, box.y + box.height * 0.75);
await a.waitForTimeout(3500); // let the click-walk finish before the keyboard overrides it
await a.screenshot({ path: "screenshots/02-plaza-window-a.png" });
await b.screenshot({ path: "screenshots/03-plaza-window-b.png" });

// Then float up with the keyboard.
await a.keyboard.down("KeyW");
await a.waitForTimeout(1000);
await a.keyboard.up("KeyW");
await a.waitForTimeout(1000);
await b.screenshot({ path: "screenshots/04-after-keys-window-b.png" });

await browser.close();
console.log(errors.length ? `ERRORS:\n${errors.join("\n")}` : "NO_PAGE_ERRORS");
console.log("TWO_TABS_DONE");
