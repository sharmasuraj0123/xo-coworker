// The sidebar reflects the saved order and responds to its customization controls.
import assert from "node:assert/strict";
import { bootPage } from "./lib/page.mjs";
import { publishedRules } from "./lib/css-snapshot.mjs";
import { createScope } from "../core/kernel/scope.js";
import { deferred, same } from "./lib/dom.mjs";
import { createSide } from "../shell/rail/side.js";

const { document, window } = await bootPage();
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const mine = { layout: {} };
const synced = deferred();
let shapeChanged;
const shape = {
  synced: synced.promise,
  get: (key) => mine[key],
  onChange: (listener) => { shapeChanged = listener; return () => { shapeChanged = undefined; }; },
  patchMine({ layout: { side } }) {
    if (side === null) delete mine.layout.side;
    else mine.layout.side = side;
    return { ok: true };
  },
};
const scope = createScope();
let jumps = 0;
const deps = { shape, keys: { hint: () => "" }, announce() {}, render() {}, toggleJump() { jumps++; } };
const SIDE = createSide({ ...deps, scope });

const ids = ["home", "chats", "arts", "automations", "launchpad", "runtimes", "accounts", "routing", "rules", "worktrees", "keys"];
assert.deepEqual(SIDE.bar(), { order: ids, shown: ["home", "chats", "arts", "automations"] }, "the default: Home, Chats, Artifacts, Automations; Launchpad and Settings' pages in More");
assert.ok(SIDE.isDefault());

// More's pins from before carry over
store.set("xo-side-pins", JSON.stringify(["rules", "gone"]));
assert.deepEqual(SIDE.bar().shown, ["home", "chats", "arts", "automations", "rules"]);
store.set("xo-side-bar", "{broken");
assert.deepEqual(SIDE.bar().shown, ["home", "chats", "arts", "automations", "rules"], "invalid legacy JSON falls back to the old pins");
store.clear();

const browserStorage = globalThis.localStorage;
const log = console.error;
const storageErrors = [];
console.error = (error) => storageErrors.push(error);
try {
  const unavailable = new DOMException("Storage was blocked", "SecurityError");
  globalThis.localStorage = { ...browserStorage, getItem() { throw unavailable; }, setItem() { throw unavailable; } };
  SIDE.fold(true, { quiet: true });
  assert.equal(SIDE.folded, true, "blocked storage does not prevent a fold");
  assert.ok(SIDE.isDefault(), "blocked reads keep the default layout");
  assert.deepEqual(storageErrors, []);
  const fault = new Error("Unexpected storage write failure");
  globalThis.localStorage = { ...browserStorage, setItem() { throw fault; } };
  SIDE.fold(false, { quiet: true });
  assert.deepEqual(storageErrors, [fault], "unexpected storage failures reach the shared reporter");
} finally {
  console.error = log;
  globalThis.localStorage = browserStorage;
}

// keep and leave: a place in the bar or in More
SIDE.pin("launchpad", true); SIDE.pin("chats", false); SIDE.pin("worktrees", true);
assert.deepEqual(SIDE.bar().shown, ["home", "arts", "automations", "launchpad", "worktrees"], "Launchpad pinned back from More");
assert.ok(!SIDE.isDefault());

// reorder: one step (the grip's ↑ ↓), at the ends it stays; before another (a drop), or to the end
SIDE.move("arts", -1); assert.deepEqual(SIDE.bar().order.slice(0, 4), ["home", "arts", "chats", "automations"]);
SIDE.move("home", -1); assert.equal(SIDE.bar().order[0], "home");
SIDE.move("keys", 1); assert.equal(SIDE.bar().order.at(-1), "keys");
SIDE.move("worktrees", 0, "home"); assert.equal(SIDE.bar().order[0], "worktrees");
SIDE.move("home", 0, ""); assert.equal(SIDE.bar().order.at(-1), "home");

// kept in your shape, not this browser
assert.deepEqual(mine.layout.side.shown, ["home", "arts", "automations", "launchpad", "worktrees"]);
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
synced.resolve();
await synced.promise;
assert.deepEqual(mine.layout.side.shown, ["home", "rules"]);
assert.ok(!store.has("xo-side-bar"));
assert.equal(Boolean(document.querySelector('#side .nav > [data-set-open="rules"]')), true);
mine.layout.side = { order: ids, shown: ["launchpad"] };
shapeChanged();
assert.equal(document.querySelector("#nv-lp").hidden, false);
assert.equal(document.querySelector("#nv-home").hidden, true);

