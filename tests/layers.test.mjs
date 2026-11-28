// Cascade layers change no winner: one order of layers, declared first, and a sheet in a layer wins and loses where load order made it.
import assert from "node:assert/strict";
import { ORDER, declarations, drawn, turned } from "./lib/layers.mjs";
import { bootPage } from "./lib/page.mjs";
import { stylesheetRows } from "./lib/css-snapshot.mjs";
import { xi } from "../core/ui/icons/icon.js";
import { fileIcon } from "../core/ui/icons/fileicons.js";
import { XI } from "../core/ui/icons/xoicons.js";
import { chartHtml } from "../core/ui/markdown/chart.js";

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

// contests the analysis can't tell apart from turned ones, each read and found to be different elements
const READ = [
  [(/** @type {string} */ c) => /^core\/ui\/inverse-surfaces\.css :root\[data-theme="light"\] \.lbx \{(color|--ink-[34]):/.test(c) && !/ vs .*lbx[^ ]* \{[^}]*\}$/.test(c), "the inverse surface, div.lbx, against rules that never name them"],
  [(/** @type {string} */ c) => /^core\/ui\/foundation\.css svg\[stroke="currentColor"\]\[fill="none"\]/.test(c), "no svg the page draws carries the pen on its root (the pack puts it on paths)"],
];

const { document } = await bootPage();
globalThis.localStorage = { getItem: (key) => key === "xo-home-shape" ? JSON.stringify({ parts: [{ id: "hm-made", n: 1 }] }) : null };
await import("../modules/home/skeleton.js");
await import("../shell/frame.js");
const all = declarations(["./vendor/katex/katex.min.css"]);
const contests = turned(all, drawn(document));

t("the layers are declared once, in order, before anything else the page styles", () => {
  const first = stylesheetRows.slice(0, ORDER.length);
  assert.ok(first.every(({ at, context }) => at === "layer" && context.length === 0));
  assert.deepEqual(first.map(({ params }) => params), ORDER);
});
t("every layer a sheet names is one of them", () => {
  const used = [...new Set(all.map((d) => d.layer).filter(Boolean))];
  assert.ok(used.length >= 3, `layers in use: ${used.join(", ")}`);
  for (const l of used) assert.ok(ORDER.includes(/** @type {string} */ (l)), `${l} is declared`);
});
t("no contest turns: what won by load order still wins", () => {
  const left = contests.filter((c) => !READ.some(([read]) => /** @type {(c: string) => boolean} */ (read)(c)));
  assert.deepEqual(left, []);
});
t("every contest read by hand is still there to read (else it leaves the list)", () => {
  const now = contests;
  for (const [read, why] of READ) assert.ok(now.some((c) => /** @type {(c: string) => boolean} */ (read)(c)), String(why));
});
t("the page, icon pack, file icons and charts keep the pen off SVG roots", () => {
  const icons = document.createElement("div");
  icons.innerHTML = Object.keys(XI).map((name) => xi(name)).join("");
  assert.equal(icons.querySelectorAll("svg").length, Object.keys(XI).length);
  const files = document.createElement("div");
  files.innerHTML = fileIcon("script.py") + fileIcon("result.json");
  assert.equal(files.querySelectorAll("svg").length, 2);
  const chart = document.createElement("div");
  chart.innerHTML = chartHtml("[1,2,3]");
  assert.equal(chart.querySelectorAll(".mc-plot svg").length, 1);
  assert.equal(document.querySelectorAll("#hm-made .hm-lbl svg").length, 1);
  const pen = 'svg[stroke="currentColor"][fill="none"]';
  assert.ok(!document.querySelector(pen), "page markup sets the pen on an SVG root");
  assert.ok(!icons.querySelector(pen), "icon pack sets the pen on an SVG root");
  assert.ok(!files.querySelector(pen), "file icons set the pen on an SVG root");
  assert.ok(!chart.querySelector(pen), "charts set the pen on an SVG root");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
