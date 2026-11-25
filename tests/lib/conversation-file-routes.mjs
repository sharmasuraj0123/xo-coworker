import assert from "node:assert/strict";

export const projectChanges = {
  project_id: "demo", root: "/demo", worktree: null, base_ref: null, base_commit: null, head_commit: null,
  base_source: "head", computed_at: "2026-11-23T12:00:00Z", truncated: false, total_files: 1,
  files: [{ path: "notes.md", status: "modified", binary: false, version: null, patch: null, additions: 1, deletions: 0 }],
};

export async function checkConversationFileRoutes(kernel, press, flushFrames, key, createFile) {
  const owners = () => kernel.places.entries("conversation.file-route").map((entry) => entry.owner);
  press('#projects [data-go="p:demo"]');
  await new Promise(setImmediate);
  flushFrames();
  const chip = document.createElement("button");
  chip.className = "tb-cf";
  chip.dataset.file = "notes.md";
  chip.id = "route-test-chip";
  document.querySelector("#column").append(chip);
  assert.deepEqual(owners(), ["xo.changes", "xo.files"]);
  press("#route-test-chip");
  flushFrames();
  const selected = document.querySelector('#stage [data-cx="notes.md"][aria-selected="true"]');
  assert.ok(selected, "the Changes row wins over the generic shared-file route");
  await kernel.disable("xo.changes");
  assert.deepEqual(owners(), ["xo.files"]);
  press("#route-test-chip");
  flushFrames();
  assert.ok(document.querySelector("#viewer").textContent.includes("notes.md"), "Files handles the chip after Changes retires");
  await kernel.disable("xo.files");
  assert.deepEqual(owners(), []);
  await kernel.enable("xo.files");
  await kernel.enable("xo.changes");
  assert.deepEqual(owners(), ["xo.changes", "xo.files"], "priority survives reactivation in reverse order");
  key("p", { metaKey: true });
  await new Promise(setImmediate);
  const list = document.querySelector("#qo-list");
  assert.match(list.textContent, /notes\.md/);
  createFile("added.md");
  await new Promise(setImmediate);
  assert.match(list.textContent, /added\.md/, "disk events refresh the open file list");
  await kernel.disable("xo.files");
  createFile("retired.md");
  await new Promise(setImmediate);
  assert.doesNotMatch(list.textContent, /retired\.md/, "retired Files no longer handles disk events");
  await kernel.enable("xo.files");
  createFile("replacement.md");
  await new Promise(setImmediate);
  assert.match(list.textContent, /replacement\.md/);
  const input = document.querySelector("#qo-q");
  input.value = "replacement.md:12";
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
  press("#qo-list [data-i]");
  assert.ok(document.querySelector("#qo").hidden);
  assert.match(document.querySelector("#viewer").textContent, /replacement\.md/);
  chip.remove();
  press("#nv-home");
}
