import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { api } from "../../../core/platform/api.js";
import { deferred, settle } from "../../../tests/lib/dom.mjs";
import { EditorView } from "../../../vendor/codemirror/cm.js";
import { projectFile, viewerFixture } from "./viewer-fixture.mjs";

async function until(condition, message) {
  for (let attempt = 0; attempt < 20; attempt++) {
    if (condition()) return;
    await settle();
  }
  assert.fail(message);
}

test("the Files editor opens only the conflict that survives the merge import", { timeout: 3000 }, async (context) => {
  const evaluating = deferred();
  const release = deferred();
  const mergeURL = new URL("../../../vendor/codemirror/merge.js", import.meta.url).href;
  globalThis.beginMergeModule = () => { evaluating.resolve(); return release.promise; };
  const hooks = registerHooks({
    load(url, options, next) {
      const module = next(url, options);
      if (url !== mergeURL) return module;
      return { ...module, source: `await globalThis.beginMergeModule();\n${module.source}` };
    },
  });
  const { viewer, host, click } = await viewerFixture();
  context.after(() => { release.resolve(); hooks.deregister(); delete globalThis.beginMergeModule; viewer.close(); });

  const file = projectFile("note.txt");
  let current = { kind: "text", content: "original", version: "initial", editable: true };
  context.mock.method(api, "projectFile", async () => current);
  viewer.open(file);
  const editor = () => host.querySelector(".cm-editor");
  await until(editor, "Files did not mount the editor");
  const view = EditorView.findFromDOM(editor());
  assert.ok(view);

  function conflict(mine, theirs, version) {
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: mine } });
    current = { ...current, content: theirs, version };
    viewer.fileChanged({ type: "file.version", project_id: file.project, path: file.rel, version });
  }
  conflict("my first edit", "old incoming text", "old");
  await evaluating.promise;
  assert.equal(viewer.editing, true);
  const confirmation = viewer.confirmClose();
  click('[data-vw-unsaved="discard"]');
  assert.equal(await confirmation, true);
  assert.equal(viewer.editing, false);
  assert.ok(EditorView.findFromDOM(editor()) === view, "discard keeps the mounted editor");
  release.resolve();
  await import(mergeURL);
  await settle();
  assert.equal(host.querySelector(".cm-xo-chunk") !== null, false, "discarded conflict cannot appear after import");

  conflict("my active edit", "active incoming text", "active");
  await until(() => host.querySelector(".cm-xo-chunk"), "the active conflict did not open");
  assert.equal(viewer.editing, true);
  assert.ok(host.textContent.includes("active incoming text"));
  assert.equal(host.textContent.includes("old incoming text"), false);
});
