// @ts-check

/** @import { Probe, Page, SettleOptions } from "./types.d.ts" */

// The in-page probe (open requests, pending timers and frames, DOM changes, focus that falls to the page) and the settle barrier.

export const POLL_MS = 1000;
export const QUIET_FRAMES = 3;

/** Runs before the app's first script (context.addInitScript). @param {number} poll */
export function probe(poll) {
  const w = /** @type {any} */ (window);
  if (w.__e2e) return;
  /** @type {Probe} */
  const S = { fetches: new Map(), timers: new Map(), frames: 0, quiet: 0, changed: [], n: 0, drops: [], busy: () => [], checkDrops: () => {} };
  w.__e2e = S;
  const raf = globalThis.requestAnimationFrame.bind(globalThis), caf = globalThis.cancelAnimationFrame.bind(globalThis);
  /** @type {Set<number>} */
  const frames = new Set();
  const of = globalThis.fetch.bind(globalThis);
  globalThis.fetch = function (input, init) {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const id = ++S.n;
    S.fetches.set(id, new URL(raw, location.href).pathname);
    const end = () => { if (S.fetches.delete(id)) S.quiet = 0; };
    return of(input, init).then((r) => {
      const c = r.clone();
      if (/^text\/event-stream/.test(r.headers.get("content-type") || "")) {
        const reader = c.body?.getReader();
        if (!reader) end();
        else reader.read().then(() => { end(); reader.cancel().catch(() => {}); }, end);
      } else c.arrayBuffer().then(end, end);
      return r;
    }, (e) => { end(); throw e; });
  };
  const st = globalThis.setTimeout, ct = globalThis.clearTimeout;
  /** @type {(fn: unknown, ms?: number, ...a: unknown[]) => number} */
  const later = (fn, ms, ...a) => {
    const d = Number(ms) || 0;
    if (d >= poll || typeof fn !== "function") return /** @type {any} */ (st)(fn, ms, ...a);
    const id = st(() => { S.timers.delete(id); S.quiet = 0; fn(...a); }, d);
    S.timers.set(id, `${d} ms ${fn.name || "anonymous"}`);
    return id;
  };
  const g = /** @type {any} */ (globalThis);
  g.setTimeout = later;
  g.clearTimeout = (/** @type {number | undefined} */ id) => { S.timers.delete(id); ct(id); };
  g.requestAnimationFrame = (/** @type {FrameRequestCallback} */ fn) => {
    const id = raf((t) => { frames.delete(id); S.frames = frames.size; fn(t); });
    frames.add(id);
    S.frames = frames.size;
    return id;
  };
  g.cancelAnimationFrame = (/** @type {number} */ id) => { frames.delete(id); S.frames = frames.size; caf(id); };
  const name = (/** @type {Node} */ n) => {
    const e = n instanceof Element ? n : n.parentElement;
    if (!e) return "#text";
    return `${e.tagName.toLowerCase()}${e.id ? "#" + e.id : ""}${e.classList.length ? "." + [...e.classList].slice(0, 2).join(".") : ""}`;
  };
  /** @type {Element | null} */
  let had = null;
  S.checkDrops = () => {
    const a = document.activeElement;
    if ((!a || a === document.body) && had && (!had.isConnected || !had.getClientRects().length)) { S.drops.push(`${name(had)} "${(had.getAttribute("aria-label") || had.textContent || "").trim().slice(0, 30)}"`); had = null; }
  };
  document.addEventListener("focusin", (e) => { if (e.target !== document.body) had = /** @type {Element} */ (e.target); }, true);
  document.addEventListener("focusout", (e) => {
    const t = e.target;
    queueMicrotask(() => { if (had && had === t && had.isConnected && had.getClientRects().length) had = null; else S.checkDrops(); });
  }, true);
  const watch = () => new MutationObserver((list) => {
    S.quiet = 0;
    S.changed = list.slice(-3).map((m) => `${m.type}${m.attributeName ? ":" + m.attributeName : ""} on ${name(m.target)}`);
    queueMicrotask(S.checkDrops);
  }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
  if (document.documentElement) watch(); else addEventListener("DOMContentLoaded", watch, { once: true });
  const tick = () => { S.quiet++; raf(tick); };
  raf(tick);
  S.busy = (quietFrames) => {
    /** @type {string[]} */
    const why = [];
    if (S.fetches.size) why.push(`requests open: ${[...S.fetches.values()].join(", ")}`);
    if (S.timers.size) why.push(`timers waiting: ${[...S.timers.values()].join(", ")}`);
    if (S.frames) why.push(`${S.frames} animation frame callback(s) waiting`);
    if (S.quiet < quietFrames) why.push(`last change ${S.quiet} frame(s) ago: ${S.changed.join("; ") || "pending work finished"}`);
    if (document.fonts && document.fonts.status !== "loaded") why.push("fonts loading");
    const b = document.querySelector('[aria-busy="true"]');
    if (b) why.push(`busy: ${name(b)}`);
    return why;
  };
}

/** What still keeps the page busy; [] once it has settled. @param {number} q */
export const busyNow = (q) => { /** @type {Probe | undefined} */ const S = /** @type {any} */ (window).__e2e; return S ? S.busy(q) : ["the e2e probe isn't installed"]; };

/** Wait for the page and the Space to settle; past `timeout` ms, throw with what is still busy. @param {Page} page @param {{open: number, idle(ms: number): Promise<boolean>}} [space] @param {SettleOptions} [o] */
export async function settle(page, space, { timeout = 5000, quietFrames = QUIET_FRAMES } = {}) {
  const t0 = Date.now();
  const left = () => Math.max(1, timeout - (Date.now() - t0));
  for (;;) {
    /** @type {string[]} */
    let why;
    try {
      await page.waitForFunction((/** @type {number} */ q) => /** @type {any} */ (window).__e2e?.busy(q).length === 0, quietFrames, { polling: "raf", timeout: left() });
      if (!space || space.open === 0) return Date.now() - t0;
      why = [`the Space is still answering ${space.open} request(s)`];
      await space.idle(left());
    } catch (e) {
      if (!/Timeout/i.test(String(e && /** @type {any} */ (e).message))) throw e;
      why = await page.evaluate(busyNow, quietFrames).catch(() => ["the page is gone"]);
    }
    if (Date.now() - t0 >= timeout) throw new Error(`the page didn't settle in ${timeout} ms: ${why.join(" | ")}`);
  }
}
