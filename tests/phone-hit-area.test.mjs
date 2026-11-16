// A phone's larger hit area (an ::after 8 px around a small control) belongs to the control it extends: it's drawn
// only where the control anchors it (positioned), never where the control sits static in a layout, since the ::after
// then anchors to the nearest positioned ancestor and covers it (the create-project grader on c8f4c45, C066,
// artifacts-family origin-center-tap at 390 dark and light: on the Artifacts list a tap on a card's "‹ Conversation
// fixture" pinned the card instead of opening its thread; the list's pin is position:static in its 44 px column, so
// its ::after, inset -8 px, covered the whole card). The list's pin is a full-height 44 px column, already a target:
// it draws no extension.
//   node tests/phone-hit-area.test.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const read = (f) => readFileSync(new URL(`../css/${f}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const phone = read("phone.css");
const all = readdirSync(new URL("../css/", import.meta.url)).filter((f) => f.endsWith(".css")).map(read).join("\n");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("the extension's controls, and every layout that makes one of them static draws none for it", () => {
  const m = /:root:root :is\(([^)]*)\)::after\{content:"";position:absolute;inset:-8px\}/.exec(phone);
  assert.ok(m, "the phone's 8 px extension");
  const ctl = m[1].split(",").map((s) => s.trim());
  for (const r of all.matchAll(/([^{}]+)\{([^}]*position:static[^}]*)\}/g)) {
    const sel = r[1].trim();
    for (const c of ctl) {
      if (!sel.endsWith(c)) continue;
      const off = new RegExp(`${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}::after\\{content:none\\}`);
      assert.match(phone, off, `${sel} is static: its ::after would cover its positioned ancestor`);
    }
  }
});
t("the Artifacts list's pin draws no extension", () => {
  assert.match(phone, /\.arts:not\(\.is-pics\) \.ar-grid \.md-pin::after\{content:none\}/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
