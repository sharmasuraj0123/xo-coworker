// The sidebar's fold, its top row, More and the icon-only foot (the owner, 19 Nov): the markup is there, the key
// is its own, and the new CSS writes no literal sizes (tokens only, the owner's rule).
//   node tests/side-fold.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const side = readFileSync(new URL("../css/side.css", import.meta.url), "utf8");
const tokens = readFileSync(new URL("../core/ui/tokens.css", import.meta.url), "utf8");
const { ACTIONS, binding } = await import("../core/platform/keys.js");
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");

// the top row: fold, brand, search; the foot: Shells, theme and Settings as icons
for (const id of ["side-fold", "side-jump", "nv-more", "side-more"]) assert.match(html, new RegExp(`id="${id}"`), `#${id} in index.html`);
assert.match(html, /class="gear is-ic" id="theme" role="switch"/, "the theme is a foot icon button, still a switch");
assert.match(html, /class="gear is-ic" id="set-side"[^>]*aria-label="Settings"/, "Settings keeps its name for screen readers");
assert.doesNotMatch(html, /<span class="gear-t">Settings<\/span>/, "Settings shows no word");

// its own key, not the file tree's ⌘B
assert.ok(ACTIONS.some((a) => a.id === "sideFold"), "keys.js has sideFold");
assert.equal(ACTIONS.find((a) => a.id === "sideFold")?.def, "mod+shift+b");
assert.equal(binding("sideFold"), "mod+shift+b");
assert.deepEqual(ACTIONS.filter((a) => a.id !== "sideFold" && a.def === "mod+shift+b").map((a) => a.id), [], "no other action has ⌘⇧B");
assert.match(app, /sideFold: \(\) => SIDE\.fold\(!SIDE\.folded\)/, "the key folds the sidebar");

// the rail's width is a token: one row and the rows' inset on each side
assert.match(tokens, /--side-rail-w:calc\(var\(--h-row\) \+ 2 \* var\(--s-3\)\)/);

// the new block: no literal px, rem, ms or hex (media queries' breakpoints aside)
const fold = side.indexOf(".app{transition:grid-template-columns");
assert.notEqual(fold, -1, "the desktop fold rules are present");
const block = side.slice(fold);
const body = block.replace(/\/\*[\s\S]*?\*\//g, "").replace(/@media \([^)]*\)/g, "");
// (a 1 px line is the system's one hairline, used as such everywhere)
assert.doesNotMatch(body.replace(/\b1px solid\b/g, ""), /\b\d+(\.\d+)?(px|rem|ms)\b/, "no literal sizes or durations");
assert.doesNotMatch(body, /#[0-9a-f]{3,8}\b/i, "no literal colours");

// folded: no border or ring round a working or waiting project; the open sidebar keeps them (no such rule outside)
assert.match(block, /\.side-folded \.prow\{border-color:transparent;box-shadow:none\}/);
assert.match(block, /\.side-folded \.prow \.pr-ic\{box-shadow:none;animation:none\}/);
assert.doesNotMatch(side.slice(0, fold), /side-folded/, "nothing else knows the fold");

// the sidebar editor's popover is concentric with its rows: 20 = 12 + 8; More is a menu
assert.match(block, /\.side-pop\{[^}]*padding:var\(--s-2\);border-radius:var\(--r-xl\)/);

console.log("side-fold: ok");
