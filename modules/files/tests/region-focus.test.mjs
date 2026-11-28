// @ts-check
import assert from "node:assert/strict";
import { settle } from "../../../tests/lib/dom.mjs";
import { projectFile, viewerFixture } from "./viewer-fixture.mjs";

const path = "notes.txt";
const change = { path, base: "base", scope: { key: "demo|", project: "demo", worktree: null }, file: { path, status: "modified" } };
let draws = 0;
const { viewer, document, host, click } = await viewerFixture({
  changes: { at: () => change, patchAt: async () => "patch" },
}, {
  diff: async (region) => {
    if (++draws <= 2) throw new Error("Drawing failed");
    region.append(document.createElement("article"));
    return { update() {}, split() {}, destroy() {} };
  },
});
viewer.open({ ...projectFile(path), show: "changes" });
await settle();
const retry = () => host.querySelector("[data-vw-diff-redraw]");
const first = retry();
first.focus();
click("[data-vw-diff-redraw]");
await settle();
assert.equal(draws, 2);
assert.ok(retry() && retry() !== first, "the failed drawing replaces the retry notice");
assert.ok(document.activeElement === retry(), "focus returns to the replacement retry");
click("[data-vw-diff-redraw]");
await settle();
assert.equal(draws, 3);
assert.ok(!retry(), "a successful drawing removes the retry");
assert.ok(host.querySelector(".vw-diff article"));
assert.ok(document.activeElement === host.querySelector(".vw-diff"), "focus stays in the region after the retry disappears");
