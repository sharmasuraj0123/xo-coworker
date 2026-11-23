// @ts-check
import { esc } from "../../core/platform/index.js";
import { ICON } from "../../core/ui/icons/names.js";
import { redraw } from "../../core/ui/redraw.js";

/** @typedef {{ text: string, kind: string, undo?: (() => void) | null, undoLabel?: string, until?: number, sub?: string }} Notice */

/** @param {{ notes: HTMLElement | null, shown: string | null }} S @param {{ notify?: (text: string, undo: (() => void) | null, kind: string) => void, notice?: (mid: string, line: Notice, ms: number) => void, unnotice?: (mid: string) => void }} callbacks */
export function createWindowNotices(S, { notify, notice, unnotice }) {
  /** @type {Map<string, { line: Notice; until: number; t: ReturnType<typeof setTimeout>; u: ReturnType<typeof setTimeout> | 0 }>} */
  const N = new Map();
  let seq = 0;
  const local = () => !!(S.notes && S.shown);
  function drawNotes() {
    if (!S.notes) return;
    const now = Date.now();
    redraw(S.notes, [...N].map(([mid, { line: l }]) => { const undo = l.undo && (!l.until || l.until > now), err = l.kind === "err";
      return `<div class="hr hr-ev${undo ? " has-undo" : ""} k-${err ? "stopped" : "done"}" data-mid="${esc(mid)}"><span class="hr-ic ${err ? "k-stopped" : "k-ok"}">${err ? ICON.close : ICON.check}</span><span class="hr-t">${esc(l.text)}</span>${l.sub ? `<span class="hr-s">${esc(l.sub)}</span>` : ""}${undo ? `<button type="button" class="hr-undo" data-lq-undo>${esc(l.undoLabel || "Undo")}</button>` : ""}</div>`; }).join(""));
  }
  /** @param {string} mid */
  const drop = (mid) => { const n = N.get(mid); if (!n) return false; clearTimeout(n.t); clearTimeout(n.u); N.delete(mid); return true; };
  /** @param {string} mid @param {Notice} line @param {number} ms */
  const say = (mid, line, ms) => {
    if (local()) {
      drop(mid);
      N.set(mid, { line, until: Date.now() + ms, t: setTimeout(() => { N.delete(mid); drawNotes(); }, ms), u: line.until ? setTimeout(drawNotes, Math.max(0, line.until - Date.now())) : 0 });
      drawNotes(); return;
    }
    if (notice) notice(mid, line, ms); else if (notify) notify(line.text, line.undo || null, line.kind);
  };
  /** @param {string} [mid] */
  const unsay = (mid) => { if (!mid) return; if (drop(mid)) drawNotes(); else if (unnotice) unnotice(mid); };
  /** @param {string} text @param {(() => void) | null} undo @param {string} kind */
  const tell = (text, undo = null, kind = "done") => (local() ? say(`lp-n${++seq}`, { text, kind, undo }, kind === "err" ? 6000 : 4200) : notify && notify(text, undo, kind));
  function handOver() {
    const now = Date.now();
    for (const [mid, n] of [...N]) { drop(mid); if (n.until > now && notice) notice(mid, n.line, n.until - now); }
    drawNotes();
  }

  /** @param {string | undefined} mid */
  function undoNotice(mid) {
    const n = mid && N.get(mid);
    if (!n) return;
    drop(mid);
    drawNotes();
    n.line.undo?.();
  }

  return { say, unsay, tell, handOver, undoNotice };
}
