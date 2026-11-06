import Phaser from "phaser";
import {
  CAST_COOLDOWN_MS,
  GHOST_COLOURS,
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
  joinArea,
  sendSetPet,
  joinHauntedRoom,
  addFriend,
  removeFriend,
  requestFriends,
  onFriends,
  startSeance,
  answerSeance,
  endSeance,
  onSeanceShow,
  onSeanceResult,
  joinDash,
  joinDashQueue,
  leaveDashQueue,
  raceAlone,
  onDashQueue,
  onDashStart,
  onDashResults,
  type DashRoomClient,
  placeItem,
  sendBuy,
  sendCast,
  sendChat,
  sendSetHat,
  startFishing,
  type HauntedRoomClient,
  type PlazaRoom,
} from "./net";
import {
  AREAS,
  DASH_GATE,
  DASH_MAPS,
  DASH_MAP_IDS,
  formatRaceTime,
  isDashMapId,
  type DashQueue,
  type DashResults,
  FOUNTAIN_CENTRE,
  exitAt,
  type AreaId,
  type JoinOptions,
  RUNES,
  SEANCE_RANGE,
  SEANCE_SPOT,
  runeShowMs,
  type FriendView,
  type SeanceEndReason,
  type SeanceResult,
  type SeanceShow,
} from "@club-kiro/shared";
import { PlazaScene } from "./scenes/PlazaScene";
import { RoomScene } from "./scenes/RoomScene";
import { DashScene, type DashHud } from "./scenes/DashScene";
import { applyBodyClass, isTyping, muted, setMuted, setReduceMotion, reduceMotion } from "./settings";
import { makeModal } from "./modal";
import { ghostSvg, itemPreviewUrl, svgUrl } from "./art";

const COLOUR_NAMES = ["Moonlight", "Lavender", "Mint", "Pumpkin", "Rose", "Sky"];
const COIN_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#ffb84d"/><circle cx="12" cy="12" r="5.5" fill="none" stroke="#b9741c" stroke-width="2"/></svg>`;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;


// ---------- Session state ----------

const owned = new Set<string>();
let wornHat = ""; // the shop item id of the currently-worn hat, or ""
let wornPet = ""; // the pet that follows you, or ""
let currentArea: AreaId = "plaza";
let identity: { name: string; colour: number } = { name: "", colour: 0 };
/** The plaza room while in the plaza; undefined while visiting a haunted room. */
let plazaRoom: PlazaRoom | undefined;
let roomClient: HauntedRoomClient | undefined;
let currentGame: Phaser.Game | undefined;
let coins = 0;
let recoveryCode = "";

// ---------- Small UI helpers ----------

let toastTimer = 0;
function showToast(text: string) {
  const toast = $<HTMLParagraphElement>("toast");
  toast.textContent = text;
  toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toast.hidden = true), 3000);
}

function setCoins(n: number) {
  const went = n > coins;
  coins = n;
  $<HTMLSpanElement>("coin-count").textContent = String(n);
  if (went) {
    const pill = $("coins");
    pill.classList.remove("bump");
    void pill.offsetWidth; // restart the animation
    pill.classList.add("bump");
  }
  if (!$("shop").hidden) renderShop();
}

/** A shop-style card: preview, name and (optionally) price. The caller appends the action. */
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

function button(text: string, onClick: () => void, className = ""): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = text;
  if (className) b.className = className;
  b.addEventListener("click", onClick);
  return b;
}

// ---------- Join screen ----------

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
document.body.classList.add("ready");

nameInput.value = randomName();
$<HTMLButtonElement>("random-name").addEventListener("click", () => {
  nameInput.value = randomName();
  nameError.hidden = true;
  nameInput.focus();
});

// Reflect the saved reduced-motion preference before anything renders.
applyBodyClass();

const restoreRow = $<HTMLDivElement>("restore-row");
const restoreInput = $<HTMLInputElement>("restore-input");
$<HTMLButtonElement>("restore-toggle").addEventListener("click", () => {
  restoreRow.hidden = !restoreRow.hidden;
  if (!restoreRow.hidden) restoreInput.focus();
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
    identity = { name, colour };
    const room = await joinArea("plaza", joinOptions());
    $("join").hidden = true;
    $("help").hidden = false;
    window.setTimeout(() => $("help").classList.add("gone"), 10_000);
    $("hud").hidden = false;
    wireUi();
    enterArea(room, "plaza");
    startMusic(); // after the join gesture, honouring the mute preference
  } catch (error) {
    console.error(error);
    status.textContent = "The plaza gates are stuck. Is the server running? Try again in a moment.";
    joinButton.disabled = false;
  }
});

// ---------- Worlds ----------

function newGame(): Phaser.Game {
  currentGame?.destroy(true);
  // The canvas always fills the window; each scene's camera zooms to cover it.
  currentGame = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    backgroundColor: "#19161d",
    scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" },
  });
  return currentGame;
}

function focusCanvas() {
  const canvas = currentGame?.canvas;
  if (!canvas) return;
  canvas.setAttribute("tabindex", "0");
  canvas.focus();
}

/** Join options with identity plus the hat and pet you have with you. */
function joinOptions(from?: AreaId): JoinOptions {
  return { ...identity, hat: wornHat || undefined, pet: wornPet || undefined, from };
}

