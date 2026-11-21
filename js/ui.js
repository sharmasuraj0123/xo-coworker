// Converged · small shared helpers: icons, a keyed DOM reconciler, time words, smooth disclosure,
// reduced motion and the optional soft sounds (off by default).
import { esc } from "./world.js";
import { redraw, pressedNode } from "./redraw.js";
import { usable } from "./focusview.js";

import { xi, stateMark, ARC } from "./icon.js";
export { xi, stateMark, ARC };

// Every icon is the owner's (assets/icons/xo, 19 Nov), drawn on its 24 grid with its own pen (1.75, round ends),
// cleaned for the page by tools/xoicons/build.mjs into js/xoicons.js: the one source (js/icon.js draws one).

// The app's names for the icons it uses most (ICONS.md, design-research/2026-11-19-icons), each one file of the pack.
export const ICON = {
  project: xi("project"),
  globe: xi("web"),
  send: xi("send"),
  thread: xi("chat"),
  branch: xi("branch"),
  back: xi("chevron-left"),
  arrow: xi("arrow-right"),
  down: xi("arrow-down"),
  close: xi("close"),
  search: xi("search"),
  // the tick draws itself in where it lands (.tk, css/app.css): its length is 24 to the animation
  check: xi("check").replace("<path ", '<path class="tk" pathLength="24" '),
  rewind: xi("send-back"),
  reply: xi("reply"),
  copy: xi("copy"),
  retry: xi("retry"),
  edit: xi("edit"),
  chevron: xi("chevron-down"),
  list: xi("list"),
  lock: xi("lock"),
  stop: xi("stop"),
  needs: xi("state-needs-you"),
  doing: xi("step-doing"),
  todo: xi("state-idle"),
  sound: xi("sound"),
  plus: xi("plus"),
  home: xi("home"),
  right: xi("chevron-right"),
  clock: xi("clock"),
  // a refusal or an error said in a line
  warn: xi("warning"),
  menu: xi("menu"),
  eye: xi("eye"),
  clip: xi("attach"),
  doc: xi("doc"),
  image: xi("image"),
  folder: xi("folder"),
  folderOpen: xi("folder-open"),
  moon: xi("moon"),
  spark: xi("suggestion"),
  // act now: interrupt, send now
  bolt: xi("interrupt"),
  // this file runs code (the viewer's badge)
  runsCode: xi("runs-code"),
  gear: xi("gear"),
  sliders: xi("settings-general"),
  pause: xi("pause"),
  hourglass: xi("hourglass"),
  sun: xi("sun"),
  contrast: xi("contrast"),
  rule: xi("rules"),
  key: xi("key"),
  // a thread: one agent's conversation with words in it (Chats keeps the empty bubble, `thread`)
  threadOne: xi("thread"),
  // the panel's Threads frame
  threads: xi("threads"),
  // artifacts: what threads made
  stack: xi("artifacts"),
  pin: xi("pin"),
  shell: xi("terminal"),
  minimize: xi("minimize"),
  // the sidebar (or the file tree) folding to its rail
  sidebar: xi("sidebar-left"),
  panel: xi("panel-right"),
  full: xi("full-size"),
  unfull: xi("exit-full-size"),
  foldRail: xi("fold-to-rail"),
  changes: xi("changes"),
  map: xi("map"),
  graph: xi("graph"),
  follow: xi("follow"),
  fit: xi("fit"),
  // needs you: the mark the sidebar and the lists use
  diamond: xi("state-needs-you"),
  // more: every ⋯
  more: xi("more"),
  // the stamps a decision lands with (Allowed, Sent back): their mark draws itself in (.sk, css/app.css)
  stampAllow: xi("stamp-allowed", "stamp-svg").replace("<path ", '<path class="sk" pathLength="60" '),
  stampBack: xi("stamp-sent-back", "stamp-svg").replace("<path ", '<path class="sk" pathLength="60" '),
  // where an agent is on the Map: the pack's cursor, framed so its tip sits at (1, 1) of an 18 box
  cursor: xi("agent-cursor", "dg-arrow").replace('viewBox="0 0 24 24"', 'viewBox="4.5 2.5 18 18"'),
  runtime: xi("runtime"),
  router: xi("routing"),
  shape: xi("shape"),
  out: xi("external-link"),
  backTo: xi("arrow-left"),
  fileNew: xi("file-new"),
  link: xi("link"),
  split: xi("split-view"),
  code: xi("code"),
  good: xi("thumbs-up"),
  bad: xi("thumbs-down"),
  del: xi("delete"),
  agent: xi("agent"),
  plug: xi("plug"),
  ask: xi("question"),
  dot: xi("step-dot"),
  deploy: xi("deploy"),
  github: xi("github"),
  container: xi("container"),
  server: xi("server"),
};

