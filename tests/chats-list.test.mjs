// The Chats list: grouped by day, each row the agent's mark on a tile, its state on the tile's corner, a second line
// that says only what sets the chat apart, and its own chl- classes (the panel's Changes list keeps ch-).
//   node tests/chats-list.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dayGroup, rowTime } from "../js/timeline.js";

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

const now = new Date(2026, 10, 20, 15, 0);
const at = (d, h = 10) => new Date(2026, 10, 20 - d, h, 30).toISOString();
t("day groups: Today, Yesterday, This week, then the month (its year when not this one)", () => {
  assert.equal(dayGroup(at(0), now), "Today");
  assert.equal(dayGroup(at(1), now), "Yesterday");
  assert.equal(dayGroup(at(4), now), "This week");
  assert.equal(dayGroup(at(25), now), new Date(2026, 9, 26).toLocaleDateString(undefined, { month: "long" }));
  assert.match(dayGroup(new Date(2025, 2, 1).toISOString(), now), /2025/);
  assert.equal(dayGroup("nonsense", now), "Earlier");
});
t("a row's time: the clock for today and yesterday, the weekday this week, else the date", () => {
  assert.equal(rowTime(at(0), now), new Date(at(0)).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }));
  assert.equal(rowTime(at(1), now), new Date(at(1)).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }));
  assert.equal(rowTime(at(4), now), new Date(at(4)).toLocaleDateString(undefined, { weekday: "short" }));
  assert.equal(rowTime(at(25), now), new Date(at(25)).toLocaleDateString(undefined, { month: "short", day: "numeric" }));
});
t("a row: the agent's mark on a tile, its state as a badge (none when idle), title, second line, time", () => {
  const src = read("js/chats.js");
  assert.match(src, /<span class="chl-tile">\$\{rtMark\(s\.agent\) \|\| ICON\.thread\}\$\{state \? `<i class="g g-\$\{state\}" aria-hidden="true"><\/i>` : ""\}<\/span>/);
  assert.match(src, /const state = wait \? "needs_approval" : busy \? "working" : held \? "paused" : "";/);
  assert.match(src, /<section class="chl-g" aria-labelledby="chl-g\$\{i\}"><h2 class="chl-h"/);
  // the second line: model (else the agent), effort, and the mode or folder only when not the default
  assert.match(src, /s\.permission_mode && s\.permission_mode !== "auto"/);
  assert.match(src, /home \? "" : `in \$\{folderWord\(s\.cwd\)\}`/);
  assert.doesNotMatch(src, /class="ch-(row|main|t|m|a)"/, "the Chats list has its own classes");
});
t("its look: tokens only, one surface per day, rows 56, nothing hard-coded beyond hairlines", () => {
  const css = read("css/app.css");
  const block = css.slice(css.indexOf(".chl{"), css.indexOf(".chl-calm{"));
  assert.match(block, /\.chl-list\{[^}]*border-radius:var\(--r-lg\);background:var\(--surface\);border:1px solid var\(--line-soft\)\}/);
  assert.match(block, /\.chl-row\{[^}]*min-height:var\(--h-row-list\)/);
  assert.match(block, /\.chl-tile\{[^}]*width:var\(--tile\);height:var\(--tile\)/);
  assert.doesNotMatch(block.replace(/\/\*[\s\S]*?\*\//g, "").replace(/1px solid|gap:2px/g, ""), /\b\d+px\b|#[0-9a-f]{3,8}\b|rgba?\(/i);
  assert.doesNotMatch(css, /\n\.ch-(list|row|main|t|m|a)\{/, "no global ch- rules left to leak into the panel's Changes");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
