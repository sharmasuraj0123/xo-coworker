// A working turn is redrawn in place as its steps land: drawn anew, its step's tick drew itself in again, and its dots and
// shimmer restarted, every few seconds (the owner, 21 Nov: "the tick mark keeps on refreshing").
//   node tests/turn-in-place.test.mjs
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const ui = readFileSync(new URL("../js/ui.js", import.meta.url), "utf8");
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const chats = readFileSync(new URL("../js/chats.js", import.meta.url), "utf8");
const tv = readFileSync(new URL("../js/turnview.js", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const i = ui.indexOf("export function reconcile("), body = ui.slice(i, ui.indexOf("\n}\n", i));

t("an item can ask to be updated in place, as the list can", () => {
  assert.match(body, /if \(\(always \|\| it\.inPlace \|\| \(active && active !== el && el\.contains\(active\)\) \|\| \(pressed && el\.contains\(pressed\)\)\) && fresh && fresh\.tagName === el\.tagName\) \{/);
  assert.match(body, /redraw\(el, fresh\.innerHTML\);/);
});
t("a turn row asks for it, in one place", () => {
  assert.match(tv, /export const turnItem = \(key, html\) => \(\{ key, html, inPlace: true \}\);/);
});
t("every list of turns draws them through it: a conversation's, and an open chat's on Chats", () => {
  assert.match(app, /items\.push\(m\.who === "turn" \? turnItem\(m\.key, html\) : \{ key: m\.key, html \}\);/);
  assert.match(chats, /items\.push\(turnItem\(`turn:\$\{x\.t\.id\}`, /);
  for (const [f, s] of [["app.js", app], ["chats.js", chats]]) assert.ok(!/key: `turn:|key: m\.key, html, inPlace/.test(s), f + " builds a turn row of its own");
});

const LD = process.env.LINKEDOM || [join(homedir(), ".cache/xo-test-deps/node_modules/linkedom/esm/index.js"), "/tmp/dom/node_modules/linkedom/esm/index.js"].find((f) => existsSync(f));
if (!LD) console.log("  skip the DOM case: linkedom isn't installed (npm i linkedom in ~/.cache/xo-test-deps, or set LINKEDOM)");
else {
  const { parseHTML } = await import(LD);
  const { window, document } = parseHTML(`<!doctype html><html><body><div id="box"></div></body></html>`);
  Object.assign(globalThis, { window, document, HTMLElement: window.HTMLElement, CustomEvent: window.CustomEvent, Event: window.Event,
    CSS: { escape: (x) => String(x) }, requestAnimationFrame: (f) => setTimeout(f, 0), matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    innerWidth: 1440, innerHeight: 900, localStorage: { getItem: () => null, setItem() {} } });
  const { reconcile } = await import("../js/ui.js");
  const { turnItem } = await import("../js/turnview.js");
  const turn = (n) => `<div class="m m-turn"><div class="mb">${Array.from({ length: n }, (_, i) => `<div class="st" data-st="${i}"><span class="tick"></span>Step ${i}</div>`).join("")}<span>${n} steps</span></div></div>`;
  t("a step landing keeps the turn's node and every finished step's tick", () => {
    const box = document.getElementById("box"), items = (n) => [{ key: "u:1", html: "<div>hi</div>" }, turnItem("turn:1", turn(n))];
    reconcile(box, items(1), { quiet: true });
    const row = box.children[1], tick = box.querySelector('[data-st="0"] .tick');
    reconcile(box, items(2), { quiet: true }); reconcile(box, items(3), { quiet: true });
    assert.ok(box.children[1] === row, "the turn's row was replaced");
    assert.ok(box.querySelector('[data-st="0"] .tick') === tick, "the first step's tick was drawn again");
    assert.equal(box.querySelectorAll(".st").length, 3);
  });
}
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
