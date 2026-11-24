// @ts-check
import assert from "node:assert/strict";
import { mock } from "node:test";
import { dom } from "../../tests/lib/dom.mjs";
import { createShellScheduler } from "../render.js";
import { createScope } from "../../core/kernel/scope.js";
import { createDecisionPings } from "../decision-pings.js";
import { createReturnPill } from "../return-pill.js";
import { tickElapsed } from "../elapsed.js";

const { document } = await dom('<main id="conv"><div id="scroller"><div id="msgs"><div data-k="row"><button data-go="t:one">Open</button></div></div></div></main><span class="elapsed" data-since="1000"></span>');
/** @type {FrameRequestCallback[]} */
const frames = [];
globalThis.requestAnimationFrame = (fn) => frames.push(fn);
globalThis.cancelAnimationFrame = () => {};
let renders = 0;
const scope = createScope();
const schedule = createShellScheduler(() => { if (++renders === 1) schedule(); }, scope);
schedule();
schedule();
assert.equal(frames.length, 1, "two requests share one frame");
frames.shift()?.(0);
assert.equal(frames.length, 1, "render can request the next frame");
frames.shift()?.(0);
assert.equal(renders, 2);

const scroller = document.getElementById("scroller");
const msgsEl = document.getElementById("msgs");
scroller.getBoundingClientRect = () => ({ top: 0, bottom: 800 });
Object.defineProperty(scroller, "offsetTop", { value: 12 });
const visits = [];
const pill = createReturnPill({ msgsEl, scroller, toRow: (row, smooth) => visits.push([row, smooth]) });
const original = msgsEl.firstElementChild;
pill(original.firstElementChild);
const replacement = original.cloneNode(true);
replacement.getBoundingClientRect = () => ({ top: -180, bottom: -130 });
original.replaceWith(replacement);
mock.timers.enable({ apis: ["setTimeout", "Date"], now: 6000 });
try {
  frames.shift()?.(0);
  const button = document.getElementById("mx-return");
  assert.match(button.textContent, /Back to where you were/);
  button.click();
  assert.equal(visits.length, 1);
  assert.ok(visits[0][0] === replacement, "the return pill finds the current row");
  assert.equal(visits[0][1], true);
  assert.ok(document.activeElement === replacement.firstElementChild);
  assert.ok(button.hidden);
  tickElapsed();
  assert.equal(document.querySelector(".elapsed").textContent, "5s");
} finally {
  mock.timers.reset();
}

const notices = [];
let view = "ws";
const ping = createDecisionPings({
  view: () => view, P: { mayPing: () => true }, PROJ: () => "Research", askShort: (need) => need.key,
  heraldShow: (notice) => notices.push(notice),
});
/** @param {string} key */
const need = (key) => ({ key, group: "asking", ask: {}, t: { id: key, project: "p" } });
ping([need("already-seen")]);
ping([need("already-seen"), need("new")]);
ping([need("new")]);
assert.deepEqual(notices.map((notice) => notice.decide), ["new"], "only a newly arrived ask speaks once");
view = "t:in-thread";
ping([need("in-thread")]);
view = "ws";
ping([need("in-thread"), need("elsewhere")]);
assert.deepEqual(notices.map((notice) => notice.decide), ["new", "elsewhere"], "the thread shows its own asks without a repeated ping");
