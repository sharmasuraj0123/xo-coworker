// @ts-check

import { usable } from "../../core/ui/a11y/focus.js";
import { rtName } from "../../core/services/runtimes.js";
import { createIntel } from "./intel.js";

/** @import { Composer, IntelSurfaceOptions } from "./surface-types.d.ts" */

/** @template {Composer} T @param {IntelSurfaceOptions<T>} options */
export function createIntelSurface({ composers, redrawChip, announce, openThread, ...options }) {
  const intelligence = createIntel({
    ...options,
    onChange() { for (const composer of composers()) redrawChip(composer); },
    onMoved(thread, runtime) {
      announce(`Continuing on ${rtName(runtime)}. This thread is frozen; write in it to pick it back up.`);
      if (thread) openThread(thread.id);
    },
  });

  /** @param {string} session @param {HTMLElement | null} chip */
  function toggle(session, chip) {
    if (intelligence.isOpen) intelligence.close();
    else intelligence.open(session, chip);
  }

  /** @param {string} session @param {HTMLElement | null} chip */
  function openAlternate(session, chip) {
    const choice = intelligence.runtimeChoice(session);
    const alternate = choice.list.find((candidate) => candidate.id !== choice.on && candidate.usable);
    if (!alternate) return false;
    intelligence.open(session, chip, { rt: alternate.id });
    return true;
  }

  /** @param {(view: string) => string} sessionOf */
  function activate(sessionOf) {
    const sessions = [];
    for (const composer of composers()) if (usable(composer.iq)) sessions.push(sessionOf(composer.view));
    intelligence.activate(sessions);
  }

  return { intelligence, toggle, openAlternate, activate };
}