/** Show a public area (plaza, lighthouse or crypt) and bind its room's server messages. */
function enterArea(room: PlazaRoom, area: AreaId) {
  plazaRoom = room;
  currentArea = area;
  // Message handlers go on synchronously after join, so the join-time wallet is not missed.
  bindPlazaMessages(room);
  newGame().scene.add("plaza", PlazaScene, true, { room, area, onVisit: offerVisit, onTalk: talkToCaretaker });
  focusCanvas();
  const plaza = area === "plaza";
  // The mini-games live in the town square; chat works everywhere public.
  $("fishing").hidden = !plaza;
  $("seance").hidden = !plaza;
  $("chat").hidden = false;
  // Away from the square, the top-left bar names the place and offers the way back.
  $("room-controls").hidden = plaza;
  $("room-owner").textContent = AREAS[area].name;
  $("room-button").hidden = false;
  editorButton.hidden = true;
}

function bindPlazaMessages(room: PlazaRoom) {
  onWallet(room, (wallet) => {
    owned.clear();
    for (const id of wallet.items) owned.add(id);
    recoveryCode = wallet.recoveryCode;
    $("recovery-code").textContent = recoveryCode;
    saveRecoveryCode(recoveryCode);
    setCoins(wallet.coins);
  });
  onBought(room, (msg) => {
    owned.add(msg.itemId);
    setCoins(msg.balance);
    renderShop();
    showToast(`Bought ${SHOP_ITEMS.find((i) => i.id === msg.itemId)?.name ?? "it"}!`);
  });
  onDenied(room, (msg) => {
    renderShop();
    showToast(msg.reason === "owned" ? "You already own that." : "Not enough coins yet.");
  });
  onCaretakerNote(room, (n) => showCaretakerNote(n.text));
  onFriends(room, (list) => {
    friends = list.friends;
    renderFriends();
  });
  requestFriends(room);
  onFishStarted(room, (msg) => fishing.started(msg.roundMs));
  onFishCatch(room, (msg) => fishing.caught(getCatch(msg.catchId).name, msg.coins));
  onDashQueue(room, (q) => renderDashGate(q));
  onDashStart(room, (s) => void enterDash(s.roomId));
  onSeanceShow(room, (msg) => seance.show(msg));
  onSeanceResult(room, (msg) => seance.result(msg));
  onFishEnded(room, (msg) => {
    fishing.ended();
    setCoins(msg.balance);
  });
}

let noteTimer = 0;
function showCaretakerNote(text: string) {
  $("caretaker-text").textContent = text;
  $("caretaker-note").hidden = false;
  window.clearTimeout(noteTimer);
  noteTimer = window.setTimeout(() => ($("caretaker-note").hidden = true), 6000);
}

/** My own player id, read from my ghost's synced ownerId in the plaza. */
function myPlayerId(): number | null {
  const me = plazaRoom?.state.ghosts?.get(plazaRoom.sessionId);
  const id = me?.ownerId ? Number(me.ownerId) : NaN;
  return Number.isFinite(id) && id > 0 ? id : null;
}

// ---------- Talking to the Caretaker (scripted, client-side; no chat is sent) ----------

const STORIES = [
  "Long ago a ghost lost her favourite hat in the fountain. She fished for a hundred years. The fish say she still checks every Tuesday.",
  "The clock tower has leaned since the night it laughed too hard at one of my jokes. It has never told me which one.",
  "Once, every lantern in town went out at once. A tiny ghost hummed until they lit again. Kindness is the oldest light we have.",
];

const TALK_TOPICS: { ask: string; answer: () => string }[] = [
  { ask: "Who are you?", answer: () => "I'm the Caretaker. I've tended these lanterns for three hundred years, give or take a century. Every ghost who floats in is my guest." },
  { ask: "How do I earn coins?", answer: () => "Float to the fountain and cast a line. Reel when the marker is in the zone. Each hit makes it faster; land one at full speed and you've caught something." },
  { ask: "What can I buy?", answer: () => "Hats for your head and trinkets for your room. Buy a decoration, then visit My room and press Decorate to place it." },
  { ask: "Why do you read the chat?", answer: () => "I read every message before the town hears it, so kindness travels and cruelty doesn't. If I stop you, it's only a quiet word between us, never in public." },
  { ask: "Tell me a story.", answer: () => STORIES[Math.floor(Math.random() * STORIES.length)]! },
];

function plazaScene(): PlazaScene | undefined {
  const scene = currentGame?.scene.getScene("plaza");
  return scene instanceof PlazaScene ? scene : undefined;
}

/** The Caretaker speaks in its bubble; the same line goes to screen readers. */
function caretakerSays(line: string) {
  plazaScene()?.caretakerSay(line);
  $("talk-said").textContent = line;
}

/** Swap the chat bar for reply options. Ends on Goodbye, Esc, or walking off. */
function talkToCaretaker() {
  if (!$("talk").hidden) return;
  const name = plazaRoom?.state.ghosts?.get(plazaRoom.sessionId)?.name ?? "little one";
  caretakerSays(`Ah, ${name}. What would you like to know?`);
  const topics = $("talk-topics");
  topics.replaceChildren(
    ...TALK_TOPICS.map((t) => button(t.ask, () => caretakerSays(t.answer()), "secondary")),
    button("Goodbye", () => endTalk(true), "ghost-btn bye"),
  );
  $("chat-form").hidden = true;
  $("talk").hidden = false;
  plazaScene()?.setCaretakerTalking(true); // it stops drifting while you talk
  topics.querySelector("button")?.focus();
}

