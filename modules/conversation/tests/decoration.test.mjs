// @ts-check
import assert from "node:assert/strict";
import { dom, settle } from "../../../tests/lib/dom.mjs";

const surface = (/** @type {string} */ id) => `<section id="${id}"><div class="scroll"><div class="msgs"></div></div>
  <div class="typing"></div><div class="dock"><div class="tdock"></div>
  <form><div class="composer-field"><textarea></textarea></div><button type="submit">Send</button></form></div></section>`;
const { window, document } = await dom(surface("one") + surface("two"));
const sizes = new Set();
const intervals = new Set();
Object.assign(globalThis, {
  getComputedStyle: window.getComputedStyle,
  cancelAnimationFrame: clearTimeout,
  MutationObserver: window.MutationObserver,
  ResizeObserver: class {
    observe() { sizes.add(this); }
    disconnect() { sizes.delete(this); }
  },
  setInterval: (fn) => { intervals.add(fn); return fn; },
  clearInterval: (fn) => intervals.delete(fn),
});
const { decorateConversation } = await import("../decoration.js");
const { createFollow } = await import("../follow.js");
const rect = () => ({ top: 0, bottom: 100, height: 0, width: 0 });

function mount(id) {
  const conv = document.getElementById(id);
  const get = (selector) => conv.querySelector(selector);
  const msgs = get(".msgs"), scroller = get(".scroll");
  Object.defineProperties(scroller, {
    scrollHeight: { value: 4000 }, clientHeight: { value: 500 },
    scrollTo: { value: ({ top }) => { scroller.scrollTop = top; } },
  });
  scroller.scrollTop = 0;
  const follow = createFollow({ scroller, msgs, column: scroller });
  const options = {
    conv, msgs, scroller, follow, typing: get(".typing"), composer: get("form"), say: get("textarea"),
    dock: get(".dock"), tdock: get(".tdock"), send: get("button"), host: conv, isThread: () => true, view: () => "thread",
  };
  for (const el of [conv, scroller, options.composer]) el.getBoundingClientRect = rect;
  return { ...options, follow, mount: () => decorateConversation(options) };
}

const one = mount("one"), two = mount("two");
function message(key, text = "Repeated") {
  const row = document.createElement("div");
  row.className = "m m-you";
  row.dataset.k = key;
  row.innerHTML = '<div class="bubble"></div>';
  row.firstElementChild.textContent = text;
  row.getBoundingClientRect = rect;
  return row;
}
function turn(list) {
  const row = document.createElement("div");
  row.className = "m m-them m-turn is-live is-folded";
  row.dataset.k = "shared-turn";
  row.innerHTML = '<div class="mb"><div class="turn is-live"><span class="elapsed"></span></div></div>';
  row.querySelector(".elapsed").dataset.since = String(Date.now() - 250);
  row.getBoundingClientRect = row.firstElementChild.getBoundingClientRect = rect;
  list.append(row);
  return row;
}
function agent(key, name, text, main = false) {
  const row = document.createElement("div");
  row.className = "m m-them";
  row.dataset.k = key;
  row.innerHTML = '<span class="av"></span><div class="mb"><div class="mh"><b></b></div><div class="prose"></div></div>';
  row.querySelector(".av").classList.toggle("av-t", main);
  row.querySelector(".mh b").textContent = name;
  row.querySelector(".prose").textContent = text;
  row.getBoundingClientRect = rect;
  return row;
}
const first = message("first"), duplicate = message("duplicate");
first.getBoundingClientRect = () => ({ top: 900, bottom: 920, height: 20 });
duplicate.getBoundingClientRect = () => ({ top: 1800, bottom: 1820, height: 20 });
const history = [first, duplicate, ...Array.from({ length: 498 }, (_, i) => message(`old-${i}`))];
one.msgs.append(...history, agent("primary", "Main", "Earlier message", true), agent("other", "Coordinator", "A unique historical source"));
const firstTurn = turn(one.msgs), secondTurn = turn(two.msgs);
let oldVisits = 0;
for (const row of history) {
  const query = row.querySelector;
  row.querySelector = function (selector) {
    if (selector === ".bubble") oldVisits++;
    return query.call(this, selector);
  };
}
const A = one.mount(), B = two.mount();
await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
const pill = firstTurn.querySelector(".mx-work");
assert.ok(pill.classList.contains("mx-tail"), "classified coordinator leaves a tail on the live pill");
let workingReads = 0;
firstTurn.getBoundingClientRect = () => { workingReads++; return rect(); };
oldVisits = 0;
one.msgs.append(agent("more", "Main", "A unique historical source", true));
await settle();
assert.equal(oldVisits, 0);
assert.equal(workingReads, 0, "appending only updates the active pill's tail");
assert.ok(!pill.classList.contains("mx-tail"), `the same agent continues into the live pill with ${oldVisits} old row decorations`);
const start = performance.now();
const added = message("new", "A new message");
one.msgs.append(added);
oldVisits = 0;
await settle();
console.log(`decoration append to 500 rows: ${(performance.now() - start).toFixed(1)} ms, ${oldVisits} old row decorations`);
assert.equal(oldVisits, 0);
assert.ok(added.querySelector(".mx-swipe"));
assert.ok(pill.classList.contains("mx-tail"), "a user message breaks the pill's run");
const replacement = added.firstElementChild;
replacement.textContent = "🙂";
added.dispatchEvent(new window.Event("redrawn", { bubbles: true }));
assert.ok(added.classList.contains("mx-emoji"));

