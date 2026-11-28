// @ts-check

/** @import { createHerald, Notice } from "../../core/services/notices.js" */

/** @typedef {{ text: string, kind?: string, sub?: string, undo?: (() => void) | null, undoLabel?: string, until?: number }} Line */

const UNDO_MS = 3000;
const UNDO_NOTICE_MS = 3200;
const FAILURE_NOTICE_MS = 6000;
const PASSING_NOTICE_MS = 4200;

/** @param {string} kind */
const heraldKind = (kind) => kind === "err" ? "stopped" : kind;

/** @param {Pick<ReturnType<typeof createHerald>, "show" | "forMsg" | "drop">} herald */
export function createLaunchpadHerald({ show, forMsg, drop }) {
  return {
    /** @param {string} text @param {(() => void) | null} [undo] */
    notify(text, undo, kind = "done") {
      const actions = undo ? { undo, undoUntil: Date.now() + UNDO_MS, ownFocus: true } : {};
      const duration = undo ? UNDO_NOTICE_MS : kind === "err" ? FAILURE_NOTICE_MS : PASSING_NOTICE_MS;
      show({ kind: heraldKind(kind), text, ...actions }, duration);
    },
    /** @param {string} mid @param {Line} line @param {number} ms */
    notice(mid, line, ms) {
      /** @type {Notice} */
      const next = { mid, kind: heraldKind(line.kind || "done"), text: line.text };
      if (line.sub) next.sub = line.sub;
      if (line.undo) Object.assign(next, { undo: line.undo, undoLabel: line.undoLabel, undoUntil: line.until || 0, ownFocus: true });
      if (!forMsg(mid, () => next, ms)) show(next, ms);
    },
    unnotice: drop,
  };
}
