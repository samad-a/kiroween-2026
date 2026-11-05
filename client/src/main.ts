import Phaser from "phaser";
import {
  GHOST_COLOURS,
  OBSTACLES,
  PLAZA_HEIGHT,
  PLAZA_WIDTH,
  SHOP_ITEMS,
  cleanName,
  getCatch,
  parseRecoveryCode,
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
  joinHauntedRoom,
  placeItem,
  removeItem,
  sendBuy,
  sendCast,
  sendChat,
  sendSetHat,
  startFishing,
  type HauntedRoomClient,
  type PlazaRoom,
} from "./net";
import { PlazaScene } from "./scenes/PlazaScene";
import { RoomScene } from "./scenes/RoomScene";
import { applyBodyClass, muted, setMuted, setReduceMotion, reduceMotion } from "./settings";
import { makeModal } from "./modal";
import { ghostSvg, itemPreviewUrl, svgUrl } from "./art";

const COLOUR_NAMES = ["Moonlight", "Lavender", "Mint", "Pumpkin", "Rose", "Sky"];
const COIN_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#ffcf7a" stroke="#c98a2b" stroke-width="2"/><circle cx="12" cy="12" r="5.5" fill="none" stroke="#c98a2b" stroke-width="1.6"/></svg>`;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** A short, non-blocking message at the top of the screen. */
let toastTimer = 0;
function showToast(text: string) {
  const toast = $<HTMLParagraphElement>("toast");
  toast.textContent = text;
  toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toast.hidden = true), 3000);
}

/** A shop-style card: preview, name and price. The caller appends the action. */
function itemCard(item: (typeof SHOP_ITEMS)[number], showPrice: boolean): HTMLLIElement {
  const li = document.createElement("li");
  li.className = "card";
  const preview = document.createElement("div");
  preview.className = "preview";
  const img = document.createElement("img");
  img.src = itemPreviewUrl(item.id);
  img.alt = "";
  preview.append(img);
  const name = document.createElement("div");
  name.className = "item-name";
  name.textContent = item.name;
  li.append(preview, name);
  if (showPrice) {
    const price = document.createElement("div");
    price.className = "price";
    price.innerHTML = COIN_SVG;
    price.append(String(item.price));
    li.append(price);
  }
  return li;
}

function sectionTitle(text: string): HTMLLIElement {
  const li = document.createElement("li");
  li.className = "section-title";
  li.textContent = text;
  return li;
}
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

// The join card shows your ghost in the colour you pick.
const joinGhost = $<HTMLImageElement>("join-ghost");
const showJoinGhost = () => {
  const i = Number(new FormData(form).get("colour") ?? 0);
  joinGhost.src = svgUrl(ghostSvg(GHOST_COLOURS[i] ?? GHOST_COLOURS[0]!));
};
swatches.addEventListener("change", showJoinGhost);
showJoinGhost();

nameInput.value = randomName();
$<HTMLButtonElement>("random-name").addEventListener("click", () => {
  nameInput.value = randomName();
  nameError.hidden = true;
  nameInput.focus();
});

// Reflect the saved reduced-motion preference before anything renders.
applyBodyClass();

// "Restore with a recovery code" reveals an input on the join screen.
const restoreToggle = $<HTMLButtonElement>("restore-toggle");
const restoreRow = $<HTMLDivElement>("restore-row");
const restoreInput = $<HTMLInputElement>("restore-input");
restoreToggle.addEventListener("click", () => {
  const show = restoreRow.hidden;
  restoreRow.hidden = !show;
  if (show) restoreInput.focus();
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

  // If the player typed a recovery code, store it so the join uses it to restore.
  const typedCode = parseRecoveryCode(restoreInput.value);
  if (typedCode) saveRecoveryCode(typedCode);

  joinButton.disabled = true;
  status.textContent = "Drifting into the plaza…";
  try {
    identity = { name, colour }; // remembered for re-joining after a room visit
    const room = await joinPlaza({ name, colour });
    plazaRoom = room;
    $("join").hidden = true;
    $("help").hidden = false;
    window.setTimeout(() => $("help").classList.add("gone"), 10_000);
    $("chat").hidden = false;
    $("hud").hidden = false;
    $("fishing").hidden = false;
    // Register message handlers synchronously so the join-time wallet is not missed.
    wireWalletAndShop(room);
    wireFishing(room);
    wireRooms(); // sets onVisitGhost before the scene is created
    startGame(room);
    wireChat(room);
    wireSettings();
    startMusic(); // after the join gesture, honouring the mute preference
  } catch (error) {
    console.error(error);
    status.textContent = "The plaza gates are stuck. Is the server running? Try again in a moment.";
    joinButton.disabled = false;
  }
});

function newGame(): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    width: PLAZA_WIDTH,
    height: PLAZA_HEIGHT,
    backgroundColor: "#0f0a22",
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  });
  return game;
}

