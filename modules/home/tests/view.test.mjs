// @ts-check
import assert from "node:assert/strict";
import { createPlaces } from "../../../core/kernel/places.js";
import { dom } from "../../../tests/lib/dom.mjs";
import { createHomeParts } from "../parts.js";
import { createHomeSelection } from "../selection.js";
import { thenHtml } from "../then.js";

const { document } = await dom('<main id="home"></main><button id="elsewhere">Other control</button>');
/** @type {FrameRequestCallback[]} */
const frames = [];
Object.assign(globalThis, {
  matchMedia: () => ({ matches: true }),
  requestAnimationFrame: (/** @type {FrameRequestCallback} */ frame) => frames.push(frame),
});
let now = 0;
Object.defineProperty(globalThis, "performance", { value: { now: () => now } });
const { createHomeView } = await import("../view.js");
const { createScope } = await import("../../../core/kernel/scope.js");
globalThis.cancelAnimationFrame = () => {};

const needs = ["a", "b", "c", "d"].map((key) => ({
  key, risk: "notable", effort: "think", group: "notable", admitted: true,
  t: { id: key, project: "project", title: key },
  ask: { kind: "question" },
}));
const selection = createHomeSelection();
/** @type {string | null} */
let panel = null;
/** @type {string[]} */
const decided = [];
/** @type {string[]} */
const announcements = [];
let scheduled = 0;
let mounted = 0;
const places = createPlaces();
places.define({ id: "home.section", kind: "list", scope: "app", description: "Home sections" });
places.contribute("home.section", {
  id: "hm-since",
  mount() { mounted++; },
  render(/** @type {HTMLElement} */ el) { el.textContent = "Since you left"; },
}, "test");
const { homeRender, nextDecide } = createHomeView({
  selection,
  isCurrent: () => true,
  D: { current: () => panel, isOpen: () => !!panel, decideNow: (key) => { decided.push(key); return true; } },
  world: { state: { threads: [] } },
  Kit: { READ_MS: 300 },
  EFFORT: { think: { label: "Think" } },
  homeParts: createHomeParts(selection, () => needs, () => false),
  nextCardHtml: (need) => `<article class="next r-notable" data-key="${need.key}" tabindex="-1"></article>`,
  endRender() {},
  greeting: () => "Hello",
  today: () => "Today",
  num: String,
  noun: (word) => word,
  plural: (_, word) => word,
  isBusy: () => false,
  askTitle: (need) => need.key,
  PROJ: (project) => project,
  places,
  SV: { homeOrder() {} },
  announce: (message) => { announcements.push(message); },
  schedule: () => { scheduled++; },
}, createScope());

homeRender(needs);
assert.equal(document.querySelector("#home-h").textContent, "Hello. 4 things are worth your time.");
assert.deepEqual([...document.querySelectorAll("#hm-then [data-decide]")].map((button) => button.dataset.decide), ["b", "c"]);
assert.equal(document.querySelector("[data-open-all]").textContent, "+1 more");
assert.equal(document.querySelector("#hm-next .next").dataset.key, "a");
assert.equal(document.querySelector("#hm-since").textContent, "Since you left");

const elsewhere = document.getElementById("elsewhere");
elsewhere.focus();
selection.requestFocus();
homeRender(needs);
assert.ok(document.activeElement === document.querySelector("#hm-next .next"), "the next draw handles the focus request");
elsewhere.focus();
homeRender(needs);
assert.ok(document.activeElement === elsewhere, "a used focus request cannot steal focus on the next draw");

panel = "a";
homeRender(needs);
assert.equal(mounted, 1, "live renders leave mounted Home sections in place");
assert.equal(document.querySelector("#hm-next .in-panel").textContent, "Open in the panel");
assert.ok(!document.querySelector("#hm-next .next"));
await nextDecide("allow");
assert.deepEqual(decided, [], "a shortcut cannot decide a card that moved to the panel");
now = 700;
panel = null;
homeRender(needs);
now = 999;
await nextDecide("allow");
assert.deepEqual(decided, [], "returning from the panel restarts the read interval");
assert.deepEqual(announcements, ["A beat to read it first."]);
now = 1000;
await nextDecide("allow");
assert.deepEqual(decided, ["a"]);
assert.equal(scheduled, 1);
assert.equal(selection.current(), null);
while (frames.length) for (const frame of frames.splice(0)) frame(now);
assert.ok(document.activeElement === document.querySelector("#hm-next .next"), "focus returns to the current card");

const queue = document.createElement("div");
const options = { EFFORT: { think: { label: "Think" } }, askTitle: (need) => need.key, PROJ: () => "Demo & Tests" };
const next = { ...needs[1], risk: "destructive", t: { ...needs[1].t, asker: true } };
queue.innerHTML = thenHtml({ then: [next], later: [needs[0]], more: [needs[2]], glances: [needs[2], needs[3]] }, options);
assert.equal(queue.querySelector(".ti-p .risk").textContent, "Destructive");
assert.equal(queue.querySelector(".ti-w").textContent, "Demo & Tests coordinator");
assert.deepEqual([...queue.querySelectorAll(".then-foot button")].map((button) => button.textContent.trim()), [
  "+1 more", "Clear 2 glances together", "1 later today bring back",
]);
queue.innerHTML = thenHtml({ then: [], later: [needs[0]], more: [], glances: [] }, options);
assert.equal(queue.querySelector(".then-foot.solo [data-bring]")?.textContent.trim(), "1 later today bring back");
assert.ok(queue.querySelector("ol") === null);