const more = document.querySelector("#nv-more");
const pop = document.querySelector("#side-more");
const click = (node) => node.dispatchEvent(new window.Event("click", { bubbles: true }));
more.getBoundingClientRect = () => ({ top: 36, right: 120 });
click(more);
const edit = [...pop.querySelectorAll('[role="menuitem"]')].at(-1);
assert.equal(edit.textContent, "Edit the sidebar…");
click(edit);
assert.equal(pop.getAttribute("role"), "dialog");
assert.equal(pop.getAttribute("aria-label"), "Edit the sidebar");
const grip = pop.querySelector('[data-se-grip="launchpad"]');
assert.equal(grip.getAttribute("aria-label"), "Move Launchpad: up or down arrow");
assert.equal(Boolean(grip.querySelector("svg")), true);
grip.dispatchEvent(Object.assign(new window.Event("keydown", { bubbles: true }), { key: "ArrowUp" }));
pop.querySelector('[data-se-grip="launchpad"]').dispatchEvent(Object.assign(new window.Event("keydown", { bubbles: true }), { key: "ArrowUp" }));
pop.querySelector('[data-se-grip="launchpad"]').dispatchEvent(Object.assign(new window.Event("keydown", { bubbles: true }), { key: "ArrowUp" }));
assert.deepEqual(SIDE.bar().order.slice(0, 4), ["home", "launchpad", "chats", "arts"]);
same(document.activeElement, pop.querySelector('[data-se-grip="launchpad"]'));
const target = pop.querySelector('[data-se="arts"]');
target.getBoundingClientRect = () => ({ top: 20 });
Object.defineProperty(target, "offsetHeight", { value: 40 });
target.dispatchEvent(Object.assign(new window.Event("drop", { bubbles: true, cancelable: true }), {
  clientY: 21, dataTransfer: { getData: (type) => type === "text/x-xo-place" ? "launchpad" : "" },
}));
assert.deepEqual(SIDE.bar().order.slice(0, 4), ["home", "chats", "launchpad", "arts"]);
const home = pop.querySelector('[data-se-sw="home"]');
assert.equal(home.getAttribute("role"), "switch");
assert.equal(home.getAttribute("aria-label"), "Keep Home in the sidebar");
assert.equal(home.getAttribute("aria-checked"), "false");
click(home);
assert.equal(pop.querySelector('[data-se-sw="home"]').getAttribute("aria-checked"), "true");
assert.equal(document.querySelector("#nv-home").hidden, false);
click(pop.querySelector("[data-se-reset]"));
assert.equal(pop.querySelector("[data-se-reset]").hasAttribute("disabled"), true);
click(pop.querySelector("[data-se-done]"));
assert.equal(pop.getAttribute("role"), "menu");
assert.deepEqual([...pop.querySelectorAll('[role="menuitem"]')].map((item) => item.textContent), ["Launchpad", "Runtimes", "Edit the sidebar…"], "by default More holds Launchpad; the Workspace lives in Chats");
assert.equal(document.querySelector("#nv-ws"), null);
assert.equal(document.querySelector("#nv-lp").hidden, true);
assert.equal(Boolean(document.querySelector("#nv-pins")), false);

pop.querySelector('[role="menuitem"]').focus();
scope.dispose();
assert.equal(scope.size, 0);
assert.equal(shapeChanged, undefined);
assert.equal(pop.hidden, true);
assert.equal(pop.childElementCount, 0);
same(document.activeElement, more);
click(more);
click(document.querySelector("#side-jump"));
assert.equal(pop.hidden, true);
assert.equal(jumps, 0);
const nextScope = createScope();
createSide({ ...deps, scope: nextScope });
click(more);
assert.equal(pop.hidden, false);
assert.equal(pop.querySelectorAll("[data-side-edit]").length, 1);
click(document.querySelector("#side-jump"));
assert.equal(jumps, 1);
nextScope.dispose();

const editorRules = publishedRules().filter(({ sel }) => /^\.(?:sm-sep\b|se-)/.test(sel));
assert.ok(editorRules.some(({ sel }) => sel === ".se-grip"));
assert.ok(editorRules.some(({ sel }) => sel === ".sm-sep"));
for (const { sel, declarations } of editorRules) {
  for (const { v } of declarations) assert.doesNotMatch(v.replace(/\b1px solid\b/g, ""), /\b\d+(\.\d+)?(px|rem|ms)\b|#[0-9a-f]{3,8}\b/i, sel);
}
console.log("side-bar: ok");
