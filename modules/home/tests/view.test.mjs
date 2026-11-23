// @ts-check
import assert from "node:assert/strict";
import { createPlaces } from "../../../core/kernel/places.js";
import { dom } from "../../../tests/lib/dom.mjs";
import { createHomeParts } from "../parts.js";

const { document } = await dom('<main id="home"></main>');
/** @type {FrameRequestCallback[]} */
const frames = [];
Object.assign(globalThis, {
  matchMedia: () => ({ matches: true }),
  requestAnimationFrame: (/** @type {FrameRequestCallback} */ frame) => frames.push(frame),
});
let now = 0;
Object.defineProperty(globalThis, "performance", { value: { now: () => now } });
const { createHomeView } = await import("../view.js");

const needs = ["a", "b", "c", "d"].map((key) => ({
  key, risk: "notable", effort: "think", group: "notable", admitted: true,
  t: { id: key, project: "project", title: key },
  ask: { kind: "question" },
}));
/** @type {{ view: string, pin: string | null }} */
const S = { view: "home", pin: null };
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
  S,
  D: { current: () => panel, isOpen: () => !!panel, decideNow: (key) => { decided.push(key); return true; } },
  world: { state: { threads: [] } },
  Kit: { READ_MS: 300 },
  EFFORT: { think: { label: "Think" } },
  homeParts: createHomeParts(S, { needItems: () => needs }, { isBinary: () => false }),
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
  kernel: { places },
  SV: { homeOrder() {} },
  announce: (message) => { announcements.push(message); },
  schedule: () => { scheduled++; },
});

homeRender(needs);
assert.equal(document.querySelector("#home-h").textContent, "Hello. 4 things are worth your time.");
assert.deepEqual([...document.querySelectorAll("#hm-then [data-decide]")].map((button) => button.dataset.decide), ["b", "c"]);
assert.equal(document.querySelector("[data-open-all]").textContent, "+1 more");
assert.equal(document.querySelector("#hm-next .next").dataset.key, "a");
assert.equal(document.querySelector("#hm-since").textContent, "Since you left");

panel = "a";
homeRender(needs);
assert.equal(mounted, 1, "live renders leave mounted Home sections in place");
assert.equal(document.querySelector("#hm-next .in-panel").textContent, "Open in the panel");
assert.ok(!document.querySelector("#hm-next .next"));
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
assert.equal(S.pin, null);
while (frames.length) for (const frame of frames.splice(0)) frame(now);
assert.ok(document.activeElement === document.querySelector("#hm-next .next"), "focus returns to the current card");
