// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import * as facade from "../api.js";
import * as transport from "../http.js";

const { api, chatActivityApi } = facade;
const when = "2026-11-23T12:00:00Z";
const chat = "/chat/chats/example";
const trees = "/chat/worktrees";
const branch = {
  merged: false, merged_at: null, commits: null, ahead: null, behind: null, upstream: null,
  pr: { number: null, url: null, state: null, draft: false, merged_at: null },
};
const tree = {
  chat_id: "example", thread_ts: "sample", path: "/example/sample", branch: null, base_commit: null,
  thread_state: "resolved", resolved_at: when, session_id: null, session_state: null, exists: true,
  xo: true, would_lose: null, error: null, removable: true,
  git: { ...branch, branch: null, unpushed: null },
};
const reported = { seq: 4, chat_id: "example", thread_ts: null, path: "/example/manual", reported_at: when, managed: false };
const removed = { ...tree, exists: false, removed_at: when, removed_by: "person" };
const made = {
  id: "example-artifact", chat_id: "example", thread_ts: "sample", kind: "file", source: "attachment", name: "build.md",
  path: "/example/build.md", relative_path: "build.md", project_id: "example", url: null, mime: "text/markdown", bytes: 12,
  title: null, copy_path: null, message_id: null, turn_id: null, where: "project", exists: true,
  created_at: when, updated_at: when, pinned: false, pinned_at: null,
};
const madeBranch = { ...made, id: "example-branch", kind: "branch", path: "xo/example", git: branch };
const memory = { path: "MEMORY.md", version: "example-version" };
const emptyShape = { shape: null, version: "new", updated_at: null };
const nonemptyShape = { shape: { thread: { foreword: "open" } }, version: "example-version", updated_at: when };
const paths = { count: 1, paths: ["build.md"] };
const loss = { summary: "1 untracked file", branch: null, commits: 0, changed: paths, untracked: paths, ignored: paths };

/** @type {[string, string, () => Promise<unknown>, object, object][]} */
const cases = [
  ["GET", trees + "?chat=example", () => chatActivityApi.worktrees("example"), { worktrees: [tree], removed: [removed], reported: [reported] },
    { worktrees: [{ ...tree, error: {} }] }],
  ["DELETE", trees + "/example/sample?confirm=receipt", () => chatActivityApi.removeWorktree("example", "sample", "receipt"),
    { removed: true, forced: true, lost: loss, note: "Removed" }, { removed: true, forced: true, lost: { ...loss, changed: [paths] } }],
  ["GET", chat + "/made?limit=10", () => api.made("example", { limit: 10 }), { made: [made, madeBranch], next_before: null },
    { made: [{ ...made, bytes: "12" }], next_before: null }],
  ["PUT", chat + "/made/example-artifact/pin", () => api.pinMade("example", made.id, true), { ...made, pinned: true, pinned_at: when },
    { ...made, pinned: "yes" }],
  ["DELETE", chat + "/made/example-artifact/pin", () => api.pinMade("example", made.id, false), made, { ...made, id: [] }],
  ["GET", chat + "/memory", () => api.memory("example"), { files: [{ ...memory, bytes: 12 }] },
    { files: [{ ...memory, bytes: "12" }] }],
  ["GET", chat + "/memory/MEMORY.md", () => api.memoryFile("example", memory.path), { ...memory, content: "Example text" },
    { ...memory, content: { text: "Example text" } }],
  ["GET", "/chat/shape", () => api.shape(), emptyShape, { ...emptyShape, version: null }],
  ["PUT", "/chat/shape", () => api.putShape({ shape: nonemptyShape.shape, if_version: "new" }), nonemptyShape,
    { ...nonemptyShape, shape: [] }],
];

for (const [method, path, call, good, bad] of cases) {
  test(`${method} ${path} validates its own response`, async ({ mock }) => {
    let value = good;
    mock.method(globalThis, "fetch", async (url, options) => {
      assert.equal(url, "api" + path);
      assert.equal(options.method, method);
      if (path === "/chat/shape" && method === "PUT") {
        assert.deepEqual(JSON.parse(options.body), { shape: nonemptyShape.shape, if_version: "new" });
      }
      return Response.json(value);
    });
    assert.deepEqual(await call(), good);
    value = bad;
    await assert.rejects(call(), { code: "bad_answer" });
  });
}

test("JSON transport has no unchecked compatibility export", () => {
  assert.equal(Object.hasOwn(facade, "request"), false);
  assert.equal(Object.hasOwn(transport, "request"), false);
});
