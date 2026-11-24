// @ts-check

import { RM } from "../../core/ui/motion.js";

// The one owner of a conversation's scroll: pinned at the latest, or reading where you are, read from the position itself.

/** @typedef {HTMLElement | (() => HTMLElement | null) | null | undefined} ElOrGet */

/** @typedef {{ scroller: ElOrGet, column: ElOrGet, msgs: ElOrGet, dock?: ElOrGet }} FollowEls */

/** @typedef {{ fromLatest: () => number, fromTop: () => number, isPinned: () => boolean, toLatest: (smooth?: boolean) => void, toTop: () => void, unpin: (row?: Element | null) => void, toRow: (el: Element | null | undefined, smooth?: boolean) => void, init: () => void, destroy: () => void }} Follow */


/** @param {FollowEls} els @returns {Follow} */
export function createFollow(els) {
  /** @param {keyof FollowEls} k */
  const get = (k) => { const v = els[k]; return typeof v === "function" ? v() : v; };
  /** @param {keyof FollowEls} k */
  function required(k) {
    const node = get(k);
    if (!node) throw new Error(`Missing conversation follow target: ${k}`);
    return node;
  }
  const sc = () => required("scroller");
  const rowsEl = () => required("msgs");
  let pinned = true, lastTop = 0;
  /** @type {{ k: string, y: number } | null} */
  let place = null;
  let at = 0, width = 0;
  let held = false;

  const fromLatest = () => { const s = sc(); return Math.max(0, s.scrollHeight - s.clientHeight - s.scrollTop); };
  const fromTop = () => Math.max(0, sc().scrollTop);
  const isPinned = () => pinned;
  /** @param {boolean} [smooth] */
  function toLatest(smooth = false) {
    const s = sc();
    pinned = true;
    s.scrollTo({ top: s.scrollHeight, behavior: smooth && !RM.matches ? "smooth" : "auto" });
  }
  function toTop() {
    pinned = false; held = false;
    sc().scrollTop = 0; lastTop = 0;
  }
  /** @param {Element | null} [row] */
  function unpin(row) {
    pinned = false;
    const list = rowsEl();
    /** @type {HTMLElement | null} */
    let el = row && row.closest ? row.closest("[data-k]") : null;
    while (el && el.parentElement !== list) el = el.parentElement && el.parentElement.closest ? el.parentElement.closest("[data-k]") : null;
    held = !!el;
    if (el) place = { k: el.dataset.k || "", y: el.getBoundingClientRect().top - (sc().getBoundingClientRect().top + 1) };
    else notePlace();
  }

  /** @param {Element | null | undefined} el @param {boolean} [smooth] */
  function toRow(el, smooth = false) {
    const s = sc();
    if (!el || !s.contains(el)) return;
    pinned = false; held = false;
    const dock = get("dock");
    const over = dock ? Math.max(0, s.getBoundingClientRect().bottom - dock.getBoundingClientRect().top) : 0;
    const view = Math.max(80, s.clientHeight - over);
    const r = el.getBoundingClientRect(), sr = s.getBoundingClientRect();
    const top = Math.max(0, Math.min(s.scrollHeight - s.clientHeight, s.scrollTop + (r.top - sr.top) - Math.max(0, (view - r.height) / 2)));
    if (smooth && !RM.matches && Math.abs(top - s.scrollTop) <= s.clientHeight * 1.5) s.scrollTo({ top, behavior: "smooth" });
    else { s.scrollTop = top; lastTop = s.scrollTop; notePlace(); }
  }

  function notePlace() {
    const s = sc(), rows = /** @type {HTMLCollectionOf<HTMLElement>} */ (rowsEl().children);
    if (!rows.length) { place = null; return; }
    const top = s.getBoundingClientRect().top + 1, mid = top + s.clientHeight / 2;
    let i = Math.min(at, rows.length - 1);
    while (i > 0 && rows[i - 1].getBoundingClientRect().bottom > mid) i--;
    while (i < rows.length - 1 && rows[i].getBoundingClientRect().bottom <= mid) i++;
    at = i;
    const el = rows[i];
    place = el.dataset.k ? { k: el.dataset.k, y: el.getBoundingClientRect().top - top } : null;
  }
  function keepPlace() {
    const s = sc();
    if (!place) return;
    const k = place.k;
    const el = /** @type {HTMLElement[]} */ ([...rowsEl().children]).find((e) => e.dataset.k === k);
    if (!el) return;
    const d = el.getBoundingClientRect().top - (s.getBoundingClientRect().top + 1) - place.y;
    if (Math.abs(d) >= 1) { s.scrollTop += d; lastTop = s.scrollTop; }
  }

  /** @type {ResizeObserver | null} */
  let ro = null;
  /** @type {(() => void) | null} */
  let removeScroll = null;
  function init() {
    const s = sc(), column = required("column");
    lastTop = s.scrollTop;
    let seenW = column.clientWidth;
    const onScroll = () => {
      const top = s.scrollTop, gap = s.scrollHeight - s.clientHeight - top;
      const w = column.clientWidth;
      if (w !== seenW) { seenW = w; lastTop = top; return; }
      const ours = Math.abs(top - lastTop) < 1;
      if (gap <= 2) pinned = true;
      else if (top < lastTop - 1) pinned = false;
      lastTop = top;
      if (!pinned && !(held && ours)) { held = false; notePlace(); }
    };
    s.addEventListener("scroll", onScroll, { passive: true });
    removeScroll = () => s.removeEventListener("scroll", onScroll);
    const keep = () => {
      if (pinned) { if (fromLatest() > 0.5) { s.scrollTop = s.scrollHeight; lastTop = s.scrollTop; } width = column.clientWidth; return; }
      if (column.clientWidth !== width) { width = column.clientWidth; keepPlace(); }
      if (!held) notePlace();
    };
    width = column.clientWidth;
    ro = new ResizeObserver(keep);
    ro.observe(column); ro.observe(s);
  }
  function destroy() { ro?.disconnect(); ro = null; removeScroll?.(); removeScroll = null; }
  return { fromLatest, fromTop, isPinned, toLatest, toTop, unpin, toRow, init, destroy };
}

const MAIN = createFollow({ scroller: () => document.getElementById("scroller"), column: () => document.getElementById("column"), msgs: () => document.getElementById("msgs"), dock: () => document.getElementById("dock") });
export const fromLatest = () => MAIN.fromLatest();
export const toTop = () => MAIN.toTop();
export const fromTop = () => MAIN.fromTop();
export const isPinned = () => MAIN.isPinned();
export const toLatest = (smooth = false) => MAIN.toLatest(smooth);
/** @param {Element | null} [row] */
export const unpin = (row) => MAIN.unpin(row);
/** @param {Element | null | undefined} el @param {boolean} [smooth] */
export const toRow = (el, smooth = false) => MAIN.toRow(el, smooth);
export function initFollow() { MAIN.init(); return MAIN.destroy; }
