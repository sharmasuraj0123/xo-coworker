import assert from "node:assert/strict";
import { dom } from "./lib/dom.mjs";
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
{
  const { document } = await dom('<div id="box"></div>');
  const { reconcile } = await import("../core/ui/redraw.js");
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
