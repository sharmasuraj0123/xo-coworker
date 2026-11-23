// A changed row of any list is updated in place, never drawn anew: a working turn replaced at every step replayed its
// ticks, dots and shimmer (the owner, 21 Nov, and again 23 Nov on Chats, whose list hadn't asked for it). There is no
// asking now: reconcile keeps every row whose tag stays.
//   node tests/rows-in-place.test.mjs
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const ui = readFileSync(new URL("../js/ui.js", import.meta.url), "utf8");
const src = ["app.js", "chats.js", "turnview.js"].map((f) => [f, readFileSync(new URL(`../js/${f}`, import.meta.url), "utf8")]);
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const i = ui.indexOf("export function reconcile("), body = ui.slice(i, ui.indexOf("\n}\n", i));

t("reconcile updates every changed row in place; only a row whose tag changes is drawn anew", () => {
  assert.match(body, /if \(fresh && fresh\.tagName === el\.tagName\) \{/);
  assert.match(body, /redraw\(el, fresh\.innerHTML\);/);
});
t("no list or row has to ask for it", () => {
  assert.ok(!/inPlace: always|it\.inPlace/.test(body), "reconcile still reads a flag");
  for (const [f, s] of src) assert.ok(!/inPlace: true|turnItem/.test(s), f + " still asks");
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
    const turn = (n) => `<div class="m m-turn"><div class="mb">${Array.from({ length: n }, (_, i) => `<div class="st" data-st="${i}"><span class="tick"></span>Step ${i}</div>`).join("")}<span>${n} steps</span></div></div>`;
  t("a step landing keeps the turn's node and every finished step's tick, with no flag", () => {
    const box = document.getElementById("box"), items = (n) => [{ key: "u:1", html: "<div>hi</div>" }, { key: "turn:1", html: turn(n) }];
    reconcile(box, items(1), { quiet: true });
    const row = box.children[1], tick = box.querySelector('[data-st="0"] .tick');
    reconcile(box, items(2), { quiet: true }); reconcile(box, items(3), { quiet: true });
    assert.ok(box.children[1] === row, "the turn's row was replaced");
    assert.ok(box.querySelector('[data-st="0"] .tick') === tick, "the first step's tick was drawn again");
    assert.equal(box.querySelectorAll(".st").length, 3);
  });
  t("a row whose tag changes is drawn anew", () => {
    const box = document.getElementById("box");
    reconcile(box, [{ key: "x", html: "<p>a</p>" }], { quiet: true });
    const was = box.firstElementChild;
    reconcile(box, [{ key: "x", html: "<div>b</div>" }], { quiet: true });
    assert.ok(box.firstElementChild !== was && box.firstElementChild.tagName === "DIV");
  });
}
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
