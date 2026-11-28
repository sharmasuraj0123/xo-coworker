import assert from "node:assert/strict";
import test from "node:test";
import { applyFileEvent } from "../file-events.js";

test("a rename updates the path index only with both paths", () => {
  const changes = [], events = [];
  function rename(old_path) {
    const data = { kind: "rename", project_id: "p", path: ".xo/worktrees/t/new", old_path };
    applyFileEvent({ kind: "file", data }, { fileChanged: (event) => events.push(event) },
      { changed: (scope, change) => changes.push([scope, change]) });
  }
  rename(7);
  rename(".xo/worktrees/t/old");
  assert.equal(events.length, 2);
  assert.deepEqual(changes, [[{ project: "p", base: ".xo/worktrees/t" }, { kind: "rename", path: "new", old_path: "old" }]]);
});