function endTalk(sayBye = false) {
  if ($("talk").hidden) return;
  if (sayBye) caretakerSays("Float safely, little one.");
  plazaScene()?.setCaretakerTalking(false);
  $("talk").hidden = true;
  $("chat-form").hidden = false;
  focusCanvas();
}

// ---------- Friends ----------

let friends: FriendView[] = [];
const isFriend = (playerId: number) => friends.some((f) => f.playerId === playerId);

function renderFriends() {
  const online = friends.filter((f) => f.online).length;
  const badge = $("friends-online");
  badge.textContent = String(online);
  badge.hidden = online === 0;
  badge.setAttribute("aria-label", `${online} online`);

  const list = $<HTMLUListElement>("friends-list");
  list.replaceChildren();
  if (friends.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "No friends yet. Click a ghost in the plaza to add one.";
    list.append(li);
  }
  // Online first, then by name.
  const sorted = [...friends].sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name));
  for (const f of sorted) {
    const li = document.createElement("li");
    if (f.online) li.classList.add("online");
    const who = document.createElement("div");
    who.className = "who";
    const name = document.createElement("b");
    name.textContent = f.name || "A ghost";
    const state = document.createElement("span");
    state.className = "state";
    state.textContent = f.online ? "Online" : "Away";
    who.append(name, state);
    li.append(
      who,
      button("Visit room", () => {
        modals.friends.close();
        void visitRoom(f.playerId, false);
      }),
      button("Remove", () => plazaRoom && removeFriend(plazaRoom, f.playerId), "ghost-btn"),
    );
    list.append(li);
  }
  syncFriendToggle();
}

/** The Add/Remove friend button on the ghost card follows the current list. */
function syncFriendToggle() {
  const toggle = $<HTMLButtonElement>("friend-toggle");
  toggle.textContent = pendingVisit !== null && isFriend(pendingVisit) ? "Remove friend" : "Add friend";
}

let pendingVisit: number | null = null;
/** Clicking another ghost opens its player card. */
function offerVisit(ownerPlayerId: number, name: string) {
  // Two tabs in one browser share a guest id, so they are the same player.
  const self = ownerPlayerId === myPlayerId();
  pendingVisit = self ? null : ownerPlayerId;
  $("visit-title").textContent = name;
  $("visit-text").textContent = self
    ? "That's you, in another tab or window. Use My room to visit your own room."
    : `Drop in on ${name}'s haunted room, or add them as a friend.`;
  $("visit-go").hidden = self;
  $("friend-toggle").hidden = self;
  syncFriendToggle();
  modals.visit.open();
}

let switching = false;
async function visitRoom(ownerPlayerId: number, isOwner: boolean) {
  if (switching || dashRoom) return; // finish the race first
  switching = true;
  try {
    fishing.stop();
    seance.stop();
    endTalk();
    modals.shop.close();
    const leaving = plazaRoom;
    plazaRoom = undefined;
    await leaving?.leave();
    roomClient = await joinHauntedRoom(joinOptions(), ownerPlayerId);
    newGame().scene.add("room", RoomScene, true, { room: roomClient, isOwner });
    focusCanvas();
    // Chat and the mini-games live in the plaza only.
    $("fishing").hidden = true;
    $("seance").hidden = true;
    $("chat").hidden = true;
    $("room-controls").hidden = false;
    $("room-owner").textContent = isOwner ? "Your haunted room" : `${roomClient.state.ownerName}'s room`;
    $("room-button").hidden = true;
    editorButton.hidden = !isOwner;
  } catch (err) {
    console.error(err);
    showToast("That room's door is stuck. Back to the plaza.");
    await returnToPlaza(true);
  } finally {
    switching = false;
  }
}

async function returnToPlaza(force = false) {
  if (switching && !force) return;
  switching = true;
  modals.editor.close();
  try {
    await roomClient?.leave();
  } catch (err) {
    console.error("room leave failed (continuing):", err);
  }
  roomClient = undefined;
  try {
    enterArea(await joinArea("plaza", joinOptions()), "plaza");
  } catch (err) {
    console.error(err);
    showToast("The plaza gates are stuck. Reload the page to try again.");
  } finally {
    switching = false;
  }
}

/** Walk from one public area to another (plaza, lighthouse, crypt). */
async function travel(to: AreaId) {
  if (switching || dashRoom || to === currentArea || !plazaRoom) return;
  switching = true;
  const from = currentArea;
  fishing.stop();
  seance.stop();
  endTalk();
  modals.shop.close();
  try {
    const leaving = plazaRoom;
    plazaRoom = undefined;
    await leaving.leave();
    // `from` puts us at the matching exit on the other side.
    enterArea(await joinArea(to, joinOptions(from)), to);
  } catch (err) {
    console.error(err);
    showToast("The path is blocked. Back to the town square.");
    try {
      enterArea(await joinArea("plaza", joinOptions()), "plaza");
    } catch {
      showToast("The town gates are stuck. Reload the page to try again.");
    }
  } finally {
    switching = false;
  }
}

// ---------- One-time UI wiring ----------

