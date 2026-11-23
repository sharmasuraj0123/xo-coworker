// A project's icon, yours to choose (the owner, 19 Nov 14:44Z: "per project icons are fine"): its header tile opens a
// picker of the owner's project topics and the cube, "Automatic" (its own guess) first; the choice is kept in your
// shape (layout.icons, core/services/shape), so every device shows it; a choice it doesn't know falls back to the guess.
//   node tests/project-icons.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TOPICS, glyph } from "../modules/projects/projicons.js";
import { createProjectIconChoice } from "../modules/projects/icon-choice.js";
import { hasIcon } from "../core/ui/icons/icon.js";
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const side = readFileSync(new URL("../shell/sidebar.css", import.meta.url), "utf8");

assert.equal(TOPICS.length, 31);
for (const k of TOPICS) assert.ok(hasIcon(`project-${k}`), k);
assert.match(glyph("project"), /data-xi="project"/);

const icons = {};
const world = { state: { threads: [] }, project: () => null };
const SHAPE = { get: (key) => key === "layout" ? { icons } : undefined };
const { ownIcon, projectIcon, forgetIcon } = createProjectIconChoice({ world, SHAPE });
assert.equal(ownIcon("a"), null);
assert.equal(projectIcon("a"), glyph("project"));
world.state.threads.push({ project: "a", title: "research" });
assert.equal(projectIcon("a"), glyph("research"), "a new thread can change the automatic icon");
icons.a = "project";
assert.equal(ownIcon("a"), "project");
assert.equal(projectIcon("a"), glyph("project"), "the selected cube overrides the cached guess");
icons.a = "mobile";
assert.equal(ownIcon("a"), "mobile");
assert.equal(projectIcon("a"), glyph("mobile"), "a new choice overrides the cached choice");
icons.a = "nonsense";
assert.equal(ownIcon("a"), null, "an unknown choice falls back to the guess");
assert.equal(projectIcon("a"), glyph("research"));
world.state.threads[0].title = "finance";
assert.equal(projectIcon("a"), glyph("research"), "the automatic icon is cached while the thread count holds");
forgetIcon("a");
assert.equal(projectIcon("a"), glyph("finance"), "forgetting a choice clears the cached icon");
// kept in your shape; Automatic removes it
assert.match(app, /SHAPE\.patchMine\(\{ layout: \{ icons: \{ \[pid\]: k \|\| null \} \} \}\);/);
// the header tile opens it, a dialog of radios with one Tab stop; arrows walk the grid, Esc closes back to the tile
assert.match(app, /class="pj-pick" data-pj-icon="\$\{esc\(pid\)\}" aria-haspopup="dialog"/);
assert.match(app, /role="radio" aria-checked="\$\{on\}" data-pk="\$\{k\}"/);
assert.match(app, /\{ ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols, Home: -i, End: os\.length - 1 - i \}/);
assert.match(app, /if \(e\.key === "Escape"\) \{ e\.preventDefault\(\); e\.stopPropagation\(\); closePick\(\{ focus: true \}\); return; \}/);

// CSS: tokens only
const block = side.slice(side.search(/^\.pj-pick\{/m));
assert.ok(block.length > 300);
assert.doesNotMatch(block.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\b1px solid\b/g, ""), /\b\d+(\.\d+)?(px|rem|ms)\b|#[0-9a-f]{3,8}\b/i);
console.log("project-icons: ok");
