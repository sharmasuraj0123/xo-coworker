// @ts-check

/** @typedef {ReturnType<typeof mountIntelligence>} IntelligenceSurface */

import { pressEntry, valuePress } from "../../shell/conversation-press.js";
import { sessionOf } from "../../shell/place-context.js";
import { usable } from "../../core/ui/a11y/focus.js";
import { rtName } from "../../core/services/runtimes.js";
import { createRecordLines } from "./record-lines.js";
import { createIntel } from "./intel.js";

/** @param {import("../../core/kernel/types").ModuleContext} ctx */
function mountIntelligence(ctx) {
  const world = ctx.use("world"), shape = ctx.use("shape"), navigation = ctx.use("navigation");
  const announce = ctx.use("announce"), conversation = ctx.use("conversationSession"), notices = ctx.use("notices");
  const lines = createRecordLines({ view: ctx.use("currentView"), localMessages: conversation.localMessages, announce,
    schedule: () => ctx.invalidate("workspace"), heraldShow: notices.show, placeRegion: conversation.region,
    dismissRecord: (id) => notices.dismiss((notice) => notice.undo === id),
  });
  ctx.contribute("conversation.press", pressEntry("record-undo", valuePress("data-rec-undo", lines.undoRecord)));
  const intelligence = createIntel({
    world, PROJ: ctx.use("projectName"), simple: () => shape.opts("xo:composer/intel").mode === "simple",
    record: lines.recordLine, onChange: () => ctx.emit("app:intelligence-changed"),
    onMoved(thread, runtime) {
      announce(`Continuing on ${rtName(runtime)}. This thread is frozen; write in it to pick it back up.`);
      if (thread) navigation.go("t:" + thread.id, { focus: true });
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

  function activate() {
    const sessions = [];
    for (const composer of conversation.focus.composers()) if (usable(composer.iq)) sessions.push(sessionOf(composer.view));
    intelligence.activate(sessions);
  }

  ctx.effect(() => () => { lines.dispose(); intelligence.dispose(); });
  ctx.on("app:view-preparing", () => intelligence.close({ restore: false }));
  return { intelligence, toggle, openAlternate, activate, undoRecord: lines.undoRecord };
}

/** @type {import("../../core/kernel/types").ModuleDef} */
export const intelModule = {
  manifest: { id: "xo.intelligence", version: "1.0.0", kernel: "^1.1.0", core: true,
    needs: ["world", "shape", "navigation", "announce", "conversationSession", "notices", "currentView", "projectName"],
    contributes: ["conversation.press:record-undo"], provides: ["intelligence"] },
  activate(ctx) { ctx.provide("intelligence", mountIntelligence(ctx)); },
};