const editorButton = document.createElement("button");
editorButton.type = "button";
editorButton.className = "secondary";
editorButton.hidden = true;
editorButton.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4l6 6-9 9H5v-6z"/></svg><span class="label">Decorate</span>`;
editorButton.setAttribute("aria-label", "Decorate");

const modals = {
  shop: makeModal($("shop")),
  recovery: makeModal($("recovery")),
  settings: makeModal($("settings")),
  visit: makeModal($("visit-prompt"), () => (pendingVisit = null)),
  editor: makeModal($("room-editor")),
  friends: makeModal($("friends")),
  dashResults: makeModal($("dash-results"), () => void (dashRoom && leaveDash())),
};
const toggle = (m: (typeof modals)[keyof typeof modals]) => (m.isOpen ? m.close() : m.open());

function renderShop() {
  const list = $<HTMLUListElement>("shop-list");
  list.replaceChildren();
  let lastKind = "";
  for (const item of SHOP_ITEMS) {
    if (item.kind !== lastKind) {
      lastKind = item.kind;
      list.append(sectionTitle({ hat: "Hats", decoration: "Room decorations", pet: "Pets" }[item.kind]));
    }
    const has = owned.has(item.id);
    const li = itemCard(item, !has);
    if (has) li.classList.add("owned");
    if (wornHat === item.id || wornPet === item.id) li.classList.add("wearing");
    if (has && item.kind === "pet") {
      // One pet at a time; bringing another sends the first one home.
      const along = wornPet === item.id;
      li.append(
        button(along ? "Send home" : "Bring along", () => {
          if (!plazaRoom) return;
          wornPet = along ? "" : item.id;
          sendSetPet(plazaRoom, wornPet);
          renderShop();
        }, along ? "secondary" : ""),
      );
    } else if (has && item.kind === "hat") {
      const wearing = wornHat === item.id;
      li.append(
        button(wearing ? "Take off" : "Wear", () => {
          if (!plazaRoom) return;
          wornHat = wearing ? "" : item.id;
          sendSetHat(plazaRoom, wornHat);
          renderShop();
        }, wearing ? "secondary" : ""),
      );
    } else if (has) {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = "Owned";
      li.append(tag);
    } else {
      const buy = button(coins < item.price ? `Need ${item.price - coins} more` : "Buy", () => {
        if (!plazaRoom) return;
        buy.disabled = true;
        sendBuy(plazaRoom, item.id);
      });
      buy.disabled = coins < item.price || !plazaRoom;
      li.append(buy);
    }
    list.append(li);
  }
}

function renderDecorList() {
  const list = $<HTMLUListElement>("decor-list");
  list.replaceChildren();
  const ownedDecor = SHOP_ITEMS.filter((i) => i.kind === "decoration" && owned.has(i.id));
  if (ownedDecor.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "Buy decorations in the shop first.";
    list.append(li);
    return;
  }
  for (const item of ownedDecor) {
    const li = itemCard(item, false);
    // The decoration follows the cursor; the next click in the room puts it there (Esc cancels).
    li.append(
      button("Place", () => {
        const scene = currentGame?.scene.getScene("room");
        if (scene instanceof RoomScene) {
          scene.startPlacing(item.id);
          showToast("Click anywhere in the room to place it. Esc to cancel.");
          focusCanvas();
        } else if (roomClient) {
          placeItem(roomClient, item.id, PLAZA_WIDTH / 2, PLAZA_HEIGHT / 2);
        }
      }),
    );
    list.append(li);
  }
}

