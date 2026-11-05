import Phaser from "phaser";
import {
  GHOST_COLOURS,
  OBSTACLES,
  PLAZA_HEIGHT,
  PLAZA_WIDTH,
  SHOP_ITEMS,
  cleanName,
  getCatch,
  randomName,
} from "@club-kiro/shared";
import {
  endFishing,
  joinPlaza,
  onBought,
  onCaretakerNote,
  onDenied,
  onFishCatch,
  onFishEnded,
  onFishStarted,
  onWallet,
  saveRecoveryCode,
  sendBuy,
  sendCast,
  sendChat,
  startFishing,
  type PlazaRoom,
} from "./net";
import { PlazaScene } from "./scenes/PlazaScene";

const COLOUR_NAMES = ["Moonlight", "Lavender", "Mint", "Pumpkin", "Rose", "Sky"];

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const form = $<HTMLFormElement>("join-form");
const nameInput = $<HTMLInputElement>("name-input");
const nameError = $<HTMLParagraphElement>("name-error");
const status = $<HTMLParagraphElement>("join-status");
const joinButton = $<HTMLButtonElement>("join-button");

// Colour swatches as real radio buttons, so they work with keyboard and screen readers.
const swatches = $<HTMLDivElement>("colour-options");
GHOST_COLOURS.forEach((hex, i) => {
  const label = document.createElement("label");
  label.style.background = hex;
  label.title = COLOUR_NAMES[i] ?? `Colour ${i + 1}`;
  const input = document.createElement("input");
  input.type = "radio";
  input.name = "colour";
  input.value = String(i);
  input.checked = i === 0;
  input.setAttribute("aria-label", COLOUR_NAMES[i] ?? `Colour ${i + 1}`);
  label.append(input);
  swatches.append(label);
});

nameInput.value = randomName();
$<HTMLButtonElement>("random-name").addEventListener("click", () => {
  nameInput.value = randomName();
  nameError.hidden = true;
  nameInput.focus();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = cleanName(nameInput.value);
  if (!name) {
    nameError.hidden = false;
    nameInput.setAttribute("aria-invalid", "true");
    nameInput.focus();
    return;
  }
  nameError.hidden = true;
  nameInput.removeAttribute("aria-invalid");
  const colour = Number(new FormData(form).get("colour") ?? 0);

  joinButton.disabled = true;
  status.textContent = "Drifting into the plaza…";
  try {
    const room = await joinPlaza({ name, colour });
    $("join").hidden = true;
    $("help").hidden = false;
    $("chat").hidden = false;
    $("hud").hidden = false;
    $("fishing").hidden = false;
    // Register message handlers synchronously so the join-time wallet is not missed.
    wireWalletAndShop(room);
    wireFishing(room);
    startGame(room);
    wireChat(room);
  } catch (error) {
    console.error(error);
    status.textContent = "The plaza gates are stuck. Is the server running? Try again in a moment.";
    joinButton.disabled = false;
  }
});

function startGame(room: Awaited<ReturnType<typeof joinPlaza>>) {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    width: PLAZA_WIDTH,
    height: PLAZA_HEIGHT,
    backgroundColor: "#0f0a22",
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  });
  game.scene.add("plaza", PlazaScene, true, { room });
  game.canvas.setAttribute("tabindex", "0");
  game.canvas.focus();
}

function wireChat(room: PlazaRoom) {
  const chatForm = $<HTMLFormElement>("chat-form");
  const chatInput = $<HTMLInputElement>("chat-input");
  const note = $<HTMLParagraphElement>("caretaker-note");
  const resting = $<HTMLParagraphElement>("caretaker-resting");

  chatForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;
    sendChat(room, text);
    chatInput.value = "";
  });

  // The Caretaker's private nudges and blocks, shown only to this player.
  let noteTimer = 0;
  onCaretakerNote(room, (n) => {
    note.textContent = (n.kind === "block" ? "🕯️ " : "👻 ") + n.text;
    note.hidden = false;
    window.clearTimeout(noteTimer);
    noteTimer = window.setTimeout(() => (note.hidden = true), 6000);
  });

  // "Caretaker is resting" banner follows the synced state. Polling is simplest
  // and avoids the SDK's generic state-callback typing; the value changes rarely.
  let lastResting: boolean | undefined;
  window.setInterval(() => {
    const value = room.state.caretakerResting === true;
    if (value !== lastResting) {
      lastResting = value;
      resting.hidden = !value;
    }
  }, 1000);
}

// The fountain is the first obstacle; its centre is where you fish.
const FOUNTAIN = OBSTACLES[0]!;
const FOUNTAIN_CENTRE = { x: FOUNTAIN.x + FOUNTAIN.width / 2, y: FOUNTAIN.y + FOUNTAIN.height / 2 };
const FISH_RANGE = 160; // how close a ghost must be to cast

const owned = new Set<string>();

function setCoins(n: number) {
  $<HTMLSpanElement>("coin-count").textContent = String(n);
}

