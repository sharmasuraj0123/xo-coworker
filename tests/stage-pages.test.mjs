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

assert.match(stage, /page, show, sections, closeTab,\n\s*pages: \(\) => S\.tabs\.map/);
assert.match(stage, /const TAB_MAX = 5;/);
// show: a tab once, the oldest beyond 5 asked to close, the panel opened, one host, one switch
const show = stage.slice(stage.indexOf("  function show("), stage.indexOf("  function sections("));
assert.match(show, /while \(S\.tabs\.length > TAB_MAX\) \{ const old = S\.tabs\.find\(\(t\) => !sameTab\(t, S\.page\) && !sameTab\(t, next\)\); if \(!old \|\| !closeTab\(old\.name, old\.key, \{ quiet: true \}\)\) break; \}/);
assert.match(show, /if \(S\.page\) PAGES\.get\(S\.page\.name\)\.hide\?\.\(S\.page\.key\);/);
assert.match(show, /el\.dataset\.page = name;/);
assert.match(show, /sp\.mount\(el\.querySelector\("\.stg-page"\), next\.key\);/);
// closing asks the page; refusing keeps it; the one showing hands over to the last tab, else the sections
const ct = stage.slice(stage.indexOf("  function closeTab("), stage.indexOf("  function pageChanged("));
assert.match(ct, /if \(sp\.close && sp\.close\(t\.key\) === false\) return false;/);
assert.match(ct, /const prev = S\.tabs\[S\.tabs\.length - 1\]; if \(prev\) show\(prev\.name, prev\.key\); else pageChanged\(\);/);
// widths: a page's own, kept per kind, 480 up to the window less READ
assert.match(stage, /const PAGE_MIN = 480;/);
assert.match(stage, /const clampP = \(w\) => Math\.round\(Math\.max\(PAGE_MIN, Math\.min\(innerWidth - READ, w\)\)\);/);
assert.match(stage, /localStorage\.setItem\(`\$\{W_KEY\}:\$\{S\.page\.name\}`, String\(v\)\)/);
assert.match(stage, /const widthNow = \(\) => \(pageSpecW\(\) \? pageW\(\) :/);
// Esc: full size, then the sections, then closed (the shell, as before, closes)
assert.match(stage, /if \(S\.full\) setFull\(false\); else if \(S\.page && S\.page\.name !== "shell"\) sections\(\); else close\(\);/);
// the bar: tabs from two pages on, ‹ first; one page alone keeps "place › page" as Shell did
assert.match(stage, /if \(S\.tabs\.length > 1\) return `<button type="button" class="stg-ic pg-back" data-stg-sections/);
assert.match(stage, /role="tab" aria-selected="\$\{on\}" data-stg-tab="\$\{esc\(t\.name\)\}" data-stg-key="\$\{esc\(t\.key\)\}"/);
// CSS: one host for every page; tokens only
assert.match(css, /\.stage\[data-page\] \.stg-frames\{display:none\}\n\.stage\[data-page\] \.stg-page\{display:flex;flex:1;min-height:0;flex-direction:column\}/);
const block = css.slice(css.indexOf("── Pages open in the panel"));
assert.ok(block.length > 300);
assert.doesNotMatch(block.replace(/\/\*[\s\S]*?\*\//g, ""), /\b\d+(\.\d+)?(px|rem|ms)\b|#[0-9a-f]{3,8}\b/i);
console.log("stage-pages: ok");
