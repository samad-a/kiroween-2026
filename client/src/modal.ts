// Accessible modal behaviour for the overlay panels: trap Tab focus inside an
// open dialog and close it on Escape. Keeps keyboard users from tabbing out
// into the game canvas behind the panel.

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export interface Modal {
  /** Open the panel, move focus inside, and start trapping. */
  open(): void;
  /** Close the panel and stop trapping. */
  close(): void;
  readonly isOpen: boolean;
}

/**
 * Wire a panel element as a modal. `onClose` lets the caller sync any button
 * state. The panel is shown/hidden via its `hidden` attribute.
 */
export function makeModal(panel: HTMLElement, onClose?: () => void): Modal {
  let open = false;

  const focusable = (): HTMLElement[] =>
    Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => !el.hasAttribute("disabled"));

  const onKeydown = (e: KeyboardEvent) => {
    if (!open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      api.close();
      return;
    }
    if (e.key !== "Tab") return;
    const items = focusable();
    if (items.length === 0) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const active = document.activeElement;
    // Wrap focus at the ends so Tab never escapes the dialog.
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const api: Modal = {
    get isOpen() {
      return open;
    },
    open() {
      if (open) return;
      open = true;
      panel.hidden = false;
      document.addEventListener("keydown", onKeydown, true);
      focusable()[0]?.focus();
    },
    close() {
      if (!open) return;
      open = false;
      panel.hidden = true;
      document.removeEventListener("keydown", onKeydown, true);
      onClose?.();
    },
  };
  return api;
}
