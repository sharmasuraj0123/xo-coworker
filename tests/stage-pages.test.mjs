// The panel's pages, one model (the owner, 20 Nov: "fix the panel from the root"): the panel shows its sections, or
// one page over them (a thread, Files, a shell), at the panel's own width, under one 40 px head with no tabs. A shell
// over a page keeps that page under it; ‹ and Esc go one level back. A page belongs to the place it was opened beside:
// another place, or the panel closing, closes it. A page slides in over the sections, which stay laid out under it.
//   node tests/stage-pages.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const stage = readFileSync(new URL("../js/stage.js", import.meta.url), "utf8");
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const fp = readFileSync(new URL("../js/filespage.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/panel.css", import.meta.url), "utf8");
const appCss = readFileSync(new URL("../css/app.css", import.meta.url), "utf8");
const found = readFileSync(new URL("../css/foundation.css", import.meta.url), "utf8");
const code = stage.replace(/\/\/[^\n]*/g, "");

// no tabs, nothing kept: one page and the one under it
assert.match(stage, /Object\.assign\(S, \{ page: null, under: null \}\);/);
assert.doesNotMatch(code, /S\.tabs|TAB_MAX|evict|pg-tab|data-stg-tab|S\.single|S\.fullOf/);
assert.match(stage, /page, show, back, closePage, requestClose,/);
assert.match(stage, /leave: \(\) => dropPages\(\),/);

// a page's box is built once and kept; the same kind on another subject keeps its box
const show = stage.slice(stage.indexOf("  function show("), stage.indexOf("  /** ‹ and Esc"));
assert.match(show, /if \(!box\._m\) \{ box\._m = true; sp\.mount\?\.\(box, next\.key\); \}/);
assert.match(show, /if \(S\.page && S\.page\.name === name\) \{ S\.page = next; sp\.onShow\?\.\(next\.key, \{ focus \}\); pageChanged\(\); return true; \}/);
assert.doesNotMatch(stage, /unmount|\.remove\(\); BOXES\.delete/);

