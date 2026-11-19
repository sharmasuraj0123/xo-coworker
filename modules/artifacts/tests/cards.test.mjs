// node modules/artifacts/tests/cards.test.mjs: a made card is made once and then updated in place, the same node under a press, its pin and age changing.
import assert from "node:assert/strict";
import { dom } from "../../../tests/lib/dom.mjs";

await dom(`<ul id="list"></ul>`);
const { createCards } = await import("../cards.js");

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };

const PV = { thumbs: new Map(), texts: new Map(), failed: new Set(), previewable: () => false };
const naming = (m) => ({ label: m.title || m.name, html: m.title || m.name, file: m.name, tip: m.path, from: m.threadTitle || "Its thread" });
const { syncCards } = createCards({ PV, PROJ: (p) => p.toUpperCase(), naming });
const card = (o = {}) => ({ key: "t1|a.md", tid: "t1", project: "demo", threadTitle: "Write it", title: null, path: "a.md", name: "a.md", type: "", bytes: 2048, kind: "doc", at: Date.now() - 60_000, pinned: false, ...o });
const ul = document.getElementById("list");

t("a card is drawn once, with its name, its kind and size, its thread and its pin", () => {
  syncCards(ul, [card()], false);
  const li = ul.querySelector(".md-it");
  assert.equal(li.querySelector("[data-made-file]").dataset.madeFile, "t1|a.md");
  assert.match(li.querySelector(".md-meta > span").textContent, /^Document · 2\.0 KB · /);
  assert.equal(li.querySelector("[data-made-go]").dataset.madeGo, "t:t1");
  assert.equal(li.querySelector("[data-made-pin]").getAttribute("aria-pressed"), "false");
});
t("pinning it updates the same node in place: its pin and its class change, nothing is drawn anew", () => {
  const li = ul.querySelector(".md-it"), open = li.querySelector(".md-open"), pin = li.querySelector(".md-pin");
  syncCards(ul, [card({ pinned: true })], false);
  assert.equal(ul.querySelector(".md-it"), li);
  assert.equal(li.querySelector(".md-open"), open);
  assert.equal(li.querySelector(".md-pin"), pin);
  assert.equal(pin.getAttribute("aria-pressed"), "true");
  assert.ok(li.classList.contains("is-pin"));
});
t("on Home's strip a card names its project instead of its kind; on the page every card keeps a from line", () => {
  const home = document.createElement("ul"), page = document.createElement("ul");
  syncCards(home, [card({ tid: null })], true);
  assert.match(home.querySelector(".md-meta > span").textContent, /^DEMO · /);
  syncCards(page, [card({ tid: null })], "page");
  assert.ok(page.querySelector(".md-from.is-none"), "an empty from line keeps every card one height");
});
console.log(`\n${passed} passed`);
