// @ts-check

import assert from "node:assert/strict";
import { same } from "./lib/dom.mjs";
import { stageFixture } from "./lib/stage-fixture.mjs";

const review = { go: "t:review", title: "Review", state: "working", word: "Working" };
const inspect = { go: "t:inspect", title: "Inspect", state: "working", word: "Working" };
const rows = [review];
const { stage, document, panel, change } = await stageFixture({ threads: () => [{ k: "working", word: "Working", rows }] });
panel.open({ focus: false });

const filter = stage.querySelector("[data-tg-q]");
const row = stage.querySelector('[data-go="t:review"]');
assert.ok(row, "the open Stage draws its thread");
row.focus();
rows.push(inspect);
panel.sync();
same(stage.querySelector("[data-tg-q]"), filter, "the thread filter survives a count change");
same(stage.querySelector('[data-go="t:review"]'), row, "an existing thread's control survives redraw");
same(document.activeElement, row, "the focused thread survives an update");
assert.equal(stage.querySelector('[data-fr-n="agents"]')?.textContent, "2");

const originalFile = { path: "README.md", rel: "README.md", project: "one", mark: "edited" };
change([originalFile]);
const file = stage.querySelector('[data-change="README.md"]');
assert.ok(file, "the open Stage draws the fallback Changes list");
file.focus();
change([originalFile, { ...originalFile, path: "index.html", rel: "index.html" }]);
same(stage.querySelector('[data-change="README.md"]'), file, "an existing file's control survives redraw");
same(document.activeElement, file, "the focused change survives an update");
assert.equal(stage.querySelector('[data-fr-n="changes"]')?.textContent, "2");
