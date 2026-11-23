// @ts-check

// A conversation's decoration on a DOM: the action row kept across redraws, ratings, Copy, a reply and its quote, teardown.
import assert from "node:assert/strict";
import { dom, settle } from "./lib/dom.mjs";


const skeleton = (p) => `<div id="${p}conv"><div id="${p}scroller"><div id="${p}column"><div id="${p}msgs"></div></div></div><div id="${p}typing"></div>` +
  `<form id="${p}composer"><div class="composer-field"><textarea id="${p}say"></textarea></div><button id="${p}send"></button></form><div id="${p}dock"></div><div id="${p}tdock"></div></div>`;
const { window, document } = await dom(`<div id="app" data-conv="p:demo">${skeleton("")}</div><div id="tp">${skeleton("t")}</div><div id="live"></div>`);
const g = /** @type {any} */ (globalThis);
// linkedom tells a childList observer about its children's attribute changes; a browser doesn't
g.MutationObserver = class extends window.MutationObserver {
  constructor(/** @type {Function} */ cb) { super((/** @type {any[]} */ rs, /** @type {any} */ o) => { const own = rs.filter((r) => r.type !== "attributes" || o._attrs); if (own.length) cb(own, o); }); }
  observe(/** @type {any} */ el, /** @type {any} */ opts) { if (opts.attributes || opts.attributeFilter) /** @type {any} */ (this)._attrs = true; super.observe(el, opts); }
};
Object.getPrototypeOf(document.createElement("canvas")).getContext = () => ({ font: "", measureText: (/** @type {string} */ t) => ({ width: t.length * 7 }) });
g.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
const store = new Map();
g.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
g.isSecureContext = true;
const copied = [];
Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (t) => { copied.push(t); } } });
g.getSelection = () => ({ isCollapsed: true, toString: () => "" });

const { decorateConversation } = await import("../js/msgx.js");
const $ = (s, r = document) => r.querySelector(s);
let view = "t:one";
const viewSubs = [];
const E = decorateConversation({
  conv: $("#tp"), msgs: $("#tmsgs"), scroller: $("#tscroller"), typing: $("#ttyping"), composer: $("#tcomposer"), say: $("#tsay"), send: $("#tsend"),
  atList: null, dock: $("#tdock"), tdock: $("#ttdock"), herald: null, host: $("#tp"), follow: { toLatest() {}, fromLatest: () => 0 },
  isThread: () => true, view: () => view, onView: (fn) => viewSubs.push(fn),
});
const msgs = $("#tmsgs"), say = /** @type {any} */ ($("#tsay"));
const click = (el) => el.dispatchEvent(new window.Event("click", { bubbles: true }));
const key = (el, k) => { const e = new window.Event("keydown", { bubbles: true, cancelable: true }); Object.assign(e, { key: k, shiftKey: false, isComposing: false, keyCode: 13 }); el.dispatchEvent(e); return e; };
const them = (k, text, { name = "Coordinator", cont = false } = {}) =>
  `<div class="m m-them${cont ? " cont" : ""}" data-k="${k}"><div class="mb">${cont ? "" : `<div class="mh"><b>${name}</b></div>`}<div class="prose">${text}</div></div></div>`;
const add = (html) => { const t = document.createElement("template"); t.innerHTML = html; const el = t.content.firstElementChild; msgs.append(el); return el; };

// a settled reply gets one action row under it: Copy, Reply, Good, Bad, then its time; it is the latest
add(`<div class="m m-you" data-k="y1"><div class="bubble">Can you tidy the README?</div></div>`);
const a1 = add(them("a1", "Started a thread for it."));
await settle();
const row = a1.querySelector(":scope > .mb > .mx-actrow");
assert.ok(row, "an agent's message has its action row");
assert.ok("own" in row.dataset, "kept by an in-place redraw");
assert.deepEqual([...row.querySelectorAll("button")].map((b) => b.getAttribute("aria-label")), ["Copy", "Reply", "Good response", "Bad response"]);
assert.ok(row.querySelector("time"), "then its time");
assert.ok(a1.classList.contains("mx-latest"), "the latest reply's row always shows");
assert.equal(msgs.querySelector('[data-k="y1"] .mx-actrow'), null, "yours has no action row");
assert.ok(msgs.querySelector('[data-k="y1"] > .bubble > .mx-acts [data-mx-reply]'), "yours keeps Reply and Copy beside its bubble");

// a turn at work has none; once it has ended, it has its own
const turn = add(`<div class="m m-turn is-live" data-k="t1"><div class="mb"><div class="turn"><div class="tb-text">Working on it</div></div></div></div>`);
await settle();
assert.equal(turn.querySelector(".mx-actrow"), null, "nothing to copy or rate mid-reply");
assert.ok(a1.classList.contains("mx-latest"), "the latest settled reply stays the latest");
const ended = add(`<div class="m m-turn" data-k="t1"><div class="mb"><div class="turn"><div class="tb-answer">Done.</div></div></div></div>`);
turn.replaceWith(ended); await settle();
assert.ok(ended.querySelector(":scope > .mb > .mx-actrow"), "an ended turn has its row");
assert.ok(ended.classList.contains("mx-latest") && !a1.classList.contains("mx-latest"), "the latest moves to it");

