// A project's icon, yours to choose (the owner, 19 Nov 14:44Z: "per project icons are fine"): its header tile opens a
// picker of the owner's project topics and the cube, "Automatic" (its own guess) first; the choice is kept in your
// shape (layout.icons, core/services/shape), so every device shows it; a choice it doesn't know falls back to the guess.
//   node tests/project-icons.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TOPICS, glyph } from "../modules/projects/projicons.js";
import { hasIcon } from "../core/ui/icons/icon.js";
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const side = readFileSync(new URL("../css/side.css", import.meta.url), "utf8");

assert.equal(TOPICS.length, 31);
for (const k of TOPICS) assert.ok(hasIcon(`project-${k}`), k);
assert.match(glyph("project"), /data-xi="project"/);

// the choice, checked as written: only a topic or the cube counts
const own = /const ownIcon = (\(pid\) => \{[^\n]*\});/.exec(app);
assert.ok(own);
const make = (icons) => new Function("SHAPE", "TOPICS", `return ${own[1]};`)({ get: (k) => (k === "layout" ? { icons } : undefined) }, TOPICS);
assert.equal(make({ a: "research" })("a"), "research");
assert.equal(make({ a: "project" })("a"), "project");
assert.equal(make({ a: "nonsense" })("a"), null, "an unknown choice: its own guess");
assert.equal(make({})("a"), null);

// it wins over the guess, and a change of it draws again (the memo knows it)
assert.match(app, /const icon = own \|\| classify\(/);
assert.match(app, /if \(memo && memo\.n === ts\.length && memo\.own === own\) return memo\.svg;/);
// kept in your shape; Automatic removes it
assert.match(app, /SHAPE\.patchMine\(\{ layout: \{ icons: \{ \[pid\]: k \|\| null \} \} \}\);/);
// the header tile opens it, a dialog of radios with one Tab stop; arrows walk the grid, Esc closes back to the tile
assert.match(app, /class="pj-pick" data-pj-icon="\$\{esc\(pid\)\}" aria-haspopup="dialog"/);
assert.match(app, /role="radio" aria-checked="\$\{on\}" data-pk="\$\{k\}"/);
assert.match(app, /\{ ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols, Home: -i, End: os\.length - 1 - i \}/);
assert.match(app, /if \(e\.key === "Escape"\) \{ e\.preventDefault\(\); e\.stopPropagation\(\); closePick\(\{ focus: true \}\); return; \}/);

// CSS: tokens only
const block = side.slice(side.indexOf("── A project's icon, yours to choose"));
assert.ok(block.length > 300);
assert.doesNotMatch(block.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\b1px solid\b/g, ""), /\b\d+(\.\d+)?(px|rem|ms)\b|#[0-9a-f]{3,8}\b/i);
console.log("project-icons: ok");