let wired = false;
function wireUi() {
  if (wired) return;
  wired = true;

  $("hud").append(editorButton);
  editorButton.addEventListener("click", () => {
    renderDecorList();
    toggle(modals.editor);
  });

  $("shop-button").addEventListener("click", () => {
    renderShop();
    toggle(modals.shop);
  });
  $("shop-close").addEventListener("click", () => modals.shop.close());

  $("room-button").addEventListener("click", () => {
    const id = myPlayerId();
    if (id !== null) void visitRoom(id, true);
  });
  // "Plaza" leaves a haunted room, or walks home from the lighthouse or crypt.
  $("return-plaza").addEventListener("click", () => void (roomClient ? returnToPlaza() : travel("plaza")));

  // Standing at an exit offers the way through.
  const exitPrompt = $<HTMLButtonElement>("exit-prompt");
  let exitTo: AreaId | null = null;
  exitPrompt.addEventListener("click", () => exitTo && void travel(exitTo));
  window.setInterval(() => {
    const me = plazaRoom?.state.ghosts?.get(plazaRoom.sessionId);
    const exit = me && !switching ? exitAt(currentArea, me) : undefined;
    exitTo = exit?.to ?? null;
    exitPrompt.hidden = !exit;
    if (exit) exitPrompt.textContent = `Go to ${exit.label}`;
  }, 300);
  $("visit-cancel").addEventListener("click", () => modals.visit.close());
  $("visit-go").addEventListener("click", () => {
    const target = pendingVisit;
    modals.visit.close();
    if (target !== null) void visitRoom(target, false);
  });
  $("room-editor-close").addEventListener("click", () => modals.editor.close());
  $("talk").addEventListener("keydown", (e) => {
    if (e.key === "Escape") endTalk();
  });

  $("friends-button").addEventListener("click", () => {
    if (plazaRoom) requestFriends(plazaRoom); // refresh who's online
    renderFriends();
    toggle(modals.friends);
  });
  $("friends-close").addEventListener("click", () => modals.friends.close());
  $("friend-toggle").addEventListener("click", () => {
    if (pendingVisit === null || !plazaRoom) return;
    const adding = !isFriend(pendingVisit);
    (adding ? addFriend : removeFriend)(plazaRoom, pendingVisit);
    showToast(adding ? `Added ${$("visit-title").textContent} as a friend` : "Removed from friends");
  });
  // Keep online dots fresh while in the plaza.
  window.setInterval(() => plazaRoom && requestFriends(plazaRoom), 20_000);

  // Settings, with the recovery code one level down.
  const motion = $<HTMLInputElement>("set-reduce-motion");
  const mute = $<HTMLInputElement>("set-mute");
  motion.checked = reduceMotion();
  mute.checked = muted();
  motion.addEventListener("change", () => setReduceMotion(motion.checked));
  mute.addEventListener("change", () => {
    setMuted(mute.checked);
    applyMute();
  });
  $("settings-button").addEventListener("click", () => toggle(modals.settings));
  $("settings-close").addEventListener("click", () => modals.settings.close());
  $("recovery-button").addEventListener("click", () => {
    modals.settings.close();
    modals.recovery.open();
  });
  $("recovery-close").addEventListener("click", () => modals.recovery.close());
  $("recovery-copy").addEventListener("click", () => {
    void navigator.clipboard?.writeText(recoveryCode).then(() => showToast("Code copied"));
  });

  // Chat goes to the current plaza room. Esc hands the keyboard back to the game.
  const chatInput = $<HTMLInputElement>("chat-input");
  $<HTMLFormElement>("chat-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const text = chatInput.value.trim();
    if (!text || !plazaRoom) return;
    sendChat(plazaRoom, text);
    chatInput.value = "";
  });
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      chatInput.blur();
      focusCanvas();
    }
  });

  // "Caretaker is resting" follows synced state; it changes rarely, so polling is fine.
  window.setInterval(() => {
    $("caretaker-resting").hidden = plazaRoom?.state.caretakerResting !== true;
  }, 1000);

  fishing.wire();
  seance.wire();
  wireDash();
}

// ---------- Ghost Fishing ----------
//
// Each hit inside the zone speeds the reel up a tier and moves the zone.
// A miss drops back to the slowest tier. A hit at top speed lands a catch:
// only then is a cast sent, and the server rolls the catch from the accuracy.

const FISH_RANGE = 160; // how close a ghost must be to cast
/** Time for the marker to cross the bar once, per tier. The last tier lands the catch. */
const TIER_SWEEP_MS = [1500, 1050, 760, 540];
const ZONE_WIDTH = 0.16;
const REEL_GAP_MS = 180; // ignore key-repeat and double taps