/** The "next" glyph: XO's own chevron, from the mark. */
export const NEXT_GLYPH = xi("next-move", "nx-g");

/** Effort: how much of you an ask takes, Glance, Decide or Think (the pack's three marks). */
export function dial(effort) {
  const e = { glance: 1, decide: 1, think: 1 }[effort] ? effort : "decide";
  return xi(`effort-${e}`, `dial d-${e}`);
}

/** The XO mark: the X in the theme's ink, the O green (.x, .o: css/app.css). */
export const XO = xi("xo-mark", "xo-mark");

/**
 * Smooth height change: measure, mutate, measure, animate the height
 * continuously while the new content cross-fades in. No jumps.
 */
export function morph(el, mutate, { duration = 320, fade = null } = {}) {
  if (!el) { mutate(); return; }
  const h0 = el.getBoundingClientRect().height;
  mutate();
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const h1 = el.getBoundingClientRect().height;
  if (Math.abs(h1 - h0) > 1) {
    el.getAnimations?.().forEach((a) => a.id === "morph" && a.cancel());
    const a = el.animate([{ height: `${h0}px`, overflow: "hidden" }, { height: `${h1}px`, overflow: "hidden" }], { duration, easing: EASE });
    a.id = "morph";
  }
  if (fade) fade.animate([{ opacity: 0 }, { opacity: 1 }], { duration: Math.round(duration * 0.8), easing: EASE, delay: Math.round(duration * 0.15), fill: "backwards" });
}

/** One easing for every size change: continuous, no front-loaded jump (a frame never moves more than ~40 px). */
export const EASE = "cubic-bezier(.2,.8,.2,1)"; // the one curve (css/tokens.css --ease)
export const EXPAND_MS = 320;

/**
 * Smooth disclosure (#20): the body's height animates continuously from its old
 * to its new size over ~320 ms while its contents cross-fade. Opening renders the
 * contents first (so they can be measured); closing animates, then removes them
 * from layout (so folded text is never counted, read or tabbed to).
 * box: the element that carries .is-open; body: the element whose height moves.
 */
export function expand(box, body, open, { onStep = null, frame = null } = {}) {
  if (!box || !body) return;
  if (frame) { expandFrame(box, body, open, frame, onStep); return; }
  const was = box.classList.contains("is-open");
  if (was === open && !body._closing) return;
  const rm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  body.getAnimations?.().forEach((a) => a.cancel());
  const inner = body.firstElementChild;
  const h0 = was && !body.hidden ? body.getBoundingClientRect().height : 0;
  body._closing = false;
  if (open) {
    body.hidden = false;
    box.classList.add("is-open");
    if (rm) return;
    const h1 = body.getBoundingClientRect().height;
    const a = body.animate([{ height: `${h0}px` }, { height: `${h1}px` }], { duration: EXPAND_MS, easing: EASE });
    body.style.overflow = "hidden";
    a.onfinish = a.oncancel = () => { body.style.overflow = ""; };
    if (inner) inner.animate([{ opacity: 0, transform: "translateY(-3px)" }, { opacity: 1, transform: "none" }], { duration: 220, delay: 60, easing: EASE, fill: "backwards" });
  } else {
    box.classList.remove("is-open");
    if (rm || !h0) { body.hidden = true; return; }
    body._closing = true;
    body.style.overflow = "hidden";
    if (inner) inner.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: EASE, fill: "forwards" });
    const a = body.animate([{ height: `${h0}px` }, { height: "0px" }], { duration: EXPAND_MS - 40, easing: EASE });
    a.onfinish = () => { if (body._closing) { body.hidden = true; body._closing = false; } body.style.overflow = ""; inner?.getAnimations?.().forEach((x) => x.cancel()); };
  }
  if (onStep) { const t0 = performance.now(); const f = () => { onStep(); if (performance.now() - t0 < EXPAND_MS + 40) requestAnimationFrame(f); }; requestAnimationFrame(f); }
}

