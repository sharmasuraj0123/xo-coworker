// A row that goes while it holds focus hands focus on first, never to BODY (the create-project/Launchpad grader on
// f70ca6b, C050/C121): to the nearest row that stays, before it, else after, on its first control that shows; with
// none, to the list's own fallback (the conversation's: the message box). Run on a DOM (linkedom), as the app calls it.
//   node tests/reconcile-focus.test.mjs   (linkedom: LINKEDOM=<its esm/index.js>, else `npm i linkedom` in ~/.cache/xo-test-deps)
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const LD = process.env.LINKEDOM || [join(homedir(), ".cache/xo-test-deps/node_modules/linkedom/esm/index.js"), "/tmp/dom/node_modules/linkedom/esm/index.js"].find((f) => existsSync(f));
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

if (!LD) console.log("  skip the DOM cases: linkedom isn't installed (npm i linkedom in ~/.cache/xo-test-deps, or set LINKEDOM)");
else {
  const { parseHTML } = await import(LD);
  const { window, document } = parseHTML(`<!doctype html><html><body><main id="box"></main><textarea id="say"></textarea></body></html>`);
  let active = document.body;
  Object.defineProperty(document, "activeElement", { get: () => (active && active.isConnected ? active : document.body) });
  Object.assign(window.HTMLElement.prototype, { focus() { active = this; }, getClientRects() { return this.hidden ? [] : [{}]; } });
  Object.assign(globalThis, { window, document, CustomEvent: window.CustomEvent });
  const { reconcile } = await import("../core/ui/redraw.js");
  const box = document.getElementById("box"), say = document.getElementById("say");
  const row = (k, ctl = `<button data-r="${k}">${k}</button>`) => ({ key: k, html: `<div class="row">${ctl}</div>` });
  const draw = (items) => reconcile(box, items, { quiet: true, fallback: () => say });
  const btn = (k) => box.querySelector(`[data-r="${k}"]`);

  t("the row that holds focus and is going hands it to the nearest row before it that stays", () => {
    draw([row("a"), row("b"), row("c")]);
    btn("b").focus();
    draw([row("a"), row("c")]);
    assert.equal(document.activeElement, btn("a"));
  });
  t("with none before it, to the nearest row after it, on its first control that shows", () => {
    draw([row("a"), row("b", `<button hidden data-r="b0">x</button><button data-r="b">b</button>`)]);
    btn("a").focus();
    draw([row("b", `<button hidden data-r="b0">x</button><button data-r="b">b</button>`)]);
    assert.equal(document.activeElement, btn("b"));
  });
  t("with no row left, to the list's fallback, never the page", () => {
    draw([row("a")]);
    btn("a").focus();
    draw([]);
    assert.equal(document.activeElement, say);
  });
}
t("the conversation's fallback is its message box", () => {
  assert.match(app, /reconcile\(C\.msgs, items, \{ quiet, fallback: \(\) => \(C\.main \? \$\("#say"\) : C\.scroller\) \}\);/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
