import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const app = read("js/app.js"), view = read("js/runsview.js"), html = read("index.html"), css = read("css/app.css");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const fn = (src, name) => { const i = src.indexOf(name); assert.ok(i >= 0, name); return src.slice(i, src.indexOf("\n}\n", i)); };

t("no sheet: the page's content is built once and mounted in the panel's page box", () => {
  assert.doesNotMatch(html, /id="runs"|id="runs-card"/);
  assert.doesNotMatch(app, /runsEl\b/);
  assert.doesNotMatch(css, /\.runs-card\b|\.rn-h\b|\.rn-back\b|\.rn-foot\b/);
  assert.match(app, /STAGE\.page\("runs", \{\n\s*over: true,/);
  assert.match(app, /mount: \(box\) => box\.append\(runsCard\),/);
});
t("it opens over the page under it, and ‹ and Esc go up one level the page's own way", () => {
  assert.match(app, /up: \(\) => \{ runsEscape\(\); return true; \},\n\s*escape: \(\) => \{ runsEscape\(\); return true; \},/);
  const esc = fn(app, "function runsEscape()");
  assert.match(esc, /if \(RS\.view !== "run"\) \{ closeRuns\(\); return; \}/, "the list: back to the thread");
  assert.match(esc, /runsLand\(`\[data-run="\$\{CSS\.escape\(id\)\}"\]`\)/, "a run: back to the list, on its row");
});
t("from the main chat the panel opens for it and closes with it; from the panel it steps back to the thread page", () => {
  assert.match(fn(app, "async function openRuns("), /if \(!RS\.open\) Object\.assign\(RS, \{ panelWas: STAGE\.isOpen,/);
  assert.match(fn(app, "async function openRuns("), /if \(!STAGE\.show\("runs", t\.sessionId\)\) \{ RS\.open = false; return; \}/);
  assert.match(fn(app, "function closeRuns()"), /if \(!RS\.panelWas && STAGE\.pageShown\?\.name === "runs"\) STAGE\.close\(\{ restore: false \}\); else STAGE\.closePage\("runs"\);/);
  assert.match(app, /backTo: \(\) => \(RS\.view === "run" \? "Sub-agents" : RS\.panelWas \|\| STAGE\.pageShown\?\.name !== "runs" \? "" : "the thread"\),/);
});
t("focus goes back to what opened it only when it was in the page; a page that moved focus keeps it there", () => {
  const g = fn(app, "function runsGone()");
  assert.match(g, /const here = runsCard\.contains\(document\.activeElement\) \|\| STAGE\.owns\(document\.activeElement\);/);
  assert.match(g, /RS\.refocus = here \? to : null;\n\s*if \(here\) to\(\);/);
  assert.match(fn(app, "function closeRuns()"), /if \(!a \|\| a === document\.body\) RS\.refocus\?\.\(\);/, "a phone's panel gone, then focus");
});
t("nothing modal is left: the app isn't made inert for it and it isn't a key layer", () => {
  assert.match(app, /hold\(\$\("#app"\), \[jump, keys, allEl, QO\.el\]\.some/);
  assert.match(app, /return \[keys, allEl, jump\]\.find/);
});
t("agents first, live then newest; every command at any depth in one Commands group, 8 then Show more", () => {
  assert.match(view, /agents: \(nodes \|\| \[\]\)\.filter\(\(r\) => !isCmd\(r\)\)\.sort\(newest\), cmds: all\.filter\(isCmd\)\.sort\(newest\)/);
  assert.match(view, /const open = o\.cmdsOpen !== false, max = o\.cmdsAll \? cmds\.length : 8;/);
  assert.match(view, /data-runs-cmds aria-expanded="\$\{open\}"/);
  assert.match(app, /if \(e\.target\.closest\("\[data-runs-more\]"\)\) \{ RS\.cmdsAll = true;/);
});
t("a run's page: its kind and title, State Steps Tokens Time, its result, then its work; a lost record said quietly", () => {
  const r = fn(view, "export function runViewHtml(");
  assert.match(r, /\["State", /);
  assert.match(r, /!cmd && \["Steps", /);
  assert.match(r, /Its step-by-step record is no longer kept/);
  assert.doesNotMatch(r, /data-close|data-runs-back|rn-foot/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