// the slide: the page comes in over the sections (they stay laid out; covered, they leave the rendering); back, it goes out
assert.match(stage, /const FROM = \{ opacity: 0, transform: "translateX\(12px\)" \}, TO = \{ opacity: 1, transform: "none" \};/);
assert.match(stage, /getPropertyValue\("--d-sheet"\)/);
assert.match(stage, /getPropertyValue\("--ease"\)/);
assert.match(stage, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
assert.match(show, /if \(fresh \|\| RM\.matches\) settle\(\); else \{ box\.style\.zIndex = "1"; slide\(box, "in", settle\); \}/);
const back = stage.slice(stage.indexOf("  function back("), stage.indexOf("  /** Every page goes at once"));
assert.match(back, /if \(RM\.matches\) gone\(\); else slide\(box, "out", gone\);/);
assert.match(css, /\.stage\.is-covered \.stg-frames\{visibility:hidden;content-visibility:hidden\}/);
assert.match(css, /\.stg-body\{flex:1;min-height:0;display:grid;grid-template:minmax\(0,1fr\)\/minmax\(0,1fr\)\}/);

// under a page the sections aren't redrawn (they are when they show again)
assert.match(stage, /if \(!S\.lp && !covered\) set\("agents"/);

// the panel's own attribute: never [data-page], which is Settings' (its tabs hid the panel: the owner's gap, 20 Nov)
assert.match(stage, /if \(S\.page\) el\.dataset\.stgPage = S\.page\.name; else delete el\.dataset\.stgPage;/);
assert.doesNotMatch(code, /dataset\.page\b/);
assert.doesNotMatch(css, /\[data-page\]/);
const sp = app.slice(app.indexOf("function setPage("), app.indexOf("\n}\n", app.indexOf("function setPage(")));
assert.match(sp, /for \(const p of setEl\.querySelectorAll\("\[data-page\]"\)\) p\.hidden = p\.dataset\.page !== id;/, "Settings looks only inside Settings");
assert.doesNotMatch(sp, /\$\$\("\[data-page\]"\)/);

// a page belongs to its place: another place closes it; the panel closing closes it (and the file in it)
assert.match(app, /if \(v !== S\.view\) STAGE\.leave\(\);/);
assert.doesNotMatch(app, /FP\.reset\(\)/);
assert.match(stage.slice(stage.indexOf("function close("), stage.indexOf("function close(") + 200), /if \(S\.page\) dropPages\(\);/);
assert.match(fp, /close: \(\) => \{ if \(viewer\.hasFile\) viewer\.close\(\{ restore: false \}\); files\.hide\(\); \},/);

// one width: the panel's, for every page; nothing beside it moves when a page opens
assert.match(stage, /function apply\(\) \{\n\s*const v = clampW\(wSaved \|\| wDef\(\)\);/);
assert.doesNotMatch(code, /pageSpecW|PAGE_MIN|clampP|\bWIDE\b|S\.wide|xo-stage-w:/);
assert.doesNotMatch(fp.replace(/\/\/[^\n]*/g, ""), /\bwidth: /);
// --rp has one source per side panel: the viewer and the Map live in the panel now, so neither reserves room of its own
assert.doesNotMatch(appCss, /body\.viewer-open \.main\{--rp|body\.map-open[^{]*\.main\{--rp/);
assert.doesNotMatch(appCss, /body\.viewer-open \.tdock\{display:none\}/);

// one head: ‹ (one level back, named), the page's lead control, its title; the page's controls then the panel's
const th = stage.slice(stage.indexOf("  function titleHtml("), stage.indexOf("  let nameOf"));
assert.match(th, /const to = S\.under \? pageTitle\(S\.under\) : "Threads, Changes and Map"/);
assert.match(th, /return `\$\{back\}\$\{lead\}<b class="stg-name" title="\$\{esc\(title\)\}">\$\{esc\(title\)\}<\/b>`;/);
assert.match(stage, /<div class="stg-acts"><span class="stg-pa"><\/span>/);
assert.match(stage, /get slot\(\) \{ return el\.querySelector\("\.stg-pa"\); \},/);
// ‹ with a dot when the sections need you
assert.match(stage, /const sectionsNeed = \(\) => \{ const tg = threads \? threads\(view\(\)\) : null; return !!tg && tg\.some\(\(g\) => g\.k === "needs" && g\.rows\.length\); \};/);
// Esc: the page's own first, then one level back, then full size, then closed
assert.match(stage, /if \(S\.page && PAGES\.get\(S\.page\.name\)\.escape\?\.\(S\.page\.key\) === true\) return;\n\s*if \(S\.page\) back\(\); else if \(S\.full\) setFull\(false\); else requestClose\(\);/);
assert.match(stage, /if \(t\.closest\("\[data-stg-close\]"\)\) \{ requestClose\(\); return; \}/);

// the head is defined once: 40 px, its rule drawn inside it; no other file sizes it but the phone's safe area
assert.equal((css.match(/(^|\n)\.stg-bar\{/g) || []).length, 1);
assert.match(css, /\.stg-bar\{position:relative;z-index:2;flex:none;box-sizing:border-box;display:flex;align-items:center;gap:var\(--s-1\);height:var\(--h-lg\);/);
assert.doesNotMatch(appCss + found, /\.stg-bar\{|\.stg-tabs?\b/);
assert.match(css, /\.stage \.stg-t:has\(\.pg-back\)\{align-items:center;gap:var\(--s-1\)\}/, "a page's title centres on its ‹");

// inside the Shell page's terminal Esc is the shell's (vim), not the panel's: the stage's keys ask the shells' one rule
// first (owns: inside #shd .xterm), as the app's keys do
{ const dock = readFileSync(new URL("../js/shells/dock.js", import.meta.url), "utf8");
  assert.match(stage, /shell = null, owns = \(\) => false \}\) \{/);
  assert.match(stage, /el\.addEventListener\("keydown", \(e\) => \{\n(\s*\/\/[^\n]*\n)*\s*if \(owns\(e\)\) return;/, "the terminal's keys before the panel's");
  assert.match(app, /createStage\(\{[^\n]*owns: \(e\) => SH\.owns\(e\) \}\);/);
  assert.match(dock, /return !!\(el && el\.closest && el\.closest\("#shd \.xterm"\)\);/);
  assert.match(app, /if \(SH\.owns\(e\)\) \{/); }
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
assert.match(stage, /const placeless = \(\) => \{ const v = view\(\); return v === "home" \|\| v === "artifacts"; \};/);
assert.match(stage, /if \(placeless\(\)\) \{ if \(S\.open\) \{ S\.resume = true; close\(\{ restore: false, quiet: true \}\); \} \}\n\s*else if \(S\.resume\) \{ S\.resume = false; open\(\{ focus: false \}\); \}/);
assert.match(stage, /if \(saved\.open\) S\.resume = true;/);
console.log("stage-pages home: ok");
// the sections' head names no place (the owner, 20 Nov: the chat beside it already does); a page still shows its title
assert.match(stage, /if \(!S\.page\) return ""; \/\/ the sections name no place/);
console.log("stage-pages head: ok");