/**
 * The same, for a card with a capped height (the thread's own card): the card's
 * frame animates from its old to its new height, so the motion stays continuous
 * even when the card hits its cap and its body starts to scroll.
 */
function expandFrame(box, body, open, frame, onStep) {
  const rm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  frame.getAnimations?.().forEach((a) => a.id === "xf" && a.cancel());
  const inner = body.firstElementChild;
  const h0 = frame.getBoundingClientRect().height;
  if (open) { body.hidden = false; box.classList.add("is-open"); }
  else { box.classList.remove("is-open"); body.hidden = true; }
  if (rm) return;
  const h1 = frame.getBoundingClientRect().height;
  if (!open) { body.hidden = false; }
  frame.style.overflow = "hidden";
  const a = frame.animate([{ height: `${h0}px` }, { height: `${h1}px` }], { duration: EXPAND_MS, easing: EASE });
  a.id = "xf";
  if (open && inner) inner.animate([{ opacity: 0, transform: "translateY(-3px)" }, { opacity: 1, transform: "none" }], { duration: 220, delay: 60, easing: EASE, fill: "backwards" });
  if (!open && inner) inner.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: "forwards" });
  a.onfinish = a.oncancel = () => { frame.style.overflow = ""; if (!box.classList.contains("is-open")) body.hidden = true; inner?.getAnimations?.().forEach((x) => x.cancel()); };
  if (onStep) { const t0 = performance.now(); const f = () => { onStep(); if (performance.now() - t0 < EXPAND_MS + 40) requestAnimationFrame(f); }; requestAnimationFrame(f); }
}

/** mm:ss for a countdown. */
export const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
/** "3 h 12 m" / "42 m" for how long something has waited. */
export function waited(ms) {
  const m = Math.max(1, Math.round(ms / 60000));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
}

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const RM = matchMedia("(prefers-reduced-motion: reduce)");
/** An animation's time: none under reduced motion. Never for time a person needs to act (see hold). */
export const wait = (ms) => new Promise((r) => setTimeout(r, RM.matches ? 0 : ms));
/** Time a person has to act (an Undo window, a moment to read): real time, reduced motion or not. Reduced motion
 *  cuts animations, never the time to act (Astra S014: the dock's Undo vanished in ~20 ms). */
export const hold = (ms) => new Promise((r) => setTimeout(r, ms));

