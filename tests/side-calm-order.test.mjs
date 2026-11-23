// The sidebar's calm order: projects at work or needing you sit on top, and the rows move only while you're off the
// sidebar, once a project has worked a while (one needing you at once) or been idle a while. A moved row keeps its node
// and its animations (moveBefore), so its working line doesn't replay.
//   node tests/side-calm-order.test.mjs
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createCalmOrder, JOIN_MS, LEAVE_MS } from "../js/sideorder.js";
let passed = 0;
const t = async (name, fn) => { try { await fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8"), ui = readFileSync(new URL("../js/ui.js", import.meta.url), "utf8");
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

await t("the sidebar draws the calm order: the top part, a divider, the rest; a change glides; leaving the sidebar settles it", () => {
  const i = app.indexOf("function sideRender(needs) {"), body = app.slice(i, app.indexOf("\n}\n", i));
  assert.match(body, /SIDE_CALM\.order\(rows\.map\(\(r\) => \(\{ id: r\.key, active: r\.active, urgent: r\.urgent \}\)\), now, \{ first: !sideRender\.ready, held \}\)/);
  assert.match(body, /key: "pr-sep", html: `<div class="pr-sep" aria-hidden="true"><\/div>`/);
  assert.match(body, /el\.animate\(\[\{ transform: `translateY\(\$\{dy\}px\)` \}, \{ transform: "none" \}\], \{ duration: MOVE, easing: EASE \}\)/);
  assert.match(body, /!still\(\)/, "reduced motion: it lands at once");
  assert.match(app, /side\.addEventListener\("pointerleave", \(\) => \{ SIDE_CALM\.over = false; settle\(\); \}\)/);
  assert.match(app, /active: busy \|\| needsMe, urgent: needsMe/);
});

const LD = process.env.LINKEDOM || [join(homedir(), ".cache/xo-test-deps/node_modules/linkedom/esm/index.js"), "/tmp/dom/node_modules/linkedom/esm/index.js"].find((f) => existsSync(f));
if (!LD) console.log("  skip the DOM case: linkedom isn't installed");
else {
  const { parseHTML } = await import(LD);
  const { window, document } = parseHTML(`<!doctype html><html><body><main id="host"></main></body></html>`);
  Object.assign(globalThis, { window, document, HTMLElement: window.HTMLElement, CustomEvent: window.CustomEvent, Event: window.Event, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), localStorage: { getItem: () => null, setItem() {} } });
  const { reconcile } = await import("../js/ui.js");
  await t("reconcile moves a row with moveBefore where the browser has it, so the row and its line stay", () => {
    const box = document.createElement("nav"); document.getElementById("host").replaceChildren(box);
    const it = (k) => ({ key: k, html: `<button class="prow">${k}<span class="pr-t">line</span></button>` });
    reconcile(box, ["a", "b", "c"].map(it), { quiet: true });
    const c = box.children[2], line = c.querySelector(".pr-t");
    const moved = [];
    box.moveBefore = function (el, at) { moved.push(el.dataset.k); return this.insertBefore(el, at); };
    reconcile(box, ["c", "a", "b"].map(it), { quiet: true, inPlace: true });
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
assert.match(ui, /if \(at !== el\) move\(box, el, at \|\| null\);/, "reconcile places rows through move()");
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
