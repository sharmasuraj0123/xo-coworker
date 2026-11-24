// @ts-check
import assert from "node:assert/strict";
import { api } from "../../../core/platform/api.js";
import { settle } from "../../../tests/lib/dom.mjs";
import { declarationsFor, valuesFor } from "../../../tests/lib/css-snapshot.mjs";
import { projectFile, unavailable, viewerFixture } from "./viewer-fixture.mjs";

const draft = "<p>Draft contents</p>";
const saved = "<p>Saved contents</p>";
const storage = new Map([["xo-draft:demo|note.html", JSON.stringify({ text: draft, base: saved, version: "1" })]]);
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};
const { viewer, window, document, host, clipboard, announcements, selected, click } = await viewerFixture();
const attempted = [];
const fallback = [];
window.HTMLTextAreaElement.prototype.select = function () { fallback.push(this.value); };
clipboard.writeText = async (text) => { attempted.push(text); throw new Error("Clipboard refused"); };
viewer.open(unavailable(".xo/worktrees/example/docs/note.txt"));
click(".vw-path [data-vw-copy-path]");
await settle();
const path = "docs/note.txt";
assert.deepEqual(attempted, [path]);
assert.equal(announcements.at(-1), "Couldn't copy the path.");
const alert = host.querySelector('[role="alert"]');
assert.match(alert.textContent, /Here it is to copy/);
const field = alert.querySelector('input[aria-label="The path, to copy"]');
assert.equal(field.value, path);
assert.equal(field.hasAttribute("readonly"), true);
field.focus();
assert.deepEqual(selected, [path], "focusing selects the entire path");
const press = Object.assign(new window.Event("mousedown", { bubbles: true, cancelable: true }), { button: 0 });
field.dispatchEvent(press);
assert.equal(press.defaultPrevented, true);
assert.deepEqual(selected, [path, path], "pressing again selects the path instead of placing a caret");
viewer.refresh();
assert.equal(document.activeElement === host.querySelector('[aria-label="The path, to copy"]'), true);

api.projectFile = async () => ({ kind: "html", content: saved, version: "1" });
viewer.open(projectFile("note.html"));
await settle();
click("[data-vw-more]");
click("[data-vw-copy]");
await settle();
assert.deepEqual(attempted, [path, draft]);
assert.deepEqual(fallback, attempted, "both refusal paths attempt the legacy clipboard");
assert.equal(announcements.at(-1), "Couldn't copy.");
assert.match(host.querySelector('[role="alert"]').textContent, /Select the text and copy it, or download the file/);
assert.ok(!host.querySelector("[data-vw-cut-sel]"));

const rule = (selector, property) => declarationsFor(selector, property).map((entry) => entry.value);
assert.ok(rule(".vw-cut:has(.vw-cut-sel)", "flex-wrap").includes("wrap"));
assert.ok(rule((selector) => selector.replace(/\s/g, "") === ".vw-cut:has(.vw-cut-sel)>span", "flex").includes("1 1 0"));
assert.deepEqual(valuesFor(".vw-cut-sel", "flex"), ["1 0 calc(100% - 22px)"], "The path field fills its indented row");
assert.ok(rule(".vw-cut-sel", "font").some((value) => value.includes("var(--mono)")));
assert.deepEqual(valuesFor(".vw-cut:has(.vw-cut-sel)>span", "min-width"), ["0"]);
assert.deepEqual(valuesFor(".vw-cut-sel", "margin-left"), ["22px"]);
assert.ok(!valuesFor(".vw-cut-sel", "min-width").includes("0"));
