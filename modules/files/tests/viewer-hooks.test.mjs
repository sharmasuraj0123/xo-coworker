// @ts-check
import assert from "node:assert/strict";
import { api } from "../../../core/platform/api.js";
import { settle } from "../../../tests/lib/dom.mjs";
import { projectFile, viewerFixture } from "./viewer-fixture.mjs";

const path = "note.html";
const change = { path, base: "base", scope: { key: "demo|", project: "demo", worktree: null }, file: { path } };
const { viewer, host, document, click } = await viewerFixture({ changes: { at: () => change, patchAt: async () => "patch" } });
api.projectFile = async () => ({ kind: "html", content: "<p>Note</p>", version: "1" });
viewer.open(projectFile(path));
await settle();

function assertUniqueControls() {
  const seen = new Set();
  for (const control of host.querySelectorAll("button, a")) {
    const hook = [...control.attributes].find(({ name }) => name.startsWith("data-vw-"));
    if (!hook) continue;
    const key = JSON.stringify([hook.name, hook.value]);
    assert.equal(seen.has(key), false, `duplicate rendered control hook: ${key}`);
    seen.add(key);
  }
}
assertUniqueControls();
click(".vw-seg [data-vw-show=changes]");
await settle();
assertUniqueControls();
const retry = host.querySelector("[data-vw-diff-redraw]");
assert.ok(retry);
retry.focus();
viewer.refresh();
assert.ok(document.activeElement === host.querySelector("[data-vw-diff-redraw]"), "the retry keeps focus when the viewer refreshes");
const file = ".vw-seg [data-vw-show=file]";
host.querySelector(file).focus();
click(file);
assert.ok(document.activeElement === host.querySelector(file), "the selected File control keeps focus when its region is redrawn");
