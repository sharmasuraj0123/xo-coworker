import assert from "node:assert/strict";
import { dom } from "../../../tests/lib/dom.mjs";
import { createScope } from "../../../core/kernel/scope.js";
import { createFileSearch } from "../file-search.js";

const { window, document } = await dom("");
const scope = createScope();
const requests = new Map();
globalThis.fetch = (input, options) => new Promise((resolve) => {
  requests.set(new URL(input, "http://localhost/").pathname.split("/").pop(), { resolve, signal: options.signal });
});
const notices = [];
let changes = 0;
const { quickOpen } = createFileSearch(scope, {
  viewer: { openFiles: [], open() {} }, tree: { pathsChanged() { changes++; } },
}, { place: () => ({ project: "demo" }), announce: (text) => notices.push(text), syncInert() {} });

quickOpen.open("files");
quickOpen.close();
quickOpen.open("text");
const input = document.querySelector("#qo-q");
input.value = "held";
input.dispatchEvent(new window.Event("input"));
input.dispatchEvent(Object.assign(new window.Event("keydown"), { key: "Enter" }));
const before = quickOpen.el.textContent;
scope.dispose();
assert.ok(!quickOpen.el.isConnected, "disposal removes the sheet");
for (const name of ["paths", "search"]) assert.equal(requests.get(name)?.signal?.aborted, true, name);
requests.get("paths").resolve(Response.json({ root: "", paths: ["late.md"], dirs: [], stamp: "1", truncated: false }));
requests.get("search").resolve(Response.json({ root: "", files: 0, matches: [], truncated: false, took_ms: 1 }));
await new Promise(setImmediate);
assert.equal(changes, 0);
assert.deepEqual(notices, []);
assert.equal(quickOpen.el.textContent, before, "late reads cannot paint the retired sheet");
