// @ts-check
import { createScope } from "../../core/kernel/scope.js";
import { reportFailure } from "../../core/services/notices/failures.js";

/** @import { RecordDeps, IncomingRecord } from "./record-lines-types.d.ts" */

/** @param {RecordDeps} options */
export function createRecordLines({ view, localMessages, announce, schedule, heraldShow, dismissRecord, placeRegion }) {
  const scope = createScope();
  /** @param {string} session @param {IncomingRecord} rec */
  function recordLine(session, rec) {
    if (scope.signal.aborted) return;
    const at = Date.now();
    const m = localMessages.record(session, { at, text: rec.text, refused: !!rec.refused, undo: rec.undo || null, until: at + 3000 });
    if (rec.undo) scope.timeout(() => { recUndoLeaves(m.id); m.undo = null; schedule(); }, 3050);
    const current = view();
    if (current === "home" || current !== session) heraldShow({ kind: "rec", text: rec.text, undo: rec.undo ? m.id : null, undoUntil: rec.undo ? m.until : 0 }, rec.undo ? 3200 : 4200);
    announce(rec.text);
    schedule();
  }
  /** @param {string} id */
  function recUndoLeaves(id) {
    const b = document.activeElement?.closest?.(`[data-rec-undo="${CSS.escape(id)}"]`);
    if (b) placeRegion().focus({ preventScroll: true });
  }
  /** @param {string} id */
  async function undoRecord(id) {
    if (scope.signal.aborted) return;
    const m = localMessages.get(id);
    if (m?.who !== "rec" || !m.undo || m.until == null || Date.now() >= m.until) return;
    recUndoLeaves(id);
    const undo = m.undo;
    m.undo = null;
    dismissRecord(id);
    schedule();
    try {
      await undo();
      if (scope.signal.aborted) return;
      m.text = `${m.text} · undone`;
      announce("Undone.");
    } catch (error) {
      if (scope.signal.aborted) return;
      reportFailure(error);
      m.text = `${m.text} · couldn't undo`;
      announce("Couldn't undo.");
    }
    schedule();
  }
  return { recordLine, undoRecord, dispose: scope.dispose };
}
