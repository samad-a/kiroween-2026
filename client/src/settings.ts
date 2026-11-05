// Player preferences, persisted in localStorage. Centralises reduced-motion and
// mute so the CSS, the DOM overlays and the Phaser scenes all read one source.

const MOTION_KEY = "clubkiro.reduceMotion";
const MUTE_KEY = "clubkiro.muted";

type Listener = () => void;
const listeners = new Set<Listener>();

const systemPrefersReducedMotion = (): boolean =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Stored preference as a tri-state: "on", "off", or "system" (default). */
function storedMotion(): "on" | "off" | "system" {
  const v = localStorage.getItem(MOTION_KEY);
  return v === "on" || v === "off" ? v : "system";
}

/** Effective reduced-motion: the explicit choice, else the OS setting. */
export function reduceMotion(): boolean {
  const s = storedMotion();
  return s === "system" ? systemPrefersReducedMotion() : s === "on";
}

export function muted(): boolean {
  return localStorage.getItem(MUTE_KEY) === "true";
}

export function setReduceMotion(on: boolean): void {
  localStorage.setItem(MOTION_KEY, on ? "on" : "off");
  applyBodyClass();
  notify();
}

export function setMuted(on: boolean): void {
  localStorage.setItem(MUTE_KEY, String(on));
  notify();
}

/** Reflect reduced-motion as a body class so CSS can respond to the explicit choice. */
export function applyBodyClass(): void {
  document.body.classList.toggle("reduce-motion", reduceMotion());
}

/** Subscribe to any settings change. Returns an unsubscribe function. */
export function onSettingsChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify(): void {
  for (const fn of listeners) fn();
}
