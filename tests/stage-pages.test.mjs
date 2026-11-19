// The panel's pages (one panel model for the Files plan and the Thread page, 19 Nov): the panel shows its sections or
// one page in their place; pages open as tabs (one strip, at most 5, the oldest goes if it lets itself); ‹ goes back
// to the sections with the tabs kept; a page can refuse to close (an unsaved file); a page with a width keeps its own
// (480 up to the window less the conversation's 560), apart from the sections'; Esc: full size → sections → close.
// Shell is the page "shell", unchanged to see. API: page(name, spec), show(name, key), sections(), closeTab(name,
// key), pages(), pageShown.
//   node tests/stage-pages.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { panelSrc } from "./lib/panel-src.mjs";
const stage = panelSrc;
const css = readFileSync(new URL("../css/panel.css", import.meta.url), "utf8");

assert.match(stage, /page: PG\.page, show, sections, closeTab: PG\.closeTab, requestClose,\n\s*pages: PG\.pages,/);
assert.match(stage, /const pages = \(\) => S\.tabs\.map/);
assert.match(stage, /const TAB_MAX = 5;/);
// the Files thread's seven edits:
// 1. hidden pages live on: mount once, onShow/onHide every switch, unmount only when the tab closes; a box each
const show = stage.slice(stage.indexOf("  function show("), stage.indexOf("  async function evict("));
assert.match(show, /if \(was\) \{ PAGES\.get\(was\.name\)\.onHide\?\.\(was\.key\); boxFor\(was\)\.hidden = true; \}/);
assert.match(show, /if \(box\._new\) \{ box\._new = false; sp\.mount\(box, next\.key\); \}/);
assert.match(stage, /sp\.unmount\?\.\(t\.key\);\n\s*BOXES\.get\(id\)\?\.remove\(\); BOXES\.delete\(id\);/);
// 2. canClose before a tab's ×, the panel closing, an eviction; refusers skipped, none go if all refuse
assert.match(stage, /const ask = async \(t\) => \{ const sp = PAGES\.get\(t\.name\); try \{ return !sp\.canClose \|\| \(await sp\.canClose\(t\.key\)\) !== false; \} catch \{ return false; \} \};/);
assert.match(stage, /if \(!\(await ask\(t\)\)\) return false;/);
assert.match(stage, /for \(const t of \[\.\.\.S\.tabs\]\) if \(!\(await ask\(t\)\)\) \{/);
assert.match(stage, /if \(sameTab\(t, S\.page\) \|\| sameTab\(t, keep\)\) continue;\n\s*if \(await ask\(t\)\) \{ drop\(t\); n--; \}/);
assert.match(stage, /if \(t\.closest\("\[data-stg-close\]"\)\) \{ requestClose\(\); return; \}/);
// 3. a single page (Files) is one tab, its key what it shows now
assert.match(stage, /const tabOf = \(name, key\) => \{ const sp = PAGES\.get\(name\); return \{ name, key: sp && sp\.single \? name : String\(key\) \}; \};/);
// 4. the page takes Esc first
assert.match(stage, /if \(S\.page && PAGES\.get\(S\.page\.name\)\.escape\?\.\(S\.page\.key\) === true\) return;\n\s*if \(S\.full\) setFull\(false\); else if \(S\.page && S\.page\.name !== "shell"\) sections\(\); else requestClose\(\);/);
// 5. focus on show only when asked
assert.match(show, /sp\.onShow\?\.\(shownKey, \{ focus \}\);/);
// 6. width per page, full size belongs to the page, the switch and the width in one write
assert.match(show, /el\.dataset\.page = name;\n\s*el\.classList\.toggle\("is-shell", name === "shell"\);\n\s*if \(S\.full !== !!S\.fullOf\?\.\[name\]\) setFull\(!!S\.fullOf\?\.\[name\]\);[^\n]*\n\s*apply\(\);/);
assert.match(stage, /if \(S\.full\) setFull\(false\); \/\/ the sections come back at their own width/);
// 7. ‹ Sections with a dot when the sections need you
assert.match(stage, /const sectionsNeed = \(\) => \{ const tg = threads \? threads\(view\(\)\) : null; return !!tg && tg\.some\(\(g\) => g\.k === "needs" && g\.rows\.length\); \};/);
assert.match(stage, /\$\{sectionsNeed\(\) \? '<i class="pg-dot" aria-hidden="true"><\/i>' : ""\}/);
// widths: a page's own, kept per kind, 480 up to the window less READ
assert.match(stage, /const PAGE_MIN = 480;/);
assert.match(stage, /const clampP = \(w\) => \(innerWidth <= 760 \? innerWidth : Math\.round\(Math\.max\(PAGE_MIN, Math\.min\(innerWidth - READ, w\)\)\)\);/, "a phone's page is its sheet's width");
assert.match(stage, /localStorage\.setItem\(`\$\{W_KEY\}:\$\{S\.page\.name\}`, String\(v\)\)/);
// the bar: tabs from two pages on, ‹ first
assert.match(stage, /role="tab" aria-selected="\$\{on\}" data-stg-tab="\$\{esc\(t\.name\)\}" data-stg-key="\$\{esc\(t\.key\)\}"/);
// CSS: one host for every page, a box each; tokens only
assert.match(css, /\.stage\[data-page\] \.stg-frames\{display:none\}\n\.stage\[data-page\] \.stg-page\{display:flex;flex:1;min-height:0;flex-direction:column\}/);
const block = css.slice(css.indexOf("── Pages open in the panel"), css.indexOf("── The Thread page"));
assert.ok(block.length > 300);
assert.doesNotMatch(block.replace(/\/\*[\s\S]*?\*\//g, ""), /\b\d+(\.\d+)?(px|rem|ms)\b|#[0-9a-f]{3,8}\b/i);
assert.match(css, /\.stage \.stg-t:has\(\.pg-back\)\{align-items:center;gap:var\(--s-1\)\}/, "a page's title centres on its ‹");
// inside the Shell page's terminal Esc is the shell's (vim), not the panel's: the stage's keys ask the shells' one rule
// first (owns: inside #shd .xterm), as the app's keys do
{ const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8"), dock = readFileSync(new URL("../js/shells/dock.js", import.meta.url), "utf8");
  assert.match(stage, /shell = null, owns = \(\) => false, places \}\) \{/);
  assert.match(stage, /el\.addEventListener\("keydown", \((?:\/\*\* @type \{any\} \*\/ )?e\) => \{\n(\s*\/\/[^\n]*\n)*\s*if \(owns\(e\)\) return;/, "the terminal's keys before the panel's");
  assert.match(app, /createStage\(\{[^\n]*owns: \(e\) => SH\.owns\(e\), places: kernel\.places \}\);/);
  assert.match(dock, /return !!\(el && el\.closest && el\.closest\("#shd \.xterm"\)\);/);
  assert.match(app, /if \(SH\.owns\(e\)\) \{/); }
console.log("stage-pages: ok");
