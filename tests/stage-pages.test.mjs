// The panel's pages, one model (the owner, 20 Nov: "fix the panel from the root"): the panel shows its sections, or
// one page over them (a thread, Files, a shell), at the panel's own width, under one 40 px head with no tabs. A shell
// over a page keeps that page under it; ‹ and Esc go one level back. A page belongs to the place it was opened beside:
// another place, or the panel closing, closes it. A page slides in over the sections, which stay laid out under it.
//   node tests/stage-pages.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { panelSrc } from "./lib/panel-src.mjs";
const stage = panelSrc;
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const fp = readFileSync(new URL("../modules/files/page.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/panel.css", import.meta.url), "utf8");
const appCss = readFileSync(new URL("../css/app.css", import.meta.url), "utf8");
const found = readFileSync(new URL("../css/foundation.css", import.meta.url), "utf8");
const code = stage.replace(/\/\/[^\n]*/g, "");

// no tabs, nothing kept: one page and the one under it
assert.doesNotMatch(code, /S\.tabs|TAB_MAX|evict|pg-tab|data-stg-tab|S\.single|S\.fullOf/);

// the slide: the page comes in over the sections (they stay laid out; covered, they leave the rendering); back, it goes out
assert.match(stage, /getPropertyValue\("--s-3"\)/);
assert.match(stage, /getPropertyValue\("--d-sheet"\)/);
assert.match(stage, /getPropertyValue\("--ease"\)/);
assert.match(stage, /import \{ RM \}/);
assert.match(css, /\.stage\.is-covered \.stg-frames\{visibility:hidden;content-visibility:hidden\}/);
assert.match(css, /\.stg-body\{flex:1;min-height:0;display:grid;grid-template:minmax\(0,1fr\)\/minmax\(0,1fr\)\}/);

