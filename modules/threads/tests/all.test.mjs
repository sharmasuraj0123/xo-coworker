// @ts-check
import assert from "node:assert/strict";
import { dom } from "../../../tests/lib/dom.mjs";
import { createAllThreads } from "../all.js";
import { createThreadGroups } from "../groups.js";

const { document } = await dom('<h2 id="all-h"></h2><input id="all-q"><div id="all-f"></div><div id="all-list"></div>');
/** @type {import("../all-types.d.ts").AllThreadsDeps["S"]} */
const S = { view: "p:project", allFilter: "all", allDone: false };
const common = { project: "project", checklist: { done: 0, total: 0 }, lastAt: Date.now() };
const world = { state: { threads: [
  { ...common, id: "live", title: "Review", summary: "publish notes", branch: "verify", state: "working", busy: true },
  { ...common, id: "done", title: "Former notes", state: "resolved" },
] } };
const D = { needItems: () => [] }, convProject = () => "project", isHeld = () => false;
const { STATE_WORDS, threadState } = createThreadGroups({ world, D, convProject, isHeld, isBusy: (thread) => !!thread.busy,
  MAP: { agents: () => [] }, askShort: () => "", threadMark: () => "",
});
const render = createAllThreads({ S, world, D, SHAPE: { word: () => "threads" }, PROJ: () => "Project", convProject,
  STATE_WORDS, threadState, threadMark: () => '<i class="test-mark"></i>', glyphOf: (thread) => thread.state, rtTag: () => "",
});
const input = document.getElementById("all-q");
render();
const row = document.querySelector('[data-go="t:live"]');
assert.equal(document.getElementById("all-h").textContent, "All threads · Project");
assert.equal(document.querySelector(".ar-fold").getAttribute("aria-expanded"), "false");
assert.equal(row.classList.contains("has-mk"), true);
assert.ok(row.querySelector(".ar-a > .ar-mk .test-mark"));
assert.ok(row.querySelector(".ar-tl .test-mark") === null, "the mark stays outside the title");
input.value = "publish verify";
render();
assert.ok(document.querySelector('[data-go="t:live"]') === row);
assert.ok(document.querySelector('[data-go="t:done"]') === null, "the completed thread stays folded");
S.allFilter = "waiting";
render();
assert.match(document.querySelector(".ar-none").textContent, /Nothing matches/);
assert.equal(document.querySelector('[data-af="waiting"]').getAttribute("aria-checked"), "true");
