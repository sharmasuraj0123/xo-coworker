// A row that goes while it holds focus hands focus on first, never to BODY (the create-project/Launchpad grader on
// f70ca6b, C050/C121): to the nearest row that stays, before it, else after, on its first control that shows; with
// none, to the list's own fallback (the conversation's: the message box). Run on a DOM (tests/lib/dom.mjs), as the app calls it.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dom } from "./lib/dom.mjs";

const drawConv = readFileSync(new URL("../modules/conversation/draw.js", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

{
  const { document } = await dom(`<main id="box"></main><textarea id="say"></textarea>`);
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
  assert.match(drawConv, /reconcile\(C\.msgs, items, \{ quiet, fallback: \(\) => \(C\.main \? \$\("#say"\) : C\.scroller\) \}\);/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
