import assert from "node:assert/strict";
import { createCalmOrder, JOIN_MS, LEAVE_MS } from "../shell/sideorder.js";
import { createSideRows } from "../shell/rail/rows.js";
import { createScope } from "../core/kernel/scope.js";
import { dom } from "./lib/dom.mjs";
let passed = 0;
const t = async (name, fn) => { try { await fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const R = (active = [], urgent = []) => ["a", "b", "c", "d"].map((id) => ({ id, active: active.includes(id) || urgent.includes(id), urgent: urgent.includes(id) }));

await t("the first draw puts what is active on top at once, in the list's order", () => {
  const c = createCalmOrder();
  assert.deepEqual(c.order(R(["d", "b"]), 0, { first: true }).top, ["b", "d"]);
});
await t("a project at work joins after 10 s; one that needs you joins at once", () => {
  assert.equal(JOIN_MS, 10000); assert.equal(LEAVE_MS, 60000);
  const c = createCalmOrder();
  c.order(R(), 0, { first: true });
  let r = c.order(R(["c"]), 1000);
  assert.deepEqual(r.top, []); assert.equal(r.next, JOIN_MS, "it says when to look again");
  assert.deepEqual(c.order(R(["c"]), JOIN_MS).top, [], "a short turn never moves a row");
  assert.deepEqual(c.order(R(["c"]), JOIN_MS + 1000).top, ["c"]);
  assert.deepEqual(c.order(R(["c"], ["a"]), JOIN_MS + 2000).top, ["a", "c"]);
});
await t("a turn that ends before the wait leaves no trace: the next one starts its own wait", () => {
  const c = createCalmOrder();
  c.order(R(), 0, { first: true });
  c.order(R(["b"]), 0); c.order(R(), JOIN_MS / 2);
  const back = JOIN_MS;
  c.order(R(["b"]), back);
  assert.deepEqual(c.order(R(["b"]), back + JOIN_MS - 1).top, []);
  assert.deepEqual(c.order(R(["b"]), back + JOIN_MS).top, ["b"]);
});
await t("a project on top stays through a pause and leaves after 60 s idle", () => {
  const c = createCalmOrder();
  c.order(R(["a"]), 0, { first: true });
  let r = c.order(R(), 1000);
  assert.deepEqual(r.top, ["a"]); assert.equal(r.next, LEAVE_MS);
  assert.deepEqual(c.order(R(["a"]), 30000).top, ["a"], "back at work: the idle clock resets");
  c.order(R(), 40000);
  assert.deepEqual(c.order(R(), 40000 + LEAVE_MS - 1).top, ["a"]);
  assert.deepEqual(c.order(R(), 40000 + LEAVE_MS).top, []);
});
await t("nothing moves while you're on the sidebar; it's pending, and lands once you're off it", () => {
  const c = createCalmOrder();
  c.order(R(), 0, { first: true });
  const r = c.order(R([], ["d"]), 1000, { held: true });
  assert.deepEqual(r.top, []); assert.equal(r.pending, true);
  const s = c.order(R([], ["d"]), 2000);
  assert.deepEqual(s.top, ["d"]); assert.equal(s.pending, false);
});
await t("a project that goes away leaves the order", () => {
  const c = createCalmOrder();
  c.order(R(["a"]), 0, { first: true });
  assert.deepEqual(c.order(R().filter((x) => x.id !== "a"), 1000, { held: true }).top, []);
});

await t("the sidebar waits for the pointer to leave, then moves the urgent row and keeps its identity", async () => {
  const nav = ["home", "ws", "chats", "arts", "lp", "more"].map((place) => `<button id="nv-${place}"><span id="${place}-n"></span></button>`).join("") + '<span id="chats-live"></span>';
  const { document, window } = await dom(`<aside id="side"><nav class="nav">${nav}</nav><div id="projects"></div></aside>`);
  const side = document.getElementById("side"), box = document.getElementById("projects");
  const matches = side.matches.bind(side);
  side.matches = (selector) => selector === ":focus-within" ? side.contains(document.activeElement) : matches(selector);
  const needs = [];
  const timers = new Map();
  let nextTimer = 0;
  const scope = createScope({ timers: {
    setTimeout(fn, duration) { timers.set(++nextTimer, { fn, duration }); return nextTimer; },
    clearTimeout(id) { timers.delete(id); },
    setInterval, clearInterval,
  } });
  let view = "home";
  const sideRender = createSideRows(scope, { view: () => view,
    world: { state: { threads: [{ project: "b", state: "working", busy: true }] }, act: { coordinatorBusy: () => false } },
    CH: { isChats: () => false, live: () => "" }, D: { needItems: () => needs },
    projects: () => [{ id: "a", name: "Alpha" }, { id: "b", name: "Beta" }], convThread: () => null,
    isBusy: (thread) => thread.busy, isHeld: () => false, askShort: () => "Needs review", projectIcon: () => "", projectTint: () => 0, folded: () => false,
  });
  const order = () => [...box.children].map((row) => row.dataset.k);
  sideRender(needs);
  const alpha = box.lastElementChild;
  assert.deepEqual(order(), ["b", "pr-sep", "a"]);
  side.dispatchEvent(new window.Event("pointerenter"));
  needs.push({ admitted: true, group: "ask", t: { project: "a" } });
  sideRender(needs);
  assert.deepEqual(order(), ["b", "pr-sep", "a"]);
  side.dispatchEvent(new window.Event("pointerleave"));
  const [settle] = timers.values();
  assert.equal(settle.duration, 800);
  settle.fn();
  assert.deepEqual(order(), ["a", "b"]);
  assert.ok(box.firstElementChild === alpha);
  assert.equal(alpha.getAttribute("aria-label"), "Alpha. 1 needs you: Needs review");
  assert.equal(document.getElementById("nv-home").getAttribute("aria-current"), "page");
  view = "ws";
  sideRender(needs);
  assert.equal(document.getElementById("nv-home").hasAttribute("aria-current"), false);
  assert.equal(document.getElementById("nv-chats").getAttribute("aria-current"), "page", "the Workspace is a place in Chats");
  side.dispatchEvent(new window.Event("pointerenter"));
  needs.length = 0;
  sideRender(needs);
  side.dispatchEvent(new window.Event("pointerleave"));
  assert.ok(timers.size > 0, "the final reorder is pending when its rail retires");
  scope.dispose();
  assert.equal(scope.size, 0);
  assert.equal(timers.size, 0, "retiring the rail cancels pending reorders");
  side.dispatchEvent(new window.Event("pointerleave"));
  assert.equal(timers.size, 0);
});

{
  const { document } = await dom('<main id="host"></main>');
  const { reconcile } = await import("../core/ui/redraw.js");
  await t("reconcile moves a row with moveBefore where the browser has it, so the row and its line stay", () => {
    const box = document.createElement("nav"); document.getElementById("host").replaceChildren(box);
    const it = (k) => ({ key: k, html: `<button class="prow">${k}<span class="pr-t">line</span></button>` });
    reconcile(box, ["a", "b", "c"].map(it), { quiet: true });
    const c = box.children[2], line = c.querySelector(".pr-t");
    const moved = [];
    box.moveBefore = function (el, at) { moved.push(el.dataset.k); return this.insertBefore(el, at); };
    reconcile(box, ["c", "a", "b"].map(it), { quiet: true });
    assert.deepEqual([...box.children].map((x) => x.dataset.k), ["c", "a", "b"]);
    assert.deepEqual(moved, ["c"], "only the row that moved, moved whole");
    assert.ok(box.children[0] === c && c.querySelector(".pr-t") === line, "the same row and line");
  });
  await t("without moveBefore it still reorders", () => {
    const box = document.createElement("nav"); document.getElementById("host").replaceChildren(box);
    const it = (k) => ({ key: k, html: `<p>${k}</p>` });
    reconcile(box, ["a", "b"].map(it), { quiet: true });
    reconcile(box, ["b", "a"].map(it), { quiet: true });
    assert.deepEqual([...box.children].map((x) => x.dataset.k), ["b", "a"]);
  });
}
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