function wireWalletAndShop(room: PlazaRoom) {
  const shopButton = $<HTMLButtonElement>("shop-button");
  const shop = $<HTMLElement>("shop");
  const list = $<HTMLUListElement>("shop-list");
  const recoveryButton = $<HTMLButtonElement>("recovery-button");
  const recovery = $<HTMLElement>("recovery");
  const recoveryCode = $<HTMLParagraphElement>("recovery-code");

  const renderShop = () => {
    list.replaceChildren();
    const coins = Number($<HTMLSpanElement>("coin-count").textContent) || 0;
    for (const item of SHOP_ITEMS) {
      const li = document.createElement("li");
      const has = owned.has(item.id);
      if (has) li.classList.add("owned");
      const info = document.createElement("div");
      info.innerHTML = `<div class="item-name">${item.name}</div><div class="item-kind">${item.kind} · 🪙 ${item.price}</div>`;
      li.append(info);
      if (has) {
        const tag = document.createElement("span");
        tag.className = "owned-tag";
        tag.textContent = "Owned";
        li.append(tag);
      } else {
        const buy = document.createElement("button");
        buy.type = "button";
        buy.textContent = "Buy";
        buy.disabled = coins < item.price;
        buy.addEventListener("click", () => {
          buy.disabled = true;
          sendBuy(room, item.id);
        });
        li.append(buy);
      }
      list.append(li);
    }
  };

  const toggle = (panel: HTMLElement, open: boolean) => {
    panel.hidden = !open;
    if (open) panel.querySelector<HTMLElement>("button, [tabindex]")?.focus();
  };

  shopButton.addEventListener("click", () => {
    renderShop();
    toggle(shop, shop.hidden !== false);
  });
  $<HTMLButtonElement>("shop-close").addEventListener("click", () => toggle(shop, false));
  recoveryButton.addEventListener("click", () => toggle(recovery, recovery.hidden !== false));
  $<HTMLButtonElement>("recovery-close").addEventListener("click", () => toggle(recovery, false));

  onWallet(room, (wallet) => {
    setCoins(wallet.coins);
    owned.clear();
    for (const id of wallet.items) owned.add(id);
    recoveryCode.textContent = wallet.recoveryCode;
    saveRecoveryCode(wallet.recoveryCode);
    if (!shop.hidden) renderShop();
  });

  onBought(room, (msg) => {
    owned.add(msg.itemId);
    setCoins(msg.balance);
    if (!shop.hidden) renderShop();
  });

  onDenied(room, (msg) => {
    // Re-render to restore the button state; a quick note is enough.
    if (!shop.hidden) renderShop();
    window.alert(msg.reason === "owned" ? "You already own that." : "Not enough coins yet.");
  });
}

function wireFishing(room: PlazaRoom) {
  const prompt = $<HTMLButtonElement>("fish-prompt");
  const roundPanel = $<HTMLElement>("fish-round");
  const timer = $<HTMLParagraphElement>("fish-timer");
  const result = $<HTMLParagraphElement>("fish-result");
  const marker = $<HTMLDivElement>("fish-marker");
  const castButton = $<HTMLButtonElement>("fish-cast");
  const stopButton = $<HTMLButtonElement>("fish-stop");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let active = false;
  let endsAt = 0;
  let markerRaf = 0;
  let markerPos = 0; // 0..1 across the bar

  const nearFountain = (): boolean => {
    const me = room.state.ghosts?.get(room.sessionId);
    if (!me) return false;
    return Math.hypot(me.x - FOUNTAIN_CENTRE.x, me.y - FOUNTAIN_CENTRE.y) <= FISH_RANGE;
  };

  // Show the "cast a line" prompt only when near the fountain and not already fishing.
  window.setInterval(() => {
    prompt.hidden = active || !nearFountain();
  }, 300);

  const animateMarker = (t: number) => {
    // A triangle wave 0..1..0; reduced motion uses a slow step instead.
    const period = reducedMotion ? 2400 : 1100;
    const phase = (t % period) / period;
    markerPos = phase < 0.5 ? phase * 2 : 2 - phase * 2;
    marker.style.left = `${markerPos * 100}%`;
    markerRaf = requestAnimationFrame(animateMarker);
  };

  // Accuracy 1 at bar centre (0.5), falling to 0 at the edges of the target zone.
  const accuracyFrom = (pos: number): number => Math.max(0, 1 - Math.abs(pos - 0.5) / 0.1);

  const startRound = () => {
    active = true;
    prompt.hidden = true;
    roundPanel.hidden = false;
    result.textContent = "Click Cast when the marker hits the glowing zone.";
    castButton.disabled = false;
    castButton.focus();
    markerRaf = requestAnimationFrame(animateMarker);
    startFishing(room);
  };

  const stopRound = () => {
    if (!active) return;
    active = false;
    cancelAnimationFrame(markerRaf);
    roundPanel.hidden = true;
    endFishing(room);
  };

  prompt.addEventListener("click", startRound);
  stopButton.addEventListener("click", stopRound);
  castButton.addEventListener("click", () => {
    if (!active) return;
    sendCast(room, accuracyFrom(markerPos));
  });

  onFishStarted(room, (msg) => {
    endsAt = Date.now() + msg.roundMs;
  });

  onFishCatch(room, (msg) => {
    const kind = getCatch(msg.catchId);
    result.textContent = `You caught ${kind.name}! +${msg.coins} 🪙`;
  });

  onFishEnded(room, (msg) => {
    active = false;
    cancelAnimationFrame(markerRaf);
    roundPanel.hidden = true;
    setCoins(msg.balance);
  });

  // Tick the visible timer; auto-stop when the round's time is up.
  window.setInterval(() => {
    if (!active) return;
    const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
    timer.textContent = `${left}s`;
    if (left <= 0) stopRound();
  }, 250);
}
