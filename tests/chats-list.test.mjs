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
t("Chats opens at its top, the newest first; a chat still opens at its latest", () => {
  const app = read("js/app.js"), fo = read("js/follow.js");
  assert.match(app, /if \(opening\) \{ C\.rendered = v; if \(v === "chats"\) C\.follow\.toTop\(\); else C\.follow\.toLatest\(false\); \}/);
  assert.match(fo, /function toTop\(\) \{\n\s*pinned = false; held = false;\n\s*sc\(\)\.scrollTop = 0; lastTop = 0;/);
  assert.match(app, /follow: \{ toLatest, toTop, unpin/, "the main chat's follower has it too");
});
t("the agent is its mark, its name only on hover and for screen readers: the header, the composer's line, replies", () => {
  const src = read("js/chats.js");
  assert.match(src, /const agentMark = \(agent, lead = true\) => rtMark\(agent, \{ lead \}\) \|\| /);
  assert.match(src, /<span class="pj-s">\$\{metaHtml\(s\)\}<\/span>/);
  assert.match(src, /<\/b> · \$\{agentMark\(st\.agent\)\}\$\{esc\(st\.model \?/, "the composer's line: the mark beside the model");
  assert.match(src, /`<div class="av av-t">\$\{rtMark\(s\.agent\) \|\| ICON\.thread\}<\/div>`/);
  assert.doesNotMatch(src, /\$\{esc\(cliName\(st\.agent\)\)\} · /);
});
t("the New chat picker: one grid at the head's inset, the agents as one choice with their marks, modes a compact list", () => {
  const src = read("js/chats.js"), css = read("css/app.css");
  assert.match(src, /<div class="rt-seg cs-agents" role="radiogroup" aria-labelledby="cs-agent-l">/);
  assert.match(src, /data-cs-agent="\$\{esc\(r\.name\)\}">\$\{rtMark\(r\.name\) \|\| ""\}<span>/);
  assert.match(src, /<div class="cs-grid">\$\{agentRow\}\$\{field\("cwd", "Folder"\)\}\$\{field\("model", "Model"\)\}\$\{field\("effort", "Effort"\)\}<\/div>/);
  assert.match(src, /class="cs-mode\$\{m === st\.mode \? " is-on" : ""\}"/);
  assert.match(css, /\.cs-grid\{display:grid;grid-template-columns:max-content minmax\(0,1fr\);[^}]*padding:var\(--s-3\) var\(--pop-x\) var\(--s-2\)\}/);
  assert.match(css, /\.rt-seg\.cs-agents button\{[^}]*height:var\(--h-sm\);/, "as tall as the fields: 24 in its 3 px frame");
  assert.match(css, /\.cs-mode\{[^}]*height:var\(--h-ctl\);[^}]*font:var\(--fw-regular\) var\(--fs-menu\)\/var\(--lh-menu\)/);
  assert.match(css, /:is\(\.set-choice,\.cs-mode\)\.is-on \.sc-dot\{/, "one chosen dot");
  assert.match(read("css/tokens.css"), /--pop-x:10px;/);
  assert.match(read("js/app.js"), /const ag = e\.target\.closest\("\[data-cs-agent\]"\);/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
