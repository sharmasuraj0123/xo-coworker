import assert from "node:assert/strict";
import test from "node:test";
import { threads } from "../reducers/threads.js";
import { createThreadRecords } from "../thread-reads.js";
import { isThread } from "../../../platform/chat-responses.js";

test("partial thread frames retain identity and malformed projections leave the last valid row intact", () => {
  const threadRecords = createThreadRecords();
  const ctx = { threadRecords, rawThreads: threadRecords.rows, state: {}, soon() {}, fillSession() {}, sessRead: () => ({}) };
  const apply = (data) => threads.thread(ctx, { chat_id: "chat" }, { ts: "thread", ...data });
  const before = { chat_id: "chat", title: "First", card: { happened: "Built" }, outputs: [{ name: "build.log" }] };
  apply(before);
  apply({ title: "Updated" });
  const row = threadRecords.rows.get("thread");
  assert.equal(row.ts, "thread");
  assert.equal(row.chat_id, "chat");
  assert.equal(row.title, "Updated");
  for (const bad of [{ card: { happened: [] } }, { outputs: [{ bytes: "4" }] }, { git: { ahead: [] } }]) {
    assert.equal(isThread({ ts: "thread", ...bad }), false);
    apply(bad);
    assert.ok(row === threadRecords.rows.get("thread"));
  }
});
