// Where the conversation's view is: one owner (QA #9). It replaces three systems that each moved the scroll
// (app.js's toBottom/stuck/holdAnchor/settle, msgx.js's follow with its timers and observers, and the
// "opened" guess from the header's text), refereed by ~14 timing constants.
//
// One state, read from the position itself, never from input events or timers:
//   pinned  you're at the latest: anything that grows (a reply streaming, pictures loading, the work card
//           opening, the dock changing height) keeps you there, before the frame is painted;
//   reading you've moved up from the latest (wheel, finger, keys, scrollbar, find-in-page, a jump to a
//           message): nothing here moves the view; the browser keeps your place as older pages land
//           (scroll anchoring; app.js puts it right itself where a browser has none).
// You're pinned again only at the real bottom, or by toLatest(): an intent to go to the latest (opening a
// conversation, sending, the back-to-latest button, pressing the agent's working bubble).
// Only four things write the scroll position: toLatest(), keeping pinned on growth, a jump to a message, and
// keeping the row you read in place when the view changes width (a panel opening or closing, a window
// resized): the conversation re-wraps, and a change to the view's own size is one the browser's scroll
// anchoring doesn't hold (opening the right panel moved the row you read 840-864 px at 1280 wide).

const sc = () => document.getElementById("scroller");
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
let pinned = true, lastTop = 0;
let place = null, at = 0, width = 0; // while reading: the row held {k, y}; the top row's index; the column's width
let held = false; // the place is a row you acted on (not the top row): it's kept until you scroll

/** How far the view is from the latest, and from the top of what's drawn (px). */
export const fromLatest = () => { const s = sc(); return Math.max(0, s.scrollHeight - s.clientHeight - s.scrollTop); };
export const fromTop = () => Math.max(0, sc().scrollTop);
export const isPinned = () => pinned;
/** To the latest, pinned. */
export function toLatest(smooth = false) {
  const s = sc();
  pinned = true;
  s.scrollTo({ top: s.scrollHeight, behavior: smooth && !reduced() ? "smooth" : "auto" });
}
/** You've chosen something to read where it is: growth no longer carries the view. Given the row you acted on
 *  (or anything in it: a file chip opening the panel), that row is the one held if the view changes width,
 *  until you scroll; else the row at the top of the view (a fold you opened). */
export function unpin(row) {
  pinned = false;
  const el = row && row.closest && row.closest("#msgs > [data-k]");
  held = !!el;
  if (el) place = { k: el.dataset.k, y: el.getBoundingClientRect().top - (sc().getBoundingClientRect().top + 1) };
  else notePlace();
}

/** The row at the top of the view and where it stands, found from the last one (a few rows' rects, read when
 *  the layout is clean: after a scroll, or as the view's size changes). */
function notePlace() {
  const s = sc(), rows = document.getElementById("msgs").children;
  if (!rows.length) { place = null; return; }
  const top = s.getBoundingClientRect().top + 1;
  let i = Math.min(at, rows.length - 1);
  while (i > 0 && rows[i - 1].getBoundingClientRect().bottom > top) i--;
  while (i < rows.length - 1 && rows[i].getBoundingClientRect().bottom <= top) i++;
  at = i;
  const el = rows[i];
  place = el.dataset.k ? { k: el.dataset.k, y: el.getBoundingClientRect().top - top } : null;
}
/** The view changed width while you read: the row that was at its top goes back where it stood. */
function keepPlace() {
  const s = sc();
  if (!place) return;
  const el = [...document.getElementById("msgs").children].find((e) => e.dataset.k === place.k);
  if (!el) return;
  const d = el.getBoundingClientRect().top - (s.getBoundingClientRect().top + 1) - place.y;
  if (Math.abs(d) >= 1) { s.scrollTop += d; lastTop = s.scrollTop; }
}

export function initFollow() {
  const s = sc(), column = document.getElementById("column");
  lastTop = s.scrollTop;
  // moved up = reading; back at the latest = pinned. A glide down (smooth toLatest) never unpins, and
  // growth below changes no scrollTop, so neither is mistaken for you scrolling up.
  s.addEventListener("scroll", () => {
    const top = s.scrollTop, gap = s.scrollHeight - s.clientHeight - top;
    // only the real bottom re-arms following; a small scroll near it moves you just that far (QA R1: a 4 px
    // scroll inside the last 120 px used to jump you to the end)
    // (a scroll that's ours, keepPlace putting a row back, leaves a held row held)
    const ours = Math.abs(top - lastTop) < 1;
    if (gap <= 2) pinned = true;
    else if (top < lastTop - 1) pinned = false;
    lastTop = top;
    if (!pinned && !(held && ours)) { held = false; notePlace(); }
  }, { passive: true });
  // growth (or the view's own size changing) while pinned: stay at the latest, before the frame is painted;
  // while reading, a change of width keeps the row you read in place (same moment, same observer)
  const keep = () => {
    if (pinned) { if (fromLatest() > 0.5) { s.scrollTop = s.scrollHeight; lastTop = s.scrollTop; } width = column.clientWidth; return; }
    if (column.clientWidth !== width) { width = column.clientWidth; keepPlace(); }
    if (!held) notePlace();
  };
  width = column.clientWidth;
  const ro = new ResizeObserver(keep);
  ro.observe(column); ro.observe(s);
}
