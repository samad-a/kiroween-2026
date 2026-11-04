import Phaser from "phaser";
import { GHOST_COLOURS, PLAZA_HEIGHT, PLAZA_WIDTH, cleanName, randomName } from "@club-kiro/shared";
import { joinPlaza } from "./net";
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
    startGame(room);
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
