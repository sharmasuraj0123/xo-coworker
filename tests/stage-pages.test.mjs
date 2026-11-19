// The panel's pages (one panel model for the Files plan and the Thread page, 19 Nov): the panel shows its sections or
// one page in their place; pages open as tabs (one strip, at most 5, the oldest goes if it lets itself); ‹ goes back
// to the sections with the tabs kept; a page can refuse to close (an unsaved file); a page with a width keeps its own
// (480 up to the window less the conversation's 560), apart from the sections'; Esc: full size → sections → close.
// Shell is the page "shell", unchanged to see. API: page(name, spec), show(name, key), sections(), closeTab(name,
// key), pages(), pageShown.
//   node tests/stage-pages.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const stage = readFileSync(new URL("../js/stage.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/panel.css", import.meta.url), "utf8");

assert.match(stage, /page, show, sections, closeTab, requestClose,\n\s*pages: \(\) => S\.tabs\.map/);
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
assert.match(stage, /const clampP = \(w\) => Math\.round\(Math\.max\(PAGE_MIN, Math\.min\(innerWidth - READ, w\)\)\);/);
assert.match(stage, /localStorage\.setItem\(`\$\{W_KEY\}:\$\{S\.page\.name\}`, String\(v\)\)/);
// the bar: tabs from two pages on, ‹ first
assert.match(stage, /role="tab" aria-selected="\$\{on\}" data-stg-tab="\$\{esc\(t\.name\)\}" data-stg-key="\$\{esc\(t\.key\)\}"/);
// CSS: one host for every page, a box each; tokens only
assert.match(css, /\.stage\[data-page\] \.stg-frames\{display:none\}\n\.stage\[data-page\] \.stg-page\{display:flex;flex:1;min-height:0;flex-direction:column\}/);
const block = css.slice(css.indexOf("── Pages open in the panel"), css.indexOf("── The Thread page"));
assert.ok(block.length > 300);
assert.doesNotMatch(block.replace(/\/\*[\s\S]*?\*\//g, ""), /\b\d+(\.\d+)?(px|rem|ms)\b|#[0-9a-f]{3,8}\b/i);
console.log("stage-pages: ok");
