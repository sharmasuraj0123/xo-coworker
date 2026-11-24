// @ts-check



/** @import { RecordDeps, IncomingRecord } from "./record-lines-types.d.ts" */



/** @param {RecordDeps} options */

export function createRecordLines({ S, announce, schedule, heraldShow, heraldNext, placeRegion }) {

  /** @param {string} session @param {IncomingRecord} rec */
  function recordLine(session, rec) {
    const conv = session;
    const m = { id: `rec${++S.n}`, who: "rec", at: Date.now(), text: rec.text, refused: !!rec.refused, undo: rec.undo || null, until: Date.now() + 3000 };
    (S.local[conv] = S.local[conv] || []).push(m);
    // its Undo goes when its window ends: if it holds focus then, the conversation takes it first (S004)
    if (rec.undo) setTimeout(() => { recUndoLeaves(m.id); schedule(); }, 3050);
    if (S.view === "home" || (S.view !== conv)) heraldShow({ kind: "rec", text: rec.text, undo: rec.undo ? m.id : null, undoUntil: rec.undo ? m.until : 0 }, rec.undo ? 3200 : 4200);
    announce(rec.text);
    schedule();
  }

  /** @param {string} id */
  function recUndoLeaves(id) {
    const b = document.activeElement?.closest?.(`[data-rec-undo="${CSS.escape(id)}"]`);
    if (b) placeRegion().focus({ preventScroll: true });
  }

  /** @param {string} id */
  function undoRecord(id) {
    for (const list of Object.values(S.local)) {
      const m = list.find((x) => x.id === id);
      if (m && m.undo && Date.now() < /** @type {number} */ (m.until)) {
        recUndoLeaves(id);
        m.undo(); m.undo = null;
        m.text = `${m.text} · undone`;
        announce("Undone.");
        if (S.herald && S.herald.undo === id) { S.herald.until = 0; heraldNext(); }
        schedule();
        return;
      }
    }
  }

  return { recordLine, undoRecord };
}
