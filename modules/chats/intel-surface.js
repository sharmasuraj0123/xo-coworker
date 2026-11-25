// @ts-check

import { mountPressRoutes, valuePress } from "../../shell/conversation-press.js";
import { usable } from "../../core/ui/a11y/focus.js";
import { rtName } from "../../core/services/runtimes.js";
import { createRecordLines } from "./record-lines.js";
import { createIntel } from "./intel.js";

/** @import { Composer, IntelSurfaceOptions } from "./surface-types.d.ts" */

/** @template {Composer} T @param {IntelSurfaceOptions<T>} options */
export function createIntelSurface({ composers, redrawChip, announce, openThread, records, scope, places, ...options }) {
  const lines = createRecordLines(records);
  scope.effect(() => mountPressRoutes(places, "xo.intelligence", { "record-undo": valuePress("data-rec-undo", lines.undoRecord) }));
  const intelligence = createIntel({
    ...options, record: lines.recordLine,
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

  scope.effect(() => () => { lines.dispose(); intelligence.dispose(); });
  const surface = { intelligence, toggle, openAlternate, activate, undoRecord: lines.undoRecord };
  /** @type {import("../../core/kernel/types").ModuleDef} */
  const module = {
    manifest: { id: "xo.intelligence", version: "1.0.0", kernel: "^1.1.0", core: true, provides: ["intelligence"] },
    activate(ctx) { ctx.provide("intelligence", surface); },
  };
  return { ...surface, module };
}
