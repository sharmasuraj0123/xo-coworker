// @ts-check
import assert from "node:assert/strict";
import { api } from "../../../core/platform/api.js";
import { settle } from "../../../tests/lib/dom.mjs";
import { createDocs } from "../documents.js";
import { projectFile, viewerFixture } from "./viewer-fixture.mjs";

const { viewer, host, click } = await viewerFixture();
async function editorIn() {
  const current = () => host.querySelector(".cm-editor .cm-content")?.closest(".cm-editor");
  if (current()) return current();
  return new Promise((resolve, reject) => {
    const observer = new MutationObserver(() => {
      const editor = current();
      if (!editor) return;
      observer.disconnect();
      clearTimeout(timeout);
      resolve(editor);
    });
    const timeout = setTimeout(() => {
      observer.disconnect();
      reject(new Error("Source did not open an editor"));
    }, 1000);
    observer.observe(host, { childList: true, subtree: true });
  });
}
const reads = [];
api.projectFile = async (_, path) => {
  reads.push(path);
  return { kind: "html", content: `<p>${path}</p>`, version: "1", editable: true };
};
const first = { ...projectFile("first.html"), pin: true };
viewer.open(first);
await settle();
assert.equal(host.querySelector("iframe").getAttribute("srcdoc"), "<p>first.html</p>");
viewer.refresh();
assert.deepEqual(reads, ["first.html"], "refresh uses the open document");
viewer.open(projectFile("second.html"));
await settle();
assert.equal(host.querySelector("iframe").getAttribute("srcdoc"), "<p>second.html</p>");
viewer.open(first);
await settle();
assert.equal(host.querySelector("iframe").getAttribute("srcdoc"), "<p>first.html</p>");
assert.deepEqual(reads, ["first.html", "second.html"], "returning to a pinned document uses its own cached text");
click('[data-vw-mode="source"]');
const editor = await editorIn();
assert.match(editor.querySelector(".cm-content").textContent, /first\.html/);
viewer.refresh();
await settle();
assert.ok(host.querySelector(".cm-editor") === editor, "refresh keeps the editor for the same document");
viewer.open(projectFile("second.html"));
const secondEditor = await editorIn();
assert.ok(secondEditor !== editor);
assert.match(secondEditor.querySelector(".cm-content").textContent, /second\.html/);
viewer.close();

const writes = [];
const docs = createDocs({ api: { ...api, saveProjectFile: async (project, path, text, base) => {
  writes.push({ project, path, text, base });
  return { version: `version-${writes.length}`, saved_at: null };
} } });
const file = docs.open("demo", "notes.txt", { version: "initial", content: "Saved" });
let text = "Saved";
docs.attach(file, { source: () => text });
text = "First edit";
docs.edited(file);
await docs.flush(file);
text = "Second edit";
docs.edited(file);
await docs.flush(file);
assert.deepEqual(writes.map(({ text: body, base }) => [body, base]), [["First edit", "initial"], ["Second edit", "version-1"]]);
assert.equal(file.state, "saved");
assert.equal(docs.textOf(file), "Second edit");
docs.release(file);
