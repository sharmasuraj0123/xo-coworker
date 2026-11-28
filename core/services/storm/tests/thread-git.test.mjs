import assert from "node:assert/strict";
import test from "node:test";
import { boot, fakeBackend, thread, until } from "../../../../tests/storm-harness.mjs";

const TREE = { exists: true, xo: true, changed: 2, untracked: 1, kept_ignored: 0, local_commits: 0, would_lose: true, error: null, checked_at: "2026-11-27T09:00:00Z" };

test("a thread.git frame replaces the thread's git state whole, tree included", async () => {
  const backend = fakeBackend({ "GET /chat/chats/chat_p/threads": { threads: [thread("a", { git: { branch: "xo/a", commits: 3, unpushed: 3 } })] } });
  const { world } = await boot(backend);
  try {
    await until(() => world.thread("a")?.git?.commits === 3);
    backend.push("thread.git", { seq: 2, chat_id: "chat_p", thread_ts: "a", data: { ts: "a", git: { branch: "xo/a", commits: 1, tree: TREE } } }, 2);
    await until(() => world.thread("a")?.git?.commits === 1);
    assert.deepEqual(world.thread("a").git, { branch: "xo/a", commits: 1, tree: TREE });
    backend.push("thread.git", { seq: 3, chat_id: "chat_p", thread_ts: "a", data: { ts: "a", git: { branch: "xo/a", tree: { exists: "yes" } } } }, 3);
    await until(() => world.state.lastSeq === 3);
    assert.equal(world.thread("a").git.commits, 1, "a malformed frame keeps the last good state");
  } finally { world.dispose(); }
});

test("a tree Space couldn't read the first time arrives with nulls and keeps its thread", async () => {
  const unread = { exists: null, xo: null, changed: null, untracked: null, kept_ignored: null, local_commits: null, would_lose: null, error: "git timed out", checked_at: "2026-11-27T09:00:00Z" };
  const backend = fakeBackend({ "GET /chat/chats/chat_p/threads": { threads: [thread("a", { git: { branch: "xo/a", commits: 1, tree: unread } })] } });
  const { world } = await boot(backend);
  try {
    await until(() => world.thread("a")?.git?.tree?.error === "git timed out");
    backend.push("thread.git", { seq: 2, chat_id: "chat_p", thread_ts: "a", data: { ts: "a", git: { branch: "xo/a", commits: 2, tree: unread } } }, 2);
    await until(() => world.thread("a")?.git?.commits === 2);
    assert.deepEqual(world.state.rejectedFrames.size, 0);
  } finally { world.dispose(); }
});
