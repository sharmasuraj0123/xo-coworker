// A filter for long thread lists (the owner, 19 Nov 14:44Z: "the filter for long thread list can be made"): in the
// panel's Threads once a place has more than 12, and in All threads. It matches the title, the summary and the
// branch, every word; / focuses it (in the panel, and in All threads), Esc clears it first; nothing found says so.
//   node tests/thread-filter.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { panelSrc } from "./lib/panel-src.mjs";
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const stage = panelSrc, app = read("js/app.js"), panel = read("css/panel.css"), found = read("css/foundation.css");

// the match, run as written
const m = /const matchesQ = (\(r, q\) => \{[^\n]*\});/.exec(stage);
assert.ok(m, "one match rule");
const matchesQ = eval(m[1]);
const row = { title: "Design proposal: threads", sub: "running a command", summary: "the panel and the rail", branch: "xo/thread-305201" };
assert.ok(matchesQ(row, "design"));
assert.ok(matchesQ(row, "rail panel"), "every word, any order");
assert.ok(matchesQ(row, "305201"), "the branch");
assert.ok(!matchesQ(row, "design files"));

// the panel: the field over the list (built once, kept), shown past 12 or while it filters; groups show all they match
assert.match(stage, /const FILTER_AT = 12;/);
assert.match(stage, /qBox\.hidden = !\(tg && \(total > FILTER_AT \|\| tq \|\| S\.tqOpen\)\);/, "past 12, while it filters, or when asked");
// the search button and / open it here and focus it (the owner, 19 Nov 15:04Z: "can't it search within?")
assert.match(stage, /if \(t\.closest\("\[data-tg-find\]"\)\) \{ findThreads\(\); return; \}/);
assert.match(stage, /S\.tqOpen = true; paint\(\);\s*const q = el\.querySelector\("\[data-tg-q\]"\); q\.focus\(\{ preventScroll: true \}\); q\.select\(\);/);
assert.match(stage, /if \(e\.key === "Escape" && S\.tqOpen\)/, "empty, Esc puts it away again");
assert.match(stage, /set\("agents", body\("agents"\)\.querySelector\("\.tg-box"\), tg \? threadsHtml\(tg, tq, \{ folds: fr\.agents\.groups, more: S\.tgMore \}\) : agentsHtml\(ag, v\)\);/);
assert.match(stage, /No thread matches “\$\{esc\(q\)\}”\. <button type="button" class="tg-clear" data-tg-clear>Clear the filter<\/button>/);
assert.match(stage, /const g = q \? \{\} : folds \|\| \{\}, more = q \? \{ needs: 1, working: 1, waiting: 1, done: 1 \} : shownMore \|\| \{\};/);
// keys: / in the panel, Esc clears first, ↓ and Enter go to the first match
assert.match(stage, /if \(e\.key === "\/" && !e\.metaKey && !e\.ctrlKey && !e\.altKey && !e\.target\.closest\?\.\("input, textarea, \[contenteditable\]"\)\)/);
assert.match(stage, /if \(!S\.page && !fr\.agents\.folded && el\.querySelector\('\[data-fr="agents"\]:not\(\[hidden\]\)'\)\) \{ e\.preventDefault\(\); e\.stopPropagation\(\); findThreads\(\); return; \}/);
assert.match(stage, /if \(e\.key === "Escape" && inp\.value\) \{ e\.preventDefault\(\); e\.stopPropagation\(\); inp\.value = ""; S\.tq = ""; paint\(\); return; \}/);
assert.match(stage, /aria-keyshortcuts="\/"/);
// the rows carry what it matches
assert.match(app, /mark: threadMark\(t\), summary: t\.summary \|\| "", branch: t\.branch \|\| "",/);

// All threads: the same match, the same keys
assert.match(app, /const s = `\$\{t\.title\} \$\{t\.summary \|\| ""\} \$\{t\.branch \|\| ""\}`\.toLowerCase\(\); return q\.split\(\/\\s\+\/\)\.every\(\(w\) => s\.includes\(w\)\);/);
assert.match(app, /if \(e\.key === "Escape" && inSearch && \$\("#all-q"\)\.value\)/);
assert.match(app, /if \(e\.key === "\/" && !inSearch/);

// CSS: tokens only; the field's box takes the one focus ring
const block = panel.slice(panel.indexOf("── Threads' filter"), ((panel.indexOf("/* ──", panel.indexOf("── Threads' filter") + 4) + 1) || panel.length + 1) - 1);
assert.ok(block.length > 300);
assert.doesNotMatch(block.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\b1px solid\b/g, ""), /\b\d+(\.\d+)?(px|rem|ms)\b|#[0-9a-f]{3,8}\b/i);
assert.match(found, /\.tg-qf\):has\(:is\(input,textarea\):focus-visible\)/);
console.log("thread-filter: ok");
// the list snaps row by row under a sticky filter: its top is a resting place and rows rest below the filter, so
// scrolling up to "Needs you" stays there (19 Nov 18:57Z: it snapped back 40 px, its head under the filter)
{ const p3 = readFileSync(new URL("../css/panel.css", import.meta.url), "utf8");
  assert.match(p3, /\.stage \.fr\[data-fr="agents"\] \.fr-b\{[^}]*scroll-snap-type:y mandatory/);
  assert.match(p3, /\.stage \.tg-q\{scroll-snap-align:start\}/);
  assert.match(p3, /\.stage \.fr\[data-fr="agents"\] \.fr-b:has\(>\.tg-q:not\(\[hidden\]\)\)\{scroll-padding-top:calc\(var\(--h-ctl\) \+ var\(--s-2\)\)\}/);
  console.log("thread-filter snap: ok"); }
