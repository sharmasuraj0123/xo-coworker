import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { isMessage } from "../chat-responses.js";
import { api, chatActivityApi } from "../api.js";

const rows = JSON.parse(readFileSync(new URL("./fixtures/chat-reads.json", import.meta.url), "utf8"));
const systemMessage = { ...rows.message, author_kind: "system", author_id: null, author_session_id: null };
const routes = [
  ["/chat/chats", () => chatActivityApi.chats(), { chats: [rows.chat] }, { chats: [{ id: 2 }] }],
  ["/chat/chats/chat_example", () => api.chat("chat_example"), rows.chat, { ...rows.chat, routing: [] }],
  ["/chat/chats/chat_example/threads", () => api.threads("chat_example"), { threads: [rows.thread] }, { threads: false }],
  ["/chat/chats/chat_example/threads/thread_example", () => api.thread("chat_example", "thread_example"), rows.thread, {}],
  ["/chat/chats/chat_example/messages", () => api.messages("chat_example"), { messages: [rows.message, systemMessage], next_after_seq: 1 },
    { messages: [{ ...rows.message, extra: 1 }] }],
  ["/chat/sessions", () => api.sessions(), { sessions: [rows.session], next_after_seq: 2 }, { sessions: null }],
  ["/chat/sessions/session_example", () => api.session("session_example"), rows.session, { ...rows.session, epoch: "1" }],
  ["/chat/events", () => api.events(), { events: [rows.event], next_after_seq: 3 }, { events: [{ ...rows.event, type: 1 }] }],
  ["/chat/active", () => api.active(), { turns: [rows.activeTurn] }, { turns: [{ ...rows.activeTurn, session_id: null }] }],
  ["/chat/chats/chat_example/hops", () => api.hops("chat_example"), { hops: [rows.hop], next_after_seq: 5 },
    { hops: [{ ...rows.hop, via: [{}] }] }],
  ["/chat/chats/chat_example/seen", () => chatActivityApi.markSeen("chat_example"), { seen: rows.chat.seen },
    { seen: { ...rows.chat.seen, seen_seq: [] } }, "PUT"],
  ["/messages/native_example", () => api.observedMessages("native_example"), rows.observed,
    { messages: [{ ...rows.observed.messages[0], parts: [{ data: { type: "text", text: [] } }] }] }],
  ["/chat/prompt", () => api.prompt({ text: "Hi" }), { session_id: "session_example", turn_id: null },
    { session_id: {} }, "POST"],
  ["/chat/abort", () => api.abort("session_example"), { session_id: "session_example", turn_id: null, stopped: false },
    { session_id: "session_example", stopped: "false" }, "POST"],
  ["/chat/chats/chat_example", () => api.patchChat("chat_example", { routing: null }), rows.chat,
    { ...rows.chat, routing: 3 }, "PATCH"],
  ["/chat/sessions/session_example", () => api.patchSession("session_example", { model: "model" }), rows.session,
    { ...rows.session, model: ["model"] }, "PATCH"],
  ["/chat/chats/chat_example/messages", () => api.post("chat_example", { text: "Hi" }), rows.message,
    { ...rows.message, client_id: { id: "bad" } }, "POST"],
  ["/chat/chats/chat_example/threads/thread_example", () => api.patchThread("chat_example", "thread_example", {}), rows.thread,
    { ...rows.thread, title: { bad: "title" } }, "PATCH"],
  ["/chat/chats/chat_example/threads/thread_example", () => api.deleteThread("chat_example", "thread_example", {}),
    { deleted: true, undo_until: "2026-11-23T12:00:00Z" }, { deleted: false }, "DELETE"],
  ["/chat/chats/chat_example/threads/thread_example/restore", () => api.restoreThread("chat_example", "thread_example"), rows.thread,
    { ...rows.thread, ts: null }, "POST"],
  ["/chat/chats/chat_example/threads/thread_example/continue", () => api.continueThread("chat_example", "thread_example", {}),
    { thread_id: "continued_example", agent: "codex" }, { thread_id: [] }, "POST"],
];

for (const [path, read, sample, bad, method = "GET"] of routes) {
  await test(`${method} ${path} checks its published response`, async (t) => {
    let body = sample;
    const mock = t.mock.method(globalThis, "fetch", async (url, init) => {
      assert.equal(url, "api" + path);
      assert.equal(init.method, method);
      return Response.json(body);
    });
    assert.deepEqual(await read(), sample);
    body = bad;
    await assert.rejects(read, { code: "bad_answer" });
    assert.equal(mock.mock.callCount(), 2);
  });
}

test("optional message metadata accepts omission, while an attachment-only message can carry null text", () => {
  assert.ok(isMessage({ id: "m", text: null }));
  assert.equal(isMessage({ id: "m", author_kind: null }), false);
});