// one formatter each, made once: toLocale*String with options builds a new one per call (25 ms per redraw
// of a 400-row conversation; QA C5)
const CLOCK_F = new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" });
const DAY_F = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" });
export function clock(ms) {
  return CLOCK_F.format(ms);
}
export function dayOf(ms, now = Date.now()) {
  const d = new Date(ms), t = new Date(now), y = new Date(now - 86400000);
  if (d.toDateString() === t.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return DAY_F.format(d);
}
export function short(ms, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 45) return "now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return new Date(ms).toLocaleDateString(undefined, { weekday: "short" });
}
export function elapsed(secs) {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  if (m < 60) return `${m}m ${String(secs % 60).padStart(2, "0")}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}
export const plain = (md) => String(md || "").replace(/```[\s\S]*?```/g, "[code]").replace(/[*_`#>]/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\s+/g, " ").trim();

/**
 * Keyed reconcile: items [{key, html}] → children of `box`. Unchanged items
 * keep their element (so animations, focus and selection survive a tick);
 * new ones get `is-new` unless `quiet`. Returns the list of new elements.
 *
 * A changed item is drawn anew, except the one you're in: a row holding focus is brought to its new HTML in
 * place (js/redraw.js), so the control you're on stays (Astra DET-1: a tool's output arriving took focus from
 * its disclosure). Its own attributes come from the new HTML; once the list is in order it hears "redrawn"
 * (bubbling), so whatever decorates rows (js/msgx.js) puts its additions back in the same task. Every other row
 * is replaced as before, unless `inPlace`: then every changed row is updated in place (a list whose rows animate in).
 */
/** Where focus can land in a row: its controls, in order. */
const LANDING = 'button:not(:disabled), a[href], input:not([type="hidden"]):not(:disabled), textarea:not(:disabled), [tabindex="0"]';
export function reconcile(box, items, { quiet = false, fallback = null, inPlace: always = false } = {}) {
  const old = new Map();
  for (const el of box.children) if (el.dataset.k) old.set(el.dataset.k, el);
  const added = [];
  const parse = (html) => { const tpl = document.createElement("template"); tpl.innerHTML = html.trim(); return tpl.content.firstElementChild; };
  const active = document.activeElement, inPlace = [];
  // the node under a press: a row holding it is updated in place, as one holding focus is, so the press still clicks
  // (a row drawn anew mid-press took the pressed node with it, and the browser drops that click: the owner, 19 Nov)
  const pressed = pressedNode();
  // a row that's going while it holds focus hands it on first, never to BODY (the create-project/Launchpad grader on
  // f70ca6b, C050/C121: the working mini, dropped with no finished blocks, took focus with it): the nearest row that
  // stays, before it, else after it (found now, before anything moves), or the list's fallback
  const keep = new Set(items.map((it) => it.key));
  const going = [...box.children].find((el) => el.dataset.k && !keep.has(el.dataset.k) && el.contains(active));
  let near = null;
  if (going) {
    for (let s = going.previousElementSibling; s && !near; s = s.previousElementSibling) if (s.dataset.k && keep.has(s.dataset.k)) near = s.dataset.k;
    for (let s = going.nextElementSibling; s && !near; s = s.nextElementSibling) if (s.dataset.k && keep.has(s.dataset.k)) near = s.dataset.k;
  }
  items.forEach((it, i) => {
    let el = old.get(it.key);
    if (el && el._h !== it.html) {
      const fresh = parse(it.html);
      if ((always || (active && active !== el && el.contains(active)) || (pressed && el.contains(pressed))) && fresh && fresh.tagName === el.tagName) {
        for (const a of [...el.attributes]) if (a.name !== "data-k" && !fresh.hasAttribute(a.name)) el.removeAttribute(a.name);
        for (const a of fresh.attributes) if (el.getAttribute(a.name) !== a.value) el.setAttribute(a.name, a.value);
        redraw(el, fresh.innerHTML);
        el._h = it.html;
        inPlace.push(el);
      } else {
        fresh.dataset.k = it.key; fresh._h = it.html;
        const had = el === active;
        el.replaceWith(fresh); el = fresh;
        if (had && fresh.tabIndex >= 0) fresh.focus({ preventScroll: true });
      }
    } else if (!el) {
      el = parse(it.html);
      el.dataset.k = it.key; el._h = it.html;
      if (!quiet) { el.classList.add("is-new"); added.push(el); }
    }
    old.delete(it.key);
    const at = box.children[i];
    if (at !== el) box.insertBefore(el, at || null);
  });
  if (going) {
    near = near && [...box.children].find((el) => el.dataset.k === near);
    const to = (near && [...near.querySelectorAll(LANDING)].find(usable)) || (fallback && fallback());
    if (to && to.focus) to.focus({ preventScroll: true });
  }
  for (const el of old.values()) el.remove();
  // told once the list is in its final order, so what decorates rows sees their neighbours as they are
  for (const el of inPlace) if (el.isConnected) el.dispatchEvent(new CustomEvent("redrawn", { bubbles: true }));
  return added;
}

// ── optional soft sounds (OFF by default; the person turns them on) ─────────
// Turning sounds on takes a choice the browser will keep (sound that came back after a reload, or didn't, would be a
// surprise either way): where it won't keep it, they stay off and that's said. Turning them off always works on this
// page, and says when it won't be remembered. Turning on is a press, so the audio is made or woken right then; where
// the browser won't play (no audio, or it refuses), they stay off and that's said.
// (create-project grader on 7e0db5b, C117: a refused write left the switch off, a refused audio left it on with
// nothing said, and a suspended context was never woken, its notes queueing silently.)
let actx = null, chosen = null;
const stored = () => { try { return localStorage.getItem("cv-sound") === "on"; } catch { return false; } };
const keep = (v) => { try { localStorage.setItem("cv-sound", v ? "on" : "off"); return localStorage.getItem("cv-sound") === (v ? "on" : "off"); } catch { return false; } };
export const sound = {
  get on() { return chosen ?? stored(); },
  /**
   * Turn sounds on or off from a press. Resolves to {on, kept, refused}: on, what the switch now says; kept, whether
   * the browser keeps the choice (asked for on and not kept: they stay off); refused, that the browser won't play
   * sound here (so they're off).
   */
  async turn(want) {
    if (!want) { chosen = false; return { on: false, kept: keep(false), refused: false }; }
    if (!keep(true)) { chosen = false; return { on: false, kept: false, refused: false }; }
    try {
      actx = actx || new AudioContext();
      if (actx.state === "suspended") await actx.resume();
    } catch { actx = null; }
    if (!actx || actx.state !== "running") { chosen = false; keep(false); return { on: false, kept: true, refused: true }; }
    chosen = true;
    return { on: true, kept: true, refused: false };
  },
  play(kind) {
    if (!this.on) return;
    try {
      actx = actx || new AudioContext();
      if (actx.state !== "running") return; // asleep (a tab in the background): never queue notes for later
      const notes = { allow: [660, 990], back: [520, 390], done: [523, 659, 784], lock: [880], send: [740] }[kind] || [660];
      notes.forEach((f, i) => {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = "sine"; o.frequency.value = f;
        const t = actx.currentTime + i * 0.07;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.045, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 0.25);
      });
    } catch { /* no audio */ }
  },
};