const click = (node) => node.dispatchEvent(new window.Event("click", { bubbles: true }));
click(first.querySelector("[data-mx-reply]"));
one.say.value = "Reply";
one.composer.dispatchEvent(new window.Event("submit", { bubbles: true }));
const quote = message("reply", one.say.value);
one.say.value = "";
one.msgs.append(quote);
await settle();
assert.ok(one.follow.isPinned());
const jump = quote.querySelector("[data-mx-jump]");
assert.equal(jump.dataset.mxJump, "first");
click(jump);
assert.ok(!one.follow.isPinned());
assert.ok(first.classList.contains("mx-flash"));
assert.ok(!duplicate.classList.contains("mx-flash"));

const historicalSource = one.msgs.querySelector('[data-k="other"]');
const historical = message("historical", "> **Coordinator**\n> unique historical source\n\nOld reply");
const ambiguous = message("ambiguous", "> **You**\n> Repeated\n\nAnother old reply");
one.msgs.append(historical, ambiguous);
await settle();
one.follow.toLatest();
click(ambiguous.querySelector(".mx-qc"));
assert.ok(one.follow.isPinned(), "duplicate excerpts by the same author leave the view alone");
click(historical.querySelector(".mx-qc"));
assert.ok(!one.follow.isPinned());
assert.ok(historicalSource.classList.contains("mx-flash"), "the attributed excerpt selects the unique earlier row");

const [tickOne] = intervals;
assert.equal(intervals.size, 2);
const now = Date.now;
try {
  Date.now = () => now() + 8000;
  tickOne();
} finally {
  Date.now = now;
}
assert.ok(firstTurn.querySelector(".mx-we").textContent);
assert.equal(secondTurn.querySelector(".mx-we").textContent, "");

assert.equal(sizes.size, 4);
A.destroy();
assert.equal(A.activeEffects, 0);
assert.equal(sizes.size, 2);
assert.ok(!one.conv.querySelector(".mx-down"));
const after = message("after-dispose");
one.msgs.append(after);
await settle();
assert.ok(!after.querySelector(".mx-swipe"));
B.destroy();
assert.equal(B.activeEffects, 0);
assert.equal(sizes.size, 0);
assert.equal(intervals.size, 0);
assert.ok(!document.querySelector(".mx-qpop"));
