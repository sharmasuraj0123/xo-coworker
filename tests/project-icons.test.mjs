import assert from "node:assert/strict";
import { sheet } from "./lib/cascade.mjs";
import { TOPICS, glyph } from "../modules/projects/projicons.js";
import { createProjectIconChoice } from "../modules/projects/icon-choice.js";
import { createProjectIconPicker } from "../modules/projects/icon-picker.js";
import { hasIcon } from "../core/ui/icons/icon.js";
import { dom } from "./lib/dom.mjs";
const side = sheet(new URL("../shell/sidebar.css", import.meta.url));

assert.equal(TOPICS.length, 31);
for (const k of TOPICS) assert.ok(hasIcon(`project-${k}`), k);
assert.match(glyph("project"), /data-xi="project"/);

const icons = {};
const projects = { a: { name: "A" }, b: { name: "Research" } };
const world = { state: { threads: [] }, project: (id) => projects[id] };
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
assert.equal(projectIcon("a"), glyph("finance"), "renaming a thread updates the automatic icon");
assert.equal(projectIcon("b"), glyph("research"));
projects.b.name = "Finance";
assert.equal(projectIcon("b"), glyph("finance"), "renaming a project updates the automatic icon");
forgetIcon("a");
assert.equal(projectIcon("a"), glyph("finance"), "forgetting a choice clears the cached icon");
const { document, window } = await dom('<button data-pj-icon="a"></button>');
const opener = document.querySelector("[data-pj-icon]");
const changes = [];
const picker = createProjectIconPicker({
  world, SHAPE: { patchMine: (change) => changes.push(change) }, PROJ: () => "Research",
  ownIcon, forgetIcon, announce() {}, render() {},
});
for (const selected of ["mobile", ""]) {
  picker.pickIcon("a", opener);
  const popover = document.querySelector('.pk-pop[role="dialog"]');
  assert.ok(popover);
  assert.equal(opener.getAttribute("aria-expanded"), "true");
  assert.equal(popover.querySelectorAll('[role="radio"][tabindex="0"]').length, 1);
  popover.querySelector(`[role="radio"][data-pk="${selected}"]`).dispatchEvent(new window.Event("click", { bubbles: true }));
  assert.equal(opener.getAttribute("aria-expanded"), "false");
  assert.ok(document.activeElement === opener, "choosing restores focus to the opener");
}
assert.deepEqual(changes, [{ layout: { icons: { a: "mobile" } } }, { layout: { icons: { a: null } } }]);
// the header tile opens it, a dialog of radios with one Tab stop; arrows walk the grid, Esc closes back to the tile
picker.pickIcon("a", opener);
const grid = document.querySelector(".pk-grid");
const options = [...grid.children];
Object.defineProperty(grid, "clientWidth", { value: 80 });
Object.defineProperty(options[0], "offsetWidth", { value: 20 });
for (const [key, position] of [["ArrowRight", 1], ["ArrowDown", 5], ["ArrowLeft", 4], ["ArrowUp", 0], ["End", options.length - 1], ["Home", 0]]) {
  const event = new window.Event("keydown", { bubbles: true, cancelable: true });
  event.key = key;
  document.activeElement.dispatchEvent(event);
  assert.equal(event.defaultPrevented, true);
  assert.ok(document.activeElement === options[position], key);
}
const escape = new window.Event("keydown", { bubbles: true, cancelable: true });
escape.key = "Escape";
document.activeElement.dispatchEvent(escape);
assert.equal(grid.isConnected, false);
assert.ok(document.activeElement === opener);

// CSS: tokens only
const block = side.slice(side.search(/^\.pj-pick\{/m));
assert.ok(block.length > 300);
assert.doesNotMatch(block.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\b1px solid\b/g, ""), /\b\d+(\.\d+)?(px|rem|ms)\b|#[0-9a-f]{3,8}\b/i);
console.log("project-icons: ok");
