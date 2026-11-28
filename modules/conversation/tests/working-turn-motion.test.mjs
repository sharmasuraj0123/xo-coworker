// @ts-check
import assert from "node:assert/strict";
import { createScope } from "../../../core/kernel/scope.js";
import { dom } from "../../../tests/lib/dom.mjs";

const { document } = await dom(`
  <div class="msgs"><div class="m m-turn is-live">
    <div class="mb"><div class="turn"><div class="tb-work is-open"><button class="tb-h" data-tb="work" aria-expanded="true"></button></div>
      <div class="tb-narr">First step</div></div></div>
  </div></div>`);
const tokens = new Map([["--d-move", "371ms"], ["--d-out", "193ms"], ["--d-loop", "2.8s"], ["--ease", "linear"]]);
let styleReads = 0;
globalThis.getComputedStyle = (node) => {
  assert.ok(node === document.documentElement, "working motion reads only the root style");
  styleReads++;
  return { getPropertyValue: (name) => tokens.get(name) || "" };
};
const { createWorkingTurn } = await import("../working-turn.js");
const msgs = document.querySelector(".msgs");
const row = msgs.firstElementChild;
const mb = row.firstElementChild;
const firstCard = row.querySelector(".tb-work");
let rowHeight = 180;
row.getBoundingClientRect = () => ({ top: 0 });
mb.getBoundingClientRect = () => ({ height: rowHeight, bottom: rowHeight });
Object.defineProperty(firstCard, "offsetHeight", { value: 130 });
const animations = [];
function animate(keyframes, options) {
  const animation = { cancel() {}, finished: new Promise(() => {}), effect: { getComputedTiming: () => ({ progress: 0 }) } };
  animations.push({ keyframes, options });
  return animation;
}
row.animate = animate;
const timeouts = new Map();
const scope = createScope({ timers: {
  setTimeout: (fn, delay) => { timeouts.set(fn, delay); return fn; },
  clearTimeout: (fn) => { timeouts.delete(fn); },
  setInterval: (fn) => fn,
  clearInterval: () => {},
} });
const turn = createWorkingTurn({ msgs, follow: { toLatest() {}, fromLatest() {}, toRow() {} } }, scope);
const oldNow = Date.now;
try {
  Date.now = () => 10000;
  turn.working(row);
  assert.equal(row.querySelector(".mx-wl").style.getPropertyValue("--mx-wave"), "-1600ms", "the wave uses the published loop period");

  const nextCard = firstCard.cloneNode(true);
  nextCard.animate = animate;
  Object.defineProperty(nextCard, "offsetHeight", { value: 70 });
  firstCard.replaceWith(nextCard);
  row.querySelector(".tb-narr").textContent = "Second step";
  rowHeight = 100;
  Date.now = () => 13000;
  turn.working(row);
  assert.equal(row.querySelector(".mx-wl.is-out").textContent, "First step");
  assert.deepEqual([...timeouts.values()], [193], "the departing label uses the exit token");
  assert.deepEqual(animations, [
    { keyframes: [{ height: "130px" }, { height: "70px" }], options: { duration: 371, easing: "linear", fill: "both" } },
    { keyframes: [{ minHeight: "180px" }, { minHeight: "100px" }],
      options: { duration: 371, delay: 0, fill: "backwards", easing: "linear" } },
  ], "the card and row both use the published move timing");
  assert.equal(styleReads, 1);
} finally {
  Date.now = oldNow;
  scope.dispose();
}
assert.equal(scope.size, 0);
assert.equal(timeouts.size, 0);
