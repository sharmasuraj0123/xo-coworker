// A shell in the panel (the owner, 19 Nov): the panel's Shell button moves the shells' own dock (the same sessions
// and tabs as under the page) into the panel as its page "shell". Over a thread (the owner, 20 Nov: "it opens the shell
// and closes the thread suddenly") it opens in that thread's worktree and keeps the thread under it: ‹ or the Shell
// button again goes back to the thread as it was. The left panel's Shells stay as they are.
//   node tests/panel-shell.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const stage = readFileSync(new URL("../js/stage.js", import.meta.url), "utf8");
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const dock = readFileSync(new URL("../js/shells/dock.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/panel.css", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

// the panel: a Shell button (only when the app gives it a shell), and one host for every page, over the frames
assert.match(stage, /\$\{shell \? `<button type="button" class="stg-ic stg-shell-b" data-stg-shell aria-pressed="false"/);
assert.match(stage, /`<div class="stg-body"><div class="stg-frames">`/);
assert.match(stage, /`<\/div><div class="stg-page"><\/div><\/div>`;/, "the page host sits over the frames, in the same cell");
assert.match(stage, /if \(t\.closest\("\[data-stg-shell\]"\)\) \{ setShell\(S\.page\?\.name !== "shell"\); return; \}/);
// over a thread: that thread's worktree; elsewhere the place beside the panel. Off: one level back (to the thread)
const set = stage.slice(stage.indexOf("function setShell("), stage.indexOf("function setShell(") + 300);
assert.match(set, /if \(on\) show\("shell", S\.page\?\.name === "thread" \? `t:\$\{S\.page\.key\}` : view\(\)\); else back\(\);/);
assert.match(stage, /onShow: \(k\) => shell\(true, boxFor\("shell"\), k\), onHide: \(\) => shell\(false\),/);
// a shell over a page keeps that page under it (hidden, not closed); any other page takes the place of both
const show = stage.slice(stage.indexOf("  function show("), stage.indexOf("  /** ‹ and Esc"));
assert.match(show, /const prev = S\.page, keep = name === "shell" && prev && !S\.under \? prev : null;/);
assert.match(show, /for \(const t of \[prev, S\.under\]\) if \(t && t !== keep\) shut\(t, t === prev\);/);
assert.match(show, /if \(keep\) PAGES\.get\(keep\.name\)\.onHide\?\.\(keep\.key\);/);
const back = stage.slice(stage.indexOf("  function back("), stage.indexOf("  /** Every page goes at once"));
assert.match(back, /S\.page = under; S\.under = null;/);
assert.match(back, /if \(under\) \{ BOXES\.get\(under\.name\)\.hidden = false; PAGES\.get\(under\.name\)\.onShow\?\.\(under\.key, \{ focus: had \}\); \}/);
assert.match(stage, /if \(S\.page\) el\.dataset\.stgPage = S\.page\.name; else delete el\.dataset\.stgPage;/, "the shell page is marked as every page is");
assert.match(stage, /b\.setAttribute\("aria-pressed", String\(on\)\)/);
const close = stage.slice(stage.indexOf("function close("), stage.indexOf("function close(") + 200);
assert.match(close, /if \(S\.page\) dropPages\(\);/, "the panel closing puts its pages away (the shell goes back under the page)");

// the app: the dock itself moves (no second terminal), a shell opens where it was asked for, and it goes back home
const ps = app.slice(app.indexOf("function panelShell("), app.indexOf("/** A Shell button: \"ws\""));
assert.match(ps, /function panelShell\(on, host, where\) \{/);
assert.match(ps, /host\.append\(d\); d\.classList\.add\("in-panel"\);/);
assert.match(ps, /const at = where \|\| S\.view;/);
assert.match(ps, /Promise\.resolve\(openShell\(at\.startsWith\("t:"\) \|\| at\.startsWith\("p:"\) \? at : "ws"\)\)\.then\(\(\) => \{ if \(STAGE\.isShell && d\.hidden\) STAGE\.shellOff\(\); \}/, "one that couldn't open goes back");
assert.match(ps, /SHD_HOME\.parent\.insertBefore\(d, SHD_HOME\.next\);\n\s*SH\.hide\(\);/);
assert.match(ps, /if \(!SH\.enabled\) \{ STAGE\.shellOff\(\);/, "no shells here: the panel says so and goes back");
assert.match(app, /new MutationObserver\(\(\) => \{ if \(STAGE\.isShell && \$\("#shd"\)\.hidden\) STAGE\.shellOff\(\); \}\)/, "put away from inside, the panel goes back");
assert.match(app, /shell: \(on, host, where\) => panelShell\(on, host, where\)/);
assert.match(dock, /get shown\(\) \{ return R\.enabled && wanted\(\) && R\.open && !R\.min; \}/);
assert.match(dock, /hide\(\) \{ if \(!R\.open\) return; R\.open = false; changed\(\); away\(\); \}/);

// the left panel's Shells stay: its toggle and the dock under the page are untouched
assert.match(html, /<button type="button" class="gear is-ic sh-tog" id="nv-shells" aria-pressed="false" aria-label="Shells" hidden><span class="gear-ic" id="ic-shells"><\/span><span class="sh-n"><\/span><\/button>/);
assert.match(html, /<section class="shd" id="shd" aria-label="Shells" hidden><\/section>/);

// CSS: tokens only; the page over the frames in one cell; a phone keeps its own shells sheet
const block = css.slice(css.indexOf("── Shell mode"), ((css.indexOf("/* ──", css.indexOf("── Shell mode") + 4) + 1) || css.length + 1) - 1);
assert.match(block, /\.stg-body>\*\{grid-area:1\/1;min-width:0;min-height:0\}/);
assert.match(block, /\.stage\.is-covered \.stg-frames\{visibility:hidden;content-visibility:hidden\}/);
assert.match(block, /@media \(max-width:760px\)\{\.stg-shell-b\{display:none\}\}/);
assert.doesNotMatch(block.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\b1px solid\b/g, "").replace(/@media \([^)]*\)/g, ""), /\b\d+(\.\d+)?(px|rem|ms)\b/);

console.log("panel-shell: ok");
