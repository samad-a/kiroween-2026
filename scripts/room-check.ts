// Browser check for Phase 3 haunted rooms: join, buy a decoration, visit your
// room, place the decoration, and return to the plaza. Screenshots to screenshots/.
// Usage: node node_modules/tsx/dist/cli.mjs scripts/room-check.ts   (dev servers must be running)
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright-core";

const URL = "http://localhost:5173/";
mkdirSync("screenshots", { recursive: true });

const browser = await chromium.launch({ channel: "msedge", headless: true });
const errors: string[] = [];

async function join(name: string): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: 1200, height: 760 } });
  page.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${name} console: ${m.text()}`));
  await page.goto(URL);
  await page.fill("#name-input", name);
  await page.click("#join-button");
  await page.waitForSelector("canvas");
  return page;
}

const page = await join("Decor Dottie");
await page.waitForTimeout(1200);

// Give the player coins the quick way: fish a round near the fountain.
async function clickPlaza(p: Page, x: number, y: number) {
  const box = (await p.locator("canvas").boundingBox())!;
  await p.mouse.click(box.x + (box.width / 1200) * x, box.y + (box.height / 700) * y);
}
await clickPlaza(page, 600, 500);
await page.waitForTimeout(3000);
await page.waitForSelector("#fish-prompt:not([hidden])", { timeout: 5000 });
await page.click("#fish-prompt");
for (let i = 0; i < 10; i++) {
  await page.click("#fish-cast");
  await page.waitForTimeout(850);
}
await page.click("#fish-stop");
await page.waitForTimeout(500);

// Buy a decoration (Paper Lantern, 15 coins).
await page.click("#shop-button");
await page.waitForSelector("#shop:not([hidden])");
const lanternBuy = page.locator("#shop-list li", { hasText: "Paper Lantern" }).locator("button");
if (await lanternBuy.count()) await lanternBuy.click();
await page.waitForTimeout(500);
await page.click("#shop-close");

// Visit own room.
await page.click("#room-button");
await page.waitForSelector("#room-controls:not([hidden])", { timeout: 8000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: "screenshots/10-my-room.png" });

// Open the editor and place the lantern.
await page.click("#hud button:has-text('Decorate')");
await page.waitForSelector("#room-editor:not([hidden])");
const place = page.locator("#decor-list li", { hasText: "Paper Lantern" }).locator("button");
let placed = false;
if (await place.count()) {
  await place.click();
  await page.waitForTimeout(800);
  placed = true;
}
await page.screenshot({ path: "screenshots/11-room-decorated.png" });

// Close the editor (it overlaps the return control) then return to plaza.
await page.click("#room-editor-close");
await page.waitForTimeout(200);
await page.click("#return-plaza");
await page.waitForSelector("#fishing:not([hidden])", { timeout: 8000 });
await page.waitForTimeout(800);
await page.screenshot({ path: "screenshots/12-back-in-plaza.png" });

await browser.close();
console.log(`placed decoration: ${placed}`);
console.log(errors.length ? `ERRORS:\n${errors.join("\n")}` : "NO_PAGE_ERRORS");
console.log("ROOM_CHECK_DONE");
