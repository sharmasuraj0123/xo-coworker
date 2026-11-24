// @ts-check

import { $ } from "../../core/platform/dom.js";
import { hydrateMedia } from "../../core/services/media/hydrate.js";
import { reconcile } from "../../core/ui/redraw.js";

/** @import { Conversation, ConversationMount, DrawingDeps, RankedNeed } from "./draw-types.d.ts" */

/** @param {ConversationMount} options @returns {Conversation} */
export function createConv({ view, msgs, scroller: sc, column, typing, follow, main = false }) {
  return { get view() { return typeof view === "function" ? view() : view; }, msgs, scroller: sc, column, typing, follow, main, rendered: null, filled: null };
}

/** @param {DrawingDeps} options */
export function createConversationDrawing({ S, CHG, msgItems, readingPlace, holdPlace, foldsBefore, workMotion, ensureRoot, liveReady, typingRender }) {
  /** @param {Conversation} C @param {RankedNeed[]} needs */
  function drawConv(C, needs) {
    const v = C.view;
    const opening = C.rendered !== v;
    let quiet = opening;
    // the first real fill of a conversation lands quietly (no arrivals), and where you are
    const ready = liveReady(v);
    if (!opening && ready && C.filled !== v) quiet = true;
    C.filled = ready ? v : null;
    if (C.main) S.filled = C.filled;
    CHG.sync(v); // what this place changed: read on opening, and after each edit an agent finishes
    const items = msgItems(v, needs);
    // the work folds about to be redrawn, measured before anything changes (workMotion glides them)
    const folds = quiet ? null : foldsBefore(C, items);
    const place = !opening && !C.follow.isPinned() ? readingPlace(C) : null;
    reconcile(C.msgs, items, { quiet, fallback: () => (C.main ? $("#say") : C.scroller) });
    hydrateMedia(C.msgs); // new pictures load and fade in; redrawn ones keep their pixels
    if (place) { holdPlace(C, place); queueMicrotask(() => holdPlace(C, place)); } // after msgx's decoration too
    if (folds) workMotion(C, folds);
    ensureRoot(v);
    typingRender(C);

    // Only navigation moves the reading position to the latest row.
    if (opening) { C.rendered = v; if (v === "chats") C.follow.toTop(); else C.follow.toLatest(false); }
  }

  return drawConv;
}