function startGame(room: Awaited<ReturnType<typeof joinPlaza>>) {
  currentGame?.destroy(true);
  currentGame = newGame();
  currentGame.scene.add("plaza", PlazaScene, true, { room, onVisit: onVisitGhost });
  currentGame.canvas.setAttribute("tabindex", "0");
  currentGame.canvas.focus();
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
let wornHat = ""; // the shop item id of the currently-worn hat, or ""
let identity: { name: string; colour: number } = { name: "", colour: 0 };
let plazaRoom: PlazaRoom | undefined;
let roomClient: HauntedRoomClient | undefined;
let currentGame: Phaser.Game | undefined;
/** Set by wireRooms; lets the plaza scene offer a visit when a ghost is clicked. */
let onVisitGhost: ((ownerPlayerId: number, name: string) => void) | undefined;

function setCoins(n: number) {
  const count = $<HTMLSpanElement>("coin-count");
  const before = Number(count.textContent) || 0;
  count.textContent = String(n);
  if (n > before) {
    // Restart the little bump animation each time coins go up.
    const pill = $("coins");
    pill.classList.remove("bump");
    void pill.offsetWidth;
    pill.classList.add("bump");
  }
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
    let lastKind = "";
    for (const item of SHOP_ITEMS) {
      if (item.kind !== lastKind) {
        lastKind = item.kind;
        list.append(sectionTitle(item.kind === "hat" ? "Hats" : "Room decorations"));
      }
      const has = owned.has(item.id);
      const li = itemCard(item, !has);
      if (has) li.classList.add("owned");
      if (wornHat === item.id) li.classList.add("wearing");
      if (has) {
        if (item.kind === "hat") {
          // Owned hats can be worn or taken off.
          const wear = document.createElement("button");
          wear.type = "button";
          const wearing = wornHat === item.id;
          wear.textContent = wearing ? "Take off" : "Wear";
          wear.addEventListener("click", () => {
            wornHat = wearing ? "" : item.id;
            sendSetHat(room, wornHat);
            renderShop();
          });
          li.append(wear);
        } else {
          const tag = document.createElement("span");
          tag.className = "tag";
          tag.textContent = "Owned";
          li.append(tag);
        }
      } else {
        const buy = document.createElement("button");
        buy.type = "button";
        buy.textContent = coins < item.price ? `Need ${item.price - coins} more` : "Buy";
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

  const shopModal = makeModal(shop);
  const recoveryModal = makeModal(recovery);

  shopButton.addEventListener("click", () => {
    if (shopModal.isOpen) {
      shopModal.close();
    } else {
      renderShop();
      shopModal.open();
    }
  });
  $<HTMLButtonElement>("shop-close").addEventListener("click", () => shopModal.close());
  // The recovery button lives in Settings; swap one dialog for the other.
  recoveryButton.addEventListener("click", () => {
    if (!$("settings").hidden) $<HTMLButtonElement>("settings-close").click();
    recoveryModal.open();
  });
  $<HTMLButtonElement>("recovery-close").addEventListener("click", () => recoveryModal.close());
  $<HTMLButtonElement>("recovery-copy").addEventListener("click", () => {
    void navigator.clipboard?.writeText(recoveryCode.textContent ?? "").then(() => showToast("Code copied"));
  });

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
    showToast(msg.reason === "owned" ? "You already own that." : "Not enough coins yet.");
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

function wireSettings() {
  const settings = $<HTMLElement>("settings");
  const motion = $<HTMLInputElement>("set-reduce-motion");
  const mute = $<HTMLInputElement>("set-mute");

  motion.checked = reduceMotion();
  mute.checked = muted();

  motion.addEventListener("change", () => setReduceMotion(motion.checked));
  mute.addEventListener("change", () => {
    setMuted(mute.checked);
    applyMute();
  });

  const settingsModal = makeModal(settings);
  $<HTMLButtonElement>("settings-button").addEventListener("click", () =>
    settingsModal.isOpen ? settingsModal.close() : settingsModal.open(),
  );
  $<HTMLButtonElement>("settings-close").addEventListener("click", () => settingsModal.close());
}

/** My own player id, read from my ghost's synced ownerId in the plaza. */
function myPlayerId(): number | null {
  const me = plazaRoom?.state.ghosts?.get(plazaRoom.sessionId);
  const id = me?.ownerId ? Number(me.ownerId) : NaN;
  return Number.isFinite(id) && id > 0 ? id : null;
}

function wireRooms() {
  const roomButton = $<HTMLButtonElement>("room-button");
  const roomControls = $<HTMLDivElement>("room-controls");
  const roomOwner = $<HTMLParagraphElement>("room-owner");
  const returnButton = $<HTMLButtonElement>("return-plaza");
  const editor = $<HTMLElement>("room-editor");
  const editorModal = makeModal(editor);
  const decorList = $<HTMLUListElement>("decor-list");
  const editorButton = document.createElement("button");
  editorButton.type = "button";
  editorButton.className = "secondary with-icon";
  editorButton.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4l6 6-9 9H5v-6z"/></svg>Decorate`;

  roomButton.addEventListener("click", () => {
    const id = myPlayerId();
    if (id !== null) void visitRoom(id, true);
  });
  returnButton.addEventListener("click", () => void returnToPlaza());

  // Clicking another ghost in the plaza offers a visit to their room.
  const visitPanel = $<HTMLElement>("visit-prompt");
  const visitText = $<HTMLParagraphElement>("visit-text");
  const visitModal = makeModal(visitPanel);
  let pendingVisit: number | null = null;
  onVisitGhost = (ownerPlayerId, name) => {
    if (ownerPlayerId === myPlayerId()) return; // that's your own ghost
    pendingVisit = ownerPlayerId;
    visitText.textContent = `Drop in on ${name}'s haunted room?`;
    visitModal.open();
  };
  $<HTMLButtonElement>("visit-cancel").addEventListener("click", () => {
    pendingVisit = null;
    visitModal.close();
  });
  $<HTMLButtonElement>("visit-go").addEventListener("click", () => {
    const target = pendingVisit;
    pendingVisit = null;
    visitModal.close();
    if (target !== null) void visitRoom(target, false);
  });
  $<HTMLButtonElement>("room-editor-close").addEventListener("click", () => editorModal.close());
  editorButton.addEventListener("click", () => {
    renderDecorList();
    editorModal.isOpen ? editorModal.close() : editorModal.open();
  });

  const renderDecorList = () => {
    if (!roomClient) return;
    decorList.replaceChildren();
    const ownedDecor = SHOP_ITEMS.filter((i) => i.kind === "decoration" && owned.has(i.id));
    if (ownedDecor.length === 0) {
      const li = document.createElement("li");
      li.className = "empty";
      li.textContent = "Buy decorations in the shop first.";
      decorList.append(li);
      return;
    }
    for (const item of ownedDecor) {
      const li = itemCard(item, false);
      const place = document.createElement("button");
      place.type = "button";
      place.textContent = "Place";
      place.addEventListener("click", () => {
        // Drop near the centre; the owner then drags it where they like.
        if (roomClient) placeItem(roomClient, item.id, PLAZA_WIDTH / 2, PLAZA_HEIGHT / 2);
      });
      li.append(place);
      decorList.append(li);
    }
  };

  async function visitRoom(ownerPlayerId: number, isOwner: boolean) {
    try {
      // Leave the plaza world and open the room world.
      await plazaRoom?.leave();
      roomClient = await joinHauntedRoom(identity, ownerPlayerId);
      currentGame?.destroy(true);
      currentGame = newGame();
      currentGame.scene.add("room", RoomScene, true, { room: roomClient, isOwner });
      currentGame.canvas.setAttribute("tabindex", "0");
      currentGame.canvas.focus();
      // Swap HUD affordances for room ones.
      $("fishing").hidden = true;
      roomControls.hidden = false;
      roomOwner.textContent = isOwner ? "Your haunted room" : `${roomClient.state.ownerName}'s room`;
      roomButton.hidden = true;
      // Owner gets a Decorate button in the HUD.
      if (isOwner && !editorButton.isConnected) $("hud").append(editorButton);
      editorButton.hidden = !isOwner;
    } catch (err) {
      console.error(err);
    }
  }

  async function returnToPlaza() {
    editorModal.close();
    // Leaving the room shouldn't block returning; ignore a noisy leave.
    try {
      await roomClient?.leave();
    } catch (err) {
      console.error("room leave failed (continuing):", err);
    }
    roomClient = undefined;
    try {
      const room = await joinPlaza(identity);
      plazaRoom = room;
      // Re-wear the hat the player had on.
      if (wornHat) sendSetHat(room, wornHat);
      wireWalletAndShop(room);
      wireFishing(room);
      startGame(room);
      wireChat(room);
    } catch (err) {
      console.error(err);
    }
    // Restore the plaza HUD regardless, so the player is never stuck.
    roomControls.hidden = true;
    roomButton.hidden = false;
    editorButton.hidden = true;
    $("fishing").hidden = false;
  }
}

function music(): HTMLAudioElement {
  return $<HTMLAudioElement>("bg-music");
}

function applyMute() {
  const el = music();
  if (muted()) {
    el.pause();
  } else {
    el.volume = 0.3;
    void el.play().catch(() => {}); // ignore autoplay rejection; a later gesture will start it
  }
}

function startMusic() {
  music().volume = 0.3;
  applyMute();
}
