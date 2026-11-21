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
  assert.match(src, /<span class="chl-tile">\$\{rtMark\(s\.agent\) \|\| ICON\.thread\}\$\{state \? stateMark\(state\) : ""\}<\/span>/);
  assert.match(src, /const state = wait \? "needs_approval" : busy \? "working" : held \? "paused" : "";/);
  assert.match(src, /<section class="chl-g" aria-labelledby="chl-g\$\{i\}"><h2 class="chl-h"/);
  // the second line: model (else the agent), effort, and the mode or folder only when not the default
  assert.match(src, /s\.permission_mode && s\.permission_mode !== "auto"/);
  assert.match(src, /home \? "" : `in \$\{folderWord\(s\.cwd\)\}`/);
  assert.doesNotMatch(src, /class="ch-(row|main|t|m|a)"/, "the Chats list has its own classes");
});
t("its look: tokens only, one quiet list split by hairlines, rows 56, nothing hard-coded beyond hairlines", () => {
  const css = read("css/app.css");
  const block = css.slice(css.indexOf(".cs-hi{"), css.indexOf(".chl-calm{"));
  assert.match(block, /\.chl-list\{list-style:none;display:flex;flex-direction:column;margin:0;padding:0\}/);
  assert.match(block, /\.chl-list>li\+li\{border-top:1px solid var\(--line-faint\)\}/);
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
  assert.match(src, /return `<span class="iq-l">\$\{rtMark\(st\.agent, \{ lead: true \}\) \|\| ""\}/, "the chip: the mark beside the model");
  assert.match(src, /`<div class="av av-t">\$\{rtMark\(s\.agent\) \|\| ICON\.thread\}<\/div>`/);
  assert.doesNotMatch(src, /\$\{esc\(cliName\(st\.agent\)\)\} · /);
});
t("the New chat picker is the shared picker's look: the chip opens it, agents as a segment with their marks, models and folders as rows, thinking as the depth segment", () => {
  const src = read("js/chats.js"), app = read("js/app.js"), css = read("css/app.css");
  assert.match(src, /<div class="iq-route" role="radiogroup" aria-labelledby="cs-agent-l">/);
  assert.match(src, /data-cs-agent="\$\{esc\(r\.name\)\}">\$\{rtMark\(r\.name, \{ withName: true \}\)/);
  assert.match(src, /<div class="iq-list" role="radiogroup" aria-labelledby="cs-model-l">/);
  assert.match(src, /<div class="iq-route iq-depth" role="radiogroup" aria-labelledby="cs-e-l">/);
  assert.match(src, /toggleSetup\(anchor, part\) \{ if \(C\.pop\.open && C\.pop\.part === part\) closeSetup\(\); else openSetup\(anchor, part\); \}/, "each chip opens its own list");
  assert.match(src, /const x = part === "model" \? r\.right - w \+ gap : r\.left - gap;/, "the model list by the chip's right edge, folder and permission by their left");
  assert.match(app, /\$\("#cs-perm"\)\.addEventListener\("click", \(\) => \{ CH\.toggleSetup\(\$\("#cs-perm"\), "mode"\);/);
  assert.match(read("index.html"), /<button type="button" class="target cs-perm" id="cs-perm" aria-haspopup="dialog" aria-expanded="false" aria-controls="cs-pop" hidden><\/button>/);
  assert.match(src, /row\("data-csmode", m,/, "what it may do: rows, one choice");
  assert.match(src, /import \{ EFFORT_WORD, EFFORT_HINT \} from "\.\/intel\.js";/, "one set of thinking words");
  assert.match(app, /if \(S\.view === "chats"\) \{ CH\.toggleSetup\(\$\("#iq"\), "model"\);/);
  assert.match(app, /const html = chat \? CH\.chipHtml\(K\.view\) : IQ\.chipHtml/);
  assert.doesNotMatch(src + css, /cs-grid|class="cs-mode|xo-select data-cs|tg-ch/, "the form of dropdowns is gone");
  assert.match(app, /const ag = e\.target\.closest\("\[data-cs-agent\]"\);/);
});
t("Chats' header line runs the row's width: the project cap only shares a row with something in .top-end; the folder chip is the folder's name alone", () => {
  assert.match(read("css/app.css"), /\.top\[data-kind="project"\]:has\(> \.top-end:empty\) \.top-who\{flex:1;max-width:none\}/);
  assert.match(read("js/chats.js"), /return `\$\{ICON\.folder\}<span>\$\{esc\(capFirst\(folderName\(st\.cwd\)\.replace\(\/\^your \/, ""\)\)\)\}<\/span>`;/);
});

t("Chats starts with its composer: under the greeting at the top, the dock back at the foot in a chat", () => {
  const app = read("js/app.js"), html = read("index.html"), css = read("css/app.css");
  assert.match(html, /id="scroller"[^>]*>\s*<h2 class="cs-hi" id="cs-hi" hidden>What can I help with\?<\/h2>/);
  assert.match(app, /dockAtTop\(v === "chats"\);/);
  assert.match(app, /if \(top\) \$\("#cs-hi"\)\.after\(dock\); else \$\("#drop-veil"\)\.after\(dock\);/);
  assert.match(app, /had\?\.focus\(\{ preventScroll: true \}\)/, "focus in the composer survives the move");
  assert.match(css, /\.app\[data-conv="chats"\] \.main\{--dock-h:0px\}/, "nothing reserves the foot's room on Chats");
  assert.match(css, /\.cs-hi\{[^}]*var\(--fs-display\)\/var\(--lh-display\)/, "the greeting is Home's display role");
});
t("Recent: the three latest under the composer, all of them a click away with a search over titles and lines, second lines only for what isn't the default", () => {
  const src = read("js/chats.js"), app = read("js/app.js");
  assert.match(src, /<div class="rt-seg chl-seg" role="group" aria-label="Which chats"><button type="button" data-chl-all="0" aria-pressed="\$\{!C\.all\}">Recent<\/button><button type="button" data-chl-all="1" aria-pressed="\$\{C\.all\}">All/);
  assert.match(src, /\$\{C\.all \? `<label class="tg-qf chl-q">\$\{ICON\.search\}<input type="search" data-chl-q/);
  assert.match(read("css/app.css"), /\.chl-top>\.chl-q\{[^}]*height:var\(--h-lg\);border-radius:var\(--r-lg\)\}/, "the field matches the segment beside it");
  assert.match(src, /const RECENT = 3;/);
  assert.match(src, /few \? rows\.slice\(0, RECENT\) : q \? rows\.filter\(\(s\) => `\$\{titleFor\(s\)\} \$\{rowLine\(s\)\}`\.toLowerCase\(\)\.includes\(q\)\)/);
  assert.match(read("css/app.css"), /\.scroller:has\(\.chl-few,\.chl-calm\)>\.column\{height:0;margin-bottom:auto\}/, "at rest the composer stands in the middle");
  assert.match(src, /No chats match/);
  assert.doesNotMatch(src.slice(src.indexOf("const rowLine"), src.indexOf("const waiting")), /Default model/);
  assert.match(app, /e\.target\.matches\?\.\("\[data-chl-q\]"\)\) CH\.search\(e\.target\.value\)/);
  assert.doesNotMatch(read("css/panel.css"), /\.stage \.tg-qf/, "the search field is one shared look");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
