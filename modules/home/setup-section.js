// @ts-check

import { read, write } from "../../core/platform/storage.js";
import { EASE, arrive, still, syncList } from "../../core/ui/motion.js";
import { redraw } from "../../core/ui/redraw.js";
import { IN, MOVE } from "../../core/ui/tokens.js";
import { headHtml, readyRuntime, rowHtml, setupNeeds, signedInNow } from "./setup.js";

/** @import { Lifetime } from "../../core/kernel/types" */

/** @import { Runtime } from "../../core/services/runtime-types" */

/** @import { GitHubRead, SetupItem } from "./setup.js" */

/** @typedef {{ state: { runtimes?: Runtime[] | null }, subscribe?: (fn: () => void) => () => void }} SetupWorld */

/** @typedef {(o: { signal: AbortSignal }) => Promise<{ status: string }>} ReadGitHub */

/** @typedef {{ done: () => boolean, finish: () => void }} SetupMemory */

/** @typedef {{ memory?: SetupMemory, seen?: (el: HTMLElement) => boolean }} SetupSeams */

/** @typedef {{ world: SetupWorld, githubStatus: ReadGitHub, scope: Lifetime, schedule: () => void } & SetupSeams} SetupDeps */

const AGAIN_MS = 3000;
const DONE_MS = 1800;
const FINAL_MS = 4000;
const STEP_MS = 60;
const KEY = "xo-setup-done";

/** @type {SetupMemory} */
const STORED = { done: () => read(KEY, (s) => s === "1", false), finish: () => { write(KEY, "1"); } };

/** @param {HTMLElement} el */
const onScreen = (el) => !document.hidden && !el.closest("[inert]") && el.getClientRects().length > 0;

/** @param {Element} el @param {() => void} then */
function fold(el, then) {
  if (still() || !(el instanceof HTMLElement)) { then(); return; }
  el.style.overflow = "hidden";
  const h = el.getBoundingClientRect().height;
  const frames = [{ height: `${h}px`, opacity: 1 }, { height: "0px", opacity: 0 }];
  el.animate(frames, { duration: MOVE, easing: EASE, fill: "forwards" }).finished.then(then, then);
}

/** The rows arrive one after another, each logo settling into its tile. @param {HTMLElement} box */
function welcome(box) {
  if (still()) return;
  arrive(box.querySelector(".su-hd"));
  box.querySelectorAll(".su-list > li").forEach((li, i) => {
    arrive(li, { delay: STEP_MS * (i + 1) });
    const frames = [{ opacity: 0, transform: "scale(.6) rotate(-12deg)" }, { opacity: 1, transform: "none" }];
    li.querySelector(".su-m")?.animate(frames, { duration: MOVE, delay: STEP_MS * (i + 2), easing: EASE, fill: "backwards" });
  });
}

/** @param {Element} li */
function checkOff(li) {
  if (still()) return;
  const frames = [{ opacity: 0, transform: "scale(.6)" }, { opacity: 1, transform: "none" }];
  li.querySelector(".su-ok")?.animate(frames, { duration: IN, easing: EASE });
}

/** Home's suggestions to get started, once per Space; each opens its Settings row and checks off when signed in. @param {SetupDeps} deps */
export function setupSection({ world, githubStatus, scope, schedule, memory = STORED, seen = onScreen }) {
  /** @type {GitHubRead} */
  let gh;
  let at = 0, reading = false, runtimes = world.state.runtimes, over = memory.done(), leaving = false;
  /** @type {Map<string, SetupItem>} */
  const shown = new Map();
  /** @type {Map<string, { done: boolean, started: boolean }>} */
  const ghosts = new Map();
  let closing = false;
  /** @type {WeakMap<Element, string>} */
  const drawn = new WeakMap();

  async function readGitHub() {
    if (reading || over || scope.signal.aborted) return;
    reading = true; at = Date.now();
    try { gh = await githubStatus({ signal: scope.signal }); }
    catch { gh = gh ?? null; }
    finally { reading = false; }
    if (!scope.signal.aborted) schedule();
  }
  const again = () => {
    if (over) return;
    schedule();
    if (gh?.status !== "connected" && Date.now() - at > AGAIN_MS) void readGitHub();
  };
  const finish = () => { over = true; memory.finish(); };

  void readGitHub();
  scope.effect(() => world.subscribe?.(() => { if (world.state.runtimes !== runtimes) { runtimes = world.state.runtimes; schedule(); } }));
  scope.listen(document, "visibilitychange", () => { if (!document.hidden) again(); });

  /** @param {string} key @param {HTMLElement} el */
  function settle(key, el) {
    const li = el.querySelector(`.su-list > li[data-k="${CSS.escape(key)}"]`);
    const gone = () => { shown.delete(key); ghosts.delete(key); schedule(); };
    if (li) fold(li, gone); else gone();
  }

  /** @param {HTMLElement} el @param {boolean} done */
  function leave(el, done) {
    const box = el.firstElementChild;
    const end = () => { el.replaceChildren(); leaving = false; closing = false; if (done) finish(); };
    leaving = true;
    if (box && done) fold(box, end); else end();
  }

  /** @param {HTMLElement} el @param {{ key: string, html: string }} row */
  function paint(el, row) {
    const was = drawn.get(el);
    if (was === row.html) return;
    if (was) redraw(el, row.html); else el.innerHTML = row.html;
    drawn.set(el, row.html);
    if (was && el.querySelector(".is-done")) checkOff(el);
  }

  /** @param {HTMLElement} el */
  function render(el) {
    if (over) { if (!leaving && el.firstChild) el.replaceChildren(); return; }
    const needs = setupNeeds(world.state.runtimes, gh);
    if (!needs || leaving) return;
    const live = new Set(needs.map((it) => it.key));
    for (const key of shown.keys()) {
      if (live.has(key)) ghosts.delete(key);
      else if (!ghosts.has(key)) ghosts.set(key, { done: signedInNow(key, world.state.runtimes, gh), started: false });
    }
    for (const it of needs) shown.set(it.key, it);
    if (!shown.size) { leave(el, gh?.status === "connected"); return; }

    let box = /** @type {HTMLElement | null} */ (el.querySelector(".su"));
    const fresh = !box;
    if (!box) {
      el.innerHTML = `<section class="su" aria-labelledby="su-h"><div class="su-hd"></div><ul class="su-list"></ul></section>`;
      box = /** @type {HTMLElement} */ (el.querySelector(".su"));
    }
    const allSet = !needs.length;
    redraw(box.querySelector(".su-hd"), headHtml({ allSet, ready: readyRuntime(world.state.runtimes) }));
    const rows = [...shown.values()].map((it) => ({ key: it.key, html: rowHtml(it, !!ghosts.get(it.key)?.done) }));
    syncList(/** @type {HTMLElement} */ (box.querySelector(".su-list")), rows, {
      make: (row) => { const li = document.createElement("li"); paint(li, row); return li; },
      update: paint,
    });
    if (fresh) welcome(box);
    if (!seen(el)) return;
    for (const [key, ghost] of ghosts) {
      if (ghost.started || (ghost.done && allSet)) continue;
      ghost.started = true;
      if (ghost.done) scope.timeout(() => settle(key, el), DONE_MS); else settle(key, el);
    }
    if (allSet && !closing) { closing = true; scope.timeout(() => leave(el, gh?.status === "connected"), FINAL_MS); }
  }

  return { again, section: { id: "hm-start", order: 5, mount() {}, render } };
}