// under a page the sections aren't redrawn (they are when they show again)
assert.match(stage, /if \(!covered\) set\("agents"/);

// the panel's own attribute: never [data-page], which is Settings' (its tabs hid the panel: the owner's gap, 20 Nov)
assert.doesNotMatch(code, /dataset\.page\b/);
assert.doesNotMatch(css, /\[data-page\]/);

// a page belongs to its place: another place closes it; the panel closing closes it (and the file in it)
assert.match(app, /if \(v !== S\.view\) STAGE\.leave\(\);/);
assert.doesNotMatch(app, /FP\.reset\(\)/);
assert.match(fp, /close: \(\) => \{ if \(viewer\.hasFile\) viewer\.close\(\{ restore: false \}\); files\.hide\(\); \},/);

// one width: the panel's, for every page; nothing beside it moves when a page opens
assert.doesNotMatch(code, /pageSpecW|PAGE_MIN|clampP|\bWIDE\b|S\.wide|xo-stage-w:/);
assert.doesNotMatch(fp.replace(/\/\/[^\n]*/g, ""), /\bwidth: /);
// --rp has one source per side panel: in a place the viewer and the Map live in the panel; outside one the viewer docks at the panel's width
assert.doesNotMatch(appCss, /body\.viewer-open[^{]*\.main\{--rp|body\.map-open[^{]*\.main\{--rp/);
assert.match(found, /body\.viewer-open:not\(\.stage-open\):not\(\.panel-open\) \.main\{--rp:var\(--vw\)\}/);
assert.match(found, /:root\{--sw:360px;--vw:var\(--sw\);/);
assert.doesNotMatch(appCss, /--vw:(?!var\(--sw\))/);
assert.doesNotMatch(appCss, /body\.viewer-open \.tdock\{display:none\}/);

// one head: ‹ (one level back, named), the page's lead control, its title; the page's controls then the panel's
assert.match(stage, /<div class="stg-acts"><span class="stg-pa"><\/span>/);
assert.match(stage, /get slot\(\) \{ return el\.querySelector\("\.stg-pa"\); \},/);
assert.match(stage, /if \(t\.closest\("\[data-stg-close\]"\)\) \{ requestClose\(\); return; \}/);

// the head is defined once: 40 px, its rule drawn inside it; no other file sizes it but the phone's safe area
assert.equal((css.match(/(^|\n)\.stg-bar\{/g) || []).length, 1);
assert.match(css, /\.stg-bar\{position:relative;z-index:2;flex:none;box-sizing:border-box;display:flex;align-items:center;gap:var\(--s-1\);height:var\(--h-lg\);/);
assert.doesNotMatch(appCss + found, /\.stg-bar\{|\.stg-tabs?\b/);
assert.match(css, /\.stage \.stg-t:has\(\.pg-back\)\{align-items:center;gap:var\(--s-1\)\}/, "a page's title centres on its ‹");

// inside the Shell page's terminal Esc is the shell's (vim), not the panel's: the stage's keys ask the shells' one rule
// first (owns: inside #shd .xterm), as the app's keys do
assert.match(app, /if \(SH\.owns\(e\)\) \{/);
console.log("stage-pages: ok");
// the default width is 2/5 of the main area (the owner, 20 Nov: main and panel 3:2); the chat keeps 480; a drag is kept
assert.match(stage, /const W_KEY = "xo-stage-w2", W_SHARE = 0\.4, W_MIN = 320, CHAT_MIN = 480;/);
assert.match(stage, /const wDef = \(\) => \(innerWidth - sideW\(\)\) \* W_SHARE;/);
assert.match(stage, /const clampW = \(w\) => Math\.round\(Math\.max\(W_MIN, Math\.min\(innerWidth - sideW\(\) - CHAT_MIN, w\)\)\);/);
// All files sits in the head beside Shell, not in Changes; pressed while Files shows, it goes back
assert.match(stage, /<span class="stg-pa"><\/span>\$\{openFiles \? `<button type="button" class="stg-ic" data-open-files/);
assert.doesNotMatch(stage, /class="fr-ib" data-open-files/);
assert.match(stage, /if \(t\.closest\("\[data-open-files\]"\)\) \{ if \(S\.page\?\.name === "files"\) back\(\); else openFiles && openFiles\(\); return; \}/);
console.log("stage-pages width and All files: ok");
// Home and Artifacts have no panel (the owner, 20 Nov): open elsewhere, it steps aside there and comes back at the next place
assert.match(stage, /const placeless = \(\) => !place\(view\(\)\);/);
// which places have a panel is one positive rule, the app's: a project's chat, the Workspace's, their threads
assert.match(app, /const panelPlace = \(v\) => \/\^\(\?:ws\$\|\[pt\]:\)\/\.test\(v \|\| ""\);/);
assert.match(app, /createStage\(\{ place: panelPlace,/);
{ const panelPlace = (v) => /^(?:ws$|[pt]:)/.test(v || "");
  for (const v of ["ws", "p:xo", "t:abc"]) assert.equal(panelPlace(v), true, v);
  for (const v of ["home", "chats", "c:abc", "artifacts", "", undefined]) assert.equal(panelPlace(v), false, String(v)); }
assert.doesNotMatch(stage.replace(/\/\/[^\n]*/g, ""), /"home"[^\n]*"artifacts"|"chats"/, "the stage names no place");
// a place without a panel opens none: not by its button (there is none), a page, or a shortcut
assert.match(stage, /function open\(\{ focus = true \} = \{\}\) \{\n\s*if \(placeless\(\)\) return;/);
assert.match(stage, /if \(placeless\(\)\) \{ if \(S\.open\) \{ S\.resume = true; close\(\{ restore: false, quiet: true \}\); \} \}\n\s*else if \(S\.resume\) \{ S\.resume = false; open\(\{ focus: false \}\); \}/);
assert.match(stage, /if \(saved\.open\) S\.resume = true;/);
console.log("stage-pages home: ok");
// a head control keeps its full control size: in the title row a long title shrinks, never ‹ (the owner, 21 Nov: a sliver to click)
assert.match(css, /\.stg-ic\{flex:none;display:grid;place-items:center;width:var\(--h-ctl\);height:var\(--h-ctl\);/);
console.log("stage-pages head control size: ok");
// ‹'s needs-you dot is the icon badge size, on the icon's corner (the owner, 21 Nov: too large)
{ const tokens = readFileSync(new URL("../core/ui/tokens.css", import.meta.url), "utf8");
  assert.match(tokens, /--badge-dot:calc\(var\(--ic\) \* 3 \/ 8\);/);
  assert.match(css, /\.stage \.pg-dot\{position:absolute;top:calc\(\(var\(--h-ctl\) - var\(--ic\)\) \/ 2\);right:calc\(\(var\(--h-ctl\) - var\(--ic\)\) \/ 2\);width:var\(--badge-dot\);height:var\(--badge-dot\);/); }
console.log("stage-pages back dot: ok");
// Follow is its icon only: the agent at work shows once, as the live file's badge, never a second mark in the head
{ const diffs = readFileSync(new URL("../css/diffs.css", import.meta.url), "utf8");
  assert.match(stage, /class="xd-follow" data-follow hidden>\$\{ICON\.follow\}<\/button>/);
  assert.doesNotMatch(stage + diffs, /xd-arc/);
  // a head's controls never shrink: the panel head's group, a frame head's group
  assert.match(css, /\.stg-acts\{flex:none;/);
  assert.match(css, /\.fr-a\{flex:none;margin-left:auto;/); }
console.log("stage-pages follow: ok");
