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
// You're pinned again the moment the view is back at the latest, or by toLatest() (opening a conversation,
// the back-to-latest button, pressing the agent's working bubble).
// Only three things write the scroll position: toLatest(), keeping pinned on growth, and a jump to a message.

const sc = () => document.getElementById("scroller");
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
let pinned = true, lastTop = 0;

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
/** You've chosen something to read where it is (a fold you opened): growth no longer carries the view. */
export function unpin() { pinned = false; }

export function initFollow() {
  const s = sc(), column = document.getElementById("column");
  lastTop = s.scrollTop;
  // moved up = reading; back at the latest = pinned. A glide down (smooth toLatest) never unpins, and
  // growth below changes no scrollTop, so neither is mistaken for you scrolling up.
  s.addEventListener("scroll", () => {
    const top = s.scrollTop;
    if (s.scrollHeight - s.clientHeight - top <= 2) pinned = true;
    else if (top < lastTop - 1) pinned = false;
    lastTop = top;
  }, { passive: true });
  // growth (or the view's own size changing) while pinned: stay at the latest, before the frame is painted
  const keep = () => { if (pinned && fromLatest() > 0.5) { s.scrollTop = s.scrollHeight; lastTop = s.scrollTop; } };
  const ro = new ResizeObserver(keep);
  ro.observe(column); ro.observe(s);
}
