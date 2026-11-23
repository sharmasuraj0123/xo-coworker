// The bar, yours to edit (the owner, 19 Nov 14:29Z: "in the More section, i want the ability to customize the bar:
// what to keep, what not to keep"). Every place in one order you set; the ones you keep are the sidebar's rows, the
// rest wait in More; drag or ↑ ↓ on a grip to reorder; Reset to default; kept in your shape (layout.side), so it
// follows you to every device; what this browser kept before (its own key, More's pins) moves there once.
//   node tests/side-bar.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../shell/rail/side.js", import.meta.url), "utf8");
const side = readFileSync(new URL("../shell/sidebar.css", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

// the model, run as written: SIDE's bar part with a stand-in for the device's storage
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const part = app.slice(app.indexOf('  BAR: "xo-side-bar",'), app.indexOf("  extras: new Map(),"));
assert.ok(part.length > 1000, "the bar's model is there");
let mine = {};
const SHAPE = { get: (k) => mine[k], patchMine: (p) => { for (const [k, v] of Object.entries(p.layout || {})) { mine.layout = { ...(mine.layout || {}) }; if (v === null) delete mine.layout[k]; else mine.layout[k] = v; } return { ok: true }; } };
const SIDE = new Function("SHAPE", `const ICON = {}; const SIDE = { PINS: "xo-side-pins", ${part} apply() {} }; return SIDE;`)(SHAPE);

const ids = ["home", "ws", "chats", "arts", "launchpad", "runtimes", "accounts", "routing", "rules", "worktrees", "keys"];
assert.deepEqual(SIDE.bar(), { order: ids, shown: ["home", "ws", "chats", "arts"] }, "the default: the four places; Launchpad and Settings' pages in More");
assert.ok(SIDE.isDefault());

// More's pins from before carry over
store.set("xo-side-pins", JSON.stringify(["rules", "gone"]));
assert.deepEqual(SIDE.bar().shown, ["home", "ws", "chats", "arts", "rules"]);
store.clear();

// keep and leave: a place in the bar or in More
SIDE.pin("chats", false); SIDE.pin("worktrees", true);
assert.deepEqual(SIDE.bar().shown, ["home", "ws", "arts", "worktrees"]);
assert.ok(!SIDE.isDefault());

// reorder: one step (the grip's ↑ ↓), at the ends it stays; before another (a drop), or to the end
SIDE.move("arts", -1); assert.deepEqual(SIDE.bar().order.slice(0, 4), ["home", "ws", "arts", "chats"]);
SIDE.move("home", -1); assert.equal(SIDE.bar().order[0], "home");
SIDE.move("keys", 1); assert.equal(SIDE.bar().order.at(-1), "keys");
SIDE.move("worktrees", 0, "home"); assert.equal(SIDE.bar().order[0], "worktrees");
SIDE.move("home", 0, ""); assert.equal(SIDE.bar().order.at(-1), "home");

// kept in your shape, not this browser
assert.deepEqual(mine.layout.side.shown, ["home", "ws", "arts", "worktrees"]);
assert.ok(!store.has("xo-side-bar"));

// what's saved is made whole: an unknown place is dropped, a new one joins at the end, hidden
mine.layout.side = { order: ["arts", "nope", "home"], shown: ["arts", "nope"] };
const b = SIDE.bar();
assert.deepEqual(b.order.slice(0, 2), ["arts", "home"]);
assert.equal(b.order.length, ids.length);
assert.deepEqual(b.shown, ["arts"]);

// Reset to default
SIDE.reset(); assert.ok(SIDE.isDefault()); assert.equal(mine.layout.side, undefined);

// this browser's old copy moves into your shape once (not when your shape already has one)
store.set("xo-side-bar", JSON.stringify({ order: ids, shown: ["home", "rules"] }));
SIDE.adopt();
assert.deepEqual(mine.layout.side.shown, ["home", "rules"]);
assert.ok(!store.has("xo-side-bar"));
assert.match(app, /SHAPE\.synced\.then\(\(\) => \{ SIDE\.adopt\(\); SIDE\.apply\(\); \}\);/);
assert.match(app, /SHAPE\.onChange\(\(\) => SIDE\.apply\(\)\);/, "another device's change follows");

// the page: More ends with Edit the sidebar…; editing, grips, switches, Reset and Done
assert.match(app, /data-side-edit><span class="nr-ic">\$\{ICON\.edit\}<\/span><span class="nr-name">Edit the sidebar…<\/span>/);
assert.match(app, /class="se-grip" data-se-grip="\$\{id\}" aria-label="Move \$\{esc\(p\.name\)\}: up or down arrow"/);
assert.match(app, /class="switch se-sw" role="switch" data-se-sw="\$\{id\}" aria-checked="\$\{on\}" aria-label="Keep \$\{esc\(p\.name\)\} in the sidebar"/);
assert.match(app, /data-se-reset\$\{SIDE\.isDefault\(b\) \? " disabled" : ""\}>Reset to default/);
assert.match(app, /xi\("drag-handle"\)/, "the grip is the owner's drag handle");
assert.match(app, /pop\.setAttribute\("role", "dialog"\); pop\.setAttribute\("aria-label", "Edit the sidebar"\)/);
assert.match(app, /e\.key === "ArrowUp" \? -1 : 1/);
assert.match(app, /addEventListener\("drop"/);
assert.doesNotMatch(html, /id="nv-pins"/, "kept places sit in the bar itself, in your order");

// CSS: tokens only (the 1 px hairline is the system's)
const block = side.slice(side.search(/^\.sm-sep\{/m));
assert.ok(block.length > 300);
assert.doesNotMatch(block.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\b1px solid\b/g, ""), /\b\d+(\.\d+)?(px|rem|ms)\b|#[0-9a-f]{3,8}\b/i);
console.log("side-bar: ok");