const fishing = (() => {
  const prompt = $<HTMLButtonElement>("fish-prompt");
  const panel = $<HTMLElement>("fish-round");
  const timer = $<HTMLParagraphElement>("fish-timer");
  const result = $<HTMLParagraphElement>("fish-result");
  const bar = $<HTMLDivElement>("fish-bar");
  const zone = $<HTMLDivElement>("fish-zone");
  const marker = $<HTMLDivElement>("fish-marker");
  const tiers = $<HTMLDivElement>("fish-tiers");
  const castButton = $<HTMLButtonElement>("fish-cast");

  let active = false;
  let endsAt = 0;
  let raf = 0;
  let lastFrame = 0;
  let pos = 0; // 0..1 across the bar
  let dir = 1;
  let tier = 0;
  let zoneLeft = 0.42;
  let lastReel = 0;
  let lastCastSent = 0;

  tiers.replaceChildren(...TIER_SWEEP_MS.map(() => document.createElement("span")));

  const say = (text: string, mood: "" | "good" | "bad" = "") => {
    result.textContent = text;
    result.className = `fish-result ${mood}`;
  };

  const draw = () => {
    zone.style.left = `${zoneLeft * 100}%`;
    zone.style.width = `${ZONE_WIDTH * 100}%`;
    tiers.querySelectorAll("span").forEach((s, i) => s.classList.toggle("on", i <= tier));
    tiers.setAttribute("aria-label", `Reel speed ${tier + 1} of ${TIER_SWEEP_MS.length}`);
  };

  /** Move the zone somewhere new, at least a zone-width away from where it was. */
  const moveZone = () => {
    let next = zoneLeft;
    for (let i = 0; i < 10 && Math.abs(next - zoneLeft) < ZONE_WIDTH; i++) next = 0.04 + Math.random() * (0.92 - ZONE_WIDTH);
    zoneLeft = next;
  };

  const flash = (cls: "hit" | "miss") => {
    bar.classList.remove("hit", "miss");
    void bar.offsetWidth;
    bar.classList.add(cls);
    window.setTimeout(() => bar.classList.remove(cls), 250);
  };

  const frame = (t: number) => {
    const dt = lastFrame ? Math.min(50, t - lastFrame) : 0;
    lastFrame = t;
    const sweep = TIER_SWEEP_MS[tier]! * (reduceMotion() ? 1.5 : 1);
    pos += (dir * dt) / sweep;
    if (pos >= 1) [pos, dir] = [1, -1];
    if (pos <= 0) [pos, dir] = [0, 1];
    marker.style.left = `${pos * 100}%`;
    bar.dataset.inZone = pos >= zoneLeft && pos <= zoneLeft + ZONE_WIDTH ? "1" : "0";
    raf = requestAnimationFrame(frame);
  };

  const reel = () => {
    const room = plazaRoom;
    if (!active || !room) return;
    const now = performance.now();
    if (now - lastReel < REEL_GAP_MS) return;
    lastReel = now;

    const inZone = pos >= zoneLeft && pos <= zoneLeft + ZONE_WIDTH;
    if (!inZone) {
      flash("miss");
      say(tier > 0 ? "It slipped away. Back to a slow reel." : "Missed. Wait for the marker to cross the zone.", "bad");
      tier = 0;
    } else if (tier < TIER_SWEEP_MS.length - 1) {
      flash("hit");
      tier++;
      say(tier === TIER_SWEEP_MS.length - 1 ? "Nearly there! One more at full speed." : "Hooked! Faster now…", "good");
    } else {
      flash("hit");
      const centre = zoneLeft + ZONE_WIDTH / 2;
      const accuracy = Math.max(0, 1 - Math.abs(pos - centre) / (ZONE_WIDTH / 2));
      // Respect the server's cast cooldown so a fast landing is never dropped.
      const wait = Math.max(0, lastCastSent + CAST_COOLDOWN_MS + 50 - Date.now());
      window.setTimeout(() => {
        if (!active || plazaRoom !== room) return;
        lastCastSent = Date.now();
        sendCast(room, accuracy);
      }, wait);
      say("Landing it…", "good");
      tier = 0;
    }
    moveZone();
    draw();
  };

  const start = () => {
    if (!plazaRoom) return;
    active = true;
    tier = 0;
    pos = 0;
    dir = 1;
    lastFrame = 0;
    moveZone();
    draw();
    prompt.hidden = true;
    panel.hidden = false;
    timer.textContent = "60s";
    say("Reel when the marker is inside the zone.");
    castButton.focus();
    raf = requestAnimationFrame(frame);
    startFishing(plazaRoom);
  };

  const halt = () => {
    active = false;
    cancelAnimationFrame(raf);
    panel.hidden = true;
  };

  return {
    wire() {
      prompt.addEventListener("click", start);
      castButton.addEventListener("click", reel);
      $("fish-stop").addEventListener("click", () => this.stop());
      // Space reels, unless you are typing. preventDefault also stops a focused
      // button from turning the same press into a second click.
      document.addEventListener("keydown", (e) => {
        if (!active || e.code !== "Space" || isTyping()) return;
        e.preventDefault();
        if (!e.repeat) reel();
      });
      // Offer fishing only near the fountain, and only in the plaza.
      window.setInterval(() => {
        const me = plazaRoom?.state.ghosts?.get(plazaRoom.sessionId);
        const near = !!me && Math.hypot(me.x - FOUNTAIN_CENTRE.x, me.y - FOUNTAIN_CENTRE.y) <= FISH_RANGE;
        prompt.hidden = active || !near;
      }, 300);
      window.setInterval(() => {
        if (!active) return;
        const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
        timer.textContent = `${left}s`;
        if (left <= 0) this.stop();
      }, 250);
    },
    started(roundMs: number) {
      endsAt = Date.now() + roundMs;
    },
    caught(name: string, coinsWon: number) {
      say(`You caught ${name}! +${coinsWon} coins`, "good");
    },
    ended() {
      halt();
    },
    /** End the round (button, timer, or leaving the plaza). */
    stop() {
      if (!active) return;
      halt();
      if (plazaRoom) endFishing(plazaRoom);
      focusCanvas();
    },
  };
})();

// ---------- Séance ----------
//
// The server sends a sequence; the runes light up one by one, then the player repeats
// it by clicking or pressing 1-4. A wrong rune is sent at once, so the server ends it.

const RUNE_ICONS: Record<(typeof RUNES)[number], string> = {
  moon: `<path d="M15 4a8 8 0 1 0 5 13A7 7 0 0 1 15 4z"/>`,
  star: `<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>`,
  eye: `<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>`,
  candle: `<path d="M12 3c2 2.5 2 4 0 5.5-2-1.5-2-3 0-5.5zM9 10h6v11H9z"/>`,
};

const SEANCE_LINES: Record<SeanceEndReason, string> = {
  wrong: "The candles gutter. The spirits lost the thread.",
  timeout: "The spirits grew tired of waiting.",
  complete: "A perfect séance! The spirits are delighted.",
  left: "You step out of the circle.",
};