// drawn again in its place (a live redraw), the row is the same element: a press across it lands on the same button
const a1b = document.createElement("template"); a1b.innerHTML = them("a1", "Started a thread for it: Tidy the README.");
const fresh = /** @type {any} */ (a1b.content.firstElementChild);
a1.replaceWith(fresh); await settle();
assert.equal(fresh.querySelector(":scope > .mb > .mx-actrow"), row, "the same action row moves into the row drawn in its place");

// Good, Bad: pressed, kept on this device; pressed again, taken back
const good = row.querySelector('[data-mx-rate="good"]'), bad = row.querySelector('[data-mx-rate="bad"]');
click(good);
assert.equal(good.getAttribute("aria-pressed"), "true"); assert.equal(bad.getAttribute("aria-pressed"), "false");
assert.deepEqual(JSON.parse(store.get("xo-msg-rating")), { a1: "good" });
click(bad);
assert.equal(good.getAttribute("aria-pressed"), "false"); assert.equal(bad.getAttribute("aria-pressed"), "true");
click(bad);
assert.equal(bad.getAttribute("aria-pressed"), "false");
assert.deepEqual(JSON.parse(store.get("xo-msg-rating")), {}, "taken back");

// Copy under a reply copies the whole run the speaker said, each message a paragraph
const c1 = add(them("c1", "First part.")), c2 = add(them("c2", "Second part.", { cont: true }));
await settle();
assert.equal(c1.querySelector(".mx-actrow"), null, "a message the same speaker goes on from isn't a reply's end");
click(c2.querySelector(".mx-actrow [data-mx-copy]")); await settle();
assert.equal(copied.pop(), "First part.\n\nSecond part.");

// Reply: the chip names who you answer, the field takes focus, and Enter sends the quote first, as Markdown
click(fresh.querySelector(".mx-actrow [data-mx-reply]"));
const chip = /** @type {any} */ ($("#tcomposer > .mx-reply"));
assert.ok(chip && !chip.hidden, "the reply chip shows above the field");
assert.equal(chip.nextElementSibling, $("#tcomposer > .composer-field"), "just before the field");
assert.equal(chip.querySelector("b").textContent, "Coordinator");
assert.equal(document.activeElement, say, "the field takes focus");
say.value = "Thanks";
key(say, "Enter");
assert.equal(say.value, "> **Coordinator**\n> Started a thread for it: Tidy the README.\n\nThanks", "the quote goes first, read synchronously by send");
await settle();
assert.equal(say.value, "Thanks", "not sent (the field kept the quote): the quote comes back off");
assert.ok(!chip.hidden, "and the reply waits");

// one reply per conversation: another thread shows its own (none), coming back shows this one's
view = "t:two"; viewSubs.forEach((f) => f());
assert.ok(chip.hidden, "another conversation has no reply");
say.value = "Hello"; key(say, "Enter");
assert.equal(say.value, "Hello", "and sends no quote");
view = "t:one"; viewSubs.forEach((f) => f());
assert.ok(!chip.hidden, "back: this conversation's reply");

// sent (the app emptied the field): the reply is done
say.value = "Sure"; key(say, "Enter"); say.value = ""; await settle();
assert.ok(chip.hidden, "sent: the chip goes");

// Escape in the field takes the reply back
click(fresh.querySelector(".mx-actrow [data-mx-reply]"));
assert.ok(!chip.hidden);
const esc = key(say, "Escape");
assert.ok(chip.hidden && esc.defaultPrevented, "Escape removes the quote");

const touch = (/** @type {string} */ type, /** @type {number} */ clientX) => {
  const event = new window.Event(type, { bubbles: true });
  Object.assign(event, { pointerType: "touch", clientX, clientY: 100 });
  fresh.dispatchEvent(event);
};
touch("pointerdown", 100);
touch("pointermove", 165);
assert.ok(fresh.classList.contains("mx-armed"));
touch("pointercancel", 165);
assert.ok(chip.hidden, "a cancelled swipe leaves the reply untouched");
touch("pointerdown", 100);
touch("pointermove", 165);
touch("pointerup", 165);
assert.ok(!chip.hidden, "an armed swipe starts the reply");
assert.equal(document.activeElement, say);
key(say, "Escape");

// teardown: what it put on the page goes, and its document keys stop
const heads = () => [...document.head.querySelectorAll("style")].map((s) => s.id);
assert.ok(heads().includes("mx-hold-tmsgs") && heads().includes("mx-order-tmsgs"));
assert.equal(document.querySelectorAll("body > .mx-qpop").length, 2, "one quote button per conversation");
E.destroy();
assert.ok(!heads().includes("mx-hold-tmsgs") && !heads().includes("mx-order-tmsgs"), "its sheets go");
assert.equal(document.querySelectorAll("body > .mx-qpop").length, 1, "its quote button goes");
assert.ok(heads().includes("mx-hold") && heads().includes("mx-order"), "the main chat's stay");
click(fresh.querySelector(".mx-actrow [data-mx-reply]"));
say.value = "After"; key(say, "Enter");
assert.equal(say.value, "After", "its keys no longer quote");

console.log("conv-actions: ok");
process.exit(0);
