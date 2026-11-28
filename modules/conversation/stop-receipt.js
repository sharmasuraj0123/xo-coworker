// @ts-check

/** @import { StopDeps } from "./stop-types.d.ts" */

/** @param {Pick<StopDeps, "heraldShow" | "announce" | "inUse">} options */
export function createStopReceipt({ heraldShow, announce, inUse }) {
  /** @param {boolean} interrupt */
  const focusTargets = (interrupt) => [inUse(interrupt ? "[data-interrupt]" : "[data-chat-stop]"), inUse("#send")];

  /** @param {string} what @param {boolean} interrupt @param {boolean} finished */
  function sent(what, interrupt, finished) {
    const text = finished ? "It had already finished" : interrupt ? "Interrupted" : "Stopped";
    const sub = interrupt ? `${what} · it reads your message next` : finished ? what : `${what} · what it did is kept`;
    heraldShow({ kind: "halt", text, sub }, 4200);
    if (interrupt) {
      announce(finished ? "It had already finished. It reads your message next."
        : `Interrupted ${what}. What it did is kept, and it reads your message next.`);
    } else {
      announce(finished ? "It had already finished." : `Stopped ${what}. What it did is kept.`);
    }
  }

  /** @param {string} what @param {boolean} interrupt @param {unknown} error @param {() => void} retry */
  function failed(what, interrupt, error, retry) {
    const message = error instanceof Error ? error.message : String(error);
    heraldShow({
      kind: "stopped", text: interrupt ? "Couldn't interrupt it" : "Couldn't stop it", sub: `${what} · ${message}`,
      undo: retry, undoLabel: "Retry", back: focusTargets(interrupt),
    }, 7000);
  }

  return { sent, failed, focusTargets };
}