const seance = (() => {
  const prompt = $<HTMLButtonElement>("seance-prompt");
  const panel = $<HTMLElement>("seance-round");
  const count = $<HTMLParagraphElement>("seance-count");
  const status = $<HTMLParagraphElement>("seance-status");
  const runeBox = $<HTMLDivElement>("seance-runes");

  let active = false;
  let sequence: number[] = [];
  let answer: number[] = [];
  let showing = false;
  let timers: number[] = [];

  const runes = RUNES.map((name, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "rune";
    b.setAttribute("aria-label", name);
    b.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true">${RUNE_ICONS[name]}</svg><kbd>${i + 1}</kbd>`;
    b.addEventListener("click", () => press(i));
    return b;
  });
  runeBox.replaceChildren(...runes);

  const setEnabled = (on: boolean) => runes.forEach((r) => (r.disabled = !on));
  const clearTimers = () => {
    timers.forEach((t) => window.clearTimeout(t));
    timers = [];
  };
  const flash = (i: number, ms: number) => {
    runes[i]!.classList.add("lit");
    timers.push(window.setTimeout(() => runes[i]!.classList.remove("lit"), ms));
  };

  /** Light the runes in order, then hand over to the player. */
  const play = (seq: number[]) => {
    showing = true;
    setEnabled(false);
    status.textContent = "Watch the runes…";
    const on = runeShowMs(seq.length);
    seq.forEach((r, k) => timers.push(window.setTimeout(() => flash(r, on), 500 + k * (on + 200))));
    timers.push(
      window.setTimeout(() => {
        showing = false;
        setEnabled(true);
        status.textContent = "Your turn. Repeat the runes.";
        runes[0]!.focus();
      }, 500 + seq.length * (on + 200)),
    );
  };

  function press(i: number) {
    if (!active || showing || !plazaRoom) return;
    flash(i, 180);
    answer.push(i);
    const wrong = answer[answer.length - 1] !== sequence[answer.length - 1];
    // Send as soon as it's complete or wrong; the server decides either way.
    if (wrong || answer.length === sequence.length) {
      setEnabled(false);
      answerSeance(plazaRoom, answer);
      if (!wrong) status.textContent = "The spirits stir…";
    }
  }

  const halt = () => {
    active = false;
    clearTimers();
    runes.forEach((r) => r.classList.remove("lit"));
    panel.hidden = true;
  };

  return {
    wire() {
      prompt.addEventListener("click", () => {
        if (!plazaRoom) return;
        active = true;
        prompt.hidden = true;
        panel.hidden = false;
        count.textContent = "Round 1";
        status.textContent = "The candles flicker…";
        setEnabled(false);
        startSeance(plazaRoom);
      });
      $("seance-stop").addEventListener("click", () => this.stop());
      // 1-4 press runes, unless you're typing.
      document.addEventListener("keydown", (e) => {
        if (!active || isTyping()) return;
        const n = Number(e.key);
        if (Number.isInteger(n) && n >= 1 && n <= RUNES.length) {
          e.preventDefault();
          press(n - 1);
        }
      });
      // Offer the séance only at the candle circle.
      window.setInterval(() => {
        const me = plazaRoom?.state.ghosts?.get(plazaRoom.sessionId);
        const near = !!me && Math.hypot(me.x - SEANCE_SPOT.x, me.y - SEANCE_SPOT.y) <= SEANCE_RANGE;
        prompt.hidden = active || !near;
      }, 300);
    },
    show(msg: SeanceShow) {
      if (!active) return;
      clearTimers();
      sequence = msg.sequence;
      answer = [];
      count.textContent = `Round ${msg.round}`;
      play(sequence);
    },
    result(msg: SeanceResult) {
      halt();
      setCoins(msg.balance);
      showToast(msg.coins > 0 ? `${SEANCE_LINES[msg.reason]} +${msg.coins} coins` : SEANCE_LINES[msg.reason]);
      focusCanvas();
    },
    stop() {
      if (!active) return;
      halt();
      if (plazaRoom) endSeance(plazaRoom);
    },
  };
})();

// ---------- Graveyard Dash ----------

let dashRoom: DashRoomClient | undefined;
let dashRecords: DashQueue["records"] = {};
let dashQueued = false;
let dashStartsAt = 0;
let dashResultsShown = false;

const mapName = (id: string) => (isDashMapId(id) ? DASH_MAPS[id].name : "Graveyard Dash");

function renderDashGate(q?: DashQueue) {
  if (q) {
    dashQueued = q.names.length > 0;
    dashStartsAt = q.startsAt;
    if (Object.keys(q.records).length || !dashQueued) dashRecords = q.records;
  }
  const text = $("dash-queue-text");
  const count = $("dash-queue-count");
  if (dashQueued && q) {
    text.textContent = q.names.length > 1 ? `In the queue: ${q.names.join(", ")}.` : "Waiting for another ghost… or race alone.";
    count.hidden = false;
    count.textContent = `${q.names.length}/4`;
  } else if (!dashQueued) {
    text.textContent = "Race up to three other ghosts through a haunted graveyard. Boost pads, wisps, gates and bats.";
    count.hidden = true;
  }
  $("dash-join").textContent = dashQueued ? "Leave queue" : "Join the race";
  const recs = DASH_MAP_IDS.filter((id) => dashRecords[id]).map((id) => `${DASH_MAPS[id].name} ${formatRaceTime(dashRecords[id]!)}`);
  $("dash-records").textContent = recs.length ? `Your bests: ${recs.join(" · ")}` : "";
}