export { esc };

/** The working cue: three dots that hop in turn (css/app.css .dots). */
export const DOTS = `<i class="dots" aria-hidden="true"><i></i><i></i><i></i></i>`;

/**
 * Every turning arc and every shimmering "working" line on the page moves in step, from the page's first
 * moment, whenever it was drawn: one redrawn by a streamed update would otherwise restart from zero and
 * look like it stutters.
 */
export function keepTurning() {
  if (typeof document === "undefined" || !document.getAnimations) return;
  const sync = () => {
    for (const a of document.getAnimations()) {
      if (a.animationName === "spin" || a.animationName === "arc-turn" || a.animationName === "shimmer" || a.animationName === "dot-hop") { if (a.startTime !== 0) a.startTime = 0; }
    }
  };
  // only when something added holds an arc, a spinner or a shimmer (a scan of every animation on the page
  // after any change at all cost tens of ms on a busy page, QA #11), and at once, before the frame is
  // painted: a redrawn arc used to show one frame from its start before being put back in step
  const MOVING = ".arc, .g-working, .spin, .shimmer, .tb-live, .dots";
  const moving = (n) => n.nodeType === 1 && (n.matches(MOVING) || !!n.querySelector(MOVING));
  new MutationObserver((recs) => {
    for (const r of recs) for (const n of r.addedNodes) if (moving(n)) { sync(); return; }
  }).observe(document.body, { childList: true, subtree: true });
  sync();
}

/** A checklist step's mark, from the pack: done, doing, to do. */
export const stepMark = (s) => (s === "done" ? ICON.check : s === "doing" ? ICON.doing : ICON.todo);
