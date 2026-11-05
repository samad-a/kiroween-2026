// Browser check for Phase 3 ghost-fishing: join, walk to the fountain, fish a
// catch, buy a shop item, then reload to confirm coins + ownership persist.
// Uses the system Microsoft Edge so no browser download is needed.
// Usage: node node_modules/tsx/dist/cli.mjs scripts/fishing-check.ts   (dev servers must be running)
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright-core";
import { OBSTACLES } from "@club-kiro/shared";

const URL = "http://localhost:5173/";
mkdirSync("screenshots", { recursive: true });

const fountain = OBSTACLES[0]!;
const centre = { x: fountain.x + fountain.width / 2, y: fountain.y + fountain.height / 2 };

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

const coinCount = async (p: Page): Promise<number> => Number(await p.locator("#coin-count").textContent());

// Map a plaza-space point onto the FIT-scaled canvas.
async function clickPlaza(p: Page, x: number, y: number) {
  const box = (await p.locator("canvas").boundingBox())!;
  const sx = box.width / 1200;
  const sy = box.height / 700;
  await p.mouse.click(box.x + x * sx, box.y + y * sy);
}

const page = await join("Fisher Fay");
await page.waitForTimeout(1000);

// Walk to the fountain so the fishing prompt appears.
await clickPlaza(page, centre.x, centre.y + 150);
await page.waitForTimeout(3000);
await page.waitForSelector("#fish-prompt:not([hidden])", { timeout: 5000 });
await page.screenshot({ path: "screenshots/05-fishing-prompt.png" });

// Start a round and cast a few times.
await page.click("#fish-prompt");
await page.waitForSelector("#fish-round:not([hidden])");
for (let i = 0; i < 6; i++) {
  await page.click("#fish-cast");
  await page.waitForTimeout(900); // respect the server cast cooldown
}
const earnedCoins = await coinCount(page).catch(() => 0);
await page.screenshot({ path: "screenshots/06-fishing-round.png" });

// End the round and read the balance.
await page.click("#fish-stop");
await page.waitForTimeout(500);
const afterFishing = await coinCount(page);
console.log(`coins after fishing: ${afterFishing}`);

// Open the shop and buy the cheapest affordable item.
await page.click("#shop-button");
await page.waitForSelector("#shop:not([hidden])");
await page.screenshot({ path: "screenshots/07-shop.png" });
const firstBuy = page.locator("#shop-list button:not([disabled])").first();
if (await firstBuy.count()) {
  await firstBuy.click();
  await page.waitForTimeout(600);
}
const afterBuy = await coinCount(page);
const ownedCount = await page.locator("#shop-list li.owned").count();
console.log(`coins after buy: ${afterBuy}, owned items: ${ownedCount}`);
await page.screenshot({ path: "screenshots/08-after-buy.png" });

// Reload: the guest id in localStorage should restore coins and ownership.
await page.reload();
await page.fill("#name-input", "Fisher Fay");
await page.click("#join-button");
await page.waitForSelector("canvas");
await page.waitForTimeout(1200);
const afterReload = await coinCount(page);
await page.click("#shop-button");
await page.waitForSelector("#shop:not([hidden])");
const ownedAfterReload = await page.locator("#shop-list li.owned").count();
console.log(`after reload -> coins: ${afterReload}, owned: ${ownedAfterReload}`);
await page.screenshot({ path: "screenshots/09-after-reload.png" });

const persisted = afterReload === afterBuy && ownedAfterReload === ownedCount && ownedAfterReload >= 1;

await browser.close();
console.log(errors.length ? `ERRORS:\n${errors.join("\n")}` : "NO_PAGE_ERRORS");
console.log(persisted ? "PERSIST_OK" : "PERSIST_FAILED");
console.log("FISHING_CHECK_DONE");