/** Leave the plaza for the race room the server just opened for us. */
async function enterDash(roomId: string) {
  if (switching || !plazaRoom) return;
  switching = true;
  fishing.stop();
  seance.stop();
  endTalk();
  modals.shop.close();
  dashQueued = false;
  dashResultsShown = false;
  try {
    const leaving = plazaRoom;
    plazaRoom = undefined;
    await leaving.leave();
    dashRoom = await joinDash(roomId, joinOptions());
    const room = dashRoom;
    onDashResults(room, (r) => showDashResults(r));
    // Wait for the first state sync, so the scene draws the track the server picked.
    await new Promise<void>((resolve) => {
      if (room.state.map) return resolve();
      const timer = window.setTimeout(resolve, 3000);
      room.onStateChange.once(() => {
        window.clearTimeout(timer);
        resolve();
      });
    });
    newGame().scene.add("dash", DashScene, true, { room, onHud: renderDashHud });
    focusCanvas();
    for (const id of ["fishing", "seance", "chat", "dash-gate", "room-controls", "help", "room-button"]) $(id).hidden = true;
    $("exit-prompt").hidden = true;
    $("dash-hud").hidden = false;
    $("dash-map").textContent = mapName(room.state.map);
    const best = isDashMapId(room.state.map) ? dashRecords[room.state.map] : undefined;
    $("dash-best").textContent = best ? `Best ${formatRaceTime(best)}` : "No best yet";
  } catch (err) {
    console.error(err);
    showToast("The graveyard gate stuck. Back to the square.");
    dashRoom = undefined;
    try {
      enterArea(await joinArea("plaza", joinOptions()), "plaza");
    } catch {
      showToast("The town gates are stuck. Reload the page to try again.");
    }
  } finally {
    switching = false;
  }
}

function renderDashHud(h: DashHud) {
  $("dash-time").textContent = formatRaceTime(Math.max(0, h.clock));
  $("dash-hud").classList.toggle("boosted", h.boosted);
  $("dash-hud").classList.toggle("stunned", h.stunned);
  const cd = $("dash-countdown");
  if (h.clock < 0) {
    cd.hidden = false;
    cd.textContent = String(Math.ceil(-h.clock / 1000));
  } else if (h.clock < 700 && h.phase === "racing") {
    cd.hidden = false;
    cd.textContent = "GO!";
  } else {
    cd.hidden = true;
  }
  const bar = $("dash-progress");
  if (bar.childElementCount !== h.progress.length) bar.replaceChildren(...h.progress.map(() => document.createElement("span")));
  h.progress.forEach((p, i) => {
    const dot = bar.children[i] as HTMLSpanElement;
    dot.className = `dash-dot${p.me ? " me" : ""}`;
    dot.style.left = `${p.at * 100}%`;
    dot.title = p.name;
  });
}

function showDashResults(r: DashResults) {
  if (dashResultsShown) return;
  dashResultsShown = true;
  if (r.bestMs && isDashMapId(r.map)) dashRecords = { ...dashRecords, [r.map]: r.bestMs };
  const me = dashRoom?.state.racers.get(dashRoom.sessionId)?.name;
  $("dash-results-title").textContent = `${mapName(r.map)}: race over`;
  $("dash-standings").replaceChildren(
    ...r.standings.map((s) => {
      const li = document.createElement("li");
      if (s.name === me) li.className = "me";
      li.textContent = s.name;
      const time = document.createElement("span");
      time.className = "time";
      time.textContent = s.timeMs !== null ? formatRaceTime(s.timeMs) : "didn't finish";
      li.append(time);
      return li;
    }),
  );
  const reward = $("dash-reward");
  reward.replaceChildren();
  if (r.newRecord) {
    const rec = document.createElement("span");
    rec.className = "new-record";
    rec.textContent = "New personal best! ";
    reward.append(rec);
  }
  reward.append(r.coins > 0 ? `+${r.coins} coins.` : "No coins this time.");
  if (r.bestMs) reward.append(` Your best here: ${formatRaceTime(r.bestMs)}.`);
  setCoins(r.balance);
  $("dash-countdown").hidden = true;
  modals.dashResults.open();
}

/** Back to the square after a race (or if you leave one early). */
async function leaveDash() {
  const leaving = dashRoom;
  if (!leaving) return;
  dashRoom = undefined; // first, so closing the results card doesn't call back in here
  modals.dashResults.close();
  $("dash-hud").hidden = true;
  $("dash-countdown").hidden = true;
  try {
    await leaving?.leave();
  } catch {
    /* already closed */
  }
  try {
    enterArea(await joinArea("plaza", joinOptions()), "plaza");
  } catch (err) {
    console.error(err);
    showToast("The town gates are stuck. Reload the page to try again.");
  }
}

function wireDash() {
  $("dash-join").addEventListener("click", () => {
    if (!plazaRoom) return;
    if (dashQueued) leaveDashQueue(plazaRoom);
    else joinDashQueue(plazaRoom);
  });
  $("dash-solo").addEventListener("click", () => plazaRoom && raceAlone(plazaRoom));
  $("dash-back").addEventListener("click", () => void leaveDash());
  // Show the gate panel only when standing at the Dash Gate in the plaza.
  window.setInterval(() => {
    const me = plazaRoom?.state.ghosts?.get(plazaRoom.sessionId);
    const near = currentArea === "plaza" && !!me && Math.hypot(me.x - DASH_GATE.x, me.y - DASH_GATE.y) <= DASH_GATE.radius;
    $("dash-gate").hidden = !near && !dashQueued;
    if (dashQueued && dashStartsAt) {
      const s = Math.max(0, Math.ceil((dashStartsAt - Date.now()) / 1000));
      $("dash-queue-count").textContent = `Starts in ${s}s`;
    }
  }, 250);
}

// ---------- Music ----------

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
