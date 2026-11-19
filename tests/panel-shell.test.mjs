// A shell in the panel (the owner, 19 Nov): the panel's Shell button moves the shells' own dock (the same sessions
// and tabs as under the page) into the panel in place of its frames, opening a shell for where you are; off, or the
// panel closing, it goes back under the page, put away. The left panel's Shells stay as they are.
//   node tests/panel-shell.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const stage = readFileSync(new URL("../js/stage.js", import.meta.url), "utf8");
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const dock = readFileSync(new URL("../js/shells/dock.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/panel.css", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

// the panel: a Shell button (only when the app gives it a shell), a host, the mode
assert.match(stage, /\$\{shell \? `<button type="button" class="stg-ic stg-shell-b" data-stg-shell aria-pressed="false"/);
assert.match(stage, /`<div class="stg-shell"><\/div>` \+\n\s*`<div class="stg-frames">`/, "its host sits where the frames are");
assert.match(stage, /if \(t\.closest\("\[data-stg-shell\]"\)\) \{ setShell\(!S\.shell\); return; \}/);
const set = stage.slice(stage.indexOf("function setShell("), stage.indexOf("function setShell(") + 900);
assert.match(set, /el\.classList\.toggle\("is-shell", S\.shell\)/);
assert.match(set, /b\.setAttribute\("aria-pressed", String\(S\.shell\)\)/);
assert.match(set, /shell\(S\.shell, el\.querySelector\("\.stg-shell"\)\)/);
const close = stage.slice(stage.indexOf("function close("), stage.indexOf("function close(") + 200);
assert.match(close, /if \(S\.shell\) setShell\(false\);/, "the panel closing leaves Shell mode");

// the app: the dock itself moves (no second terminal), a shell opens for where you are, and it goes back home
const ps = app.slice(app.indexOf("function panelShell("), app.indexOf("/** A Shell button: \"ws\""));
assert.match(ps, /host\.append\(d\); d\.classList\.add\("in-panel"\);/);
assert.match(ps, /openShell\(S\.view\.startsWith\("t:"\) \|\| S\.view\.startsWith\("p:"\) \? S\.view : "ws"\)/);
assert.match(ps, /SHD_HOME\.parent\.insertBefore\(d, SHD_HOME\.next\);\n\s*SH\.hide\(\);/);
assert.match(ps, /if \(!SH\.enabled\) \{ STAGE\.shellOff\(\);/, "no shells here: the panel says so and stays as it was");
assert.match(app, /new MutationObserver\(\(\) => \{ if \(STAGE\.isShell && \$\("#shd"\)\.hidden\) STAGE\.shellOff\(\); \}\)/, "put away from inside, the panel goes back");
assert.match(dock, /get shown\(\) \{ return R\.enabled && wanted\(\) && R\.open && !R\.min; \}/);
assert.match(dock, /hide\(\) \{ if \(!R\.open\) return; R\.open = false; changed\(\); away\(\); \}/);

// the left panel's Shells stay: its toggle and the dock under the page are untouched
assert.match(html, /<button type="button" class="gear sh-tog" id="nv-shells"/);
assert.match(html, /<section class="shd" id="shd" aria-label="Shells" hidden><\/section>/);

// CSS: tokens only; a phone keeps its own shells sheet
const block = css.slice(css.indexOf("── Shell mode"));
assert.match(block, /\.stage\.is-shell \.stg-frames\{display:none\}/);
assert.match(block, /@media \(max-width:760px\)\{\.stg-shell-b\{display:none\}\}/);
assert.doesNotMatch(block.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\b1px solid\b/g, "").replace(/@media \([^)]*\)/g, ""), /\b\d+(\.\d+)?(px|rem|ms)\b/);

console.log("panel-shell: ok");
